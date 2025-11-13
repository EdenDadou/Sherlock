/**
 * Debug detection logic step by step
 */
import { createUserInteractionsService } from "./app/services/user-interactions.service";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const USER_ADDRESS = "0x6f7b21276be8026a29602007fbbb7ceee4059645";

async function debugDetection() {
  console.log("🔍 Debugging interaction detection\n");

  try {
    // Step 1: Check contracts in DB
    console.log("📊 Step 1: Contracts in database");
    const contracts = await prisma.monvisionContract.findMany({
      include: { dapp: { select: { name: true } } },
    });
    console.log(`  Total contracts: ${contracts.length}\n`);

    if (contracts.length === 0) {
      console.log("  ❌ No contracts in database!");
      console.log("  → Please run sync first\n");
      return;
    }

    // Show first 10 contracts
    console.log("  First 10 contracts:");
    contracts.slice(0, 10).forEach((c, i) => {
      console.log(`    ${i + 1}. ${c.address} - ${c.dapp?.name || "Unknown"}`);
    });

    // Step 2: Run detection
    console.log("\n📊 Step 2: Running detection for user");
    console.log(`  Address: ${USER_ADDRESS}\n`);

    const service = createUserInteractionsService();
    const result = await service.detectUserDappInteractions(USER_ADDRESS);

    console.log(`✅ Detection complete!`);
    console.log(`  Total dApps interacted: ${result.interactions.length}`);
    console.log(`  Total transactions: ${result.totalTransactions}\n`);

    if (result.interactions.length > 0) {
      console.log("📋 Detected interactions:");
      result.interactions.forEach((interaction, i) => {
        console.log(`\n  ${i + 1}. ${interaction.dappName}`);
        console.log(`     DApp ID: ${interaction.dappId}`);
        console.log(`     Transactions: ${interaction.transactions}`);
        console.log(`     Events: ${interaction.eventCount}`);
        console.log(`     Contracts: ${Array.from(interaction.contractAddresses).join(", ")}`);
      });
    } else {
      console.log("  ❌ No interactions detected!\n");
      console.log("  Possible reasons:");
      console.log("  1. User hasn't interacted with any dApp");
      console.log("  2. HyperSync hasn't indexed the transactions yet");
      console.log("  3. Transactions are too old (beyond indexed range)");
      console.log("  4. Contract addresses in DB don't match actual usage");
    }

    // Step 3: Get list of expected dApps
    console.log("\n\n📊 Step 3: Expected dApps (based on previous API call)");
    console.log("  According to earlier tests, user should have interacted with:");
    console.log("  1. Bubblefi");
    console.log("  2. Castora");
    console.log("  3. Clober");
    console.log("  4. Magma");
    console.log("\n  Let's check if these dApps are in our database:");

    const expectedDapps = ["Bubblefi", "Castora", "Clober", "Magma"];
    for (const name of expectedDapps) {
      const dapp = await prisma.monvisionDApp.findFirst({
        where: { name: { contains: name, mode: "insensitive" } },
        include: { contracts: { take: 3 } },
      });

      if (dapp) {
        console.log(`  ✅ ${name} - ${dapp.contracts.length} contracts`);
        dapp.contracts.forEach((c) => {
          console.log(`      - ${c.address}`);
        });
      } else {
        console.log(`  ❌ ${name} - NOT FOUND IN DB`);
      }
    }

  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

debugDetection().catch(console.error);
