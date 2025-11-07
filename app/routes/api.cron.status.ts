/**
 * Route API pour obtenir le statut des tâches cron
 * GET /api/cron/status
 */

import type { Route } from './+types/api.cron.status';
import { cronService } from '~/services/cron.service';

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const status = await cronService.getStatus();

    return Response.json({
      success: true,
      jobs: status,
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération du statut des crons:', error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
