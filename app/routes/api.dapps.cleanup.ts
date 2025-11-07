import type { Route } from './+types/api.dapps.cleanup';
import { prisma } from '~/lib/db/prisma';

/**
 * Route API pour nettoyer les fausses dApps (tokens isolés)
 * GET /api/dapps/cleanup - Supprime les dApps qui n'ont qu'un seul contrat
 */
export async function loader({ request }: Route.LoaderArgs) {
  try {
    console.log('🧹 Démarrage du nettoyage des fausses dApps...');

    // Récupérer toutes les dApps
    const allDApps = await prisma.dApp.findMany({
      include: {
        contracts: true,
      },
    });

    console.log(`📊 ${allDApps.length} dApps trouvées dans la base de données`);

    // Identifier les dApps à supprimer (celles avec un seul contrat)
    const dAppsToDelete: string[] = [];
    const contractsToDetach: string[] = [];

    for (const dapp of allDApps) {
      if (dapp.contracts.length === 1) {
        dAppsToDelete.push(dapp.id);
        contractsToDetach.push(dapp.contracts[0].id);
        console.log(`  ⊘ dApp à supprimer: ${dapp.name || dapp.id} (1 seul contrat: ${dapp.contracts[0].address})`);
      } else if (dapp.contracts.length === 2) {
        // Pour les dApps avec 2 contrats, vérifier si elles sont vraiment liées
        // Pour l'instant, on les garde mais on pourrait ajouter plus de logique ici
        console.log(`  ⚠️ dApp avec 2 contrats: ${dapp.name || dapp.id} (à vérifier manuellement)`);
      }
    }

    console.log(`\n🗑️ ${dAppsToDelete.length} fausses dApps identifiées`);

    if (dAppsToDelete.length > 0) {
      // Détacher d'abord les contrats de leurs dApps
      await prisma.contract.updateMany({
        where: {
          id: { in: contractsToDetach },
        },
        data: {
          dappId: null,
        },
      });

      console.log(`✓ ${contractsToDetach.length} contrats détachés`);

      // Supprimer les dApps
      const deleteResult = await prisma.dApp.deleteMany({
        where: {
          id: { in: dAppsToDelete },
        },
      });

      console.log(`✓ ${deleteResult.count} dApps supprimées`);
    }

    // Statistiques finales
    const remainingDApps = await prisma.dApp.count();
    const orphanContracts = await prisma.contract.count({
      where: {
        dappId: null,
      },
    });

    console.log(`\n📊 Statistiques après nettoyage:`);
    console.log(`  - dApps restantes: ${remainingDApps}`);
    console.log(`  - Contrats orphelins: ${orphanContracts}`);

    return Response.json({
      success: true,
      deleted: dAppsToDelete.length,
      remaining: remainingDApps,
      orphanContracts,
      message: `${dAppsToDelete.length} fausses dApps supprimées avec succès`,
    });
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
