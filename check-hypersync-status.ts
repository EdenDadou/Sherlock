/**
 * Check HyperSync indexing status
 */
import { createEnvioService } from "./app/services/envio.service";

async function checkHyperSyncStatus() {
  console.log("🔍 Checking HyperSync indexing status...\n");

  const envioService = createEnvioService();

  try {
    const currentBlock = await envioService.getCurrentBlock();
    console.log(`📊 Latest block indexed by HyperSync: ${currentBlock}`);
    console.log(`   This means HyperSync is up to block #${currentBlock}\n`);

    // Get user's transactions to see the latest one
    const USER_ADDRESS = "0x6f7b21276be8026a29602007fbbb7ceee4059645";

    console.log(`🔎 Fetching your latest transactions...\n`);

    const query = {
      from_block: Math.max(0, currentBlock - 1000), // Last 1000 blocks
      to_block: currentBlock,
      transactions: [
        {
          from: [USER_ADDRESS.toLowerCase()],
        },
      ],
      field_selection: {
        transaction: ["hash", "from", "to", "block_number", "transaction_index"],
      },
      include_all_blocks: false,
    };

    const response = await envioService['hyperSyncClient'].sendReq(query);

    if (response.data && response.data.length > 0) {
      let totalTxs = 0;
      const allTxs: any[] = [];

      response.data.forEach((blockData: any) => {
        if (blockData.transactions) {
          totalTxs += blockData.transactions.length;
          allTxs.push(...blockData.transactions);
        }
      });

      console.log(`✅ Found ${totalTxs} transactions in last 1000 blocks\n`);

      if (allTxs.length > 0) {
        // Sort by block number descending
        allTxs.sort((a, b) => b.block_number - a.block_number);

        console.log("📋 Your 10 most recent transactions:\n");
        allTxs.slice(0, 10).forEach((tx, i) => {
          console.log(`  ${i + 1}. Block ${tx.block_number}`);
          console.log(`     Hash: ${tx.hash}`);
          console.log(`     To: ${tx.to || "Contract Creation"}`);
          console.log();
        });
      }
    } else {
      console.log("❌ No transactions found in last 1000 blocks");
    }

    console.log("\n💡 How it works:");
    console.log("   - Transactions are indexed by HyperSync with a delay");
    console.log("   - Recent transactions (< 1 minute) may not be indexed yet");
    console.log("   - Wait a few minutes and refresh to see new interactions");

  } catch (error) {
    console.error("\n❌ Error:", error);
  }
}

checkHyperSyncStatus().catch(console.error);
