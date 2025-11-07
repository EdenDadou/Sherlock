/**
 * Route API pour enrichir les protocoles Monad avec Envio
 * POST /api/discovery/scan/enriched
 */

import type { Route } from './+types/api.discovery.scan.enriched';
import { protocolEnrichmentService } from '~/services/protocol-enrichment.service';

export async function action({ request }: Route.ActionArgs) {
  try {
    const body = await request.json();
    const network = body.network || 'testnet';

    console.log(`🚀 Démarrage de l'enrichissement: ${network}`);

    // Lancer l'enrichissement
    const enriched = await protocolEnrichmentService.enrichAllProtocols(network);

    // Sauvegarder dans la base de données
    if (enriched.length > 0) {
      await protocolEnrichmentService.saveToDatabase(enriched);
    }

    return Response.json({
      success: true,
      protocols: enriched.length,
      data: enriched.map(p => ({
        name: p.name,
        description: p.description,
        category: p.category,
        website: p.website,
        logo: p.logo,
        stats: p.stats,
        contractCount: Object.keys(p.contracts).length,
      })),
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'enrichissement:', error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
