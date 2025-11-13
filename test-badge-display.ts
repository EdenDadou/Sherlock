/**
 * Test to verify the "Utilisé" badge will display correctly
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Test with a real Ethereum address
const TEST_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0";

async function testBadgeDisplay() {
  console.log("🎯 Testing 'Utilisé' badge display logic\n");

  try {
    // Step 1: Get all dApps
    console.log("📊 Step 1: Loading dApps from database...");
    const dapps = await prisma.monvisionDApp.findMany({
      include: {
        contracts: true,
      },
      take: 5,
    });

    console.log(`✅ Found ${dapps.length} dApps (showing first 5)\n`);

    // Step 2: Check enrichment status
    console.log("📋 Step 2: Checking enrichment status:");
    dapps.forEach((dapp, i) => {
      console.log(`  [${i + 1}] ${dapp.name}`);
      console.log(`      isEnriched: ${dapp.isEnriched ? "✅ Yes" : "❌ No"}`);
      console.log(`      Contracts: ${dapp.contracts.length}`);
    });
    console.log();

    // Step 3: Simulate the badge display logic
    console.log("🎨 Step 3: Badge display logic simulation:");
    console.log(`  User address: ${TEST_ADDRESS}`);
    console.log(`  Simulating API call: /api/user/interactions?address=${TEST_ADDRESS}\n`);

    // In the real app, this would come from the API
    const mockUserInteractedDappIds: string[] = []; // Empty for now since test address has no interactions

    console.log("📱 Step 4: Badge visibility for each dApp:");
    dapps.forEach((dapp, i) => {
      const hasUserInteracted = mockUserInteractedDappIds.includes(dapp.id);
      const shouldShowBadge = hasUserInteracted && dapp.isEnriched;

      console.log(`  [${i + 1}] ${dapp.name}`);
      console.log(`      hasUserInteracted: ${hasUserInteracted}`);
      console.log(`      isEnriched: ${dapp.isEnriched}`);
      console.log(`      shouldShowBadge: ${shouldShowBadge ? "✅ YES" : "❌ NO"}`);
      console.log();
    });

    console.log("✅ Badge Display Logic Summary:");
    console.log("   The 'Utilisé' badge will show when:");
    console.log("   1. User has interacted with the dApp (hasUserInteracted = true)");
    console.log("   2. AND the dApp is enriched (isEnriched = true)");
    console.log();
    console.log("🎯 Current Status:");
    console.log(`   - Total dApps: ${dapps.length}`);
    console.log(`   - Enriched dApps: ${dapps.filter(d => d.isEnriched).length}`);
    console.log(`   - User has interacted with: ${mockUserInteractedDappIds.length} dApps`);
    console.log();
    console.log("💡 To test with real interactions:");
    console.log("   1. Start the dev server: npm run dev");
    console.log("   2. Connect a wallet that has interacted with Monad testnet dApps");
    console.log("   3. Open the Discovery modal");
    console.log("   4. The green 'Utilisé' badge will appear on dApps you've used");

  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testBadgeDisplay().catch(console.error);
