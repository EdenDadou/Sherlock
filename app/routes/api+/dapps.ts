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
import { DAppCategory, DAppStatus } from '@prisma/client';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  // Paramètres de requête
  const category = url.searchParams.get('category') as DAppCategory | null;
  const status = url.searchParams.get('status') as DAppStatus | null;
  const sort = url.searchParams.get('sort') || 'createdAt';
  const order = url.searchParams.get('order') || 'desc';
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
  const search = url.searchParams.get('search');

  // Construction de la requête
  const where: any = {};

  if (category) {
    where.category = category;
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { contracts: { some: { address: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  // Déterminer l'ordre
  let orderBy: any = {};
  if (sort === 'activity') {
    // Pour trier par activité, on doit faire une jointure
    orderBy = { updatedAt: order };
  } else {
    orderBy = { [sort]: order };
  }

  // Récupérer les dApps
  const [dapps, total] = await Promise.all([
    prisma.dApp.findMany({
      where,
      include: {
        contracts: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          take: 7,
          orderBy: { date: 'desc' },
        },
        _count: {
          select: {
            contracts: true,
            activities: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dApp.count({ where }),
  ]);

  return json({
    dapps: dapps.map((dapp) => ({
      id: dapp.id,
      name: dapp.name,
      description: dapp.description,
      category: dapp.category,
      status: dapp.status,
      detectionSource: dapp.detectionSource,
      createdAt: dapp.createdAt,
      updatedAt: dapp.updatedAt,
      contractCount: dapp._count.contracts,
      contracts: dapp.contracts.map((c) => ({
        id: c.id,
        address: c.address,
        type: c.type,
        deploymentDate: c.deploymentDate,
      })),
      recentActivity: dapp.activities.map((a) => ({
        date: a.date,
        txCount: a.txCount,
        userCount: a.userCount,
        eventCount: a.eventCount,
      })),
    })),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
