import type { ActionFunction, ActionFunctionArgs } from "react-router";
import { prisma } from "~/lib/db/prisma";

const GITHUB_PROTOCOLS_DIR_API =
  "https://api.github.com/repos/monad-crypto/protocols/contents/testnet";
const GOOGLE_SHEETS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1LvM26stpFO7kJk4Y974NhLznjerMh6h8wvZBeYja26M/export?format=csv&gid=0";

interface GitHubFileInfo {
  name: string;
  download_url: string;
  type: string;
}

interface GitHubProtocolData {
  name: string;
  description?: string;
  live?: boolean;
  categories?: string[];
  addresses?: Record<string, string>;
  links?: {
    project?: string;
    twitter?: string;
    github?: string;
    docs?: string;
  };
}

interface GitHubProtocol {
  id?: string;
  name: string;
  protocol?: string;
  description?: string;
  logo?: string;
  symbol?: string;
  category?: string;
  website?: string;
  github?: string;
  twitter?: string;
  contracts?: Array<{
    address: string;
    type?: string;
    name?: string;
    symbol?: string;
  }>;
}

/**
 * Fetch protocols from GitHub
 * Returns empty array if GitHub source is unavailable
 */
async function fetchGitHubProtocols(): Promise<GitHubProtocol[]> {
  try {
    // 1. Fetch the list of files in the testnet directory
    const dirResponse = await fetch(GITHUB_PROTOCOLS_DIR_API);
    if (!dirResponse.ok) {
      console.warn(
        `⚠️  GitHub directory unavailable: ${dirResponse.statusText}`
      );
      return [];
    }

    const files: GitHubFileInfo[] = await dirResponse.json();
    const jsonFiles = files.filter(
      (file) => file.type === "file" && file.name.endsWith(".json")
    );

    console.log(`📂 Found ${jsonFiles.length} protocol files in GitHub`);

    // 2. Fetch each JSON file and transform the data
    const protocols: GitHubProtocol[] = [];

    for (const file of jsonFiles) {
      try {
        const fileResponse = await fetch(file.download_url);
        if (!fileResponse.ok) {
          console.warn(
            `⚠️  Failed to fetch ${file.name}: ${fileResponse.statusText}`
          );
          continue;
        }

        const data: GitHubProtocolData = await fileResponse.json();

        // Transform addresses object to contracts array
        const contracts = data.addresses
          ? Object.entries(data.addresses).map(([name, address]) => ({
              address,
              name,
              type: "UNKNOWN" as const,
            }))
          : [];

        // Extract category from categories array
        const category =
          data.categories && data.categories.length > 0
            ? data.categories[0].split("::")[0]
            : undefined;

        // Transform to GitHubProtocol format
        const protocol: GitHubProtocol = {
          id: data.name,
          name: data.name,
          description: data.description,
          category,
          website: data.links?.project,
          github: data.links?.github,
          twitter: data.links?.twitter,
          contracts,
        };

        protocols.push(protocol);
      } catch (error) {
        console.warn(`⚠️  Failed to process ${file.name}:`, error);
      }
    }

    console.log(
      `✅ Successfully loaded ${protocols.length} protocols from GitHub`
    );
    return protocols;
  } catch (error) {
    console.warn(`⚠️  Failed to fetch GitHub protocols:`, error);
    return [];
  }
}

/**
 * Fetch enrichment data from Google Sheets (CSV)
 * Returns empty object if Google Sheets is unavailable
 */
async function fetchGoogleSheetsData(): Promise<Record<string, any>> {
  try {
    const response = await fetch(GOOGLE_SHEETS_CSV_URL);
    if (!response.ok) {
      console.warn(`⚠️  Google Sheets unavailable: ${response.statusText}`);
      return {};
    }

    const csvText = await response.text();
    const lines = csvText.split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

    const enrichmentMap: Record<string, any> = {};

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (handle quoted values)
      const values: string[] = [];
      let currentValue = "";
      let insideQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === "," && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = "";
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());

      const rowData: Record<string, any> = {};
      headers.forEach((header, index) => {
        rowData[header] = values[index]?.replace(/"/g, "") || "";
      });

      // Use protocol name as key (adjust based on actual CSV structure)
      const protocolName =
        rowData.NAME || rowData.name || rowData.Name || rowData.protocol;
      if (protocolName) {
        enrichmentMap[protocolName.toLowerCase()] = rowData;
      }
    }

    return enrichmentMap;
  } catch (error) {
    console.warn(`⚠️  Failed to fetch Google Sheets data:`, error);
    return {};
  }
}

/**
 * Map category string to enum value
 * Handles hierarchical categories like "DeFi::DEX" from GitHub
 */
function mapCategory(category?: string) {
  if (!category) return "UNKNOWN" as const;

  // Convert "Category::Subcategory" to "CATEGORY_SUBCATEGORY"
  // e.g., "DeFi::DEX" -> "DEFI_DEX"
  // e.g., "AI::Agent Launchpad" -> "AI_AGENT_LAUNCHPAD"
  const enumValue = category
    .toUpperCase()
    .replace(/::/g, "_")
    .replace(/\s+/g, "_")
    .replace(/\//g, "_")
    .replace(/-/g, "_")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/_+/g, "_"); // Replace multiple underscores with single

  // List of all valid categories from the updated enum
  const validCategories = [
    // AI
    "AI_AGENT_LAUNCHPAD", "AI_ABSTRACTION_INFRASTRUCTURE", "AI_CONSUMER_AI",
    "AI_DATA", "AI_COMPUTE", "AI_INFERENCE", "AI_GAMING", "AI_INFRASTRUCTURE",
    "AI_INVESTING", "AI_MODELS", "AI_TRADING_AGENT", "AI_OTHER",
    // CeFi
    "CEFI_CEX", "CEFI_INSTITUTIONAL_TRADING", "CEFI_OTHER",
    // Consumer
    "CONSUMER_BETTING", "CONSUMER_ECOMMERCE_TICKETING", "CONSUMER_PREDICTION_MARKET",
    "CONSUMER_SOCIAL", "CONSUMER_OTHER",
    // DeFi
    "DEFI_ASSET_ALLOCATORS", "DEFI_ASSET_ISSUERS", "DEFI_CDP", "DEFI_CROSS_CHAIN",
    "DEFI_DEX", "DEFI_DEX_AGGREGATOR", "DEFI_INDEXES", "DEFI_INSURANCE",
    "DEFI_INTENTS", "DEFI_LAUNCHPADS", "DEFI_LENDING", "DEFI_LEVERAGED_FARMING",
    "DEFI_LIQUID_STAKING", "DEFI_MEMECOIN", "DEFI_MEV", "DEFI_OPTIONS",
    "DEFI_PERPETUALS_DERIVATIVES", "DEFI_PRIME_BROKERAGE", "DEFI_RESERVE_CURRENCY",
    "DEFI_RWA", "DEFI_STABLECOIN", "DEFI_STABLESWAP", "DEFI_STAKING",
    "DEFI_SYNTHETICS", "DEFI_TRADING_INTERFACES", "DEFI_UNCOLLATERALIZED_LENDING",
    "DEFI_YIELD", "DEFI_YIELD_AGGREGATOR", "DEFI_OTHER",
    // DePIN
    "DEPIN_SPATIAL_INTELLIGENCE", "DEPIN_CDN", "DEPIN_COMPUTE",
    "DEPIN_DATA_COLLECTION", "DEPIN_DATA_LABELLING", "DEPIN_MAPPING",
    "DEPIN_MONITORING_NETWORKS", "DEPIN_STORAGE", "DEPIN_WIRELESS_NETWORK",
    "DEPIN_OTHER",
    // DeSci
    "DESCI_OTHER",
    // Gaming
    "GAMING_METAVERSE", "GAMING_MOBILE_FIRST", "GAMING_GAMES",
    "GAMING_INFRASTRUCTURE", "GAMING_OTHER",
    // Governance
    "GOVERNANCE_DELEGATION", "GOVERNANCE_RISK_MANAGEMENT", "GOVERNANCE_OTHER",
    // Infra
    "INFRA_AA", "INFRA_AUTOMATION", "INFRA_ANALYTICS", "INFRA_DEVELOPER_TOOLING",
    "INFRA_IDENTITY", "INFRA_INDEXING", "INFRA_INTEROPERABILITY", "INFRA_GAMING",
    "INFRA_ORACLE", "INFRA_PRIVACY_ENCRYPTION", "INFRA_RPC", "INFRA_OTHER",
    "INFRA_ZK", "INFRA_RAAS", "INFRA_WAAS", "INFRA_WALLET",
    // NFT
    "NFT_COLLECTIONS", "NFT_INFRASTRUCTURE", "NFT_INTEROPERABILITY",
    "NFT_MARKETPLACE", "NFT_NFTFI", "NFT_OTHER",
    // Payments
    "PAYMENTS_CREDIT_CARDS", "PAYMENTS_ONRAMP_OFFRAMPS", "PAYMENTS_NEOBANKS",
    "PAYMENTS_ORCHESTRATION", "PAYMENTS_REMITTANCE", "PAYMENTS_OTHER",
  ] as const;

  return validCategories.includes(enumValue as any) ? enumValue : "UNKNOWN";
}

/**
 * POST /api/dapps/sync
 * Sync dApps from GitHub and Google Sheets to database
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    console.log("🔄 Starting dApps sync...");

    // Fetch data from both sources
    const [githubProtocols, enrichmentMap] = await Promise.all([
      fetchGitHubProtocols(),
      fetchGoogleSheetsData(),
    ]);
    console.log(enrichmentMap);

    console.log(`📦 Fetched ${githubProtocols.length} protocols from GitHub`);
    console.log(
      `📊 Fetched ${Object.keys(enrichmentMap).length} enrichment entries from Google Sheets`
    );

    let addedCount = 0;
    let updatedCount = 0;
    let enrichedCount = 0;

    // Process each protocol
    for (const protocol of githubProtocols) {
      const protocolName = protocol.name || protocol.protocol;
      if (!protocolName) continue;

      const enrichment = enrichmentMap[protocolName.toLowerCase()] || {};
      const githubId = protocol.id || protocolName;

      // Debug: log enrichment data
      if (Object.keys(enrichment).length > 0) {
        console.log(`🔍 Enrichment data for ${protocolName}:`, {
          availableFields: Object.keys(enrichment),
          LOGO: enrichment.LOGO,
          BANNER: enrichment.BANNER,
          INFO: enrichment.INFO,
          WEB: enrichment.WEB,
          X: enrichment.X,
          TAGS: enrichment.TAGS,
        });
      }

      // Check if dApp already exists
      const existingDapp = await prisma.dApp.findFirst({
        where: {
          OR: [{ githubId }, { name: protocolName }],
        },
      });

      // Extract logo from enrichment data (try multiple field names)
      const logoUrl =
        enrichment.LOGO ||
        enrichment.logo ||
        enrichment.logoUrl ||
        enrichment.logo_url ||
        enrichment.Logo ||
        protocol.logo ||
        null;

      // Extract banner from enrichment data (try multiple field names)
      const banner =
        enrichment.BANNER ||
        enrichment.banner ||
        enrichment.Banner ||
        enrichment.banner_url ||
        null;

      // Extract twitter/X from enrichment data (try multiple field names)
      const twitter =
        enrichment.twitter ||
        enrichment.Twitter ||
        enrichment.x ||
        enrichment.X ||
        protocol.twitter ||
        null;

      const dappData = {
        name: protocolName,
        description:
          enrichment.INFO ||
          enrichment.description ||
          protocol.description ||
          null,
        logoUrl,
        banner,
        symbol: protocol.symbol || null,
        website:
          enrichment.WEB || enrichment.website || protocol.website || null,
        github: enrichment.github || protocol.github || null,
        twitter,
        category: mapCategory(
          protocol.category || enrichment.TAGS || enrichment.category
        ) as any,
        githubId,
      };

      // Debug: log what we're about to save
      if (logoUrl || banner) {
        console.log(`💾 Saving ${protocolName} with:`, {
          logoUrl,
          banner,
        });
      }

      // Log enrichment status
      const hasEnrichment = Object.keys(enrichment).length > 0;
      if (hasEnrichment) {
        const enrichedFields = [];
        if (
          logoUrl &&
          (enrichment.LOGO ||
            enrichment.logo ||
            enrichment.logoUrl ||
            enrichment.logo_url ||
            enrichment.Logo)
        )
          enrichedFields.push("logo");
        if (
          banner &&
          (enrichment.BANNER ||
            enrichment.banner ||
            enrichment.Banner ||
            enrichment.banner_url)
        )
          enrichedFields.push("banner");
        if (enrichment.INFO || enrichment.description)
          enrichedFields.push("description");
        if (enrichment.WEB || enrichment.website)
          enrichedFields.push("website");
        if (enrichment.github) enrichedFields.push("github");
        if (
          twitter &&
          (enrichment.X ||
            enrichment.twitter ||
            enrichment.Twitter ||
            enrichment.x)
        )
          enrichedFields.push("twitter");
        if (enrichment.TAGS || enrichment.category)
          enrichedFields.push("category");

        if (enrichedFields.length > 0) {
          enrichedCount++;
          console.log(
            `  📊 Enriched ${protocolName}: ${enrichedFields.join(", ")}`
          );
        }
      }

      if (existingDapp) {
        // Update existing dApp
        await prisma.dApp.update({
          where: { id: existingDapp.id },
          data: dappData,
        });
        updatedCount++;
        console.log(`✏️  Updated: ${protocolName}`);
      } else {
        // Create new dApp
        const newDapp = await prisma.dApp.create({
          data: dappData,
        });
        addedCount++;
        console.log(`✅ Added: ${protocolName}`);

        // Add contracts if available
        if (protocol.contracts && protocol.contracts.length > 0) {
          for (const contract of protocol.contracts) {
            try {
              await prisma.contract.upsert({
                where: { address: contract.address },
                update: {
                  dappId: newDapp.id,
                  name: contract.name || null,
                  symbol: contract.symbol || null,
                  type: (contract.type || "UNKNOWN") as any,
                },
                create: {
                  address: contract.address,
                  dappId: newDapp.id,
                  name: contract.name || null,
                  symbol: contract.symbol || null,
                  type: (contract.type || "UNKNOWN") as any,
                },
              });
            } catch (err) {
              console.error(`Failed to add contract ${contract.address}:`, err);
            }
          }
        }
      }
    }

    const githubAvailable = githubProtocols.length > 0;
    const sheetsAvailable = Object.keys(enrichmentMap).length > 0;

    let statusMessage = `Sync complete: ${addedCount} added, ${updatedCount} updated`;
    if (enrichedCount > 0) {
      statusMessage += `, ${enrichedCount} enriched`;
    }
    if (!githubAvailable && !sheetsAvailable) {
      statusMessage += " (Warning: Both data sources unavailable)";
    } else if (!githubAvailable) {
      statusMessage += " (GitHub unavailable, using Google Sheets only)";
    } else if (!sheetsAvailable) {
      statusMessage += " (Google Sheets unavailable, using GitHub only)";
    }

    console.log(`✅ ${statusMessage}`);
    if (enrichedCount > 0) {
      console.log(
        `📊 ${enrichedCount} dApps enriched with data from Google Sheets`
      );
    }

    return Response.json({
      success: true,
      message: statusMessage,
      addedCount,
      updatedCount,
      enrichedCount,
      sources: {
        github: githubAvailable,
        googleSheets: sheetsAvailable,
      },
    });
  } catch (error) {
    console.error("Error syncing dApps:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sync dApps",
      },
      { status: 500 }
    );
  }
}
