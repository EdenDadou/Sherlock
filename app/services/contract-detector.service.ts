import { prisma } from '~/lib/db/prisma';
import { ContractType, DAppCategory } from '@prisma/client';

// Interface générique pour les services d'indexation
interface IndexerService {
  getContractActivity(address: string, ...args: any[]): Promise<{
    holderCount?: number;
    logCount?: number;
    isActive?: boolean;
  }>;
}

/**
 * Service pour détecter et analyser les contrats déployés
 * Compatible avec différents services d'indexation (Envio, etc.)
 */
export class ContractDetectorService {
  constructor(private indexerService: IndexerService) {}

  /**
   * Sauvegarde un contrat dans la base de données
   */
  async saveContract(
    address: string,
    deployer: string,
    deploymentDate: Date
  ): Promise<void> {
    try {
      // Vérifier si le contrat existe déjà
      const existing = await prisma.contract.findUnique({
        where: { address: address.toLowerCase() },
      });

      if (existing) {
        console.log(`Contrat ${address} déjà enregistré`);
        return;
      }

      // Déterminer le type de contrat via l'API d'indexation
      const contractType = await this.detectContractTypeViaAPI(address);

      // Créer le contrat dans la base de données
      await prisma.contract.create({
        data: {
          address: address.toLowerCase(),
          bytecodeHash: '', // On pourrait le calculer si nécessaire via RPC
          type: contractType,
          creatorAddress: deployer.toLowerCase(),
          transactionHash: '', // Disponible si nécessaire
          blockNumber: BigInt(0), // On pourrait le récupérer si nécessaire
          deploymentDate,
        },
      });

      console.log(`✓ Contrat enregistré: ${address} (${contractType})`);
    } catch (error) {
      console.error(`Erreur lors de l'enregistrement du contrat ${address}:`, error);
      throw error;
    }
  }

  /**
   * Analyse un contrat et le groupe en dApp si nécessaire
   */
  async analyzeAndGroupContract(
    address: string,
    holderCount: number
  ): Promise<void> {
    try {
      const contract = await prisma.contract.findUnique({
        where: { address: address.toLowerCase() },
      });

      if (!contract) {
        console.log(`Contrat ${address} non trouvé dans la base de données`);
        return;
      }

      // Vérifier si le contrat fait déjà partie d'une dApp
      if (contract.dappId) {
        console.log(`Contrat ${address} déjà associé à une dApp`);
        return;
      }

      // Si c'est un token avec des holders, créer/trouver une dApp
      if (holderCount > 0 && this.isTokenContract(contract.type)) {
        await this.createOrUpdateDApp(contract, holderCount);
      }
    } catch (error) {
      console.error(`Erreur lors de l'analyse du contrat ${address}:`, error);
    }
  }

  /**
   * Crée ou met à jour une dApp pour un contrat
   */
  private async createOrUpdateDApp(
    contract: any,
    holderCount: number
  ): Promise<void> {
    try {
      const creatorAddress = contract.creatorAddress?.toLowerCase();

      if (!creatorAddress) {
        console.warn(`Pas de creatorAddress pour le contrat ${contract.address}, skip grouping`);
        return;
      }

      // Chercher une dApp existante avec le même créateur (factory)
      // On cherche directement dans tous les contrats, pas seulement ceux déjà liés
      const existingContractWithSameCreator = await prisma.contract.findFirst({
        where: {
          creatorAddress: creatorAddress,
          dappId: { not: null },
        },
        include: {
          dapp: true,
        },
      });

      if (existingContractWithSameCreator && existingContractWithSameCreator.dapp) {
        // Associer le contrat à la dApp existante
        await prisma.contract.update({
          where: { id: contract.id },
          data: { dappId: existingContractWithSameCreator.dapp.id },
        });
        console.log(`Contrat ${contract.address} associé à la dApp existante ${existingContractWithSameCreator.dapp.id} (factory: ${creatorAddress.substring(0, 10)}...)`);
      } else {
        // Créer une nouvelle dApp pour cette factory
        const category = this.determineCategory(contract.type);
        const dapp = await prisma.dApp.create({
          data: {
            name: `DApp Factory ${creatorAddress.substring(0, 10)}`,
            description: `DApp découverte automatiquement via factory ${creatorAddress}. Contrats déployés par cette factory.`,
            category,
            contracts: {
              connect: { id: contract.id },
            },
          },
        });
        console.log(`✓ Nouvelle dApp créée: ${dapp.id} (factory: ${creatorAddress.substring(0, 10)}..., ${category})`);
      }
    } catch (error) {
      console.error('Erreur lors de la création/mise à jour de la dApp:', error);
    }
  }

  /**
   * Détecte le type de contrat via l'API d'indexation (en vérifiant s'il a de l'activité)
   */
  private async detectContractTypeViaAPI(address: string): Promise<ContractType> {
    try {
      // Essayer de récupérer l'activité du contrat
      const activity = await this.indexerService.getContractActivity(address);

      // Vérifier s'il a de l'activité (holders ou logs)
      const hasActivity = (activity.holderCount && activity.holderCount > 0) ||
                         (activity.logCount && activity.logCount > 0) ||
                         activity.isActive;

      if (hasActivity) {
        // Si le contrat a de l'activité, c'est probablement un token
        return ContractType.ERC20; // Par défaut, considérer comme ERC20
      }

      return ContractType.CUSTOM;
    } catch (error) {
      console.log(`Impossible de détecter le type pour ${address}, utilisation de CUSTOM`);
      return ContractType.CUSTOM;
    }
  }

  /**
   * Vérifie si un contrat est un token
   */
  private isTokenContract(type: ContractType): boolean {
    const tokenTypes: ContractType[] = [ContractType.ERC20, ContractType.ERC721, ContractType.ERC1155];
    return tokenTypes.includes(type);
  }

  /**
   * Détermine la catégorie d'une dApp basée sur le type de contrat
   */
  private determineCategory(type: ContractType): DAppCategory {
    switch (type) {
      case ContractType.ERC20:
        return DAppCategory.DEFI;
      case ContractType.ERC721:
      case ContractType.ERC1155:
        return DAppCategory.NFT;
      default:
        return DAppCategory.UNKNOWN;
    }
  }

}
