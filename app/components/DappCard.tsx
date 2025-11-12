interface DappCardProps {
  dapp: {
    id: string;
    name: string | null;
    symbol: string | null;
    category: string;
    description: string | null;
    logoUrl: string | null;
    banner: string | null;
    website: string | null;
    github: string | null;
    twitter: string | null;
    twitterFollowers: string | null;
    contractCount: number;
    totalTxCount: number;
    uniqueUsers: number;
    totalEventCount: number;
    activityScore: number;
    qualityScore: number;
  };
  index: number;
}

export function DappCard({ dapp, index }: DappCardProps) {
  // Debug: log dapp data to see what we have
  if (index === 0) {
    console.log("DappCard data sample:", {
      name: dapp.name,
      logoUrl: dapp.logoUrl,
      banner: dapp.banner,
      twitter: dapp.twitter,
      website: dapp.website,
      github: dapp.github,
    });
  }

  const getCategoryColor = (category: string) => {
    // Get base category (before underscore) for coloring
    const baseCategory = category.split("_")[0];
    const colors: Record<string, string> = {
      AI: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      CEFI: "bg-orange-500/20 text-orange-300 border-orange-500/30",
      CONSUMER: "bg-pink-500/20 text-pink-300 border-pink-500/30",
      DEFI: "bg-green-500/20 text-green-300 border-green-500/30",
      DEPIN: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
      DESCI: "bg-teal-500/20 text-teal-300 border-teal-500/30",
      GAMING: "bg-violet-500/20 text-violet-300 border-violet-500/30",
      GOVERNANCE: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      INFRA: "bg-slate-500/20 text-slate-300 border-slate-500/30",
      NFT: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
      PAYMENTS: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      UNKNOWN: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    };
    return colors[baseCategory] || colors.UNKNOWN;
  };

  const getCategoryLabel = (category: string) => {
    // Convert DEFI_DEX to "DeFi - DEX"
    if (category === "UNKNOWN") return "Unknown";

    const parts = category.split("_");
    const formatted = parts
      .map((part, index) => {
        // Capitalize first letter, lowercase rest
        if (index === 0) {
          // Main category: AI, DeFi, NFT, etc.
          if (part === "DEFI") return "DeFi";
          if (part === "CEFI") return "CeFi";
          if (part === "DEPIN") return "DePIN";
          if (part === "DESCI") return "DeSci";
          if (part === "NFT") return "NFT";
          return part.charAt(0) + part.slice(1).toLowerCase();
        }
        // Sub-category
        return part.charAt(0) + part.slice(1).toLowerCase();
      })
      .join(" - ");

    return formatted;
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
    <div
      className="relative bg-black/90 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-all animate-fade-in overflow-hidden"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Banner Background */}
      {dapp.banner && (
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center"
          style={{
            backgroundImage: `url(${dapp.banner})`,
            filter: "blur(4px)",
          }}
        />
      )}

      {/* Overlay gradient pour améliorer la lisibilité */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start gap-3 mb-3">
          {/* Logo */}
          <div className="flex-shrink-0">
            {dapp.logoUrl ? (
              <img
                src={dapp.logoUrl}
                alt={dapp.name || "Logo"}
                className="w-16 h-16 rounded-lg bg-gray-700 border-2 border-gray-600"
                onError={(e) => {
                  e.currentTarget.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${dapp.name}&backgroundColor=1e293b&scale=80`;
                }}
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl border-2 border-gray-600">
                {dapp.name?.[0]?.toUpperCase() ||
                  dapp.symbol?.[0]?.toUpperCase() ||
                  "?"}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="text-white font-semibold text-lg truncate mb-1">
                  {dapp.name || dapp.symbol || "dApp sans nom"}
                </h4>
                {dapp.symbol && dapp.name && (
                  <p className="text-xs text-gray-400 font-mono">
                    {dapp.symbol}
                  </p>
                )}
              </div>

              {/* Activity Score Badge */}
              {(dapp.activityScore > 0 || dapp.qualityScore > 0) && (
                <div className="flex items-center gap-1 bg-gray-800/80 px-3 py-1.5 rounded-lg border border-gray-700 backdrop-blur-sm">
                  <svg
                    className="w-4 h-4 text-yellow-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span
                    className={`text-sm font-bold ${getQualityScoreColor(dapp.activityScore || dapp.qualityScore)}`}
                  >
                    {(dapp.activityScore || dapp.qualityScore).toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-500">/10</span>
                </div>
              )}
            </div>

            {/* Category and metadata */}
            <div className="flex items-center flex-wrap gap-2 text-sm text-gray-400 mb-3">
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${getCategoryColor(dapp.category)}`}
              >
                {getCategoryLabel(dapp.category)}
              </span>
              <span className="text-gray-600">•</span>
              <span className="text-xs">
                {dapp.contractCount} contrat{dapp.contractCount > 1 ? "s" : ""}
              </span>
              {(dapp.activityScore > 0 || dapp.qualityScore > 0) && (
                <>
                  <span className="text-gray-600">•</span>
                  <span
                    className={`text-xs font-semibold ${getQualityScoreColor(dapp.activityScore || dapp.qualityScore)}`}
                  >
                    {getQualityScoreLabel(dapp.activityScore || dapp.qualityScore)}
                  </span>
                </>
              )}
            </div>

            {/* Description */}
            {dapp.description && (
              <div className="text-sm text-gray-300 mb-3 line-clamp-2 leading-relaxed">
                {dapp.description}
              </div>
            )}

            {/* Twitter Followers - Prominent Display */}
            {dapp.twitterFollowers && (
              <div className="mb-3">
                <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/30 rounded-lg px-3 py-2">
                  <svg
                    className="w-4 h-4 text-sky-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-sky-300">
                      {dapp.twitterFollowers}
                    </span>
                    <span className="text-xs text-sky-400/70">followers</span>
                  </div>
                </div>
              </div>
            )}

            {/* Stats */}
            {(dapp.totalTxCount > 0 || dapp.uniqueUsers > 0) && (
              <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                <div className="bg-gray-800/80 rounded-lg px-3 py-2 backdrop-blur-sm border border-gray-700">
                  <div className="text-gray-500 text-[10px] mb-0.5">Transactions</div>
                  <div className="text-white font-semibold">
                    {dapp.totalTxCount.toLocaleString()}
                  </div>
                </div>
                <div className="bg-gray-800/80 rounded-lg px-3 py-2 backdrop-blur-sm border border-gray-700">
                  <div className="text-gray-500 text-[10px] mb-0.5">Utilisateurs</div>
                  <div className="text-white font-semibold">
                    {dapp.uniqueUsers.toLocaleString()}
                  </div>
                </div>
                <div className="bg-gray-800/80 rounded-lg px-3 py-2 backdrop-blur-sm border border-gray-700">
                  <div className="text-gray-500 text-[10px] mb-0.5">Événements</div>
                  <div className="text-white font-semibold">
                    {dapp.totalEventCount.toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {/* Links */}
            {(dapp.website || dapp.github || dapp.twitter) && (
              <div className="flex items-center gap-3 flex-wrap">
                {dapp.website && (
                  <a
                    href={dapp.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors bg-gray-800/80 px-2.5 py-1.5 rounded-md border border-gray-700 hover:border-blue-500/50 backdrop-blur-sm"
                  >
                    <svg
                      className="w-3.5 h-3.5"
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
                    className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1.5 transition-colors bg-gray-800/80 px-2.5 py-1.5 rounded-md border border-gray-700 hover:border-gray-500 backdrop-blur-sm"
                  >
                    <svg
                      className="w-3.5 h-3.5"
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
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1.5 transition-colors bg-gray-800/80 px-2.5 py-1.5 rounded-md border border-gray-700 hover:border-sky-500/50 backdrop-blur-sm"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <span>Twitter</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
