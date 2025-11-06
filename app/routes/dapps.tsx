import { type LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link, useSearchParams } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // Fetch dApps from our API
  const apiUrl = new URL('/api/dapps', url.origin);
  searchParams.forEach((value, key) => {
    apiUrl.searchParams.set(key, value);
  });

  const response = await fetch(apiUrl.toString());
  const data = await response.json();

  return data;
}

export default function DApps() {
  const data = useLoaderData<typeof loader>();

  if (!data) {
    return <div>Loading...</div>;
  }
  const [searchParams, setSearchParams] = useSearchParams();

  const currentCategory = searchParams.get('category') || 'all';
  const currentStatus = searchParams.get('status') || 'all';
  const currentPage = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === 'all' || value === '') {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const updatePage = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
  };

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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Monad dApp Discovery</h1>
          <p className="text-gray-600">Explore decentralized applications on Monad Testnet</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by name or address..."
                value={search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={currentCategory}
                onChange={(e) => updateFilter('category', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                <option value="DEFI">DeFi</option>
                <option value="NFT">NFT</option>
                <option value="GAMEFI">GameFi</option>
                <option value="SOCIAL">Social</option>
                <option value="BRIDGE">Bridge</option>
                <option value="INFRA">Infrastructure</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={currentStatus}
                onChange={(e) => updateFilter('status', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="DORMANT">Dormant</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {data.dapps.length} of {data.pagination.total} dApps
        </div>

        {/* dApps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {data.dapps.map((dapp: any) => (
            <Link
              key={dapp.id}
              to={`/dapps/${dapp.id}`}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {dapp.name || 'Unnamed dApp'}
                  </h3>
                  {dapp.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{dapp.description}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(dapp.category)}`}>
                  {dapp.category}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(dapp.status)}`}>
                  {dapp.status}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Contracts:</span>
                  <span className="font-medium text-gray-900">{dapp.contractCount}</span>
                </div>
                {dapp.recentActivity.length > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span>Recent Txs:</span>
                      <span className="font-medium text-gray-900">
                        {dapp.recentActivity[0].txCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Users:</span>
                      <span className="font-medium text-gray-900">
                        {dapp.recentActivity[0].userCount}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                Created {new Date(dapp.createdAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>

        {/* Pagination */}
        {data.pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <button
              onClick={() => updatePage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-4 py-2">
              Page {currentPage} of {data.pagination.totalPages}
            </span>
            <button
              onClick={() => updatePage(currentPage + 1)}
              disabled={currentPage === data.pagination.totalPages}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
