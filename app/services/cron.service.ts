import cron from 'node-cron';
import { createBlockVisionService } from './blockvision.service';
import { ContractDetectorService } from './contract-detector.service';
import { DAppClassifierService } from './dapp-classifier.service';
import { ActivityTrackerService } from './activity-tracker.service';

/**
 * Service de gestion des tâches cron pour l'ingestion de données
 */
export class CronService {
  private blockVisionService = createBlockVisionService();
  private contractDetector = new ContractDetectorService(this.blockVisionService);
  private dappClassifier = new DAppClassifierService(this.blockVisionService);
  private activityTracker = new ActivityTrackerService(this.blockVisionService);

  private jobs: cron.ScheduledTask[] = [];

  /**
   * Démarre tous les cron jobs
   */
  start() {
    console.log('Starting cron jobs...');

    // Toutes les 2 minutes : scanner les nouveaux blocks
    if (process.env.ENABLE_BLOCK_SCANNER !== 'false') {
      const blockScannerJob = cron.schedule('*/2 * * * *', async () => {
        console.log('[CRON] Running block scanner...');
        try {
          const count = await this.contractDetector.scanForNewContracts();
          console.log(`[CRON] Block scanner complete: ${count} new contracts`);
        } catch (error) {
          console.error('[CRON] Block scanner error:', error);
        }
      });

      this.jobs.push(blockScannerJob);
      console.log('✓ Block scanner job scheduled (every 2 minutes)');
    }

    // Toutes les 5 minutes : classifier les contrats non assignés
    const classifierJob = cron.schedule('*/5 * * * *', async () => {
      console.log('[CRON] Running dApp classifier...');
      try {
        const count = await this.dappClassifier.classifyUnassignedContracts();
        console.log(`[CRON] Classifier complete: ${count} contracts classified`);
      } catch (error) {
        console.error('[CRON] Classifier error:', error);
      }
    });

    this.jobs.push(classifierJob);
    console.log('✓ DApp classifier job scheduled (every 5 minutes)');

    // Toutes les 10 minutes : mettre à jour l'activité des dApps
    if (process.env.ENABLE_ACTIVITY_TRACKER !== 'false') {
      const activityTrackerJob = cron.schedule('*/10 * * * *', async () => {
        console.log('[CRON] Running activity tracker...');
        try {
          const count = await this.activityTracker.updateAllDAppsActivity();
          console.log(`[CRON] Activity tracker complete: ${count} dApps updated`);
        } catch (error) {
          console.error('[CRON] Activity tracker error:', error);
        }
      });

      this.jobs.push(activityTrackerJob);
      console.log('✓ Activity tracker job scheduled (every 10 minutes)');
    }

    // Tous les jours à 00:00 : nettoyer les vieilles données
    const cleanupJob = cron.schedule('0 0 * * *', async () => {
      console.log('[CRON] Running cleanup...');
      try {
        const count = await this.activityTracker.cleanupOldActivity(90);
        console.log(`[CRON] Cleanup complete: ${count} old records deleted`);

        // Recalculer les stats globales
        const stats = await this.activityTracker.recalculateGlobalStats();
        console.log('[CRON] Global stats:', stats);
      } catch (error) {
        console.error('[CRON] Cleanup error:', error);
      }
    });

    this.jobs.push(cleanupJob);
    console.log('✓ Cleanup job scheduled (daily at midnight)');

    console.log(`All cron jobs started (${this.jobs.length} total)`);
  }

  /**
   * Arrête tous les cron jobs
   */
  stop() {
    console.log('Stopping all cron jobs...');
    this.jobs.forEach((job) => job.stop());
    this.jobs = [];
    console.log('All cron jobs stopped');
  }

  /**
   * Exécute manuellement le scanner de blocks
   */
  async runBlockScanner() {
    console.log('Running block scanner manually...');
    return this.contractDetector.scanForNewContracts();
  }

  /**
   * Exécute manuellement le classifier
   */
  async runClassifier() {
    console.log('Running classifier manually...');
    return this.dappClassifier.classifyUnassignedContracts();
  }

  /**
   * Exécute manuellement le tracker d'activité
   */
  async runActivityTracker() {
    console.log('Running activity tracker manually...');
    return this.activityTracker.updateAllDAppsActivity();
  }

  /**
   * Récupère le statut des jobs
   */
  getJobsStatus() {
    return {
      total: this.jobs.length,
      running: this.jobs.filter((job) => job).length,
      jobs: [
        {
          name: 'Block Scanner',
          schedule: 'Every 2 minutes',
          enabled: process.env.ENABLE_BLOCK_SCANNER !== 'false',
        },
        {
          name: 'DApp Classifier',
          schedule: 'Every 5 minutes',
          enabled: true,
        },
        {
          name: 'Activity Tracker',
          schedule: 'Every 10 minutes',
          enabled: process.env.ENABLE_ACTIVITY_TRACKER !== 'false',
        },
        {
          name: 'Cleanup',
          schedule: 'Daily at midnight',
          enabled: true,
        },
      ],
    };
  }
}

// Singleton instance
let cronServiceInstance: CronService | null = null;

/**
 * Récupère ou crée l'instance du service cron
 */
export function getCronService(): CronService {
  if (!cronServiceInstance) {
    cronServiceInstance = new CronService();
  }
  return cronServiceInstance;
}

/**
 * Démarre les cron jobs (à appeler au démarrage du serveur)
 */
export function startCronJobs() {
  const cronService = getCronService();
  cronService.start();
  return cronService;
}

/**
 * Arrête les cron jobs (à appeler à l'arrêt du serveur)
 */
export function stopCronJobs() {
  if (cronServiceInstance) {
    cronServiceInstance.stop();
    cronServiceInstance = null;
  }
}
