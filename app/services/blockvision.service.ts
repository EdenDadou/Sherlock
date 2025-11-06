import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type {
  BlockVisionConfig,
  Transaction,
  TransactionReceipt,
  Block,
  AccountTransaction,
  Token,
  ContractEvent,
  Log,
  PaginatedResponse,
} from '~/types/blockvision';

/**
 * Client pour l'API BlockVision Monad Indexing
 */
export class BlockVisionService {
  private client: AxiosInstance;
  private config: BlockVisionConfig;

  constructor(config: BlockVisionConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Intercepteur pour logger les erreurs
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('BlockVision API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
        });
        throw error;
      }
    );
  }

  /**
   * Récupère les informations d'un block
   */
  async getBlock(blockNumber: number | 'latest'): Promise<Block> {
    const response = await this.client.get(`/monad/${this.config.chainId}/block/${blockNumber}`);
    return response.data;
  }

  /**
   * Récupère une transaction par son hash
   */
  async getTransaction(txHash: string): Promise<Transaction> {
    const response = await this.client.get(`/monad/${this.config.chainId}/transaction/${txHash}`);
    return response.data;
  }

  /**
   * Récupère le receipt d'une transaction
   */
  async getTransactionReceipt(txHash: string): Promise<TransactionReceipt> {
    const response = await this.client.get(
      `/monad/${this.config.chainId}/transaction/${txHash}/receipt`
    );
    return response.data;
  }

  /**
   * Récupère les transactions d'une adresse
   */
  async getAccountTransactions(
    address: string,
    options?: {
      page?: number;
      pageSize?: number;
      startBlock?: number;
      endBlock?: number;
    }
  ): Promise<PaginatedResponse<AccountTransaction>> {
    const params = {
      page: options?.page || 1,
      pageSize: options?.pageSize || 50,
      startBlock: options?.startBlock,
      endBlock: options?.endBlock,
    };

    const response = await this.client.get(
      `/monad/${this.config.chainId}/account/${address}/transactions`,
      { params }
    );
    return response.data;
  }

  /**
   * Récupère les tokens d'une adresse
   */
  async getAccountTokens(address: string): Promise<Token[]> {
    const response = await this.client.get(`/monad/${this.config.chainId}/account/${address}/tokens`);
    return response.data.tokens || [];
  }

  /**
   * Récupère les événements d'un contrat
   */
  async getContractEvents(
    contractAddress: string,
    options?: {
      eventSignature?: string;
      fromBlock?: number;
      toBlock?: number;
      page?: number;
      pageSize?: number;
    }
  ): Promise<PaginatedResponse<ContractEvent>> {
    const params = {
      eventSignature: options?.eventSignature,
      fromBlock: options?.fromBlock,
      toBlock: options?.toBlock,
      page: options?.page || 1,
      pageSize: options?.pageSize || 50,
    };

    const response = await this.client.get(
      `/monad/${this.config.chainId}/contract/${contractAddress}/events`,
      { params }
    );
    return response.data;
  }

  /**
   * Recherche de logs avec filtres
   */
  async getLogs(options: {
    fromBlock?: number;
    toBlock?: number;
    address?: string | string[];
    topics?: (string | string[] | null)[];
  }): Promise<Log[]> {
    const response = await this.client.post(`/monad/${this.config.chainId}/logs`, options);
    return response.data.logs || [];
  }

  /**
   * Récupère le dernier numéro de block
   */
  async getLatestBlockNumber(): Promise<number> {
    const block = await this.getBlock('latest');
    return parseInt(block.number, 16);
  }

  /**
   * Récupère le bytecode d'un contrat
   */
  async getContractCode(address: string): Promise<string> {
    const response = await this.client.get(`/monad/${this.config.chainId}/contract/${address}/code`);
    return response.data.code || '0x';
  }

  /**
   * Scan d'un range de blocks pour détecter les déploiements de contrats
   */
  async scanBlocksForContracts(fromBlock: number, toBlock: number): Promise<Transaction[]> {
    const contracts: Transaction[] = [];

    for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
      try {
        const block = await this.getBlock(blockNum);

        if (Array.isArray(block.transactions) && block.transactions.length > 0) {
          for (const tx of block.transactions) {
            // Si la transaction est juste un hash, on doit la récupérer
            const txData = typeof tx === 'string' ? await this.getTransaction(tx) : tx;

            // Vérifier si c'est un déploiement de contrat (to === null)
            if (!txData.to) {
              const receipt = await this.getTransactionReceipt(txData.hash);
              if (receipt.contractAddress) {
                contracts.push({
                  ...txData,
                  contractAddress: receipt.contractAddress,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning block ${blockNum}:`, error);
      }
    }

    return contracts;
  }

  /**
   * Obtenir les statistiques d'activité pour une adresse
   */
  async getAccountActivity(
    address: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    txCount: number;
    uniqueUsers: Set<string>;
    totalGasUsed: bigint;
  }> {
    const transactions = await this.getAccountTransactions(address, {
      pageSize: 100,
    });

    const uniqueUsers = new Set<string>();
    let totalGasUsed = BigInt(0);

    for (const tx of transactions.data) {
      const txTimestamp = new Date(parseInt(tx.timestamp) * 1000);
      if (txTimestamp >= startDate && txTimestamp <= endDate) {
        uniqueUsers.add(tx.from);
        if (tx.to) uniqueUsers.add(tx.to);
      }
    }

    return {
      txCount: transactions.data.length,
      uniqueUsers,
      totalGasUsed,
    };
  }
}

// Factory function pour créer une instance du service
export function createBlockVisionService(): BlockVisionService {
  const config: BlockVisionConfig = {
    apiKey: process.env.BLOCKVISION_API_KEY || '',
    baseUrl: process.env.BLOCKVISION_BASE_URL || 'https://api.blockvision.org/v1',
    chainId: process.env.MONAD_CHAIN_ID || 'monad-testnet',
  };

  if (!config.apiKey) {
    throw new Error('BLOCKVISION_API_KEY environment variable is required');
  }

  return new BlockVisionService(config);
}
