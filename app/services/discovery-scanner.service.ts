import { EventEmitter } from 'events';
import { BlockVisionService } from './blockvision.service';
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
  private blockVisionService: BlockVisionService;
  private contractDetectorService: ContractDetectorService;
  private progress: ScanProgress = {
    currentBlock: 0,
    totalBlocks: 40000,
    dappsDiscovered: 0,
    contractsFound: 0,
    progress: 0,
    status: 'idle'
  };

  constructor() {
    super();
    this.blockVisionService = new BlockVisionService({
      apiKey: process.env.BLOCKVISION_API_KEY || '',
      baseUrl: process.env.BLOCKVISION_BASE_URL || 'https://api.blockvision.org',
      chainId: process.env.MONAD_CHAIN_ID || 'monad-testnet'
    });
    this.contractDetectorService = new ContractDetectorService(this.blockVisionService);
  }

  async startScan(): Promise<void> {
    if (this.isScanning) {
      throw new Error('Un scan est déjà en cours');
    }

    this.isScanning = true;
    this.progress = {
      currentBlock: 0,
      totalBlocks: 40000,
      dappsDiscovered: 0,
      contractsFound: 0,
      progress: 0,
      status: 'scanning'
    };

    try {
      const latestBlock = await this.blockVisionService.getLatestBlockNumber();
      const startBlock = Math.max(0, latestBlock - 40000);

      this.emit('progress', this.progress);

      // Scanner par chunks de 1000 blocs
      const chunkSize = 1000;
      for (let block = startBlock; block <= latestBlock; block += chunkSize) {
        if (!this.isScanning) {
          break; // Arrêt demandé
        }

        const endBlock = Math.min(block + chunkSize - 1, latestBlock);

        try {
          // Scanner les contrats dans ce chunk
          await this.contractDetectorService.scanForNewContracts(block);

          // Compter les contrats et dApps
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
          this.progress.currentBlock = endBlock;
          this.progress.progress = Math.round(((endBlock - startBlock) / 40000) * 100);
          this.emit('progress', this.progress);

          // Petit délai pour éviter de surcharger l'API
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`Erreur lors du scan du chunk ${block}-${endBlock}:`, error);
          // Continue avec le prochain chunk malgré l'erreur
        }
      }

      this.progress.status = 'completed';
      this.progress.progress = 100;
      this.emit('progress', this.progress);
      this.emit('completed', this.progress);

    } catch (error) {
      this.progress.status = 'error';
      this.progress.error = error instanceof Error ? error.message : 'Erreur inconnue';
      this.emit('error', this.progress);
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
