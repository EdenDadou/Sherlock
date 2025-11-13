/**
 * Analyze a specific transaction to understand why it's not detected
 */
import { createEnvioService } from "./app/services/envio.service";

const TX_HASH = "0x2552a5848f5c4884d40fc7a9530daf9be69413b4e5dd5796ec9cad106a8c6f77";
const USER_ADDRESS = "0x6f7b21276be8026a29602007fbbb7ceee4059645";
const ATLANTIS_CONTRACT = "0x00000000000001f3684f28c67538d4d072c22734";

async function analyzeTransaction() {
  console.log(`🔍 Analyzing transaction: ${TX_HASH}\n`);

  const envioService = createEnvioService();

  try {
    // Get current block first
    const currentBlock = await envioService.getCurrentBlock();
    console.log(`📊 Current block: ${currentBlock}\n`);

    // Get transaction details using HyperSync
    console.log("🔎 Fetching transaction from HyperSync...");

    const query = {
      from_block: 0,
      to_block: currentBlock,
      transactions: [
        {
          hash: [TX_HASH],
        },
      ],
      field_selection: {
        transaction: ["hash", "from", "to", "value", "block_number", "transaction_index"],
        log: ["address", "topic0", "topic1", "topic2", "topic3", "data", "log_index"],
      },
      include_all_blocks: false,
    };

    const response = await envioService['hyperSyncClient'].sendReq(query);

    console.log("\n📊 Response:");
    console.log(`  Transactions found: ${response.data?.length || 0}`);

    if (response.data && response.data.length > 0) {
      const txData = response.data[0];

      console.log("\n📋 Transaction Details:");
      if (txData.transactions && txData.transactions.length > 0) {
        const tx = txData.transactions[0];
        console.log(`  Hash: ${tx.hash}`);
        console.log(`  From: ${tx.from}`);
        console.log(`  To: ${tx.to}`);
        console.log(`  Block: ${tx.block_number}`);
        console.log(`  Value: ${tx.value || "0"}`);
      } else {
        console.log("  ❌ No transaction data found");
      }

      console.log("\n📋 Logs (Events):");
      if (txData.logs && txData.logs.length > 0) {
        console.log(`  Total logs: ${txData.logs.length}\n`);

        txData.logs.forEach((log: any, i: number) => {
          console.log(`  Log ${i + 1}:`);
          console.log(`    Contract: ${log.address}`);
          console.log(`    Topic0: ${log.topic0 || "N/A"}`);
          console.log(`    Topic1: ${log.topic1 || "N/A"}`);
          console.log(`    Topic2: ${log.topic2 || "N/A"}`);

          // Check if user address appears in topics
          const userTopic = "0x000000000000000000000000" + USER_ADDRESS.slice(2).toLowerCase();
          const appearsInTopics =
            log.topic1?.toLowerCase() === userTopic ||
            log.topic2?.toLowerCase() === userTopic ||
            log.topic3?.toLowerCase() === userTopic;

          if (appearsInTopics) {
            console.log(`    ✅ User address found in topics!`);
          }

          // Check if this is Atlantis contract
          if (log.address.toLowerCase() === ATLANTIS_CONTRACT.toLowerCase()) {
            console.log(`    ✅ This is the Atlantis contract!`);
          }

          console.log();
        });

        // Check if any log is from Atlantis contract
        const atlantisLogs = txData.logs.filter((log: any) =>
          log.address.toLowerCase() === ATLANTIS_CONTRACT.toLowerCase()
        );

        console.log(`\n  📊 Logs from Atlantis contract: ${atlantisLogs.length}`);

        // Check if user appears in any log
        const userTopic = "0x000000000000000000000000" + USER_ADDRESS.slice(2).toLowerCase();
        const logsWithUser = txData.logs.filter((log: any) =>
          log.topic1?.toLowerCase() === userTopic ||
          log.topic2?.toLowerCase() === userTopic ||
          log.topic3?.toLowerCase() === userTopic
        );

        console.log(`  📊 Logs mentioning user: ${logsWithUser.length}`);

      } else {
        console.log("  ❌ No logs found");
      }

    } else {
      console.log("\n❌ Transaction not found in HyperSync!");
      console.log("   This could mean:");
      console.log("   1. HyperSync hasn't indexed this transaction yet");
      console.log("   2. The transaction hash is incorrect");
      console.log("   3. The transaction is too recent");
    }

    console.log("\n\n💡 Detection Logic:");
    console.log("   For a transaction to be detected:");
    console.log("   1. User must be tx.from OR appear in log topics");
    console.log("   2. tx.to must match Atlantis contract OR");
    console.log("   3. A log.address must match Atlantis contract");
    console.log(`\n   User address: ${USER_ADDRESS.toLowerCase()}`);
    console.log(`   Atlantis contract: ${ATLANTIS_CONTRACT.toLowerCase()}`);

  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  }
}

analyzeTransaction().catch(console.error);
