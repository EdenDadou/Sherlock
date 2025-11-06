import { prisma } from '~/lib/db/prisma';
import { BlockVisionService } from './blockvision.service';
import type { Transaction } from '~/types/blockvision';
import { ContractType } from '@prisma/client';

/**
 * Service pour détecter et enregistrer les nouveaux contrats déployés
 */
export class ContractDetectorService {
  constructor(private blockVisionService: BlockVisionService) {}

  /**
   * Scanne les blocks récents pour détecter les nouveaux contrats
   */
  async scanForNewContracts(fromBlock?: number): Promise<number> {
    try {
      // Récupérer le dernier block scanné ou utiliser celui fourni
      const startBlock = fromBlock || (await this.getLastScannedBlock());
      const latestBlock = await this.blockVisionService.getLatestBlockNumber();

      console.log(`Scanning blocks from ${startBlock} to ${latestBlock}`);

      if (startBlock >= latestBlock) {
        console.log('Already up to date');
        return 0;
      }

      // Scanner par chunks de 10 blocks pour éviter de surcharger l'API
      const chunkSize = 10;
      let contractsDetected = 0;

      for (let block = startBlock; block <= latestBlock; block += chunkSize) {
        const toBlock = Math.min(block + chunkSize - 1, latestBlock);
        console.log(`Scanning blocks ${block} to ${toBlock}`);

        const contracts = await this.blockVisionService.scanBlocksForContracts(block, toBlock);

        for (const contractTx of contracts) {
          try {
            await this.processContractDeployment(contractTx);
            contractsDetected++;
          } catch (error) {
            console.error(`Error processing contract ${contractTx.contractAddress}:`, error);
          }
        }

        // Mettre à jour le dernier block scanné
        await this.updateLastScannedBlock(toBlock);

        // Petit délai pour respecter les rate limits
        await this.sleep(500);
      }

      console.log(`Contract detection complete. Found ${contractsDetected} new contracts`);
      return contractsDetected;
    } catch (error) {
      console.error('Error in contract scanning:', error);
      throw error;
    }
  }

  /**
   * Traite un déploiement de contrat
   */
  private async processContractDeployment(tx: Transaction): Promise<void> {
    if (!tx.contractAddress) {
      return;
    }

    // Vérifier si le contrat existe déjà
    const existing = await prisma.contract.findUnique({
      where: { address: tx.contractAddress.toLowerCase() },
    });

    if (existing) {
      console.log(`Contract ${tx.contractAddress} already exists`);
      return;
    }

    // Récupérer le bytecode
    const bytecode = await this.blockVisionService.getContractCode(tx.contractAddress);
    const bytecodeHash = this.hashBytecode(bytecode);

    // Déterminer le type de contrat
    const contractType = await this.detectContractType(tx.contractAddress, bytecode);

    // Créer le contrat dans la base de données
    await prisma.contract.create({
      data: {
        address: tx.contractAddress.toLowerCase(),
        bytecodeHash,
        type: contractType,
        creatorAddress: tx.from.toLowerCase(),
        transactionHash: tx.hash,
        blockNumber: BigInt(parseInt(tx.blockNumber, 16)),
        deploymentDate: new Date(parseInt(tx.timestamp, 16) * 1000),
      },
    });

    console.log(`New contract detected: ${tx.contractAddress} (${contractType})`);
  }

  /**
   * Détecte le type de contrat basé sur le bytecode et les événements
   */
  private async detectContractType(address: string, bytecode: string): Promise<ContractType> {
    try {
      // Vérifier les signatures de fonctions courantes dans le bytecode
      const isERC20 = this.checkERC20Signatures(bytecode);
      const isERC721 = this.checkERC721Signatures(bytecode);
      const isERC1155 = this.checkERC1155Signatures(bytecode);

      if (isERC20) return ContractType.ERC20;
      if (isERC721) return ContractType.ERC721;
      if (isERC1155) return ContractType.ERC1155;

      // Essayer de récupérer les événements récents pour une classification plus précise
      try {
        const events = await this.blockVisionService.getContractEvents(address, {
          pageSize: 10,
        });

        if (events.data.length > 0) {
          const eventSignatures = events.data.map((e) => e.topics[0]);

          // ERC20 Transfer event: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
          if (eventSignatures.includes('0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef')) {
            // Vérifier si c'est ERC721 (3 topics) ou ERC20 (2 topics)
            const transferEvent = events.data.find(
              (e) => e.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
            );
            if (transferEvent && transferEvent.topics.length === 4) {
              return ContractType.ERC721;
            }
            return ContractType.ERC20;
          }

          // ERC1155 TransferSingle: 0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62
          if (eventSignatures.includes('0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62')) {
            return ContractType.ERC1155;
          }
        }
      } catch (error) {
        console.log(`Could not fetch events for ${address}:`, error);
      }

      return ContractType.CUSTOM;
    } catch (error) {
      console.error('Error detecting contract type:', error);
      return ContractType.UNKNOWN;
    }
  }

  /**
   * Vérifie les signatures ERC20 dans le bytecode
   */
  private checkERC20Signatures(bytecode: string): boolean {
    // Function selectors for ERC20
    const erc20Selectors = [
      '70a08231', // balanceOf(address)
      'dd62ed3e', // allowance(address,address)
      'a9059cbb', // transfer(address,uint256)
      '095ea7b3', // approve(address,uint256)
      '23b872dd', // transferFrom(address,address,uint256)
    ];

    let matches = 0;
    for (const selector of erc20Selectors) {
      if (bytecode.toLowerCase().includes(selector)) {
        matches++;
      }
    }

    // Si au moins 3 sélecteurs sur 5 sont présents
    return matches >= 3;
  }

  /**
   * Vérifie les signatures ERC721 dans le bytecode
   */
  private checkERC721Signatures(bytecode: string): boolean {
    const erc721Selectors = [
      '6352211e', // ownerOf(uint256)
      '42842e0e', // safeTransferFrom(address,address,uint256)
      'b88d4fde', // safeTransferFrom(address,address,uint256,bytes)
      '081812fc', // getApproved(uint256)
      'e985e9c5', // isApprovedForAll(address,address)
    ];

    let matches = 0;
    for (const selector of erc721Selectors) {
      if (bytecode.toLowerCase().includes(selector)) {
        matches++;
      }
    }

    return matches >= 3;
  }

  /**
   * Vérifie les signatures ERC1155 dans le bytecode
   */
  private checkERC1155Signatures(bytecode: string): boolean {
    const erc1155Selectors = [
      '00fdd58e', // balanceOf(address,uint256)
      '4e1273f4', // balanceOfBatch(address[],uint256[])
      'f242432a', // safeTransferFrom(address,address,uint256,uint256,bytes)
      '2eb2c2d6', // safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)
    ];

    let matches = 0;
    for (const selector of erc1155Selectors) {
      if (bytecode.toLowerCase().includes(selector)) {
        matches++;
      }
    }

    return matches >= 2;
  }

  /**
   * Hash le bytecode pour déduplication
   */
  private hashBytecode(bytecode: string): string {
    // Simple hash du bytecode (en production, utiliser crypto.createHash)
    return bytecode.length > 100 ? bytecode.substring(0, 64) : bytecode;
  }

  /**
   * Récupère le dernier block scanné
   */
  private async getLastScannedBlock(): Promise<number> {
    const state = await prisma.blockScanState.findFirst();
    if (!state) {
      // Créer un état initial si aucun n'existe
      const latestBlock = await this.blockVisionService.getLatestBlockNumber();
      const initialBlock = Math.max(0, latestBlock - 1000); // Commencer 1000 blocks en arrière

      await prisma.blockScanState.create({
        data: {
          lastBlockScanned: BigInt(initialBlock),
        },
      });

      return initialBlock;
    }

    return Number(state.lastBlockScanned);
  }

  /**
   * Met à jour le dernier block scanné
   */
  private async updateLastScannedBlock(blockNumber: number): Promise<void> {
    const state = await prisma.blockScanState.findFirst();
    if (state) {
      await prisma.blockScanState.update({
        where: { id: state.id },
        data: { lastBlockScanned: BigInt(blockNumber) },
      });
    } else {
      await prisma.blockScanState.create({
        data: { lastBlockScanned: BigInt(blockNumber) },
      });
    }
  }

  /**
   * Utilitaire pour ajouter un délai
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
