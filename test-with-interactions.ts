/**
 * Test sync + user interactions verification
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// REMPLACEZ PAR VOTRE ADRESSE WALLET
const USER_ADDRESS = "0xVOTRE_ADRESSE_ICI";

async function testWithInteractions() {
  console.log("🚀 Testing sync with user interactions verification...\n");

  try {
    // Step 1: Get dApps from database
    console.log("📊 Step 1: Loading dApps from database...");
    const dapps = await prisma.monvisionDApp.findMany({
      include: {
        contracts: true,
      },
      take: 10, // Limit to 10 for display
    });

    console.log(`✅ Found ${dapps.length} dApps in database\n`);

    // Step 2: Get contracts
    console.log("📋 Step 2: Extracting contracts...");
    const allContracts = dapps.flatMap((dapp) =>
      dapp.contracts.map((c) => ({
        address: c.address.toLowerCase(),
        dappId: dapp.id,
        dappName: dapp.name,
      }))
    );
    console.log(`✅ Found ${allContracts.length} total contracts\n`);

    // Step 3: Verify interactions (simulated)
    console.log("🔍 Step 3: Checking user interactions...");
    console.log(`   User address: ${USER_ADDRESS}`);
    console.log(`   Checking against ${allContracts.length} contracts...\n`);

    // Note: In a real scenario, you would call:
    // const response = await fetch(`/api/user/interactions?address=${USER_ADDRESS}`);
    // For now, we'll show the structure

    console.log("📋 To check your interactions in the real app:");
    console.log("   1. Start the dev server: npm run dev");
    console.log("   2. Connect your wallet in the app");
    console.log("   3. Open the Discovery modal");
    console.log("   4. The app will automatically call:");
    console.log(`      GET /api/user/interactions?address=${USER_ADDRESS}`);
    console.log("   5. This will use HyperSync to check all your transactions");
    console.log("   6. Green badges will appear on dApps you've used\n");

    console.log("📊 Sample dApps with contracts:");
    dapps.slice(0, 5).forEach((dapp, i) => {
      console.log(`\n  [${i + 1}] ${dapp.name}`);
      console.log(`      Category: ${dapp.category || "N/A"}`);
      console.log(`      Contracts: ${dapp.contracts.length}`);
      if (dapp.contracts.length > 0) {
        dapp.contracts.slice(0, 2).forEach((c) => {
          console.log(`        - ${c.address} (${c.name || "Unnamed"})`);
        });
      }
    });

    console.log("\n\n🎯 Next steps:");
    console.log("   1. Replace USER_ADDRESS in this script with your wallet address");
    console.log("   2. Or test directly in the web app with your connected wallet");
    console.log("   3. The app will show green 'Utilisé' badges on dApps you've interacted with");

  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testWithInteractions().catch(console.error);
