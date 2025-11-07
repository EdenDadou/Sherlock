# Système de Découverte de dApps - Documentation Technique

## Vue d'ensemble

Ce document explique comment fonctionne le système de découverte de dApps sur Monad testnet, comment il se compare aux solutions comme DappRadar et DeFiLlama, et comment l'améliorer.

---

## 1. Comment DappRadar et DeFiLlama détectent les dApps

### 1.1 DappRadar

**Approche hybride : Automatique + Manuelle**

#### Sources de données :
- **Indexation blockchain** : Scan des événements (Transfer, Swap, Mint, etc.)
- **Soumissions manuelles** : Les développeurs soumettent leurs dApps
- **Agrégation d'APIs** : TheGraph, Alchemy, Moralis, etc.
- **Analytics on-chain** : Volume de transactions, utilisateurs uniques, TVL

#### Méthode de détection :
1. **Pattern Recognition** : Détection de patterns connus (DEX, lending, NFT marketplace)
   - Événements `Swap` + `Sync` → DEX (Uniswap-like)
   - Événements `Deposit` + `Withdraw` → Protocol DeFi
   - Événements `Transfer` (ERC721/1155) → NFT marketplace

2. **Grouping par Factory** : Contrats déployés par la même factory = même dApp
   - Exemple : Uniswap V2 factory déploie des paires → tous groupés sous "Uniswap V2"

3. **Metadata Enrichment** :
   - Récupération du nom/symbol on-chain
   - Lookup dans des bases externes (GitHub, CoinGecko, etc.)
   - Vérification de l'existence d'un site web

4. **Scoring d'activité** :
   - Nombre d'utilisateurs uniques (distinct wallets)
   - Volume de transactions
   - Volume d'argent (TVL, trading volume)

### 1.2 DeFiLlama

**Approche principalement manuelle avec validation automatique**

#### Sources de données :
- **Adaptateurs custom** : Code écrit manuellement pour chaque protocole
- **TVL calculation** : Appels RPC pour compter les balances de tokens
- **Oracles de prix** : CoinGecko, DEX aggregators
- **GitHub repos** : Configuration via fichiers YAML

#### Méthode :
1. **Soumission manuelle** : Équipe DeFiLlama ou communauté ajoute un protocole
2. **Adapter development** : Un script TypeScript/Python récupère la TVL
3. **Validation automatique** : Vérification que les données sont cohérentes
4. **Monitoring continu** : Mise à jour de la TVL toutes les heures

**Exemple d'adapter DeFiLlama :**
```typescript
async function tvl(timestamp, block) {
  const balances = {};

  // Récupérer les balances des contrats principaux
  const usdcBalance = await sdk.api.erc20.balanceOf({
    target: USDC_ADDRESS,
    owner: PROTOCOL_CONTRACT,
    block,
  });

  balances[USDC_ADDRESS] = usdcBalance.output;
  return balances;
}

module.exports = {
  methodology: "Counts tokens locked in the main contract",
  monad: { tvl },
};
```

---

## 2. Ton système actuel : Architecture et fonctionnement

### 2.1 Stack technique

```
┌─────────────────────────────────────────────┐
│         Frontend (React Router)             │
│  - DiscoveryModal : UI pour le scan         │
│  - SSE : Server-Sent Events pour progress   │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│         Backend Services                    │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  DiscoveryScannerService              │  │
│  │  - Orchestre le scan                  │  │
│  │  - Émet des événements (progress, etc)│  │
│  └───────────────────────────────────────┘  │
│                      │                      │
│         ┌────────────┼────────────┐         │
│         ▼            ▼            ▼         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │  Envio   │ │Contract  │ │ Metadata │    │
│  │ Service  │ │ Detector │ │Enrichment│    │
│  └──────────┘ └──────────┘ └──────────┘    │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│         Data Layer                          │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Prisma ORM + SQLite                │    │
│  │  - DApp                              │    │
│  │  - Contract                          │    │
│  │  - Activity                          │    │
│  │  - BlockScanState                    │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 2.2 Flux de découverte

```
1. User clicks "Scan" → startScan()
        ↓
2. EnvioService.discoverContracts()
   - Récupère le bloc actuel
   - Scan les 100k derniers blocs
   - Trouve les contrats actifs (via logs)
        ↓
3. Pour chaque contrat actif :
   a. findContractCreator() → Trouve le deployer
   b. saveContract() → Sauvegarde dans DB
   c. analyzeAndGroupContract() → Groupe par factory
        ↓
4. MetadataEnrichmentService
   - Enrichit les métadonnées on-chain (name, symbol)
   - Détecte le type (ERC20, ERC721, etc.)
        ↓
5. Émission des événements SSE
   - progress → UI met à jour la barre
   - dapp-discovered → Affiche la nouvelle dApp
        ↓
6. Scan terminé → completed event
```

### 2.3 Points forts actuels

✅ **Automatique** : Aucune intervention manuelle nécessaire

✅ **Rapide** : Utilise Envio HyperSync (indexeur optimisé)

✅ **Pattern detection** : Grouping par factory

✅ **Metadata enrichment** : Récupération on-chain des noms/symbols

✅ **Real-time progress** : SSE pour feedback utilisateur

✅ **Limite intelligente** : Max 10 dApps pour éviter le spam

---

## 3. Limites et améliorations possibles

### 3.1 Limites actuelles

❌ **Pas de classification fine** : Tout ERC20 → DEFI, pas de distinction DEX/Lending/etc.

❌ **Pas d'enrichissement externe** : Pas de lookup GitHub, site web, logo

❌ **Factory grouping trop agressif** : Tous les contrats d'une factory = 1 dApp

❌ **Pas de scoring de qualité** : Impossible de différencier un vrai protocole d'un token spam

❌ **Pas de TVL calculation** : Pas de calcul du capital verrouillé

❌ **Limite de blocs** : 100k blocs max, peut manquer des dApps anciennes

### 3.2 Améliorations recommandées

#### 🔥 Priorité 1 : Classification intelligente

**Problème** : Tous les ERC20 sont marqués DEFI, pas de nuance.

**Solution** : Analyser les événements émis pour classifier

```typescript
// Dans EnvioService
const eventTypes = contract.eventTypes; // ['0xd78ad95fa46c...', ...]

// Détecter les patterns
if (hasEvent(eventTypes, 'Swap') && hasEvent(eventTypes, 'Sync')) {
  category = 'DEX';
} else if (hasEvent(eventTypes, 'Deposit') && hasEvent(eventTypes, 'Withdraw')) {
  category = 'LENDING';
} else if (hasEvent(eventTypes, 'Transfer') && hasEvent(eventTypes, 'Approval')) {
  category = 'TOKEN';
}
```

**Implémentation** : Ajouter une méthode `classifyByEvents()` dans `ContractDetectorService`

---

#### 🔥 Priorité 2 : Scoring de qualité

**Problème** : Impossible de différencier Uniswap d'un token spam.

**Solution** : Calculer un "quality score" basé sur :

```typescript
interface QualityScore {
  activityScore: number;      // Nombre de transactions
  diversityScore: number;      // Nombre d'utilisateurs uniques
  ageScore: number;            // Ancienneté du contrat
  contractCountScore: number;  // Nombre de contrats dans la dApp
  totalScore: number;          // Moyenne pondérée
}

// Exemple de calcul
const qualityScore = {
  activityScore: Math.min(eventCount / 1000, 10), // Max 10 points
  diversityScore: Math.min(uniqueUsers / 100, 10),
  ageScore: Math.min(daysOld / 30, 10),
  contractCountScore: Math.min(contractCount / 5, 10),
};

qualityScore.totalScore = (
  qualityScore.activityScore * 0.3 +
  qualityScore.diversityScore * 0.3 +
  qualityScore.ageScore * 0.2 +
  qualityScore.contractCountScore * 0.2
);
```

**Avantage** : Filtrer automatiquement les tokens spam (score < 3)

---

#### 🔥 Priorité 3 : Enrichissement externe

**Problème** : Pas de logo, site web, description.

**Solution** : Intégrer des APIs externes

```typescript
// CoinGecko API (gratuit, rate-limited)
async function enrichWithCoinGecko(address: string) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/monad-testnet/contract/${address}`
  );

  if (response.ok) {
    const data = await response.json();
    return {
      logo: data.image?.large,
      website: data.links?.homepage?.[0],
      description: data.description?.en,
    };
  }

  return null;
}

// Etherscan/Blockscout API
async function enrichWithExplorer(address: string) {
  // Récupérer le code source vérifié
  // Extraire les commentaires NatSpec
  // Trouver le site web dans les métadonnées
}
```

**Implémentation** : Ajouter une étape dans `MetadataEnrichmentService`

---

#### 🔥 Priorité 4 : TVL Calculation

**Problème** : Pas de calcul de TVL (Total Value Locked).

**Solution** : Calculer les balances des tokens dans les contrats

```typescript
async function calculateTVL(dappId: string) {
  const dapp = await prisma.dApp.findUnique({
    where: { id: dappId },
    include: { contracts: true },
  });

  let totalTVL = 0;

  for (const contract of dapp.contracts) {
    // Récupérer tous les tokens détenus par ce contrat
    const tokens = await getTokenBalances(contract.address);

    for (const token of tokens) {
      const price = await getTokenPrice(token.address); // CoinGecko/DEX
      const valueUSD = (token.balance * price) / (10 ** token.decimals);
      totalTVL += valueUSD;
    }
  }

  return totalTVL;
}
```

**Note** : Nécessite un oracle de prix (CoinGecko, Chainlink, ou DEX)

---

#### 🔥 Priorité 5 : Meilleur grouping

**Problème** : Factory grouping trop agressif (tous les contrats d'une factory = 1 dApp)

**Solution** : Grouping intelligent basé sur plusieurs critères

```typescript
// Critères de grouping :
// 1. Même factory (actuel) ✓
// 2. Interactions entre contrats (calls between contracts)
// 3. Même schéma d'événements (event patterns)
// 4. Temps de déploiement proche (< 1 jour d'écart)

async function shouldGroupContracts(contract1: Contract, contract2: Contract): Promise<boolean> {
  // Critère 1 : Même factory
  if (contract1.creatorAddress === contract2.creatorAddress) {
    return true;
  }

  // Critère 2 : Interactions détectées
  const hasInteractions = await detectInteractions(contract1.address, contract2.address);
  if (hasInteractions) {
    return true;
  }

  // Critère 3 : Patterns similaires + déploiement proche
  const timeDiff = Math.abs(
    contract1.deploymentDate.getTime() - contract2.deploymentDate.getTime()
  );
  const sameDay = timeDiff < 86400000; // 1 jour

  if (sameDay && haveSimilarPatterns(contract1, contract2)) {
    return true;
  }

  return false;
}
```

---

## 4. Comparaison finale : Ton système vs DappRadar/DeFiLlama

| Critère                  | Ton système | DappRadar | DeFiLlama |
|--------------------------|-------------|-----------|-----------|
| **Automatique**          | ✅ Oui      | ⚠️ Hybride| ❌ Manuel |
| **Classification**       | ⚠️ Basique  | ✅ Avancée| ✅ Avancée|
| **Metadata enrichment**  | ⚠️ On-chain | ✅ Complet| ✅ Complet|
| **TVL calculation**      | ❌ Non      | ✅ Oui    | ✅ Oui    |
| **Quality scoring**      | ❌ Non      | ✅ Oui    | ✅ Oui    |
| **Temps réel**           | ✅ SSE      | ❌ Polling| ❌ Hourly |
| **Spam filtering**       | ⚠️ Limite   | ✅ Oui    | ✅ Manuel |
| **Multi-chain**          | ❌ Monad    | ✅ 50+    | ✅ 100+   |

---

## 5. Conclusion et prochaines étapes

### Ce qui fonctionne bien :
- ✅ Découverte automatique rapide (Envio HyperSync)
- ✅ Grouping par factory
- ✅ UI temps réel avec SSE
- ✅ Métadonnées on-chain

### Ce qu'il faut améliorer :
1. **Classification intelligente** (analyser les event signatures)
2. **Quality scoring** (filtrer le spam)
3. **Enrichissement externe** (logos, sites web, descriptions)
4. **TVL calculation** (valeur économique)
5. **Grouping avancé** (détecter les interactions entre contrats)

### Pour aller plus loin :
- Ajouter un **cron job** pour scanner automatiquement toutes les heures
- Implémenter un **cache Redis** pour les métadonnées externes
- Créer un **API publique** pour exposer les dApps découvertes
- Ajouter un **système de voting** pour valider manuellement les dApps

---

## 6. Ressources utiles

### APIs et outils :
- **Envio HyperSync** : https://docs.envio.dev/docs/hypersync
- **CoinGecko API** : https://www.coingecko.com/api/documentation
- **Viem** : https://viem.sh (bibliothèque TypeScript pour Ethereum)
- **The Graph** : https://thegraph.com (indexation décentralisée)

### Exemples de code :
- **DeFiLlama adapters** : https://github.com/DefiLlama/DefiLlama-Adapters
- **Event signatures** : https://www.4byte.directory/
- **ERC standards** : https://eips.ethereum.org/

---

Fait avec ❤️ pour Sherlock - Monad dApp Explorer
