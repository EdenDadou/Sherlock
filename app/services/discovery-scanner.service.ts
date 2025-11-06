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
  private emittedDAppIds = new Set<string>(); // Suivre les dApps déjà émises
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
    this.emittedDAppIds.clear(); // Réinitialiser le suivi des dApps émises
    this.progress = {
      currentBlock: 0,
      totalBlocks: 1000, // Scan des 1000 derniers blocs (réduit pour éviter timeouts)
      dappsDiscovered: 0,
      contractsFound: 0,
      progress: 0,
      status: 'scanning'
    };

    try {
      console.log('🔍 Démarrage de la découverte de contrats avec Envio HyperSync...');
      this.emit('progress', this.progress);

      // Utiliser Envio HyperSync pour découvrir les dApps actives
      const discoveredContracts = await this.envioService.discoverContracts({
        maxBlocks: 1000, // Analyser les 1000 derniers blocs (réduit pour éviter timeouts)
        maxContracts: 500, // Top 500 contrats les plus actifs
        maxDApps: 5, // Limite à 5 dApps uniques
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

          // Utiliser directement l'eventCount qu'on a déjà récupéré
          // Pas besoin de rappeler getContractActivity() - on a déjà les données !
          const eventCount = (contract as any).eventCount || 0;

          // Si le contrat a des événements, c'est probablement un contrat actif
          if (eventCount > 0) {
            await this.contractDetectorService.analyzeAndGroupContract(
              contract.address,
              eventCount
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

          // Émettre les événements UNIQUEMENT pour les NOUVELLES dApps (pas encore émises)
          for (const dapp of recentDApps) {
            if (!this.emittedDAppIds.has(dapp.id)) {
              const discoveredDApp = await this.formatDiscoveredDApp(dapp.id);
              this.emit('dapp-discovered', discoveredDApp);
              this.emittedDAppIds.add(dapp.id); // Marquer comme émise
            }
          }

          // Mettre à jour la progression
          const contractsProcessed = discoveredContracts.indexOf(contract) + 1;
          this.progress.currentBlock = contractsProcessed; // Utilise le même champ mais change la sémantique
          this.progress.progress = Math.round((contractsProcessed / discoveredContracts.length) * 100);
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
