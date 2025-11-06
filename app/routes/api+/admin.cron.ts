import { type ActionFunctionArgs } from 'react-router';
import { getCronService } from '~/services/cron.service';

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

export async function loader() {
  const cronService = getCronService();
  const status = cronService.getJobsStatus();

  return json({
    status,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('action') as string;

  const cronService = getCronService();

  try {
    let result;

    switch (action) {
      case 'scan-blocks':
        result = await cronService.runBlockScanner();
        return json({
          success: true,
          message: `Block scanner completed: ${result} new contracts detected`,
        });

      case 'classify-contracts':
        result = await cronService.runClassifier();
        return json({
          success: true,
          message: `Classifier completed: ${result} contracts classified`,
        });

      case 'update-activity':
        result = await cronService.runActivityTracker();
        return json({
          success: true,
          message: `Activity tracker completed: ${result} dApps updated`,
        });

      case 'start-all':
        cronService.start();
        return json({
          success: true,
          message: 'All cron jobs started',
        });

      case 'stop-all':
        cronService.stop();
        return json({
          success: true,
          message: 'All cron jobs stopped',
        });

      default:
        return json(
          {
            success: false,
            error: 'Invalid action',
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Cron action error:', error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
