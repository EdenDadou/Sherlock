import { prisma } from '~/lib/db/prisma';
import { DAppStatus } from '@prisma/client';

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

export async function loader() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalDApps,
    totalContracts,
    activeDApps,
    dormantDApps,
    inactiveDApps,
    todayActivity,
    trendingDApps,
    newDApps,
  ] = await Promise.all([
    prisma.dApp.count(),
    prisma.contract.count(),
    prisma.dApp.count({ where: { status: DAppStatus.ACTIVE } }),
    prisma.dApp.count({ where: { status: DAppStatus.DORMANT } }),
    prisma.dApp.count({ where: { status: DAppStatus.INACTIVE } }),
    prisma.activity.findMany({
      where: { date: today },
    }),
    prisma.activity.findMany({
      where: {
        date: {
          gte: today,
        },
      },
      include: {
        dapp: {
          include: {
            contracts: {
              take: 1,
            },
          },
        },
      },
      orderBy: {
        txCount: 'desc',
      },
      take: 10,
    }),
    prisma.dApp.findMany({
      include: {
        contracts: {
          take: 1,
        },
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
      take: 10,
    }),
  ]);

  const totalTxsToday = todayActivity.reduce((sum, a) => sum + a.txCount, 0);
  const totalUsersToday = todayActivity.reduce((sum, a) => sum + a.userCount, 0);

  return json({
    overview: {
      totalDApps,
      totalContracts,
      totalTxsToday,
      totalUsersToday,
      activeDApps,
      dormantDApps,
      inactiveDApps,
    },
    trending: trendingDApps.map((a) => ({
      dapp: {
        id: a.dapp.id,
        name: a.dapp.name,
        category: a.dapp.category,
        status: a.dapp.status,
      },
      txCount: a.txCount,
      userCount: a.userCount,
      eventCount: a.eventCount,
    })),
    new: newDApps.map((dapp) => ({
      id: dapp.id,
      name: dapp.name,
      category: dapp.category,
      status: dapp.status,
      createdAt: dapp.createdAt,
      contractCount: dapp.contracts.length,
      latestActivity: dapp.activities[0] || null,
    })),
  });
}
