/**
 * Test Atlantis interaction detection
 */
import { PrismaClient } from "@prisma/client";
import { createUserInteractionsService } from "./app/services/user-interactions.service";

const prisma = new PrismaClient();

// REMPLACEZ PAR VOTRE ADRESSE WALLET
const USER_ADDRESS = process.argv[2] || "0xVOTRE_ADRESSE_ICI";

async function testAtlantisInteraction() {
  console.log("🔍 Testing Atlantis interaction detection\n");

  try {
    // Get Atlantis info
    const atlantis = await prisma.monvisionDApp.findFirst({
      where: { name: "Atlantis" },
      include: { contracts: true },
    });

    if (!atlantis) {
      console.log("❌ Atlantis not found in database");
      return;
    }

    console.log("📊 Atlantis Info:");
    console.log(`  ID: ${atlantis.id}`);
    console.log(`  Name: ${atlantis.name}`);
    console.log(`  Enriched: ${atlantis.isEnriched ? "✅" : "❌"}`);
    console.log(`  Contracts: ${atlantis.contracts.length}`);
    atlantis.contracts.forEach((c, i) => {
      console.log(`    ${i + 1}. ${c.address} (${c.name || "Unnamed"})`);
    });
    console.log();

    console.log(`🔍 Checking interactions for: ${USER_ADDRESS}\n`);

    // Check interactions
    const service = createUserInteractionsService();

    // Method 1: Check if user has interacted with Atlantis specifically
    console.log("Method 1: Checking specific dApp interaction...");
    const hasInteracted = await service.hasUserInteractedWithDapp(
      USER_ADDRESS,
      atlantis.id
    );
    console.log(`  Result: ${hasInteracted ? "✅ YES" : "❌ NO"}\n`);

    // Method 2: Get all interacted dApps
    console.log("Method 2: Getting all interacted dApps...");
    const interactedDappIds = await service.getUserInteractedDappIds(USER_ADDRESS);
    console.log(`  Total dApps interacted: ${interactedDappIds.length}`);
    const atlantisIncluded = interactedDappIds.includes(atlantis.id);
    console.log(`  Atlantis included: ${atlantisIncluded ? "✅ YES" : "❌ NO"}\n`);

    // Method 3: Full detection with details
    console.log("Method 3: Full interaction detection...");
    const fullResult = await service.detectUserDappInteractions(USER_ADDRESS);
    const atlantisInteraction = fullResult.interactions.find(
      (i) => i.dappId === atlantis.id
    );

    if (atlantisInteraction) {
      console.log("  ✅ Atlantis interaction found!");
      console.log(`     Transactions: ${atlantisInteraction.transactions}`);
      console.log(`     Events: ${atlantisInteraction.eventCount}`);
      console.log(`     Gas used: ${atlantisInteraction.gasUsed}`);
    } else {
      console.log("  ❌ No Atlantis interaction detected\n");
    }

    console.log("\n🎯 Badge Display Logic:");
    console.log(`  hasUserInteracted: ${hasInteracted}`);
    console.log(`  isEnriched: ${atlantis.isEnriched}`);
    console.log(`  shouldShowBadge: ${hasInteracted && atlantis.isEnriched ? "✅ YES" : "❌ NO"}`);

    if (!hasInteracted) {
      console.log("\n💡 Possible reasons why badge is not showing:");
      console.log("  1. You haven't actually interacted with Atlantis contracts");
      console.log("  2. The transactions are too old (check block range)");
      console.log("  3. HyperSync doesn't have the transaction data");
      console.log("  4. The contract addresses in DB don't match actual deployment");
      console.log("\n🔧 To debug further:");
      console.log("  - Verify you actually used Atlantis on Monad testnet");
      console.log("  - Check your wallet address is correct");
      console.log("  - Look at the API response in browser DevTools");
    }

  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (USER_ADDRESS === "0xVOTRE_ADRESSE_ICI") {
  console.log("❌ Please provide your wallet address:");
  console.log("   npx tsx test-atlantis-interaction.ts 0xYourAddress\n");
  process.exit(1);
}

testAtlantisInteraction().catch(console.error);
