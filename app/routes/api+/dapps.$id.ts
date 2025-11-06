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

export async function loader({ params }: LoaderFunctionArgs) {
  const { id } = params;

  if (!id) {
    return json({ error: 'DApp ID is required' }, { status: 400 });
  }

  const dapp = await prisma.dApp.findUnique({
    where: { id },
    include: {
      contracts: {
        orderBy: { deploymentDate: 'desc' },
      },
      activities: {
        orderBy: { date: 'desc' },
        take: 30,
      },
    },
  });

  if (!dapp) {
    return json({ error: 'DApp not found' }, { status: 404 });
  }

  // Calculer des statistiques
  const totalTxs = dapp.activities.reduce((sum, a) => sum + a.txCount, 0);
  const totalUsers = dapp.activities.reduce((sum, a) => sum + a.userCount, 0);
  const totalEvents = dapp.activities.reduce((sum, a) => sum + a.eventCount, 0);

  const avgTxsPerDay = dapp.activities.length > 0 ? totalTxs / dapp.activities.length : 0;
  const avgUsersPerDay = dapp.activities.length > 0 ? totalUsers / dapp.activities.length : 0;

  return json({
    dapp: {
      id: dapp.id,
      name: dapp.name,
      description: dapp.description,
      category: dapp.category,
      status: dapp.status,
      detectionSource: dapp.detectionSource,
      createdAt: dapp.createdAt,
      updatedAt: dapp.updatedAt,
      contracts: dapp.contracts.map((c) => ({
        id: c.id,
        address: c.address,
        type: c.type,
        deploymentDate: c.deploymentDate,
        creatorAddress: c.creatorAddress,
        transactionHash: c.transactionHash,
        blockNumber: c.blockNumber?.toString(),
      })),
      activities: dapp.activities.map((a) => ({
        date: a.date,
        txCount: a.txCount,
        userCount: a.userCount,
        eventCount: a.eventCount,
        gasUsed: a.gasUsed.toString(),
      })),
      stats: {
        totalTxs,
        totalUsers,
        totalEvents,
        avgTxsPerDay: Math.round(avgTxsPerDay * 100) / 100,
        avgUsersPerDay: Math.round(avgUsersPerDay * 100) / 100,
      },
    },
  });
}
