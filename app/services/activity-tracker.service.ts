import { prisma } from '~/lib/db/prisma';
import { BlockVisionService } from './blockvision.service';
import { DAppStatus } from '@prisma/client';

/**
 * Service pour tracker l'activité des dApps
 */
export class ActivityTrackerService {
  constructor(private blockVisionService: BlockVisionService) {}

  /**
   * Met à jour l'activité de toutes les dApps
   */
  async updateAllDAppsActivity(): Promise<number> {
    const dapps = await prisma.dApp.findMany({
      include: {
        contracts: true,
      },
    });

    let updated = 0;

    for (const dapp of dapps) {
      try {
        await this.updateDAppActivity(dapp.id);
        updated++;
      } catch (error) {
        console.error(`Error updating activity for dApp ${dapp.id}:`, error);
      }

      // Petit délai pour respecter les rate limits
      await this.sleep(200);
    }

    console.log(`Updated activity for ${updated} dApps`);
    return updated;
  }

  /**
   * Met à jour l'activité d'une dApp spécifique
   */
  async updateDAppActivity(dappId: string): Promise<void> {
    const dapp = await prisma.dApp.findUnique({
      where: { id: dappId },
      include: { contracts: true },
    });

    if (!dapp) {
      throw new Error(`DApp ${dappId} not found`);
    }

    if (dapp.contracts.length === 0) {
      console.log(`DApp ${dappId} has no contracts`);
      return;
    }

    // Calculer l'activité pour aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date();
    const startDate = new Date(today);

    let totalTxCount = 0;
    let totalEventCount = 0;
    let totalGasUsed = BigInt(0);
    const uniqueUsers = new Set<string>();

    // Agréger l'activité de tous les contrats
    for (const contract of dapp.contracts) {
      try {
        const activity = await this.blockVisionService.getAccountActivity(
          contract.address,
          startDate,
          endDate
        );

        totalTxCount += activity.txCount;
        totalGasUsed += activity.totalGasUsed;

        // Ajouter les utilisateurs uniques
        activity.uniqueUsers.forEach((user) => uniqueUsers.add(user));

        // Compter les événements
        const events = await this.blockVisionService.getContractEvents(contract.address, {
          pageSize: 100,
        });
        totalEventCount += events.data.length;
      } catch (error) {
        console.error(`Error getting activity for contract ${contract.address}:`, error);
      }
    }

    // Enregistrer ou mettre à jour l'activité
    await prisma.activity.upsert({
      where: {
        dappId_date: {
          dappId: dappId,
          date: today,
        },
      },
      create: {
        dappId: dappId,
        date: today,
        txCount: totalTxCount,
        userCount: uniqueUsers.size,
        eventCount: totalEventCount,
        gasUsed: totalGasUsed,
      },
      update: {
        txCount: totalTxCount,
        userCount: uniqueUsers.size,
        eventCount: totalEventCount,
        gasUsed: totalGasUsed,
      },
    });

    // Mettre à jour le statut de la dApp
    await this.updateDAppStatus(dappId);

    console.log(`Updated activity for dApp ${dappId}: ${totalTxCount} txs, ${uniqueUsers.size} users`);
  }

  /**
   * Met à jour le statut d'une dApp basé sur son activité récente
   */
  private async updateDAppStatus(dappId: string): Promise<void> {
    // Récupérer l'activité des 7 derniers jours
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivity = await prisma.activity.findMany({
      where: {
        dappId: dappId,
        date: {
          gte: sevenDaysAgo,
        },
      },
    });

    let status: DAppStatus;

    if (recentActivity.length === 0) {
      status = DAppStatus.INACTIVE;
    } else {
      const totalTxs = recentActivity.reduce((sum, a) => sum + a.txCount, 0);
      const avgTxsPerDay = totalTxs / recentActivity.length;

      if (avgTxsPerDay > 10) {
        status = DAppStatus.ACTIVE;
      } else if (avgTxsPerDay > 1) {
        status = DAppStatus.DORMANT;
      } else {
        status = DAppStatus.INACTIVE;
      }
    }

    await prisma.dApp.update({
      where: { id: dappId },
      data: { status },
    });
  }

  /**
   * Récupère les statistiques d'activité d'une dApp
   */
  async getDAppStats(dappId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activities = await prisma.activity.findMany({
      where: {
        dappId: dappId,
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    const totalTxs = activities.reduce((sum, a) => sum + a.txCount, 0);
    const totalUsers = activities.reduce((sum, a) => sum + a.userCount, 0);
    const totalEvents = activities.reduce((sum, a) => sum + a.eventCount, 0);
    const totalGas = activities.reduce((sum, a) => sum + Number(a.gasUsed), 0);

    const avgTxsPerDay = activities.length > 0 ? totalTxs / activities.length : 0;
    const avgUsersPerDay = activities.length > 0 ? totalUsers / activities.length : 0;

    return {
      days,
      totalTxs,
      totalUsers,
      totalEvents,
      totalGas,
      avgTxsPerDay,
      avgUsersPerDay,
      dailyActivities: activities.map((a) => ({
        date: a.date,
        txCount: a.txCount,
        userCount: a.userCount,
        eventCount: a.eventCount,
        gasUsed: a.gasUsed.toString(),
      })),
    };
  }

  /**
   * Récupère les dApps les plus actives
   */
  async getTrendingDApps(limit: number = 10) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const activities = await prisma.activity.findMany({
      where: {
        date: {
          gte: yesterday,
        },
      },
      include: {
        dapp: {
          include: {
            contracts: true,
          },
        },
      },
      orderBy: {
        txCount: 'desc',
      },
      take: limit,
    });

    return activities.map((a) => ({
      dapp: a.dapp,
      txCount: a.txCount,
      userCount: a.userCount,
      eventCount: a.eventCount,
    }));
  }

  /**
   * Récupère les nouvelles dApps
   */
  async getNewDApps(limit: number = 10) {
    return prisma.dApp.findMany({
      include: {
        contracts: true,
        activities: {
          take: 1,
          orderBy: {
            date: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Nettoie les anciennes données d'activité
   */
  async cleanupOldActivity(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.activity.deleteMany({
      where: {
        date: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`Deleted ${result.count} old activity records`);
    return result.count;
  }

  /**
   * Recalcule les statistiques globales
   */
  async recalculateGlobalStats() {
    const totalDApps = await prisma.dApp.count();
    const totalContracts = await prisma.contract.count();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayActivity = await prisma.activity.findMany({
      where: {
        date: today,
      },
    });

    const totalTxsToday = todayActivity.reduce((sum, a) => sum + a.txCount, 0);
    const totalUsersToday = todayActivity.reduce((sum, a) => sum + a.userCount, 0);

    return {
      totalDApps,
      totalContracts,
      totalTxsToday,
      totalUsersToday,
      activeDApps: await prisma.dApp.count({
        where: { status: DAppStatus.ACTIVE },
      }),
      dormantDApps: await prisma.dApp.count({
        where: { status: DAppStatus.DORMANT },
      }),
      inactiveDApps: await prisma.dApp.count({
        where: { status: DAppStatus.INACTIVE },
      }),
    };
  }

  /**
   * Utilitaire pour ajouter un délai
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
