import { useEffect, useState, useRef } from "react";
import { useFetcher } from "react-router";

interface ScanProgress {
  currentBlock: number;
  totalBlocks: number;
  dappsDiscovered: number;
  contractsFound: number;
  progress: number;
  status: "idle" | "scanning" | "completed" | "error";
  error?: string;
  currentStep?: string;
}

interface DiscoveredDApp {
  id?: string;
  name: string;
  description?: string;
  logoUrl?: string | null;
  logo?: string | null;
  banner?: string | null;
  symbol?: string | null;
  category: string;
  website?: string;
  github?: string;
  twitter?: string;
  contractCount: number;
  contracts?: Array<{
    address: string;
    type: string;
    deploymentDate?: Date;
  }>;
  discoveredAt?: Date;
  // Stats from enrichment
  stats?: {
    totalTxCount: number;
    totalEventCount: number;
    uniqueUsers: number;
    activityScore: number;
    contractCount: number;
    firstActivity: Date | null;
    lastActivity: Date | null;
  };
  // Legacy quality scoring (for backward compatibility)
  qualityScore?: number;
  activityScore?: number;
  diversityScore?: number;
  ageScore?: number;
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
    status: "idle",
  });
  const [discoveredDApps, setDiscoveredDApps] = useState<DiscoveredDApp[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Charger les dApps en cache au démarrage
    loadCachedDapps();

    // Connexion SSE pour recevoir les mises à jour en temps réel
    const eventSource = new EventSource("/api/discovery/events");
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("progress", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setProgress(data);
    });

    eventSource.addEventListener("dapp-discovered", (e: MessageEvent) => {
      const dapp = JSON.parse(e.data);
      setDiscoveredDApps((prev) => [dapp, ...prev]);
    });

    eventSource.addEventListener("completed", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setProgress(data);
    });

    eventSource.addEventListener("error", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setProgress(data);
    });

    eventSource.addEventListener("stopped", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setProgress(data);
    });

    eventSource.onerror = () => {
      console.error("EventSource error");
    };

    return () => {
      eventSource.close();
    };
  }, [isOpen]);

  const loadCachedDapps = async () => {
    try {
      const response = await fetch("/api/dapps/cached");
      const result = await response.json();

      if (result.success && result.data.length > 0) {
        setDiscoveredDApps(result.data);
        setProgress({
          currentBlock: 0,
          totalBlocks: 0,
          dappsDiscovered: result.count,
          contractsFound: result.data.reduce(
            (sum: number, p: DiscoveredDApp) => sum + p.contractCount,
            0
          ),
          progress: 100,
          status: "completed",
        });
      }
    } catch (error) {
      console.error("Erreur lors du chargement des dApps en cache:", error);
    }
  };

  const handleStartScan = async () => {
    setDiscoveredDApps([]);
    setProgress({
      currentBlock: 0,
      totalBlocks: 0,
      dappsDiscovered: 0,
      contractsFound: 0,
      progress: 0,
      status: "scanning",
    });

    try {
      const eventSource = new EventSource(
        "/api/discovery/enrich-stream?network=testnet"
      );
      let totalProtocols = 0;
      let enrichedCount = 0;

      eventSource.addEventListener("started", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        console.log("🚀 Enrichissement démarré:", data.network);
      });

      eventSource.addEventListener("protocols-loaded", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        totalProtocols = data.total;
        setProgress((prev) => ({
          ...prev,
          totalBlocks: data.total,
        }));
      });

      eventSource.addEventListener("progress", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setProgress((prev) => ({
          ...prev,
          currentBlock: data.current || 0,
          totalBlocks: totalProtocols,
          progress: data.progress || 0,
          currentStep: data.step || prev.currentStep,
          status: "scanning",
        }));
      });

      eventSource.addEventListener("dapp-enriched", (e: MessageEvent) => {
        const dapp = JSON.parse(e.data);
        enrichedCount++;

        setDiscoveredDApps((prev) => [
          ...prev,
          {
            name: dapp.name,
            description: dapp.description,
            category: dapp.category || "UNKNOWN",
            website: dapp.website,
            github: dapp.github,
            twitter: dapp.twitter,
            logo: dapp.logo,
            logoUrl: dapp.logo,
            banner: dapp.banner,
            contractCount: dapp.contractCount,
            stats: dapp.stats,
          },
        ]);

        setProgress((prev) => ({
          ...prev,
          dappsDiscovered: enrichedCount,
          contractsFound: prev.contractsFound + dapp.contractCount,
        }));
      });

      eventSource.addEventListener("completed", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setProgress((prev) => ({
          ...prev,
          progress: 100,
          status: "completed",
        }));
        eventSource.close();
      });

      eventSource.addEventListener("error", (e: MessageEvent) => {
        const data = e.data ? JSON.parse(e.data) : {};
        setProgress({
          currentBlock: 0,
          totalBlocks: 0,
          dappsDiscovered: 0,
          contractsFound: 0,
          progress: 0,
          status: "error",
          error: data.message || "Erreur lors de l'enrichissement",
        });
        eventSource.close();
      });

      eventSource.onerror = () => {
        console.error("EventSource error");
        eventSource.close();
      };
    } catch (error) {
      setProgress({
        currentBlock: 0,
        totalBlocks: 0,
        dappsDiscovered: 0,
        contractsFound: 0,
        progress: 0,
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de l'enrichissement",
      });
    }
  };

  const handleStopScan = () => {
    const formData = new FormData();
    formData.append("action", "stop");
    fetcher.submit(formData, { method: "post", action: "/api/discovery/scan" });
  };

  const handleClose = () => {
    if (progress.status === "scanning") {
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
      DEX: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      LENDING: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      DEFI: "bg-green-500/20 text-green-300 border-green-500/30",
      NFT: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      NFT_MARKETPLACE: "bg-violet-500/20 text-violet-300 border-violet-500/30",
      GAMEFI: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
      SOCIAL: "bg-pink-500/20 text-pink-300 border-pink-500/30",
      BRIDGE: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      GOVERNANCE: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      TOKEN: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      INFRA: "bg-slate-500/20 text-slate-300 border-slate-500/30",
      UNKNOWN: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    };
    return colors[category] || colors.UNKNOWN;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      DEX: "DEX",
      LENDING: "Lending",
      DEFI: "DeFi",
      NFT: "NFT",
      NFT_MARKETPLACE: "NFT Marketplace",
      GAMEFI: "GameFi",
      SOCIAL: "Social",
      BRIDGE: "Bridge",
      GOVERNANCE: "Governance",
      TOKEN: "Token",
      INFRA: "Infrastructure",
      UNKNOWN: "Unknown",
    };
    return labels[category] || category;
  };

  const getQualityScoreColor = (score: number) => {
    if (score >= 7) return "text-green-400";
    if (score >= 5) return "text-yellow-400";
    if (score >= 3) return "text-orange-400";
    return "text-red-400";
  };

  const getQualityScoreLabel = (score: number) => {
    if (score >= 7) return "Excellent";
    if (score >= 5) return "Bon";
    if (score >= 3) return "Moyen";
    return "Faible";
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="p-4 border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Découverte de dApps
            </h2>
            <p className="text-gray-400 text-sm">
              Enrichissement des protocoles Monad avec stats d'activité Envio
            </p>
          </div>
          <div className="flex gap-2">
            {progress.status === "idle" ||
            progress.status === "completed" ||
            progress.status === "error" ? (
              <>
                <button
                  onClick={handleStartScan}
                  disabled={fetcher.state !== "idle"}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {progress.status === "completed"
                    ? "Rafraîchir les données"
                    : "Enrichir les protocoles"}
                </button>
                <button
                  onClick={loadCachedDapps}
                  disabled={fetcher.state !== "idle"}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Recharger depuis le cache
                </button>
              </>
            ) : (
              <button
                onClick={handleStopScan}
                disabled={fetcher.state !== "idle"}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Arrêter le scan
              </button>
            )}

            {progress.status === "scanning" && (
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-400 border-t-transparent" />
                <span>Scan en cours...</span>
              </div>
            )}

            {progress.status === "completed" && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Scan terminé !</span>
              </div>
            )}

            {progress.status === "error" && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <svg
                  className="w-5 h-5"
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
                <span>Erreur: {progress.error}</span>
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
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

        {/* Progress Section */}
        <div className="p-4 border-b border-gray-700">
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
            {progress.currentStep && progress.status === "scanning" && (
              <div className="mt-2 text-xs text-gray-400 flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-400 border-t-transparent" />
                <span>{progress.currentStep}</span>
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
                Démarrez le scan pour commencer la découverte
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {discoveredDApps.map((dapp, index) => (
                <div
                  key={dapp.id || dapp.name || index}
                  className="relative bg-black/90 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-all animate-fade-in overflow-hidden"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Banner Background */}
                  {dapp.banner && (
                    <div
                      className="absolute inset-0 opacity-50 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${dapp.banner})`,
                        filter: "blur(2px)",
                      }}
                    />
                  )}

                  {/* Content (relative to show above banner) */}
                  <div className="relative z-10">
                    <div className="flex items-start gap-3 mb-3">
                      {/* Logo */}
                      <div className="flex-shrink-0">
                        {dapp.logoUrl || dapp.logo ? (
                          <img
                            src={dapp.logoUrl || dapp.logo || ""}
                            alt={dapp.name || "Logo"}
                            className="w-12 h-12 rounded-lg bg-gray-700"
                            onError={(e) => {
                              // Fallback en cas d'erreur de chargement
                              e.currentTarget.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${dapp.name}&backgroundColor=1e293b&scale=80`;
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                            {dapp.name?.[0]?.toUpperCase() ||
                              dapp.symbol?.[0]?.toUpperCase() ||
                              "?"}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1">
                            <h4 className="text-white font-medium truncate">
                              {dapp.name || dapp.symbol || "dApp sans nom"}
                            </h4>
                            {dapp.symbol && dapp.name && (
                              <p className="text-xs text-gray-400 font-mono">
                                {dapp.symbol}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Activity Score Badge */}
                            {((dapp.stats?.activityScore !== undefined &&
                              dapp.stats.activityScore > 0) ||
                              (dapp.qualityScore !== undefined &&
                                dapp.qualityScore > 0)) && (
                              <div className="flex items-center gap-1 bg-gray-800 px-2 py-1 rounded-md border border-gray-700">
                                <svg
                                  className="w-3 h-3 text-yellow-400"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                <span
                                  className={`text-xs font-bold ${getQualityScoreColor(dapp.stats?.activityScore || dapp.qualityScore || 0)}`}
                                >
                                  {(
                                    dapp.stats?.activityScore ||
                                    dapp.qualityScore ||
                                    0
                                  ).toFixed(1)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  /10
                                </span>
                              </div>
                            )}
                            <div className="text-xs text-gray-500">
                              À l'instant
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center flex-wrap gap-2 text-sm text-gray-400 mb-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium border ${getCategoryColor(dapp.category)}`}
                          >
                            {getCategoryLabel(dapp.category)}
                          </span>
                          <span className="text-gray-600">•</span>
                          <span className="text-xs">
                            {dapp.contractCount} contrat
                            {dapp.contractCount > 1 ? "s" : ""}
                          </span>
                          {((dapp.stats?.activityScore !== undefined &&
                            dapp.stats.activityScore > 0) ||
                            (dapp.qualityScore !== undefined &&
                              dapp.qualityScore > 0)) && (
                            <>
                              <span className="text-gray-600">•</span>
                              <span
                                className={`text-xs font-medium ${getQualityScoreColor(dapp.stats?.activityScore || dapp.qualityScore || 0)}`}
                              >
                                {getQualityScoreLabel(
                                  dapp.stats?.activityScore ||
                                    dapp.qualityScore ||
                                    0
                                )}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Description (si disponible) */}
                        {dapp.description && (
                          <div className="text-xs text-gray-400 mb-2 line-clamp-2">
                            {dapp.description}
                          </div>
                        )}

                        {/* Enrichment Stats (si disponible) */}
                        {dapp.stats && (
                          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                            <div className="bg-gray-800/50 rounded px-2 py-1">
                              <div className="text-gray-500 text-[10px]">
                                Transactions
                              </div>
                              <div className="text-white font-medium">
                                {dapp.stats.totalTxCount.toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-gray-800/50 rounded px-2 py-1">
                              <div className="text-gray-500 text-[10px]">
                                Utilisateurs
                              </div>
                              <div className="text-white font-medium">
                                {dapp.stats.uniqueUsers.toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-gray-800/50 rounded px-2 py-1">
                              <div className="text-gray-500 text-[10px]">
                                Événements
                              </div>
                              <div className="text-white font-medium">
                                {dapp.stats.totalEventCount.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Legacy Quality Score Details (pour backward compatibility) */}
                        {!dapp.stats &&
                          dapp.qualityScore !== undefined &&
                          dapp.qualityScore > 0 && (
                            <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                              {dapp.activityScore !== undefined && (
                                <div className="bg-gray-800/50 rounded px-2 py-1">
                                  <div className="text-gray-500 text-[10px]">
                                    Activity
                                  </div>
                                  <div className="text-white font-medium">
                                    {dapp.activityScore.toFixed(1)}
                                  </div>
                                </div>
                              )}
                              {dapp.diversityScore !== undefined && (
                                <div className="bg-gray-800/50 rounded px-2 py-1">
                                  <div className="text-gray-500 text-[10px]">
                                    Diversity
                                  </div>
                                  <div className="text-white font-medium">
                                    {dapp.diversityScore.toFixed(1)}
                                  </div>
                                </div>
                              )}
                              {dapp.ageScore !== undefined && (
                                <div className="bg-gray-800/50 rounded px-2 py-1">
                                  <div className="text-gray-500 text-[10px]">
                                    Age
                                  </div>
                                  <div className="text-white font-medium">
                                    {dapp.ageScore.toFixed(1)}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Contracts list (optional, for backward compatibility) */}
                    {dapp.contracts && dapp.contracts.length > 0 && (
                      <div className="space-y-1 pl-15">
                        {dapp.contracts.slice(0, 3).map((contract) => (
                          <div
                            key={contract.address}
                            className="flex items-center gap-2 text-xs font-mono"
                          >
                            <span className="text-gray-500">
                              {contract.type}
                            </span>
                            <span className="text-gray-600">•</span>
                            <span className="text-gray-400">
                              {contract.address}
                            </span>
                          </div>
                        ))}
                        {dapp.contractCount > 3 && (
                          <div className="text-xs text-gray-500 italic">
                            +{dapp.contractCount - 3} autre
                            {dapp.contractCount - 3 > 1 ? "s" : ""} contrat
                            {dapp.contractCount - 3 > 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Links (Website, GitHub, Twitter) */}
                    {(dapp.website || dapp.github || dapp.twitter) && (
                      <div className="mt-2 pl-15 flex items-center gap-3 flex-wrap">
                        {dapp.website && (
                          <a
                            href={dapp.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                            Website
                          </a>
                        )}
                        {dapp.github && (
                          <a
                            href={dapp.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                fillRule="evenodd"
                                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                                clipRule="evenodd"
                              />
                            </svg>
                            GitHub
                          </a>
                        )}
                        {dapp.twitter && (
                          <a
                            href={dapp.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            Twitter
                          </a>
                        )}
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
