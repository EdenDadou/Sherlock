import puppeteer, { Browser } from "puppeteer";

export interface ScraperResult {
  username: string;
  success: boolean;
  followersCount?: number;
  error?: string;
}

/**
 * Extract username from Twitter URL
 * https://x.com/Balancer -> Balancer
 * https://twitter.com/Balancer -> Balancer
 */
function extractUsername(urlOrUsername: string): string {
  if (urlOrUsername.includes("twitter.com") || urlOrUsername.includes("x.com")) {
    const match = urlOrUsername.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
    return match ? match[1] : urlOrUsername;
  }
  return urlOrUsername.replace("@", "");
}

/**
 * Parse follower count text to number
 * Handles both comma and dot as decimal separators
 */
function parseFollowerCount(text: string): number | null {
  let cleaned = text.replace(/Followers?/i, "").trim();

  // Handle French/European format: "154,9 k" -> "154.9k"
  cleaned = cleaned.replace(/,(\d{1,2})\s*([KMB])/i, ".$1$2");
  cleaned = cleaned.replace(/,/g, "");
  cleaned = cleaned.replace(/\s+([KMB])/gi, "$1");

  const match = cleaned.match(/([\d.]+)\s*([KMB])?/i);
  if (!match) return null;

  const number = parseFloat(match[1]);
  const suffix = match[2]?.toUpperCase();

  switch (suffix) {
    case "K":
      return Math.round(number * 1000);
    case "M":
      return Math.round(number * 1000000);
    case "B":
      return Math.round(number * 1000000000);
    default:
      return Math.round(number);
  }
}

/**
 * Scrape single account with existing browser
 */
async function scrapeAccount(
  browser: Browser,
  username: string
): Promise<ScraperResult> {
  const cleanUsername = extractUsername(username);
  const url = `https://x.com/${cleanUsername}`;

  console.log(`  🔍 Scraping @${cleanUsername}...`);

  try {
    const page = await browser.newPage();

    // Optimizations
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 720 });

    // Block images and media to speed up loading
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const resourceType = req.resourceType();
      if (["image", "media", "font", "stylesheet"].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate with shorter timeout
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    // Wait for content
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Try selectors
    const possibleSelectors = [
      'a[href$="/verified_followers"] span',
      'a[href$="/followers"] span',
      '[data-testid="primaryColumn"] a[href*="followers"] span',
    ];

    let followersText = null;

    for (const selector of possibleSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const text = await page.evaluate((el) => el.textContent, element);
          if (
            text &&
            (text.includes("Followers") || /[\d,]+(\.\d+)?[KMB]?/.test(text))
          ) {
            followersText = text;
            break;
          }
        }
        if (followersText) break;
      } catch (err) {
        // Continue to next selector
      }
    }

    await page.close();

    if (followersText) {
      const count = parseFollowerCount(followersText);
      console.log(`    ✅ @${cleanUsername}: ${count?.toLocaleString()} followers`);
      return {
        username: cleanUsername,
        success: true,
        followersCount: count || undefined,
      };
    } else {
      console.log(`    ⚠️  @${cleanUsername}: Follower count not found`);
      return {
        username: cleanUsername,
        success: false,
        error: "Follower count not found",
      };
    }
  } catch (error) {
    console.log(
      `    ⚠️  @${cleanUsername}: ${error instanceof Error ? error.message : "Error"}`
    );
    return {
      username: cleanUsername,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Scrape multiple accounts in batches
 * @param accounts - Array of Twitter URLs or usernames
 * @param batchSize - Number of concurrent scrapes (default: 3)
 * @param delayBetweenBatches - Delay in ms between batches (default: 2000)
 */
export async function scrapeTwitterFollowers(
  accounts: string[],
  batchSize: number = 3,
  delayBetweenBatches: number = 2000
): Promise<ScraperResult[]> {
  if (accounts.length === 0) {
    return [];
  }

  console.log(`🚀 Starting Twitter scrape of ${accounts.length} accounts`);
  console.log(`   Batch size: ${batchSize}, Delay: ${delayBetweenBatches}ms\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
  });

  const results: ScraperResult[] = [];

  try {
    // Process in batches
    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize);
      console.log(
        `📦 Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(accounts.length / batchSize)}`
      );

      // Scrape batch in parallel
      const batchResults = await Promise.all(
        batch.map((account) => scrapeAccount(browser, account))
      );

      results.push(...batchResults);

      // Delay between batches to avoid rate limiting
      if (i + batchSize < accounts.length) {
        console.log(`   ⏳ Waiting ${delayBetweenBatches}ms before next batch...\n`);
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }
  } finally {
    await browser.close();
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(
    `\n✅ Twitter scraping complete: ${successCount}/${results.length} successful\n`
  );

  return results;
}
