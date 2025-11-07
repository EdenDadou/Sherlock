/**
 * Script de scan blockchain simple
 * Basé sur le modèle Python : detect_contracts() + classify_contract() + export
 *
 * Usage:
 *   npx tsx scripts/scan-blockchain.ts
 *   npx tsx scripts/scan-blockchain.ts 500   # Scanner les 500 derniers blocs
 */

import 'dotenv/config';
import { blockchainScannerService } from '../app/services/blockchain-scanner.service';

async function main() {
  // Récupérer le nombre de blocs depuis les arguments ou utiliser 1000 par défaut
  const depth = process.argv[2] ? parseInt(process.argv[2]) : 1000;

  console.log(`\n🚀 Scan Blockchain Monad Testnet\n`);
  console.log(`Profondeur: ${depth.toLocaleString()} blocs\n`);

  try {
    // Lancer le scan complet
    const results = await blockchainScannerService.fullScan(depth);

    // Exporter en CSV
    if (results.length > 0) {
      await blockchainScannerService.exportToCSV(results);
    }

    console.log('\n✅ Script terminé avec succès!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  }
}

main();
