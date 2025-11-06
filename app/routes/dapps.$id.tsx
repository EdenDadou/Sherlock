import { type LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { id } = params;
  const url = new URL(request.url);

  const response = await fetch(`${url.origin}/api/dapps/${id}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Response('DApp not found', { status: 404 });
  }

  return data;
}

export default function DAppDetail() {
  const data = useLoaderData<typeof loader>();

  if (!data || !data.dapp) {
    return <div>Loading...</div>;
  }

  const { dapp } = data;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'DORMANT':
        return 'bg-yellow-100 text-yellow-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'DEFI':
        return 'bg-blue-100 text-blue-800';
      case 'NFT':
        return 'bg-purple-100 text-purple-800';
      case 'GAMEFI':
        return 'bg-pink-100 text-pink-800';
      case 'SOCIAL':
        return 'bg-indigo-100 text-indigo-800';
      case 'BRIDGE':
        return 'bg-cyan-100 text-cyan-800';
      case 'INFRA':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getContractTypeColor = (type: string) => {
    switch (type) {
      case 'ERC20':
        return 'bg-blue-50 text-blue-700';
      case 'ERC721':
        return 'bg-purple-50 text-purple-700';
      case 'ERC1155':
        return 'bg-pink-50 text-pink-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link to="/dapps" className="text-blue-600 hover:text-blue-800">
            ← Back to dApps
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {dapp.name || 'Unnamed dApp'}
              </h1>
              {dapp.description && <p className="text-gray-600">{dapp.description}</p>}
            </div>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(dapp.category)}`}>
                {dapp.category}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(dapp.status)}`}>
                {dapp.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
            <div>
              <span className="block text-gray-500">Detection</span>
              <span className="font-medium text-gray-900">{dapp.detectionSource}</span>
            </div>
            <div>
              <span className="block text-gray-500">Created</span>
              <span className="font-medium text-gray-900">
                {new Date(dapp.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="block text-gray-500">Last Updated</span>
              <span className="font-medium text-gray-900">
                {new Date(dapp.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="block text-gray-500">Contracts</span>
              <span className="font-medium text-gray-900">{dapp.contracts.length}</span>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total Transactions</div>
            <div className="text-3xl font-bold text-gray-900">{dapp.stats.totalTxs.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total Users</div>
            <div className="text-3xl font-bold text-gray-900">{dapp.stats.totalUsers.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Avg Txs/Day</div>
            <div className="text-3xl font-bold text-gray-900">{dapp.stats.avgTxsPerDay}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Avg Users/Day</div>
            <div className="text-3xl font-bold text-gray-900">{dapp.stats.avgUsersPerDay}</div>
          </div>
        </div>

        {/* Activity Chart */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Activity (Last 30 Days)</h2>
          <div className="space-y-2">
            {dapp.activities.slice(0, 10).map((activity: any) => (
              <div key={activity.date} className="flex items-center gap-4">
                <div className="w-32 text-sm text-gray-600">
                  {new Date(activity.date).toLocaleDateString()}
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                  <div
                    className="bg-blue-500 h-6 rounded-full flex items-center justify-end px-2"
                    style={{
                      width: `${Math.min((activity.txCount / Math.max(...dapp.activities.map((a: any) => a.txCount))) * 100, 100)}%`,
                    }}
                  >
                    <span className="text-xs text-white font-medium">{activity.txCount}</span>
                  </div>
                </div>
                <div className="w-20 text-sm text-gray-600 text-right">
                  {activity.userCount} users
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contracts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Contracts</h2>
          <div className="space-y-4">
            {dapp.contracts.map((contract: any) => (
              <div key={contract.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="font-mono text-sm text-gray-900 mb-2">{contract.address}</div>
                    <div className="flex gap-2 text-xs">
                      <span className={`px-2 py-1 rounded ${getContractTypeColor(contract.type)}`}>
                        {contract.type}
                      </span>
                      {contract.deploymentDate && (
                        <span className="text-gray-600">
                          Deployed {new Date(contract.deploymentDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {contract.creatorAddress && (
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Creator:</span>{' '}
                    <span className="font-mono">{contract.creatorAddress}</span>
                  </div>
                )}
                {contract.transactionHash && (
                  <div className="text-xs text-gray-600 mt-1">
                    <span className="font-medium">Tx Hash:</span>{' '}
                    <span className="font-mono">{contract.transactionHash}</span>
                  </div>
                )}
                {contract.blockNumber && (
                  <div className="text-xs text-gray-600 mt-1">
                    <span className="font-medium">Block:</span> {contract.blockNumber}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
