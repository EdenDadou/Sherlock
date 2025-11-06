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
  const { address } = params;

  if (!address) {
    return json({ error: 'Contract address is required' }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { address: address.toLowerCase() },
    include: {
      dapp: {
        include: {
          activities: {
            take: 7,
            orderBy: { date: 'desc' },
          },
        },
      },
    },
  });

  if (!contract) {
    return json({ error: 'Contract not found' }, { status: 404 });
  }

  return json({
    contract: {
      id: contract.id,
      address: contract.address,
      type: contract.type,
      deploymentDate: contract.deploymentDate,
      creatorAddress: contract.creatorAddress,
      transactionHash: contract.transactionHash,
      blockNumber: contract.blockNumber?.toString(),
      bytecodeHash: contract.bytecodeHash,
      createdAt: contract.createdAt,
      dapp: contract.dapp
        ? {
            id: contract.dapp.id,
            name: contract.dapp.name,
            category: contract.dapp.category,
            status: contract.dapp.status,
            recentActivity: contract.dapp.activities,
          }
        : null,
    },
  });
}
