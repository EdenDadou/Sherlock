import type { Route } from "./+types/api.dapps.sync";
import { prisma } from "~/lib/db/prisma";

const GITHUB_PROTOCOLS_URL =
  "https://raw.githubusercontent.com/monad-crypto/protocols/main/testnet.json";
const GOOGLE_SHEETS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1LvM26stpFO7kJk4Y974NhLznjerMh6h8wvZBeYja26M/export?format=csv&gid=0";

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
 */
async function fetchGitHubProtocols(): Promise<GitHubProtocol[]> {
  const response = await fetch(GITHUB_PROTOCOLS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub protocols: ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Fetch enrichment data from Google Sheets (CSV)
 */
async function fetchGoogleSheetsData(): Promise<Record<string, any>> {
  const response = await fetch(GOOGLE_SHEETS_CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheets data: ${response.statusText}`);
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
    const protocolName = rowData.name || rowData.Name || rowData.protocol;
    if (protocolName) {
      enrichmentMap[protocolName.toLowerCase()] = rowData;
    }
  }

  return enrichmentMap;
}

/**
 * Map category string to enum value
 */
function mapCategory(category?: string): string {
  if (!category) return "UNKNOWN";
  const upperCategory = category.toUpperCase();
  const validCategories = [
    "DEFI",
    "DEX",
    "LENDING",
    "NFT",
    "NFT_MARKETPLACE",
    "GAMEFI",
    "SOCIAL",
    "BRIDGE",
    "INFRA",
    "GOVERNANCE",
    "TOKEN",
  ];
  return validCategories.includes(upperCategory) ? upperCategory : "UNKNOWN";
}

/**
 * POST /api/dapps/sync
 * Sync dApps from GitHub and Google Sheets to database
 */
export async function action({ request }: Route.ActionArgs) {
  try {
    console.log("🔄 Starting dApps sync...");

    // Fetch data from both sources
    const [githubProtocols, enrichmentMap] = await Promise.all([
      fetchGitHubProtocols(),
      fetchGoogleSheetsData(),
    ]);

    console.log(`📦 Fetched ${githubProtocols.length} protocols from GitHub`);
    console.log(
      `📊 Fetched ${Object.keys(enrichmentMap).length} enrichment entries from Google Sheets`
    );

    let addedCount = 0;
    let updatedCount = 0;

    // Process each protocol
    for (const protocol of githubProtocols) {
      const protocolName = protocol.name || protocol.protocol;
      if (!protocolName) continue;

      const enrichment = enrichmentMap[protocolName.toLowerCase()] || {};
      const githubId = protocol.id || protocolName;

      // Check if dApp already exists
      const existingDapp = await prisma.dApp.findFirst({
        where: {
          OR: [
            { githubId },
            { name: protocolName },
          ],
        },
      });

      const dappData = {
        name: protocolName,
        description: enrichment.description || protocol.description || null,
        logoUrl: enrichment.logo || protocol.logo || null,
        banner: enrichment.banner || null,
        symbol: protocol.symbol || null,
        website: enrichment.website || protocol.website || null,
        github: enrichment.github || protocol.github || null,
        twitter: enrichment.twitter || protocol.twitter || null,
        category: mapCategory(enrichment.category || protocol.category),
        githubId,
      };

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
                  type: contract.type || "UNKNOWN",
                },
                create: {
                  address: contract.address,
                  dappId: newDapp.id,
                  name: contract.name || null,
                  symbol: contract.symbol || null,
                  type: contract.type || "UNKNOWN",
                },
              });
            } catch (err) {
              console.error(`Failed to add contract ${contract.address}:`, err);
            }
          }
        }
      }
    }

    console.log(`✅ Sync complete: ${addedCount} added, ${updatedCount} updated`);

    return Response.json({
      success: true,
      message: `Sync complete: ${addedCount} added, ${updatedCount} updated`,
      addedCount,
      updatedCount,
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
