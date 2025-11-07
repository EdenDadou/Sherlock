/**
 * Route API pour récupérer toutes les dApps en cache depuis la base de données
 * GET /api/dapps/cached
 */

import type { Route } from './+types/api.dapps.cached';
import { prisma } from '~/lib/db/prisma';

export async function loader({ request }: Route.LoaderArgs) {
  try {
    // Récupérer toutes les dApps avec leurs contrats
    const dapps = await prisma.dApp.findMany({
      include: {
        contracts: {
          take: 5, // Limiter à 5 contrats par dApp
          orderBy: {
            txCount: 'desc', // Les plus actifs en premier
          },
        },
      },
      orderBy: {
        qualityScore: 'desc', // Trier par score de qualité
      },
    });

    // Formater les données pour le frontend
    const formattedDapps = dapps.map(dapp => ({
      id: dapp.id,
      name: dapp.name,
      description: dapp.description,
      logoUrl: dapp.logoUrl,
      logo: dapp.logoUrl,
      symbol: dapp.symbol,
      category: dapp.category,
      website: dapp.website,
      contractCount: dapp.contracts.length,
      contracts: dapp.contracts.map(contract => ({
        address: contract.address,
        type: contract.type,
        deploymentDate: contract.deploymentDate,
      })),
      stats: {
        totalTxCount: dapp.totalTxCount,
        totalEventCount: 0, // Non stocké pour le moment
        uniqueUsers: dapp.uniqueUsers,
        activityScore: dapp.qualityScore,
        contractCount: dapp.contracts.length,
        firstActivity: null,
        lastActivity: null,
      },
      qualityScore: dapp.qualityScore,
      activityScore: dapp.activityScore,
      diversityScore: dapp.diversityScore,
      ageScore: dapp.ageScore,
    }));

    return Response.json({
      success: true,
      count: formattedDapps.length,
      data: formattedDapps,
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des dApps en cache:', error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
