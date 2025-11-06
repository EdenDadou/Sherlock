import { type LoaderFunctionArgs } from 'react-router';

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}
import { prisma } from '~/lib/db/prisma';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { dappId } = params;

  if (!dappId) {
    return json({ error: 'DApp ID is required' }, { status: 400 });
  }

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const activities = await prisma.activity.findMany({
    where: {
      dappId: dappId,
      date: {
        gte: startDate,
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  const totalTxs = activities.reduce((sum, a) => sum + a.txCount, 0);
  const totalUsers = activities.reduce((sum, a) => sum + a.userCount, 0);
  const totalEvents = activities.reduce((sum, a) => sum + a.eventCount, 0);
  const totalGas = activities.reduce((sum, a) => sum + Number(a.gasUsed), 0);

  const avgTxsPerDay = activities.length > 0 ? totalTxs / activities.length : 0;
  const avgUsersPerDay = activities.length > 0 ? totalUsers / activities.length : 0;

  return json({
    dappId,
    days,
    stats: {
      totalTxs,
      totalUsers,
      totalEvents,
      totalGas,
      avgTxsPerDay: Math.round(avgTxsPerDay * 100) / 100,
      avgUsersPerDay: Math.round(avgUsersPerDay * 100) / 100,
    },
    activities: activities.map((a) => ({
      date: a.date,
      txCount: a.txCount,
      userCount: a.userCount,
      eventCount: a.eventCount,
      gasUsed: a.gasUsed.toString(),
    })),
  });
}
