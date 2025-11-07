/**
 * Script de test du système de découverte
 * Lance un scan et affiche les résultats
 *
 * Usage:
 *   npx tsx scripts/test-discovery.ts
 */

import { discoveryScannerService } from '../app/services/discovery-scanner.service';
import { prisma } from '../app/lib/db/prisma';

async function main() {
  console.log('🚀 Test du système de découverte Sherlock\n');
  console.log('='.repeat(80));

  // Écouter les événements
  discoveryScannerService.on('progress', (progress) => {
    const bar = '█'.repeat(Math.floor(progress.progress / 5)) + '░'.repeat(20 - Math.floor(progress.progress / 5));
    console.log(
      `\r📊 Progression: [${bar}] ${progress.progress}% | ` +
      `Contrats: ${progress.contractsFound} | dApps: ${progress.dappsDiscovered}`
    );
  });

  discoveryScannerService.on('dapp-discovered', (dapp) => {
    console.log('\n🎉 Nouvelle dApp découverte !');
    console.log(`   Nom: ${dapp.name || 'Inconnu'}`);
    console.log(`   Catégorie: ${dapp.category}`);
    console.log(`   Contrats: ${dapp.contractCount}`);
    console.log(`   ID: ${dapp.id}`);
  });

  discoveryScannerService.on('completed', async (progress) => {
    console.log('\n\n' + '='.repeat(80));
    console.log('✅ Scan terminé !\n');

    // Afficher les statistiques finales
    const dapps = await prisma.dApp.findMany({
      include: {
        contracts: true,
      },
      orderBy: {
        qualityScore: 'desc',
      },
    });

    console.log(`📊 Statistiques finales:`);
    console.log(`   Total dApps: ${dapps.length}`);
    console.log(`   Total contrats: ${progress.contractsFound}`);
    console.log('');

    if (dapps.length > 0) {
      console.log('🏆 Top dApps par quality score:\n');

      for (let i = 0; i < Math.min(5, dapps.length); i++) {
        const dapp = dapps[i];
        console.log(`${i + 1}. ${dapp.name || 'Inconnu'} (${dapp.category})`);
        console.log(`   Quality Score: ${dapp.qualityScore.toFixed(1)}/10`);
        console.log(`   - Activity: ${dapp.activityScore.toFixed(1)}`);
        console.log(`   - Diversity: ${dapp.diversityScore.toFixed(1)}`);
        console.log(`   - Age: ${dapp.ageScore.toFixed(1)}`);
        console.log(`   Contrats: ${dapp.contracts.length}`);
        console.log('');
      }

      // Statistiques par catégorie
      const byCategory = dapps.reduce((acc, dapp) => {
        acc[dapp.category] = (acc[dapp.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('📈 Répartition par catégorie:\n');
      Object.entries(byCategory)
        .sort(([, a], [, b]) => b - a)
        .forEach(([category, count]) => {
          console.log(`   ${category.padEnd(20)} : ${count} dApp(s)`);
        });

      console.log('\n' + '='.repeat(80));
    }

    process.exit(0);
  });

  discoveryScannerService.on('error', (progress) => {
    console.error('\n❌ Erreur lors du scan:', progress.error);
    process.exit(1);
  });

  // Lancer le scan
  try {
    console.log('🔍 Démarrage du scan...\n');
    await discoveryScannerService.startScan();
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

// Lancer le script
main();
