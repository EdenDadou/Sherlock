import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "~/lib/db/prisma";

/**
 * GET /api/dapps
 * Returns all dApps from database
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const dapps = await prisma.dApp.findMany({
      include: {
        contracts: {
          select: {
            id: true,
            address: true,
            type: true,
            name: true,
            symbol: true,
          },
        },
      },
      orderBy: [{ qualityScore: "desc" }, { name: "asc" }],
    });

    // Transform data for frontend
    const transformedDapps = dapps.map((dapp) => ({
      id: dapp.id,
      name: dapp.name,
      description: dapp.description,
      logoUrl: dapp.logoUrl,
      banner: dapp.banner,
      symbol: dapp.symbol,
      category: dapp.category,
      website: dapp.website,
      github: dapp.github,
      twitter: dapp.twitter,
      contractCount: dapp.contracts.length,
      contracts: dapp.contracts,
      totalTxCount: dapp.totalTxCount,
      totalEventCount: dapp.totalEventCount,
      uniqueUsers: dapp.uniqueUsers,
      activityScore: dapp.activityScore,
      qualityScore: dapp.qualityScore,
      firstActivity: dapp.firstActivity,
      lastActivity: dapp.lastActivity,
      createdAt: dapp.createdAt,
      updatedAt: dapp.updatedAt,
    }));

    return Response.json({
      success: true,
      dapps: transformedDapps,
      count: transformedDapps.length,
    });
  } catch (error) {
    console.error("Error loading dApps:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load dApps",
        dapps: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}
