import { type LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const response = await fetch(`${url.origin}/api/stats`);
  const data = await response.json();

  return data;
}

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();

  if (!data) {
    return <div>Loading...</div>;
  }

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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Monad Testnet dApp Discovery Overview</p>
        </div>

        {/* Overview Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total dApps</div>
            <div className="text-3xl font-bold text-gray-900">
              {data.overview.totalDApps.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {data.overview.activeDApps} active
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total Contracts</div>
            <div className="text-3xl font-bold text-gray-900">
              {data.overview.totalContracts.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Deployed on testnet
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Transactions Today</div>
            <div className="text-3xl font-bold text-gray-900">
              {data.overview.totalTxsToday.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Across all dApps
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Users Today</div>
            <div className="text-3xl font-bold text-gray-900">
              {data.overview.totalUsersToday.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Unique addresses
            </div>
          </div>
        </div>

        {/* dApp Status Distribution */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">dApp Status Distribution</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {data.overview.activeDApps}
              </div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {data.overview.dormantDApps}
              </div>
              <div className="text-sm text-gray-600">Dormant</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                {data.overview.inactiveDApps}
              </div>
              <div className="text-sm text-gray-600">Inactive</div>
            </div>
          </div>
        </div>

        {/* Trending dApps */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Trending dApps (24h)</h2>
            <Link to="/dapps?sort=activity" className="text-blue-600 hover:text-blue-800 text-sm">
              View all →
            </Link>
          </div>
          <div className="space-y-4">
            {data.trending.slice(0, 5).map((item: any, index: number) => (
              <Link
                key={item.dapp.id}
                to={`/dapps/${item.dapp.id}`}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
              >
                <div className="shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">
                      {item.dapp.name || 'Unnamed dApp'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(item.dapp.category)}`}>
                      {item.dapp.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(item.dapp.status)}`}>
                      {item.dapp.status}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-600">
                    <span>{item.txCount} transactions</span>
                    <span>{item.userCount} users</span>
                    <span>{item.eventCount} events</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* New dApps */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recently Discovered</h2>
            <Link to="/dapps?sort=createdAt&order=desc" className="text-blue-600 hover:text-blue-800 text-sm">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.new.slice(0, 6).map((dapp: any) => (
              <Link
                key={dapp.id}
                to={`/dapps/${dapp.id}`}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(dapp.category)}`}>
                    {dapp.category}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(dapp.status)}`}>
                    {dapp.status}
                  </span>
                </div>
                <div className="font-semibold text-gray-900 mb-1">
                  {dapp.name || 'Unnamed dApp'}
                </div>
                <div className="text-xs text-gray-600">
                  {dapp.contractCount} contract{dapp.contractCount !== 1 ? 's' : ''}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {new Date(dapp.createdAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
