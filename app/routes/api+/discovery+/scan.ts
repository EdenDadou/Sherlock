import type { ActionFunctionArgs } from 'react-router';
import { discoveryScannerService } from '../../../services/discovery-scanner.service';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('action') as string;

  try {
    if (action === 'start') {
      // Démarrer le scan de manière asynchrone
      discoveryScannerService.startScan().catch((error: Error) => {
        console.error('Erreur lors du scan:', error);
      });

      return Response.json({ success: true, message: 'Scan démarré' });
    } else if (action === 'stop') {
      await discoveryScannerService.stopScan();
      return Response.json({ success: true, message: 'Scan arrêté' });
    } else if (action === 'status') {
      const progress = discoveryScannerService.getProgress();
      return Response.json({ success: true, progress });
    }

    return Response.json({ success: false, error: 'Action inconnue' }, { status: 400 });
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
