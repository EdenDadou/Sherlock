/**
 * Service de scan de blockchain Monad
 * Basé sur le modèle Python : scan des blocs, détection des contrats, enrichissement
 */

import { createPublicClient, http, type Address } from 'viem';
import axios from 'axios';
import { prisma } from '~/lib/db/prisma';

interface EnrichedContract {
  address: string;
  name: string | null;
  logo: string | null;
  description: string | null;
  source: 'etherscan' | 'blockscout' | 'defillama' | 'coingecko' | 'manual' | null;
  category: string | null;
  deployer: string | null;
  blockNumber: number;
  timestamp: number;
}

export class BlockchainScannerService {
  private client: ReturnType<typeof createPublicClient>;
  private rpcUrl: string;
  private blockscoutApiUrl: string;

  constructor() {
    // Essayer VITE_MONAD_RPC_URL puis MONAD_RPC_URL (support des deux)
    this.rpcUrl = process.env.VITE_MONAD_RPC_URL || process.env.MONAD_RPC_URL || 'https://monad-testnet.g.alchemy.com/v2/YOUR_KEY';
    this.blockscoutApiUrl = 'https://testnet.monadexplorer.com/api';

    console.log(`🔗 RPC URL: ${this.rpcUrl.substring(0, 50)}...`);

    this.client = createPublicClient({
      transport: http(this.rpcUrl),
    });
  }

  /**
   * 1. DÉTECTION DES CONTRATS
   * Scanne une plage de blocs et trouve tous les contrats créés
   */
  async detectContracts(startBlock: number, endBlock: number): Promise<string[]> {
    const found: string[] = [];

    console.log(`\n📊 Scanning blocks ${startBlock.toLocaleString()} → ${endBlock.toLocaleString()}...`);

    for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
      try {
        // Récupérer le bloc avec toutes les transactions
        const block = await this.client.getBlock({
          blockNumber: BigInt(blockNumber),
          includeTransactions: true,
        });

        if (!block || !block.transactions) continue;

        // Pour chaque transaction
        for (const tx of block.transactions) {
          if (typeof tx === 'string') continue; // Hash seulement, pas de détails

          // Si to === null, c'est une création de contrat
          if (tx.to === null || tx.to === undefined) {
            // Récupérer le receipt pour avoir l'adresse du contrat
            const receipt = await this.client.getTransactionReceipt({
              hash: tx.hash,
            });

            if (receipt.contractAddress) {
              found.push(receipt.contractAddress);
              console.log(`  [+] Contract créé : ${receipt.contractAddress}`);
            }
          }
        }

        // Log de progression
        if (blockNumber % 100 === 0) {
          console.log(`  📍 Block ${blockNumber.toLocaleString()} traité (${found.length} contrats trouvés)`);
        }
      } catch (error) {
        console.error(`  ❌ Erreur au bloc ${blockNumber}:`, error);
        continue;
      }
    }

    console.log(`\n✓ ${found.length} contrats trouvés\n`);
    return found;
  }

  /**
   * 2. ENRICHISSEMENT VIA BLOCKSCOUT / MONAD EXPLORER
   * Équivalent d'Etherscan pour Monad
   */
  async enrichWithBlockscout(address: string): Promise<Partial<EnrichedContract>> {
    try {
      const response = await axios.get(`${this.blockscoutApiUrl}/v2/addresses/${address}`, {
        timeout: 5000,
      });

      if (response.data) {
        const data = response.data;

        return {
          name: data.name || data.token?.name || null,
          description: data.description || null,
          logo: data.token?.icon_url || null,
          source: 'blockscout',
        };
      }
    } catch (error) {
      // Blockscout peut ne pas être disponible
      return {};
    }

    return {};
  }

  /**
   * 3. ENRICHISSEMENT VIA DEFILLAMA
   * Retourne logo + nom + description si DefiLlama connaît le protocole
   */
  async enrichWithDefillama(address: string): Promise<Partial<EnrichedContract>> {
    try {
      const response = await axios.get('https://api.llama.fi/protocols', {
        timeout: 5000,
      });

      const protocols = response.data;

      for (const protocol of protocols) {
        // DefiLlama stocke les adresses de différentes manières
        const addresses = [
          protocol.address,
          ...(protocol.chainTvls?.monad?.tokensInUsd || []).map((t: any) => t.address),
        ].filter(Boolean);

        if (addresses.some((addr: string) => addr.toLowerCase() === address.toLowerCase())) {
          return {
            name: protocol.name,
            logo: protocol.logo,
            description: protocol.description || null,
            source: 'defillama',
            category: 'DEFI',
          };
        }
      }
    } catch (error) {
      return {};
    }

    return {};
  }

  /**
   * 4. ENRICHISSEMENT VIA COINGECKO
   * Recherche de tokens par adresse
   */
  async enrichWithCoinGecko(address: string): Promise<Partial<EnrichedContract>> {
    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/coins/list?include_platform=true',
        { timeout: 5000 }
      );

      // Chercher un match par adresse
      const match = response.data.find((coin: any) => {
        return Object.values(coin.platforms || {}).some(
          (addr: any) => addr?.toLowerCase() === address.toLowerCase()
        );
      });

      if (match) {
        // Récupérer les détails
        const detailsResponse = await axios.get(
          `https://api.coingecko.com/api/v3/coins/${match.id}`,
          { timeout: 5000 }
        );

        const details = detailsResponse.data;

        return {
          name: details.name,
          description: details.description?.en || null,
          logo: details.image?.large || null,
          source: 'coingecko',
          category: 'TOKEN',
        };
      }
    } catch (error) {
      return {};
    }

    return {};
  }

  /**
   * 5. CLASSIFICATION D'UN CONTRAT
   * Combine toutes les sources pour enrichir un contrat
   */
  async classifyContract(address: string, blockNumber: number, timestamp: number): Promise<EnrichedContract> {
    const result: EnrichedContract = {
      address,
      name: null,
      logo: null,
      description: null,
      source: null,
      category: null,
      deployer: null,
      blockNumber,
      timestamp,
    };

    console.log(`  🔍 Classification de ${address.substring(0, 10)}...`);

    // Essayer dans l'ordre de priorité

    // 1. Blockscout (spécifique à Monad)
    const blockscoutData = await this.enrichWithBlockscout(address);
    if (blockscoutData.name) {
      Object.assign(result, blockscoutData);
      console.log(`     ✓ Trouvé sur Blockscout: ${blockscoutData.name}`);
      return result;
    }

    // 2. DefiLlama (meilleure source pour DeFi)
    const defiLlamaData = await this.enrichWithDefillama(address);
    if (defiLlamaData.name) {
      Object.assign(result, defiLlamaData);
      console.log(`     ✓ Trouvé sur DefiLlama: ${defiLlamaData.name}`);
      return result;
    }

    // 3. CoinGecko (tokens)
    const coinGeckoData = await this.enrichWithCoinGecko(address);
    if (coinGeckoData.name) {
      Object.assign(result, coinGeckoData);
      console.log(`     ✓ Trouvé sur CoinGecko: ${coinGeckoData.name}`);
      return result;
    }

    // 4. Récupérer le deployer via RPC
    try {
      const code = await this.client.getBytecode({ address: address as Address });
      if (code && code !== '0x') {
        result.category = 'UNKNOWN'; // Catégorie par défaut pour les contrats non identifiés
      }
    } catch (error) {
      // Ignore
    }

    console.log(`     ⚠️  Aucune information trouvée`);
    return result;
  }

  /**
   * 6. PIPELINE COMPLET
   * Scan + Classification + Sauvegarde
   */
  async fullScan(depth: number = 1000): Promise<EnrichedContract[]> {
    console.log('\n🔍 Démarrage du scan blockchain...\n');
    console.log('='.repeat(80));

    // 1. Récupérer le dernier bloc
    const currentBlock = await this.client.getBlockNumber();
    const endBlock = Number(currentBlock);
    const startBlock = endBlock - depth;

    console.log(`📊 Plage de scan: ${startBlock.toLocaleString()} → ${endBlock.toLocaleString()} (${depth} blocs)`);

    // 2. Détecter les contrats créés
    const newContracts = await this.detectContracts(startBlock, endBlock);

    if (newContracts.length === 0) {
      console.log('\n⚠️  Aucun contrat trouvé dans cette plage de blocs');
      return [];
    }

    // 3. Enrichir les données
    console.log('\n🔍 Enrichissement des contrats...\n');
    const enriched: EnrichedContract[] = [];

    for (let i = 0; i < newContracts.length; i++) {
      const address = newContracts[i];

      console.log(`\n[${i + 1}/${newContracts.length}] ${address}`);

      try {
        // Récupérer le bloc de déploiement
        const block = await this.client.getBlock({ blockNumber: BigInt(startBlock + i) });

        const data = await this.classifyContract(
          address,
          Number(block.number),
          Number(block.timestamp)
        );

        enriched.push(data);

        // Sauvegarder dans la base de données
        await this.saveToDatabase(data);

        // Pause pour éviter de spam les API
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`  ❌ Erreur lors de la classification de ${address}:`, error);
      }
    }

    // 4. Afficher le résumé
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Scan terminé!\n');
    console.log(`📊 Résultats:`);
    console.log(`   Total contrats: ${enriched.length}`);
    console.log(`   Identifiés: ${enriched.filter(c => c.name).length}`);
    console.log(`   Non identifiés: ${enriched.filter(c => !c.name).length}`);

    // Afficher les contrats identifiés
    const identified = enriched.filter(c => c.name);
    if (identified.length > 0) {
      console.log(`\n🏆 Contrats identifiés:\n`);
      identified.forEach((c, i) => {
        console.log(`${i + 1}. ${c.name} (${c.category || 'UNKNOWN'})`);
        console.log(`   Address: ${c.address}`);
        console.log(`   Source: ${c.source}`);
        if (c.description) {
          console.log(`   Description: ${c.description.substring(0, 100)}...`);
        }
        console.log('');
      });
    }

    return enriched;
  }

  /**
   * 7. SAUVEGARDER DANS LA BASE DE DONNÉES
   */
  private async saveToDatabase(contract: EnrichedContract): Promise<void> {
    try {
      // Vérifier si le contrat existe déjà
      const existing = await prisma.contract.findUnique({
        where: { address: contract.address.toLowerCase() },
      });

      if (existing) {
        // Mettre à jour
        await prisma.contract.update({
          where: { address: contract.address.toLowerCase() },
          data: {
            name: contract.name,
            symbol: contract.category,
            type: contract.category || 'UNKNOWN',
          },
        });
      } else {
        // Créer un nouveau contrat
        // Note: On doit créer une dApp d'abord car le schema le requiert
        const dapp = await prisma.dApp.create({
          data: {
            name: contract.name || `Contract ${contract.address.substring(0, 10)}...`,
            description: contract.description,
            logoUrl: contract.logo,
            category: (contract.category as any) || 'UNKNOWN',
          },
        });

        await prisma.contract.create({
          data: {
            address: contract.address.toLowerCase(),
            type: contract.category || 'UNKNOWN',
            name: contract.name,
            symbol: contract.category,
            deploymentDate: new Date(contract.timestamp * 1000),
            dappId: dapp.id,
          },
        });
      }
    } catch (error) {
      console.error(`  ❌ Erreur lors de la sauvegarde:`, error);
    }
  }

  /**
   * 8. EXPORTER EN CSV
   */
  async exportToCSV(contracts: EnrichedContract[], filename: string = 'dapps_detected.csv'): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Créer le CSV
    const headers = ['address', 'name', 'category', 'description', 'source', 'logo', 'blockNumber', 'timestamp'];
    const rows = contracts.map(c => [
      c.address,
      c.name || '',
      c.category || '',
      c.description || '',
      c.source || '',
      c.logo || '',
      c.blockNumber,
      c.timestamp,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const filePath = path.join(process.cwd(), filename);
    await fs.writeFile(filePath, csv);

    console.log(`\n✅ Résultats exportés vers ${filePath}`);
  }
}

// Export singleton
export const blockchainScannerService = new BlockchainScannerService();
