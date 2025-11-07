/**
 * Route API pour scanner la blockchain
 * POST /api/scan/blockchain
 */

import type { Route } from './+types/api.scan.blockchain';
import { blockchainScannerService } from '~/services/blockchain-scanner.service';

export async function action({ request }: Route.ActionArgs) {
  try {
    const body = await request.json();
    const depth = body.depth || 1000; // Nombre de blocs à scanner

    console.log(`🚀 Démarrage du scan: ${depth} blocs`);

    // Lancer le scan
    const results = await blockchainScannerService.fullScan(depth);

    return Response.json({
      success: true,
      contracts: results.length,
      identified: results.filter(c => c.name).length,
      data: results,
    });
  } catch (error) {
    console.error('❌ Erreur lors du scan:', error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}

// GET pour démarrer un scan simple
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const depth = parseInt(url.searchParams.get('depth') || '100');

  try {
    console.log(`🚀 Démarrage du scan: ${depth} blocs`);

    const results = await blockchainScannerService.fullScan(depth);

    return Response.json({
      success: true,
      contracts: results.length,
      identified: results.filter(c => c.name).length,
      data: results,
    });
  } catch (error) {
    console.error('❌ Erreur lors du scan:', error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
