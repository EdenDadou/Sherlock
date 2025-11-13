/**
 * Debug Monvision page to understand loading mechanism
 */
import puppeteer from 'puppeteer';

async function debugPage() {
  console.log('🔍 Debugging Monvision page structure...\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser to see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    );

    console.log('📍 Navigating to ecosystem page...');
    await page.goto('https://testnet.monvision.io/ecosystem', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for pagination or load more buttons
    console.log('\n🔎 Looking for pagination/load more controls...');

    const pageInfo = await page.evaluate(() => {
      const results: any = {
        projectLinks: 0,
        buttons: [] as string[],
        pagination: [] as string[],
        scrollHeight: document.body.scrollHeight,
        windowHeight: window.innerHeight,
      };

      // Count project links
      results.projectLinks = document.querySelectorAll('a[href*="/project/"]').length;

      // Find all buttons
      const buttons = Array.from(document.querySelectorAll('button'));
      results.buttons = buttons
        .map(b => b.textContent?.trim() || b.getAttribute('aria-label') || 'No text')
        .filter(t => t.length > 0 && t.length < 50);

      // Look for pagination elements
      const paginationSelectors = [
        'nav[role="navigation"]',
        '[class*="pagination"]',
        '[class*="page"]',
        'button[aria-label*="page"]',
        'button:has-text("Next")',
        'button:has-text("Load")',
        'button:has-text("More")',
      ];

      for (const selector of paginationSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results.pagination.push(`Found ${elements.length} elements matching: ${selector}`);
        }
      }

      return results;
    });

    console.log('\n📊 Page Analysis:');
    console.log(`  Project links found: ${pageInfo.projectLinks}`);
    console.log(`  Scroll height: ${pageInfo.scrollHeight}px`);
    console.log(`  Window height: ${pageInfo.windowHeight}px`);
    console.log(`\n  Buttons on page (${pageInfo.buttons.length}):`);
    pageInfo.buttons.forEach((btn: string, i: number) => {
      console.log(`    ${i + 1}. "${btn}"`);
    });

    if (pageInfo.pagination.length > 0) {
      console.log(`\n  Pagination elements found:`);
      pageInfo.pagination.forEach((p: string) => console.log(`    - ${p}`));
    } else {
      console.log(`\n  ❌ No pagination elements found`);
    }

    // Try scrolling and see if more projects load
    console.log('\n📜 Testing scroll behavior...');
    const beforeScroll = pageInfo.projectLinks;

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 3000));

    const afterScroll = await page.evaluate(() =>
      document.querySelectorAll('a[href*="/project/"]').length
    );

    console.log(`  Before scroll: ${beforeScroll} projects`);
    console.log(`  After scroll: ${afterScroll} projects`);
    console.log(`  New projects loaded: ${afterScroll - beforeScroll}`);

    // Take a screenshot for manual inspection
    await page.screenshot({ path: 'monvision-debug.png', fullPage: true });
    console.log('\n📸 Screenshot saved to monvision-debug.png');

    console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugPage().catch(console.error);
