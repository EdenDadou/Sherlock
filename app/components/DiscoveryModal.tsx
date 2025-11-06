import { useEffect, useState, useRef } from 'react';
import { useFetcher } from 'react-router';

interface ScanProgress {
  currentBlock: number;
  totalBlocks: number;
  dappsDiscovered: number;
  contractsFound: number;
  progress: number;
  status: 'idle' | 'scanning' | 'completed' | 'error';
  error?: string;
}

interface DiscoveredDApp {
  id: string;
  name: string | null;
  category: string;
  contractCount: number;
  contracts: Array<{
    address: string;
    type: string;
  }>;
  discoveredAt: Date;
}

interface DiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DiscoveryModal({ isOpen, onClose }: DiscoveryModalProps) {
  const fetcher = useFetcher();
  const [progress, setProgress] = useState<ScanProgress>({
    currentBlock: 0,
    totalBlocks: 40000,
    dappsDiscovered: 0,
    contractsFound: 0,
    progress: 0,
    status: 'idle'
  });
  const [discoveredDApps, setDiscoveredDApps] = useState<DiscoveredDApp[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Connexion SSE pour recevoir les mises à jour en temps réel
    const eventSource = new EventSource('/api/discovery/events');
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('progress', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setProgress(data);
    });

    eventSource.addEventListener('dapp-discovered', (e: MessageEvent) => {
      const dapp = JSON.parse(e.data);
      setDiscoveredDApps(prev => [dapp, ...prev]);
    });

    eventSource.addEventListener('completed', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setProgress(data);
    });

    eventSource.addEventListener('error', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setProgress(data);
    });

    eventSource.addEventListener('stopped', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setProgress(data);
    });

    eventSource.onerror = () => {
      console.error('EventSource error');
    };

    return () => {
      eventSource.close();
    };
  }, [isOpen]);

  const handleStartScan = () => {
    setDiscoveredDApps([]);
    const formData = new FormData();
    formData.append('action', 'start');
    fetcher.submit(formData, { method: 'post', action: '/api/discovery/scan' });
  };

  const handleStopScan = () => {
    const formData = new FormData();
    formData.append('action', 'stop');
    fetcher.submit(formData, { method: 'post', action: '/api/discovery/scan' });
  };

  const handleClose = () => {
    if (progress.status === 'scanning') {
      handleStopScan();
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    onClose();
  };

  if (!isOpen) return null;

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      DEFI: 'bg-green-500/20 text-green-300',
      NFT: 'bg-purple-500/20 text-purple-300',
      GAMEFI: 'bg-blue-500/20 text-blue-300',
      SOCIAL: 'bg-pink-500/20 text-pink-300',
      BRIDGE: 'bg-yellow-500/20 text-yellow-300',
      INFRA: 'bg-gray-500/20 text-gray-300',
      UNKNOWN: 'bg-gray-500/20 text-gray-400'
    };
    return colors[category] || colors.UNKNOWN;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Découverte de dApps
            </h2>
            <p className="text-gray-400 text-sm">
              Scan des 40 000 derniers blocs de la blockchain
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Section */}
        <div className="p-6 border-b border-gray-700">
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Progression</span>
              <span className="text-white font-mono">{progress.progress}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Bloc actuel</div>
              <div className="text-white font-mono text-lg">
                {progress.currentBlock.toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">dApps découvertes</div>
              <div className="text-green-400 font-mono text-lg">
                {progress.dappsDiscovered}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Contrats trouvés</div>
              <div className="text-blue-400 font-mono text-lg">
                {progress.contractsFound}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {progress.status === 'idle' || progress.status === 'completed' || progress.status === 'error' ? (
              <button
                onClick={handleStartScan}
                disabled={fetcher.state !== 'idle'}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {progress.status === 'completed' ? 'Relancer le scan' : 'Démarrer le scan'}
              </button>
            ) : (
              <button
                onClick={handleStopScan}
                disabled={fetcher.state !== 'idle'}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Arrêter le scan
              </button>
            )}

            {progress.status === 'scanning' && (
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-400 border-t-transparent" />
                <span>Scan en cours...</span>
              </div>
            )}

            {progress.status === 'completed' && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Scan terminé !</span>
              </div>
            )}

            {progress.status === 'error' && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Erreur: {progress.error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Discovered dApps List */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            dApps découvertes ({discoveredDApps.length})
          </h3>

          {discoveredDApps.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p>Aucune dApp découverte pour le moment</p>
              <p className="text-sm mt-2">Démarrez le scan pour commencer la découverte</p>
            </div>
          ) : (
            <div className="space-y-3">
              {discoveredDApps.map((dapp, index) => (
                <div
                  key={dapp.id}
                  className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-all animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="text-white font-medium mb-1">
                        {dapp.name || 'dApp sans nom'}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(dapp.category)}`}>
                          {dapp.category}
                        </span>
                        <span>•</span>
                        <span>{dapp.contractCount} contrat{dapp.contractCount > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      À l'instant
                    </div>
                  </div>

                  <div className="space-y-1">
                    {dapp.contracts.slice(0, 3).map((contract) => (
                      <div
                        key={contract.address}
                        className="flex items-center gap-2 text-xs font-mono"
                      >
                        <span className="text-gray-500">{contract.type}</span>
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-400">{contract.address}</span>
                      </div>
                    ))}
                    {dapp.contractCount > 3 && (
                      <div className="text-xs text-gray-500 italic">
                        +{dapp.contractCount - 3} autre{dapp.contractCount - 3 > 1 ? 's' : ''} contrat{dapp.contractCount - 3 > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
