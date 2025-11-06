import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type {
  BlockVisionConfig,
  AccountTransaction,
  Token,
  PaginatedResponse,
  NativeHolder,
  TokenHolder,
} from '~/types/blockvision';

/**
 * Client pour l'API BlockVision Monad Indexing v2
 * Utilise les endpoints d'indexation de haut niveau, pas les endpoints de bloc/RPC
 */
export class BlockVisionService {
  private client: AxiosInstance;
  private config: BlockVisionConfig;

  constructor(config: BlockVisionConfig) {
    this.config = config;
    // L'API v2 utilise api.blockvision.org, pas monad-testnet.blockvision.org
    const baseURL = config.baseUrl.includes('api.blockvision.org')
      ? config.baseUrl
      : 'https://api.blockvision.org/v2';

    this.client = axios.create({
      baseURL,
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
          data: error.response?.data,
        });
        throw error;
      }
    );
  }

  /**
   * Récupère les holders du token natif MON (adresses actives sur le réseau)
   */
  async getNativeHolders(options?: {
    cursor?: string;
    limit?: number;
  }): Promise<PaginatedResponse<NativeHolder>> {
    const params: any = {
      limit: options?.limit || 50,
    };

    if (options?.cursor) {
      params.cursor = options.cursor;
    }

    const response = await this.client.get('/monad/native/holders', { params });
    return response.data;
  }

  /**
   * Récupère les transactions d'une adresse
   */
  async getAccountTransactions(
    address: string,
    options?: {
      cursor?: string;
      limit?: number;
      ascendingOrder?: boolean;
    }
  ): Promise<PaginatedResponse<AccountTransaction>> {
    const params: any = {
      address,
      limit: options?.limit || 50,
      ascendingOrder: options?.ascendingOrder ?? false,
    };

    if (options?.cursor) {
      params.cursor = options.cursor;
    }

    const response = await this.client.get('/monad/account/transactions', { params });
    return response.data;
  }

  /**
   * Récupère les tokens d'une adresse
   */
  async getAccountTokens(
    address: string,
    options?: {
      cursor?: string;
      limit?: number;
    }
  ): Promise<PaginatedResponse<Token>> {
    const params: any = {
      address,
      limit: options?.limit || 50,
    };

    if (options?.cursor) {
      params.cursor = options.cursor;
    }

    const response = await this.client.get('/monad/account/tokens', { params });
    return response.data;
  }

  /**
   * Récupère les holders d'un token spécifique
   */
  async getTokenHolders(
    contractAddress: string,
    options?: {
      cursor?: string;
      limit?: number;
    }
  ): Promise<PaginatedResponse<TokenHolder>> {
    const params: any = {
      contractAddress,
      limit: options?.limit || 50,
    };

    if (options?.cursor) {
      params.cursor = options.cursor;
    }

    const response = await this.client.get('/monad/token/holders', { params });
    return response.data;
  }

  /**
   * Effectue une requête avec retry et exponential backoff en cas de rate limiting
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const isRateLimited = error?.response?.status === 429;
        const isLastAttempt = attempt === maxRetries - 1;

        if (!isRateLimited || isLastAttempt) {
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s, etc.
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Découvrir les contrats déployés en analysant les transactions des adresses actives
   * Cette méthode utilise une approche intelligente sans scanner tous les blocs
   */
  async discoverContracts(options?: {
    maxHolders?: number;
    maxTransactionsPerAddress?: number;
    maxContracts?: number;
  }): Promise<Array<{ address: string; deployer: string; timestamp: number }>> {
    const contracts: Array<{ address: string; deployer: string; timestamp: number }> = [];
    const processedAddresses = new Set<string>();
    const maxContracts = options?.maxContracts || 100;

    console.log('Récupération des holders du token natif MON...');

    // 1. Récupérer les holders du token natif (adresses actives)
    let holdersCursor: string | undefined;
    let holdersProcessed = 0;
    const maxHolders = options?.maxHolders || 100;

    while (holdersProcessed < maxHolders) {
      try {
        const holdersResponse = await this.retryWithBackoff(() =>
          this.getNativeHolders({
            cursor: holdersCursor,
            limit: 50,
          })
        );

        if (!holdersResponse.result?.data || holdersResponse.result.data.length === 0) {
          console.log('Aucun holder supplémentaire trouvé');
          break;
        }

        console.log(`Traitement de ${holdersResponse.result.data.length} holders...`);

        // 2. Pour chaque holder, récupérer ses transactions
        for (const holder of holdersResponse.result.data) {
          // Utiliser accountAddress ou holder comme adresse
          const holderAddress = holder.accountAddress || holder.holder;

          // Valider que l'adresse existe et n'est pas vide
          if (!holderAddress || typeof holderAddress !== 'string') {
            console.warn('Holder avec adresse invalide détecté, ignoré:', holder);
            continue;
          }

          if (processedAddresses.has(holderAddress)) {
            continue;
          }
          processedAddresses.add(holderAddress);

          try {
            console.log(`Analyse des transactions de ${holderAddress}...`);

            // Utiliser retry avec backoff pour les transactions
            const txResponse = await this.retryWithBackoff(() =>
              this.getAccountTransactions(holderAddress, {
                limit: options?.maxTransactionsPerAddress || 50,
              })
            );

            // 3. Identifier les déploiements de contrats
            if (txResponse.result?.data) {
              for (const tx of txResponse.result.data) {
                // Un déploiement de contrat a: to === null et contractAddress !== null
                if (!tx.to && tx.contractAddress) {
                  contracts.push({
                    address: tx.contractAddress,
                    deployer: tx.from.address,
                    timestamp: parseInt(tx.timestamp),
                  });
                  console.log(`✓ Contrat découvert: ${tx.contractAddress} (${contracts.length}/${maxContracts})`);

                  // Arrêter si on a atteint la limite de contrats
                  if (contracts.length >= maxContracts) {
                    console.log(`Limite de ${maxContracts} contrats atteinte`);
                    break;
                  }
                }
              }
            }

            // Arrêter la boucle externe si on a atteint la limite
            if (contracts.length >= maxContracts) {
              break;
            }
          } catch (error: any) {
            // Ne pas arrêter tout le processus si une adresse échoue
            const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
            console.error(`Erreur lors de l'analyse de ${holderAddress}: ${errorMsg}`);

            // Si c'est une erreur de rate limit persistante, faire une pause plus longue
            if (error?.response?.status === 429) {
              console.log('Rate limit détecté, pause de 5 secondes...');
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }

          holdersProcessed++;
          if (holdersProcessed >= maxHolders) break;

          // Délai entre chaque adresse pour éviter le rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Arrêter si on a atteint la limite de contrats
        if (contracts.length >= maxContracts) {
          break;
        }

        holdersCursor = holdersResponse.result.nextPageCursor;
        if (!holdersCursor) {
          console.log('Tous les holders ont été traités');
          break;
        }

        // Délai entre chaque page de holders
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error: any) {
        const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
        console.error('Erreur lors de la récupération des holders:', errorMsg);

        // Si c'est une erreur de rate limit, attendre plus longtemps
        if (error?.response?.status === 429) {
          console.log('Rate limit global détecté, arrêt de la découverte');
        }
        break;
      }
    }

    console.log(`Découverte terminée: ${contracts.length} contrats trouvés`);
    return contracts;
  }

  /**
   * Obtenir les statistiques d'activité pour un contrat
   */
  async getContractActivity(
    contractAddress: string
  ): Promise<{
    holderCount: number;
    topHolders: TokenHolder[];
  }> {
    try {
      const holdersResponse = await this.getTokenHolders(contractAddress, {
        limit: 10,
      });

      return {
        holderCount: holdersResponse.result?.total || 0,
        topHolders: holdersResponse.result?.data || [],
      };
    } catch (error) {
      console.error(`Erreur lors de la récupération de l'activité du contrat ${contractAddress}:`, error);
      return {
        holderCount: 0,
        topHolders: [],
      };
    }
  }
}

// Factory function pour créer une instance du service
export function createBlockVisionService(): BlockVisionService {
  const config: BlockVisionConfig = {
    apiKey: process.env.BLOCKVISION_API_KEY || '',
    baseUrl: process.env.BLOCKVISION_BASE_URL || 'https://api.blockvision.org/v2',
    chainId: process.env.MONAD_CHAIN_ID || 'monad-testnet',
  };

  if (!config.apiKey) {
    throw new Error('BLOCKVISION_API_KEY environment variable is required');
  }

  return new BlockVisionService(config);
}
