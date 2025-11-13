import { scrapeMonvisionComplete } from './app/lib/scraper/monvision-complete';

(async () => {
  console.log('🧪 Testing scraper with scroll functionality...\n');

  try {
    const dapps = await scrapeMonvisionComplete();

    console.log(`\n✅ Scraping complete!`);
    console.log(`   Total projects found: ${dapps.length}`);
    console.log(`\n   First 10 projects:`);
    dapps.slice(0, 10).forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.name}`);
      console.log(`      Logo: ${d.logoUrl ? 'YES' : 'NO'}`);
      console.log(`      Contracts: ${d.contracts.length}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
