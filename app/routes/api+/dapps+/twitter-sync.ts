import type { ActionFunctionArgs } from "react-router";
import { prisma } from "~/lib/db/prisma";
import { scrapeTwitterFollowers } from "~/lib/scraper/twitter";

/**
 * POST /api/dapps/twitter-sync
 * Scrape Twitter followers for all dApps asynchronously
 * This runs in background and updates the database progressively
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    console.log("\n🐦 Starting async Twitter followers scraping...");

    // Fetch all dApps with Twitter accounts
    const dappsWithTwitter = await prisma.dApp.findMany({
      where: {
        twitter: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        twitter: true,
      },
    });

    if (dappsWithTwitter.length === 0) {
      return Response.json({
        success: true,
        message: "No dApps with Twitter accounts found",
        scrapedCount: 0,
        totalCount: 0,
      });
    }

    console.log(`Found ${dappsWithTwitter.length} dApps with Twitter accounts`);

    const twitterAccounts = dappsWithTwitter
      .map((d: { twitter: string | null }) => d.twitter)
      .filter((t: string | null): t is string => t !== null);

    // Start scraping asynchronously
    const scraperResults = await scrapeTwitterFollowers(
      twitterAccounts,
      3, // batch size
      2000 // delay between batches
    );

    // Update dApps with follower counts
    let scrapedCount = 0;
    const updates = [];

    for (const result of scraperResults) {
      if (result.success && result.followersCount) {
        // Extract username from Twitter URL for matching
        const extractUsername = (urlOrUsername: string): string => {
          if (urlOrUsername.includes("twitter.com") || urlOrUsername.includes("x.com")) {
            const match = urlOrUsername.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
            return match ? match[1].toLowerCase() : urlOrUsername.toLowerCase();
          }
          return urlOrUsername.replace("@", "").toLowerCase();
        };

        const dapp = dappsWithTwitter.find(
          (d: { id: string; name: string | null; twitter: string | null }) => {
            if (!d.twitter) return false;

            const dappUsername = extractUsername(d.twitter);
            const resultUsername = result.username.toLowerCase();

            // Debug log for first few to see what we're comparing
            if (scrapedCount < 3) {
              console.log(`    🔍 Matching: "${resultUsername}" vs "${dappUsername}" (from ${d.twitter})`);
            }

            return dappUsername === resultUsername;
          }
        );

        if (dapp) {
          await prisma.dApp.update({
            where: { id: dapp.id },
            data: { twitterFollowers: result.followersCount },
          });

          scrapedCount++;
          updates.push({
            dappId: dapp.id,
            dappName: dapp.name,
            username: result.username,
            followers: result.followersCount,
          });

          console.log(
            `  ✅ Updated ${dapp.name}: ${result.followersCount.toLocaleString()} followers`
          );
        } else {
          console.log(
            `  ⚠️  No dApp found for @${result.username} (${result.followersCount.toLocaleString()} followers)`
          );
        }
      }
    }

    console.log(
      `\n🎉 Twitter scraping complete: ${scrapedCount}/${dappsWithTwitter.length} updated`
    );

    return Response.json({
      success: true,
      message: `Twitter scraping complete: ${scrapedCount}/${dappsWithTwitter.length} updated`,
      scrapedCount,
      totalCount: dappsWithTwitter.length,
      updates,
    });
  } catch (error) {
    console.error("Error scraping Twitter followers:", error);
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to scrape Twitter followers",
      },
      { status: 500 }
    );
  }
}
