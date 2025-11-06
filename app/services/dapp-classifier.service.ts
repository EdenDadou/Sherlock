import { prisma } from '~/lib/db/prisma';
import { BlockVisionService } from './blockvision.service';
import { DAppCategory, ContractType } from '@prisma/client';

/**
 * Service pour classifier les dApps basé sur les contrats et événements
 */
export class DAppClassifierService {
  constructor(private blockVisionService: BlockVisionService) {}

  /**
   * Classifie tous les contrats non assignés à une dApp
   */
  async classifyUnassignedContracts(): Promise<number> {
    const unassignedContracts = await prisma.contract.findMany({
      where: { dappId: null },
      orderBy: { deploymentDate: 'desc' },
      take: 50, // Traiter 50 contrats à la fois
    });

    let classified = 0;

    for (const contract of unassignedContracts) {
      try {
        await this.classifyContract(contract.id);
        classified++;
      } catch (error) {
        console.error(`Error classifying contract ${contract.address}:`, error);
      }
    }

    console.log(`Classified ${classified} contracts`);
    return classified;
  }

  /**
   * Classifie un contrat et le rattache à une dApp
   */
  async classifyContract(contractId: string): Promise<void> {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Déterminer la catégorie basée sur le type de contrat et les événements
    const category = await this.determineCategory(contract.address, contract.type);

    // Chercher une dApp existante avec des contrats similaires
    const existingDApp = await this.findRelatedDApp(contract);

    if (existingDApp) {
      // Rattacher à une dApp existante
      await prisma.contract.update({
        where: { id: contractId },
        data: { dappId: existingDApp.id },
      });

      // Mettre à jour la catégorie de la dApp si nécessaire
      if (existingDApp.category === DAppCategory.UNKNOWN && category !== DAppCategory.UNKNOWN) {
        await prisma.dApp.update({
          where: { id: existingDApp.id },
          data: { category },
        });
      }

      console.log(`Contract ${contract.address} assigned to existing dApp ${existingDApp.id}`);
    } else {
      // Créer une nouvelle dApp
      const dapp = await prisma.dApp.create({
        data: {
          name: this.generateDAppName(contract.address, category),
          category,
          detectionSource: 'AUTO',
          contracts: {
            connect: { id: contractId },
          },
        },
      });

      console.log(`Created new dApp ${dapp.id} for contract ${contract.address}`);
    }
  }

  /**
   * Détermine la catégorie d'un contrat basé sur son type et ses événements
   */
  private async determineCategory(
    contractAddress: string,
    contractType: ContractType
  ): Promise<DAppCategory> {
    try {
      // Récupérer les événements du contrat
      const events = await this.blockVisionService.getContractEvents(contractAddress, {
        pageSize: 100,
      });

      // Analyser les événements pour déterminer la catégorie
      const eventSignatures = events.data.map((e) => e.topics[0]);

      // DeFi patterns
      if (this.isDeFiContract(contractType, eventSignatures)) {
        return DAppCategory.DEFI;
      }

      // NFT patterns
      if (this.isNFTContract(contractType, eventSignatures)) {
        return DAppCategory.NFT;
      }

      // GameFi patterns
      if (this.isGameFiContract(eventSignatures)) {
        return DAppCategory.GAMEFI;
      }

      // Bridge patterns
      if (this.isBridgeContract(eventSignatures)) {
        return DAppCategory.BRIDGE;
      }

      // Social patterns
      if (this.isSocialContract(eventSignatures)) {
        return DAppCategory.SOCIAL;
      }

      // Infra patterns
      if (this.isInfraContract(eventSignatures)) {
        return DAppCategory.INFRA;
      }

      return DAppCategory.UNKNOWN;
    } catch (error) {
      console.error(`Error determining category for ${contractAddress}:`, error);
      return DAppCategory.UNKNOWN;
    }
  }

  /**
   * Vérifie si c'est un contrat DeFi
   */
  private isDeFiContract(contractType: ContractType, eventSignatures: string[]): boolean {
    // Swap event signature (Uniswap-like)
    const swapSignature = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
    // Mint/Burn liquidity
    const mintSignature = '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f';
    const burnSignature = '0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496';
    // Deposit/Withdraw
    const depositSignature = '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c';

    return (
      contractType === ContractType.ERC20 &&
      (eventSignatures.includes(swapSignature) ||
        eventSignatures.includes(mintSignature) ||
        eventSignatures.includes(burnSignature) ||
        eventSignatures.includes(depositSignature))
    );
  }

  /**
   * Vérifie si c'est un contrat NFT
   */
  private isNFTContract(contractType: ContractType, eventSignatures: string[]): boolean {
    return contractType === ContractType.ERC721 || contractType === ContractType.ERC1155;
  }

  /**
   * Vérifie si c'est un contrat GameFi
   */
  private isGameFiContract(eventSignatures: string[]): boolean {
    // Patterns typiques: rewards, battles, items, etc.
    // Pour une vraie implémentation, ajouter des signatures spécifiques
    const gamePatterns = [
      '0x', // Placeholder - ajouter de vraies signatures
    ];

    return eventSignatures.some((sig) => gamePatterns.includes(sig));
  }

  /**
   * Vérifie si c'est un contrat Bridge
   */
  private isBridgeContract(eventSignatures: string[]): boolean {
    // Lock/Unlock, Send/Receive cross-chain
    const lockSignature = '0x'; // Placeholder
    const sendSignature = '0x'; // Placeholder

    return eventSignatures.includes(lockSignature) || eventSignatures.includes(sendSignature);
  }

  /**
   * Vérifie si c'est un contrat Social
   */
  private isSocialContract(eventSignatures: string[]): boolean {
    // Posts, follows, likes, etc.
    const postSignature = '0x'; // Placeholder

    return eventSignatures.includes(postSignature);
  }

  /**
   * Vérifie si c'est un contrat Infrastructure
   */
  private isInfraContract(eventSignatures: string[]): boolean {
    // Oracles, relayers, etc.
    return false; // Implémenter selon les besoins
  }

  /**
   * Trouve une dApp reliée basée sur le créateur ou le bytecode
   */
  private async findRelatedDApp(contract: {
    creatorAddress: string | null;
    bytecodeHash: string | null;
  }) {
    if (!contract.creatorAddress) {
      return null;
    }

    // Chercher des contrats du même créateur
    const relatedContract = await prisma.contract.findFirst({
      where: {
        creatorAddress: contract.creatorAddress,
        dappId: { not: null },
      },
      include: { dapp: true },
    });

    if (relatedContract?.dapp) {
      return relatedContract.dapp;
    }

    // Chercher par bytecode similaire
    if (contract.bytecodeHash) {
      const similarContract = await prisma.contract.findFirst({
        where: {
          bytecodeHash: contract.bytecodeHash,
          dappId: { not: null },
        },
        include: { dapp: true },
      });

      if (similarContract?.dapp) {
        return similarContract.dapp;
      }
    }

    return null;
  }

  /**
   * Génère un nom pour une nouvelle dApp
   */
  private generateDAppName(contractAddress: string, category: DAppCategory): string {
    const shortAddress = `${contractAddress.substring(0, 6)}...${contractAddress.substring(38)}`;
    const categoryLabel = category !== DAppCategory.UNKNOWN ? category : 'Contract';
    return `${categoryLabel} ${shortAddress}`;
  }

  /**
   * Met à jour la catégorie d'une dApp manuellement
   */
  async updateDAppCategory(dappId: string, category: DAppCategory): Promise<void> {
    await prisma.dApp.update({
      where: { id: dappId },
      data: {
        category,
        detectionSource: 'MANUAL',
      },
    });
  }

  /**
   * Met à jour les informations d'une dApp
   */
  async updateDAppInfo(
    dappId: string,
    data: {
      name?: string;
      description?: string;
      category?: DAppCategory;
    }
  ): Promise<void> {
    await prisma.dApp.update({
      where: { id: dappId },
      data: {
        ...data,
        detectionSource: 'MANUAL',
      },
    });
  }
}
