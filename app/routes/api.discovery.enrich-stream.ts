/**
 * Route API pour enrichir les protocoles avec streaming SSE
 * GET /api/discovery/enrich-stream?network=testnet
 */

import type { Route } from './+types/api.discovery.enrich-stream';
import { protocolEnrichmentService } from '~/services/protocol-enrichment.service';

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const network = (url.searchParams.get('network') || 'testnet') as 'testnet' | 'mainnet';

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send('started', { network });

        // 1. Récupérer les protocoles
        send('progress', { step: 'Récupération des protocoles depuis GitHub...', progress: 0 });
        const protocols = await protocolEnrichmentService.fetchMonadProtocols(network, true);

        if (protocols.length === 0) {
          send('error', { message: 'Aucun protocole trouvé' });
          controller.close();
          return;
        }

        const total = protocols.length;
        send('protocols-loaded', { total, protocols: protocols.map(p => ({ name: p.name, category: p.category })) });

        // 2. Enrichir chaque protocole
        for (let i = 0; i < protocols.length; i++) {
          const protocol = protocols[i];
          const progress = Math.round(((i + 1) / total) * 100);

          send('progress', {
            step: `Enrichissement de ${protocol.name}...`,
            progress,
            current: i + 1,
            total
          });

          try {
            const enriched = await protocolEnrichmentService.enrichProtocol(protocol);

            // Envoyer la dApp enrichie immédiatement avec tous les liens disponibles
            send('dapp-enriched', {
              name: enriched.name,
              description: enriched.description,
              category: enriched.category,
              website: enriched.website,
              github: enriched.github,
              twitter: enriched.twitter,
              logo: enriched.logo,
              banner: enriched.banner,
              contractCount: Object.keys(enriched.contracts).length,
              stats: enriched.stats,
            });

            // Sauvegarder en base de données
            await protocolEnrichmentService.saveToDatabase([enriched]);

          } catch (error) {
            console.error(`Erreur enrichissement ${protocol.name}:`, error);
            send('protocol-error', {
              name: protocol.name,
              error: error instanceof Error ? error.message : 'Erreur inconnue'
            });
          }
        }

        send('completed', { total: protocols.length });
        controller.close();

      } catch (error) {
        console.error('Erreur lors de l\'enrichissement:', error);
        send('error', {
          message: error instanceof Error ? error.message : 'Erreur inconnue'
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
