import { useState } from "react";
import { useDappsContext } from "~/contexts/DappsContext";
import { DappCard } from "./DappCard";

interface DiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DiscoveryModal({ isOpen, onClose }: DiscoveryModalProps) {
  const { dapps, loading: dappsLoading, error: dappsError, syncDapps } = useDappsContext();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncDapps();
    } catch (error) {
      console.error("Error syncing dApps:", error);
    } finally {
      setSyncing(false);
    }
  };

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
          <h3 className="text-lg font-semibold text-white mb-4">
            dApps découvertes ({dapps.length})
          </h3>

          {dappsLoading ? (
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
                <DappCard key={dapp.id} dapp={dapp} index={index} />
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
