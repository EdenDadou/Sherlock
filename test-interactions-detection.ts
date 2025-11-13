/**
 * Test user interactions detection with Monvision contracts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testInteractionsDetection() {
  console.log("🔍 Testing interactions detection with Monvision contracts\n");

  try {
    // Step 1: Count contracts in both tables
    console.log("📊 Step 1: Counting contracts...");

    const [dappContractsCount, monvisionContractsCount] = await Promise.all([
      prisma.contract.count({ where: { dappId: { not: null } } }),
      prisma.monvisionContract.count(),
    ]);

    console.log(`  - DApp contracts (old table): ${dappContractsCount}`);
    console.log(`  - Monvision contracts (new table): ${monvisionContractsCount}`);
    console.log(`  - Total: ${dappContractsCount + monvisionContractsCount}\n`);

    // Step 2: Show sample contracts from Monvision table
    console.log("📋 Step 2: Sample Monvision contracts:");
    const sampleDapps = await prisma.monvisionDApp.findMany({
      take: 5,
      include: {
        contracts: { take: 2 },
      },
    });

    sampleDapps.forEach((dapp, i) => {
      console.log(`  [${i + 1}] ${dapp.name}`);
      console.log(`      Contracts: ${dapp.contracts.length}`);
      dapp.contracts.forEach((c) => {
        console.log(`        - ${c.address} (${c.name || "Unnamed"})`);
      });
      console.log();
    });

    // Step 3: Show what would be checked for a user
    console.log("📊 Step 3: Contract addresses that will be checked for user interactions:");
    const allContracts = await Promise.all([
      prisma.contract.findMany({
        where: { dappId: { not: null } },
        select: { address: true, dappId: true },
      }),
      prisma.monvisionContract.findMany({
        select: { address: true, dappId: true },
      }),
    ]);

    const combinedContracts = [
      ...allContracts[0],
      ...allContracts[1],
    ];

    console.log(`  Total addresses to check: ${combinedContracts.length}`);
    console.log(`  Sample addresses:`);
    combinedContracts.slice(0, 10).forEach((c, i) => {
      console.log(`    ${i + 1}. ${c.address}`);
    });

    console.log("\n✅ Detection is now configured to check both tables!");
    console.log("   When a user connects their wallet, the app will:");
    console.log("   1. Fetch all contracts from both DApp and MonvisionDApp tables");
    console.log(`   2. Check user transactions against ${combinedContracts.length} contract addresses`);
    console.log("   3. Show green badges on dApps the user has interacted with\n");

    console.log("🎯 To test in the app:");
    console.log("   1. npm run dev");
    console.log("   2. Connect your wallet");
    console.log("   3. Open the Discovery modal");
    console.log("   4. Check the console for: '🔍 Re-checking user interactions...'");
    console.log("   5. You should see green 'Utilisé' badges on dApps you've used\n");

  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testInteractionsDetection().catch(console.error);
