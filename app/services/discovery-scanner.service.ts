import { EventEmitter } from 'events';
import { EnvioService } from './envio.service';
import { ContractDetectorService } from './contract-detector.service';
import { prisma } from '~/lib/db/prisma';

export interface ScanProgress {
  currentBlock: number;
  totalBlocks: number;
  dappsDiscovered: number;
  contractsFound: number;
  progress: number;
  status: 'idle' | 'scanning' | 'completed' | 'error';
  error?: string;
}

export interface DiscoveredDApp {
  id: string;
  name: string | null;
  description: string | null;
  category: string;
  contractCount: number;
  contracts: Array<{
    address: string;
    type: string;
    deploymentDate: Date;
  }>;
  discoveredAt: Date;
}

class DiscoveryScannerService extends EventEmitter {
  private isScanning = false;
  private envioService: EnvioService;
  private contractDetectorService: ContractDetectorService;
  private progress: ScanProgress = {
    currentBlock: 0,
    totalBlocks: 10000,
    dappsDiscovered: 0,
    contractsFound: 0,
    progress: 0,
    status: 'idle'
  };

  constructor() {
    super();
    this.envioService = new EnvioService({
      hyperSyncUrl: process.env.ENVIO_HYPERSYNC_URL || 'https://monad-testnet.hypersync.xyz',
      chainId: process.env.MONAD_CHAIN_ID || 'monad-testnet'
    });
    this.contractDetectorService = new ContractDetectorService(this.envioService as any);
  }

  async startScan(): Promise<void> {
    if (this.isScanning) {
      throw new Error('Un scan est déjà en cours');
    }

    this.isScanning = true;
    this.progress = {
      currentBlock: 0,
      totalBlocks: 10000, // Scan des 10000 derniers blocs
      dappsDiscovered: 0,
      contractsFound: 0,
      progress: 0,
      status: 'scanning'
    };

    try {
      console.log('🔍 Démarrage de la découverte de contrats avec Envio HyperSync...');
      this.emit('progress', this.progress);

      // Utiliser Envio HyperSync pour une découverte ultra-rapide
      const discoveredContracts = await this.envioService.discoverContracts({
        maxBlocks: 10000, // Scanner les 10000 derniers blocs
        maxContracts: 100, // Limiter à 100 contrats
      });

      console.log(`✓ ${discoveredContracts.length} contrats découverts`);

      // Traiter chaque contrat découvert
      for (const contract of discoveredContracts) {
        if (!this.isScanning) {
          break; // Arrêt demandé
        }

        try {
          // Sauvegarder le contrat dans la base de données
          await this.contractDetectorService.saveContract(
            contract.address,
            contract.deployer,
            new Date(contract.timestamp * 1000)
          );

          // Récupérer l'activité du contrat pour déterminer sa popularité
          const activity = await this.envioService.getContractActivity(contract.address, 5000);

          // Si le contrat a des logs, c'est probablement un contrat actif
          if (activity.isActive && activity.logCount > 0) {
            await this.contractDetectorService.analyzeAndGroupContract(
              contract.address,
              activity.logCount
            );
          }

          // Mettre à jour les statistiques
          this.progress.contractsFound = await prisma.contract.count();
          this.progress.dappsDiscovered = await prisma.dApp.count();

          // Récupérer les dernières dApps créées
          const recentDApps = await prisma.dApp.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' }
          });

          // Émettre les événements pour les nouvelles dApps
          for (const dapp of recentDApps) {
            const discoveredDApp = await this.formatDiscoveredDApp(dapp.id);
            this.emit('dapp-discovered', discoveredDApp);
          }

          // Mettre à jour la progression
          this.progress.currentBlock++;
          this.progress.progress = Math.round((this.progress.currentBlock / discoveredContracts.length) * 100);
          this.emit('progress', this.progress);

        } catch (error) {
          console.error(`Erreur lors du traitement du contrat ${contract.address}:`, error);
          // Continue avec le contrat suivant
        }
      }

      this.progress.status = 'completed';
      this.progress.progress = 100;
      this.emit('progress', this.progress);
      this.emit('completed', this.progress);
      console.log('✓ Découverte terminée avec succès');

    } catch (error) {
      this.progress.status = 'error';
      this.progress.error = error instanceof Error ? error.message : 'Erreur inconnue';
      this.emit('error', this.progress);
      console.error('❌ Erreur lors du scan:', error);
      throw error;
    } finally {
      this.isScanning = false;
    }
  }

  async stopScan(): Promise<void> {
    this.isScanning = false;
    this.progress.status = 'idle';
    this.emit('stopped', this.progress);
  }

  getProgress(): ScanProgress {
    return { ...this.progress };
  }


  private async formatDiscoveredDApp(dappId: string): Promise<DiscoveredDApp> {
    const dapp = await prisma.dApp.findUnique({
      where: { id: dappId },
      include: {
        contracts: {
          orderBy: { deploymentDate: 'desc' },
          take: 5
        }
      }
    });

    if (!dapp) {
      throw new Error('DApp not found');
    }

    return {
      id: dapp.id,
      name: dapp.name,
      description: dapp.description,
      category: dapp.category,
      contractCount: dapp.contracts.length,
      contracts: dapp.contracts.map((c: any) => ({
        address: c.address,
        type: c.type,
        deploymentDate: c.deploymentDate
      })),
      discoveredAt: dapp.createdAt
    };
  }
}

export const discoveryScannerService = new DiscoveryScannerService();
