import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { EnvioConfig, HyperSyncQuery, EnvioTransaction } from '~/types/envio';

/**
 * Client pour l'API Envio HyperSync
 * Utilise HyperSync pour un accès ultra-rapide aux données Monad
 */
export class EnvioService {
  private client: AxiosInstance;
  private config: EnvioConfig;
  private readonly BATCH_SIZE = 1000; // Nombre de blocs par requête

  constructor(config: EnvioConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.hyperSyncUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 secondes pour les grosses requêtes
    });

    // Intercepteur pour logger les erreurs
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Envio HyperSync Error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          data: error.response?.data,
        });
        throw error;
      }
    );
  }

  /**
   * Récupère les transactions de déploiement de contrats dans une plage de blocs
   */
  async getContractDeployments(
    fromBlock: number,
    toBlock: number
  ): Promise<EnvioTransaction[]> {
    try {
      // Essayer de récupérer toutes les transactions du range
      // HyperSync pourrait ne pas supporter le filtre "to: null" comme attendu
      const query: HyperSyncQuery = {
        from_block: fromBlock,
        to_block: toBlock,
        // Ne pas filtrer ici, récupérer toutes les transactions
        field_selection: {
          transaction: [
            'hash',
            'from',
            'to',
            'block_number',
            'timestamp',
            'input',
            'value',
            'gas_used',
            'gas_price',
            'status',
          ],
        },
      };

      const response = await this.client.post('/query', query);

      console.log(`Batch ${fromBlock}-${toBlock}: ${response.data.data?.length || 0} transactions récupérées`);

      // Les données sont dans response.data.data au lieu de response.data.transactions
      const allTransactions = response.data.data || [];

      // Filtrer côté client pour trouver les déploiements
      // Un déploiement a: to === null/undefined/"0x0000..." et input commence par du bytecode
      const deployments = allTransactions.filter((tx: any) => {
        const isDeployment = (
          (!tx.to || tx.to === '0x0000000000000000000000000000000000000000') &&
          tx.input &&
          tx.input.length > 2 // Le bytecode doit être présent
        );

        if (isDeployment) {
          console.log(`🔍 Déploiement potentiel trouvé: ${tx.hash}`);
        }

        return isDeployment;
      }).map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        blockNumber: tx.block_number,
        timestamp: tx.timestamp,
        input: tx.input,
        value: tx.value,
        gasUsed: tx.gas_used,
        gasPrice: tx.gas_price,
        status: tx.status,
        contractAddress: null, // On devra calculer l'adresse du contrat
      }));

      console.log(`✓ ${deployments.length} déploiements trouvés dans ce batch`);
      return deployments;
    } catch (error) {
      console.error(`Erreur lors de la récupération des déploiements (blocs ${fromBlock}-${toBlock}):`, error);
      return [];
    }
  }

  /**
   * Récupère la hauteur actuelle de la blockchain
   */
  async getCurrentBlock(): Promise<number> {
    try {
      // Méthode 1: Essayer via HyperSync
      try {
        const query: HyperSyncQuery = {
          from_block: 0,
          field_selection: {
            block: ['number'],
          },
        };

        const response = await this.client.post('/query', query);

        // Debugger la réponse pour comprendre sa structure
        console.log('HyperSync Response data keys:', Object.keys(response.data));
        console.log('HyperSync Response data:', JSON.stringify(response.data, null, 2));

        // Essayer différentes propriétés possibles
        const currentBlock = response.data.archiveHeight ||
                            response.data.archive_height ||
                            response.data.nextBlock ||
                            response.data.next_block ||
                            response.data.height ||
                            0;

        if (currentBlock > 0) {
          console.log('✓ Current block via HyperSync:', currentBlock);
          return currentBlock;
        }
      } catch (hyperSyncError) {
        console.log('HyperSync height query failed, trying RPC fallback...');
      }

      // Méthode 2: Fallback sur RPC Monad directement
      const rpcUrl = process.env.VITE_MONAD_RPC_URL || 'https://monad-testnet.g.alchemy.com/v2/demo';
      console.log('Trying RPC at:', rpcUrl);

      const rpcResponse = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      });

      const blockHex = rpcResponse.data.result;
      const blockNumber = parseInt(blockHex, 16);
      console.log('✓ Current block via RPC:', blockNumber);

      return blockNumber;
    } catch (error) {
      console.error('Erreur lors de la récupération du bloc actuel:', error);
      // Si tout échoue, retourner un bloc raisonnable pour Monad testnet
      const fallbackBlock = 100000; // Valeur de secours raisonnable
      console.log(`⚠️ Utilisation du bloc de secours: ${fallbackBlock}`);
      return fallbackBlock;
    }
  }

  /**
   * Découvre les contrats déployés en scannant les blocs récents
   * Méthode optimisée avec batching pour éviter de surcharger l'API
   */
  async discoverContracts(options?: {
    fromBlock?: number;
    maxBlocks?: number;
    maxContracts?: number;
  }): Promise<Array<{ address: string; deployer: string; timestamp: number; blockNumber: number }>> {
    const contracts: Array<{ address: string; deployer: string; timestamp: number; blockNumber: number }> = [];
    const maxContracts = options?.maxContracts || 100;
    const maxBlocks = options?.maxBlocks || 10000;

    console.log('🔍 Récupération de la hauteur actuelle de la blockchain...');
    const currentBlock = await this.getCurrentBlock();
    const startBlock = options?.fromBlock || Math.max(0, currentBlock - maxBlocks);

    console.log(`📊 Scan des blocs ${startBlock} à ${currentBlock} (${currentBlock - startBlock} blocs)`);

    // Découper en batches pour éviter les timeouts
    let currentBatchStart = startBlock;
    while (currentBatchStart < currentBlock && contracts.length < maxContracts) {
      const batchEnd = Math.min(currentBatchStart + this.BATCH_SIZE, currentBlock);

      console.log(`Analyse du batch: blocs ${currentBatchStart} à ${batchEnd}...`);

      try {
        const deployments = await this.getContractDeployments(currentBatchStart, batchEnd);

        for (const tx of deployments) {
          if (!tx.contractAddress) continue;

          contracts.push({
            address: tx.contractAddress,
            deployer: tx.from,
            timestamp: tx.timestamp,
            blockNumber: tx.blockNumber,
          });

          console.log(
            `✓ Contrat découvert: ${tx.contractAddress} (${contracts.length}/${maxContracts})`
          );

          // Arrêter si on a atteint la limite
          if (contracts.length >= maxContracts) {
            console.log(`Limite de ${maxContracts} contrats atteinte`);
            break;
          }
        }

        // Délai entre les batches pour éviter le rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Erreur lors du scan du batch ${currentBatchStart}-${batchEnd}:`, error);
        // Continuer avec le batch suivant
      }

      currentBatchStart = batchEnd;

      // Arrêter si on a atteint la limite de contrats
      if (contracts.length >= maxContracts) {
        break;
      }
    }

    console.log(`Découverte terminée: ${contracts.length} contrats trouvés`);
    return contracts;
  }

  /**
   * Récupère les logs d'un contrat spécifique pour analyser son activité
   */
  async getContractLogs(
    contractAddress: string,
    fromBlock: number,
    toBlock: number
  ): Promise<any[]> {
    try {
      const query: HyperSyncQuery = {
        from_block: fromBlock,
        to_block: toBlock,
        logs: [
          {
            address: [contractAddress],
          },
        ],
        field_selection: {
          log: ['address', 'topics', 'data', 'blockNumber', 'transactionHash', 'logIndex'],
        },
      };

      const response = await this.client.post('/query', query);
      return response.data.logs || [];
    } catch (error) {
      console.error(`Erreur lors de la récupération des logs pour ${contractAddress}:`, error);
      return [];
    }
  }

  /**
   * Estime l'activité d'un contrat en comptant ses logs/événements
   */
  async getContractActivity(
    contractAddress: string,
    maxBlocks: number = 10000
  ): Promise<{ logCount: number; isActive: boolean }> {
    try {
      const currentBlock = await this.getCurrentBlock();
      const fromBlock = Math.max(0, currentBlock - maxBlocks);

      const logs = await this.getContractLogs(contractAddress, fromBlock, currentBlock);

      return {
        logCount: logs.length,
        isActive: logs.length > 0,
      };
    } catch (error) {
      console.error(`Erreur lors de l'analyse de l'activité du contrat ${contractAddress}:`, error);
      return {
        logCount: 0,
        isActive: false,
      };
    }
  }
}

// Factory function pour créer une instance du service
export function createEnvioService(): EnvioService {
  const config: EnvioConfig = {
    hyperSyncUrl: process.env.ENVIO_HYPERSYNC_URL || 'https://monad-testnet.hypersync.xyz',
    chainId: process.env.MONAD_CHAIN_ID || 'monad-testnet',
  };

  return new EnvioService(config);
}
