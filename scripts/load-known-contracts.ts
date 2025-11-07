/**
 * Script pour charger les contrats connus depuis le fichier JSON
 *
 * Usage:
 *   npx tsx scripts/load-known-contracts.ts
 */

import { dappIdentificationService } from '../app/services/dapp-identification.service';
import path from 'path';

async function main() {
  console.log('📦 Chargement des contrats connus...\n');

  const filePath = path.join(process.cwd(), 'data', 'known-contracts.json');

  try {
    await dappIdentificationService.loadKnownContracts(filePath);
    console.log('\n✅ Contrats connus chargés avec succès !');
  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

main();
