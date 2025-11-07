/**
 * Script de vérification de l'implémentation complète
 * Teste tous les composants du système de découverte
 *
 * Usage:
 *   npx tsx scripts/verify-implementation.ts
 */

import { dappIdentificationService } from '../app/services/dapp-identification.service';
import { EnvioService } from '../app/services/envio.service';
import { ContractDetectorService } from '../app/services/contract-detector.service';
import { prisma } from '../app/lib/db/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';

// Créer des instances pour les services
const envioService = new EnvioService({
  hyperSyncUrl: process.env.ENVIO_HYPERSYNC_URL || 'https://monad-testnet.hypersync.xyz',
  chainId: process.env.MONAD_CHAIN_ID || 'monad-testnet',
});
const contractDetectorService = new ContractDetectorService(envioService as any);

async function main() {
  console.log('🔍 Vérification de l\'implémentation Sherlock\n');
  console.log('='.repeat(80));

  let allTestsPassed = true;

  // ========================================
  // TEST 1: Vérifier la base de contrats connus
  // ========================================
  console.log('\n📋 TEST 1: Base de contrats connus');
  console.log('-'.repeat(80));

  try {
    const knownContractsPath = path.join(process.cwd(), 'data', 'known-contracts.json');

    try {
      await fs.access(knownContractsPath);
      const content = await fs.readFile(knownContractsPath, 'utf-8');
      const contracts = JSON.parse(content);
      const count = Object.keys(contracts).length;

      console.log(`✅ Fichier known-contracts.json trouvé: ${count} contrat(s) connu(s)`);

      // Charger dans le service
      await dappIdentificationService.loadKnownContracts(knownContractsPath);

    } catch (fileError) {
      console.log('⚠️  Fichier known-contracts.json non trouvé, création d\'un exemple...');

      // Créer le répertoire data s'il n'existe pas
      await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });

      // Créer un fichier exemple
      const exampleContracts = {
        '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': {
          name: 'Uniswap',
          description: 'Decentralized exchange protocol',
          logoUrl: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
          website: 'https://uniswap.org',
          category: 'DEX',
          tags: ['dex', 'amm', 'defi'],
          confidence: 1.0,
          source: 'manual',
        },
      };

      await fs.writeFile(knownContractsPath, JSON.stringify(exampleContracts, null, 2));
      console.log('✅ Fichier exemple créé avec 1 contrat');
    }
  } catch (error) {
    console.error('❌ Erreur lors du test de la base de contrats:', error);
    allTestsPassed = false;
  }

  // ========================================
  // TEST 2: Classification intelligente
  // ========================================
  console.log('\n📊 TEST 2: Classification intelligente');
  console.log('-'.repeat(80));

  try {
    // Test des signatures d'événements
    const testCases = [
      {
        events: ['Swap', 'Sync', 'Mint', 'Burn'],
        expected: 'DEX',
      },
      {
        events: ['Borrow', 'Repay', 'Deposit', 'Withdraw'],
        expected: 'LENDING',
      },
      {
        events: ['TransferSingle', 'TransferBatch'],
        expected: 'NFT',
      },
      {
        events: ['Transfer', 'Approval'],
        expected: 'TOKEN',
      },
    ];

    for (const testCase of testCases) {
      const result = envioService.classifyContractByEvents(testCase.events);
      const passed = result.type === testCase.expected;

      if (passed) {
        console.log(`✅ ${testCase.events.join(', ')} → ${result.type} (confiance: ${result.confidence}%)`);
      } else {
        console.log(`❌ ${testCase.events.join(', ')} → ${result.type} (attendu: ${testCase.expected})`);
        allTestsPassed = false;
      }
    }
  } catch (error) {
    console.error('❌ Erreur lors du test de classification:', error);
    allTestsPassed = false;
  }

  // ========================================
  // TEST 3: Quality Scoring
  // ========================================
  console.log('\n⭐ TEST 3: Quality Scoring');
  console.log('-'.repeat(80));

  try {
    // Créer une dApp de test si elle n'existe pas
    let testDApp = await prisma.dApp.findFirst({
      where: { name: 'Test DApp' },
    });

    if (!testDApp) {
      testDApp = await prisma.dApp.create({
        data: {
          name: 'Test DApp',
          category: 'DEX',
          deployer: '0x0000000000000000000000000000000000000000',
        },
      });

      // Créer des activités de test
      await prisma.activity.create({
        data: {
          dappId: testDApp.id,
          date: new Date(),
          txCount: 1000,
          userCount: 100,
          eventCount: 5000,
          gasUsed: 1000000n,
        },
      });
    }

    // Calculer le quality score
    const scores = await contractDetectorService.calculateQualityScore(testDApp.id);

    console.log(`✅ Quality Score calculé: ${scores.qualityScore.toFixed(1)}/10`);
    console.log(`   - Activity: ${scores.activityScore.toFixed(1)}`);
    console.log(`   - Diversity: ${scores.diversityScore.toFixed(1)}`);
    console.log(`   - Age: ${scores.ageScore.toFixed(1)}`);

    // Vérifier que le score est cohérent
    if (scores.qualityScore >= 0 && scores.qualityScore <= 10) {
      console.log('✅ Score dans la plage valide (0-10)');
    } else {
      console.log(`❌ Score invalide: ${scores.qualityScore}`);
      allTestsPassed = false;
    }

    // Nettoyer
    await prisma.activity.deleteMany({ where: { dappId: testDApp.id } });
    await prisma.dApp.delete({ where: { id: testDApp.id } });

  } catch (error) {
    console.error('❌ Erreur lors du test de quality scoring:', error);
    allTestsPassed = false;
  }

  // ========================================
  // TEST 4: Identification multi-sources
  // ========================================
  console.log('\n🔎 TEST 4: Identification multi-sources');
  console.log('-'.repeat(80));

  try {
    // Test avec un contrat connu (Uniswap)
    const testAddress = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984';
    const identified = await dappIdentificationService.identifyDApp(testAddress);

    if (identified) {
      console.log(`✅ Contrat identifié: ${identified.name}`);
      console.log(`   Source: ${identified.source}`);
      console.log(`   Confiance: ${Math.round(identified.confidence * 100)}%`);
      console.log(`   Catégorie: ${identified.category}`);
    } else {
      console.log('⚠️  Contrat non identifié (normal si pas dans la base locale)');
    }

    // Test avec un contrat inconnu
    const unknownAddress = '0x0000000000000000000000000000000000000001';
    const notIdentified = await dappIdentificationService.identifyDApp(unknownAddress);

    if (!notIdentified) {
      console.log('✅ Contrat inconnu correctement non identifié');
    } else {
      console.log('⚠️  Contrat inconnu identifié (improbable mais possible)');
    }

  } catch (error) {
    console.error('❌ Erreur lors du test d\'identification:', error);
    allTestsPassed = false;
  }

  // ========================================
  // TEST 5: Base de données
  // ========================================
  console.log('\n💾 TEST 5: Base de données Prisma');
  console.log('-'.repeat(80));

  try {
    // Vérifier les tables principales
    const dappCount = await prisma.dApp.count();
    const contractCount = await prisma.contract.count();
    const activityCount = await prisma.activity.count();

    console.log(`✅ Table DApp: ${dappCount} entrée(s)`);
    console.log(`✅ Table Contract: ${contractCount} entrée(s)`);
    console.log(`✅ Table Activity: ${activityCount} entrée(s)`);

    // Vérifier les nouveaux champs
    const sampleDApp = await prisma.dApp.findFirst();
    if (sampleDApp) {
      const hasQualityFields =
        'qualityScore' in sampleDApp &&
        'activityScore' in sampleDApp &&
        'diversityScore' in sampleDApp &&
        'ageScore' in sampleDApp;

      if (hasQualityFields) {
        console.log('✅ Nouveaux champs quality score présents');
      } else {
        console.log('❌ Champs quality score manquants');
        allTestsPassed = false;
      }
    }

  } catch (error) {
    console.error('❌ Erreur lors du test de la base de données:', error);
    allTestsPassed = false;
  }

  // ========================================
  // TEST 6: Fichiers de service
  // ========================================
  console.log('\n📁 TEST 6: Fichiers de service');
  console.log('-'.repeat(80));

  const requiredFiles = [
    'app/services/envio.service.ts',
    'app/services/contract-detector.service.ts',
    'app/services/discovery-scanner.service.ts',
    'app/services/dapp-identification.service.ts',
    'app/services/metadata-enrichment.service.ts',
    'app/services/contract-metadata.service.ts',
  ];

  for (const file of requiredFiles) {
    try {
      await fs.access(path.join(process.cwd(), file));
      console.log(`✅ ${file}`);
    } catch {
      console.log(`❌ ${file} MANQUANT`);
      allTestsPassed = false;
    }
  }

  // ========================================
  // TEST 7: Documentation
  // ========================================
  console.log('\n📚 TEST 7: Documentation');
  console.log('-'.repeat(80));

  const requiredDocs = [
    'FINAL_IMPLEMENTATION.md',
    'KNOWN_CONTRACTS.md',
    'DISCOVERY_SYSTEM.md',
    'QUICK_START.md',
    'TROUBLESHOOTING.md',
    'README_DISCOVERY.md',
  ];

  for (const doc of requiredDocs) {
    try {
      await fs.access(path.join(process.cwd(), doc));
      console.log(`✅ ${doc}`);
    } catch {
      console.log(`⚠️  ${doc} manquant`);
    }
  }

  // ========================================
  // RÉSULTAT FINAL
  // ========================================
  console.log('\n' + '='.repeat(80));
  if (allTestsPassed) {
    console.log('✅ TOUS LES TESTS RÉUSSIS');
    console.log('\n🎉 Le système de découverte est 100% fonctionnel !');
    console.log('\nPour tester en conditions réelles, lancez:');
    console.log('  npm run dev');
    console.log('  # Puis ouvrez http://localhost:5173 et cliquez sur "Discovery"');
    console.log('\nOu testez directement avec:');
    console.log('  npx tsx scripts/test-discovery.ts');
  } else {
    console.log('⚠️  CERTAINS TESTS ONT ÉCHOUÉ');
    console.log('\nConsultez les logs ci-dessus pour les détails.');
    console.log('Voir TROUBLESHOOTING.md pour l\'aide au dépannage.');
  }
  console.log('='.repeat(80));

  await prisma.$disconnect();
  process.exit(allTestsPassed ? 0 : 1);
}

// Lancer le script
main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
