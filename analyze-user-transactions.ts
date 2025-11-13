/**
 * Analyze all user transactions to find contract interactions
 */
import { createEnvioService } from "./app/services/envio.service";

const USER_ADDRESS = "0x6f7b21276be8026a29602007fbbb7ceee4059645";

async function analyzeUserTransactions() {
  console.log(`🔍 Analyzing all transactions for ${USER_ADDRESS}\n`);

  const envioService = createEnvioService();

  try {
    // Get current block
    const currentBlock = await envioService.getCurrentBlock();
    console.log(`📊 Current block: ${currentBlock}\n`);

    // Get all user transactions
    console.log("🔎 Fetching all user transactions...");
    const transactions = await envioService.getTransactionsByAddress(
      USER_ADDRESS,
      0,
      currentBlock
    );

    console.log(`✅ Found ${transactions.length} transactions\n`);

    if (transactions.length === 0) {
      console.log("No transactions found for this address");
      return;
    }

    console.log("📋 Transaction details:\n");

    // Group by contract address
    const contractCounts = new Map<string, number>();

    transactions.forEach((tx, i) => {
      const to = tx.to?.toLowerCase() || "null";
      contractCounts.set(to, (contractCounts.get(to) || 0) + 1);

      console.log(`${i + 1}. Block ${tx.block_number}`);
      console.log(`   Hash: ${tx.hash}`);
      console.log(`   From: ${tx.from}`);
      console.log(`   To: ${tx.to || "Contract Creation"}`);
      console.log(`   Value: ${tx.value || "0"}`);
      console.log();
    });

    console.log("\n📊 Contract Interaction Summary:");
    const sorted = Array.from(contractCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    sorted.forEach(([address, count]) => {
      console.log(`  ${address}: ${count} transaction${count > 1 ? "s" : ""}`);
    });

    // Get logs too
    console.log("\n\n🔎 Fetching user logs (events where you appear)...");
    const logs = await envioService.getLogsByTopic(USER_ADDRESS, 0, currentBlock);
    console.log(`✅ Found ${logs.length} logs\n`);

    if (logs.length > 0) {
      console.log("📋 Log details:\n");

      const logContracts = new Map<string, number>();

      logs.forEach((log, i) => {
        const addr = log.address.toLowerCase();
        logContracts.set(addr, (logContracts.get(addr) || 0) + 1);

        if (i < 10) { // Show first 10 only
          console.log(`${i + 1}. Block ${log.block_number}`);
          console.log(`   Contract: ${log.address}`);
          console.log(`   Topic0: ${log.topic0 || "N/A"}`);
          console.log();
        }
      });

      if (logs.length > 10) {
        console.log(`... and ${logs.length - 10} more logs\n`);
      }

      console.log("\n📊 Log Contract Summary:");
      const sortedLogs = Array.from(logContracts.entries())
        .sort((a, b) => b[1] - a[1]);

      sortedLogs.forEach(([address, count]) => {
        console.log(`  ${address}: ${count} log${count > 1 ? "s" : ""}`);
      });
    }

    console.log("\n\n💡 To find which dApp a contract belongs to:");
    console.log("   Search for the contract address on Monvision explorer");
    console.log("   https://testnet.monvision.io/address/CONTRACT_ADDRESS");

  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  }
}

analyzeUserTransactions().catch(console.error);
