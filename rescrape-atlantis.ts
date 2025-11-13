/**
 * Re-scrape Atlantis to verify contract addresses
 */
import { scrapeProjectDetails } from "./app/lib/scraper/monvision-complete";
import puppeteer from "puppeteer";

async function rescrapeAtlantis() {
  console.log("🔍 Re-scraping Atlantis from Monvision...\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const atlantisInfo = {
      name: "Atlantis",
      logoUrl: null,
      detailsUrl: "https://testnet.monvision.io/project/Atlantis",
      category: null,
      description: null,
    };

    console.log("📍 Scraping:", atlantisInfo.detailsUrl);
    const result = await scrapeProjectDetails(browser, atlantisInfo);

    console.log("\n✅ Scraping complete!\n");
    console.log("📊 Results:");
    console.log(`  Name: ${result.name}`);
    console.log(`  Description: ${result.description || "N/A"}`);
    console.log(`  Category: ${result.category || "N/A"}`);
    console.log(`  Logo: ${result.logoUrl || "N/A"}`);
    console.log(`\n  Social Links:`);
    console.log(`    Website: ${result.website || "N/A"}`);
    console.log(`    Twitter: ${result.twitter || "N/A"}`);
    console.log(`    Discord: ${result.discord || "N/A"}`);
    console.log(`    Telegram: ${result.telegram || "N/A"}`);
    console.log(`    GitHub: ${result.github || "N/A"}`);
    console.log(`    Docs: ${result.docs || "N/A"}`);
    console.log(`\n  Metrics:`);
    console.log(`    Accounts: ${result.accountsCount}`);
    console.log(`    Transactions: ${result.transactionsCount}`);
    console.log(`\n  Contracts (${result.contracts.length}):`);

    result.contracts.forEach((c, i) => {
      console.log(`    ${i + 1}. ${c.address}`);
      console.log(`       Name: ${c.name || "Unnamed"}`);
      console.log(`       Type: ${c.type || "N/A"}`);
    });

    console.log("\n\n💡 Compare with DB:");
    console.log("   DB contracts: 0x1ea9099e3026e0b3f8dd6fbacaa45f30fce67431");
    console.log("                 0x3012e9049d05b4b5369d690114d5a5861ebb85cb");
    console.log("                 0xe87a971729d5c0696de97e37aafe31c70f2dc814");

  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

rescrapeAtlantis().catch(console.error);
