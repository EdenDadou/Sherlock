import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useDappsContext } from "~/contexts/DappsContext";
import { DappCard } from "./DappCard";

interface DiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DiscoveryModal({ isOpen, onClose }: DiscoveryModalProps) {
  const {
    dapps,
    loading: dappsLoading,
    error: dappsError,
    syncDapps,
    userInteractedDappIds,
    loadUserInteractions,
    syncMessage,
    interactionsLoading,
    interactionsProgress,
  } = useDappsContext();
  const [syncing, setSyncing] = useState(false);
  const { address: userAddress, isConnected } = useAccount();

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Pass user address if connected so interactions can be re-checked after sync
      await syncDapps(isConnected ? userAddress : undefined);
    } catch (error) {
      console.error("Error syncing dApps:", error);
    } finally {
      setSyncing(false);
    }
  };

  // Load user interactions when modal opens and wallet is connected
  useEffect(() => {
    console.log("🔍 DiscoveryModal - Wallet status:", {
      isOpen,
      isConnected,
      userAddress,
      userInteractedDappIds: userInteractedDappIds.length,
    });

    if (isOpen && isConnected && userAddress) {
      console.log("🔍 Loading user interactions for modal...");
      loadUserInteractions(userAddress);
    } else {
      console.log("⚠️ Not loading interactions:", {
        modalOpen: isOpen,
        walletConnected: isConnected,
        addressAvailable: !!userAddress,
      });
    }
  }, [isOpen, isConnected, userAddress, loadUserInteractions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Découverte de dApps
            </h2>
            <p className="text-gray-400 text-sm">
              Protocoles Monad enrichis depuis GitHub et Google Sheets
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={handleSync}
              disabled={syncing || dappsLoading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? "Synchronisation..." : "Synchroniser"}
            </button>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* dApps List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-white">
              dApps découvertes ({dapps.length})
            </h3>
            <div className="flex items-center gap-2">
              {/* Enrichment Status */}
              {dapps.length > 0 && (
                <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-1.5">
                  <svg
                    className="w-4 h-4 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium text-blue-300">
                    {dapps.filter(d => d.isEnriched).length} enrichies / {dapps.length}
                  </span>
                </div>
              )}

              {/* User Interactions - Loading State */}
              {isConnected && interactionsLoading && (
                <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5">
                  <svg
                    className="w-4 h-4 text-yellow-400 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="text-sm font-medium text-yellow-300">
                    {interactionsProgress || "Recherche en cours..."}
                  </span>
                </div>
              )}

              {/* User Interactions - Completed */}
              {isConnected && !interactionsLoading && userInteractedDappIds.length > 0 && (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-1.5">
                  <svg
                    className="w-4 h-4 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium text-green-300">
                    {userInteractedDappIds.length} utilisée{userInteractedDappIds.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>

          {syncing ? (
            <div className="text-center py-12 text-gray-500">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-400 border-t-transparent mx-auto mb-4" />
              <p className="text-lg font-semibold text-white mb-2">Synchronisation en cours...</p>
              <p className="text-sm">{syncMessage || "Scraping des projets Monvision"}</p>
              {dapps.length > 0 && (
                <p className="text-sm mt-4 text-blue-400">
                  {dapps.length} dApps synchronisées
                </p>
              )}
            </div>
          ) : dappsLoading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-400 border-t-transparent mx-auto mb-4" />
              <p>Chargement des dApps...</p>
              <p className="text-sm mt-2">Récupération depuis la base de données</p>
            </div>
          ) : dappsError ? (
            <div className="text-center py-12 text-red-500">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p>Erreur lors du chargement des dApps</p>
              <p className="text-sm mt-2 text-red-400">{dappsError}</p>
            </div>
          ) : dapps.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <p>Aucune dApp découverte pour le moment</p>
              <p className="text-sm mt-2">
                Cliquez sur "Synchroniser" pour charger les dApps depuis GitHub
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {dapps.map((dapp, index) => (
                <DappCard
                  key={dapp.id}
                  dapp={dapp}
                  index={index}
                  hasUserInteracted={userInteractedDappIds.includes(dapp.id)}
                />
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
