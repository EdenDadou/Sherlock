/**
 * Route API pour exécuter manuellement une tâche cron
 * POST /api/cron/run
 * Body: { job: 'sync_github_protocols' | 'enrich_protocols' }
 */

import type { Route } from './+types/api.cron.run';
import { cronService } from '~/services/cron.service';

export async function action({ request }: Route.ActionArgs) {
  try {
    const body = await request.json();
    const { job } = body;

    if (!job || (job !== 'sync_github_protocols' && job !== 'enrich_protocols')) {
      return Response.json(
        {
          success: false,
          error: 'Job invalide. Utilisez "sync_github_protocols" ou "enrich_protocols"',
        },
        { status: 400 }
      );
    }

    console.log(`🚀 Exécution manuelle de la tâche: ${job}`);

    // Exécuter la tâche
    await cronService.forceRun(job);

    return Response.json({
      success: true,
      message: `Tâche "${job}" exécutée avec succès`,
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution de la tâche cron:', error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
