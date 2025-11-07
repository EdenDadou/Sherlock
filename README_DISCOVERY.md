# Sherlock - Système de découverte de dApps sur Monad

## Vue d'ensemble

Sherlock est un explorateur automatique de dApps pour Monad testnet, capable de :

✅ **Détecter automatiquement** tous les smart contracts déployés
✅ **Classifier intelligemment** les dApps (DEX, Lending, NFT, etc.)
✅ **Scorer la qualité** des dApps (filtrer le spam)
✅ **Enrichir les métadonnées** (logos, noms, symboles)
✅ **Suivre en temps réel** la progression du scan

---

## Fonctionnalités principales

### 1. Découverte automatique

Le système scanne la blockchain Monad en utilisant **Envio HyperSync**, un indexeur ultra-rapide qui permet de :

- Analyser 100 000 blocs en ~30 secondes
- Trouver les 500 contrats les plus actifs
- Grouper par factory (déployeur commun)
- Limiter intelligemment à 10 dApps uniques par scan

### 2. Classification intelligente

Analyse automatique des **event signatures** pour détecter :

| Type | Événements détectés |
|------|---------------------|
| **DEX** | Swap, Sync, PairCreated, Mint+Burn |
| **Lending** | Borrow, Repay, Deposit+Withdraw |
| **NFT** | TransferSingle, TransferBatch |
| **NFT Marketplace** | OrderFilled, ItemSold |
| **Bridge** | TokensLocked, TokensUnlocked |
| **Governance** | ProposalCreated, VoteCast |
| **Token** | Transfer, Approval (simple ERC-20) |

**Score de confiance** : 0-100% pour chaque classification

### 3. Quality Scoring

Chaque dApp reçoit un **score de qualité** (0-10) calculé selon :

```
Quality Score =
  Activity Score (35%) +      // Nombre de transactions
  Diversity Score (30%) +      // Nombre d'utilisateurs uniques
  Age Score (20%) +            // Ancienneté du contrat
  Contract Count Score (15%)   // Nombre de contrats
```

**Interprétation** :
- 🟢 **7-10** : Excellent - dApp très active et légitime
- 🟡 **5-7** : Bon - dApp modérément active
- 🟠 **3-5** : Moyen - dApp peu active
- 🔴 **0-3** : Faible - Probablement spam

### 4. Enrichissement des métadonnées

**Sources on-chain** (via viem) :
- `name()`, `symbol()`, `decimals()`
- `totalSupply()`
- `supportsInterface()` pour détecter ERC721/ERC1155

**Sources externes** :
- **CoinGecko API** : Logos, prix, descriptions
- **TrustWallet Assets** : Logos vérifiés
- **DiceBear API** : Génération d'avatars déterministes

### 5. Interface temps réel

**Server-Sent Events (SSE)** pour suivre la progression :
- `progress` : Mise à jour de la barre de progression
- `dapp-discovered` : Notification de nouvelle dApp
- `completed` : Scan terminé
- `error` : Erreur rencontrée

---

## Installation et utilisation

### Prérequis

```bash
Node.js >= 18
npm ou yarn
```

### Installation

```bash
# Cloner le repo
git clone <repo-url>
cd Sherlock

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos clés API
```

### Configuration (.env)

```bash
# RPC Monad Testnet
VITE_MONAD_RPC_URL="https://monad-testnet.g.alchemy.com/v2/YOUR_KEY"

# Envio HyperSync (gratuit, pas de clé nécessaire)
ENVIO_HYPERSYNC_URL="https://monad-testnet.hypersync.xyz"
MONAD_CHAIN_ID="monad-testnet"

# Scanner config
ENABLE_BLOCK_SCANNER="true"
ENABLE_ACTIVITY_TRACKER="true"
```

### Lancer l'application

```bash
# Générer le client Prisma
npx prisma generate

# Démarrer le serveur de développement
npm run dev

# Ouvrir http://localhost:5173
```

### Lancer un scan

1. Cliquer sur **"Discovery"** dans le menu
2. Cliquer sur **"Démarrer le scan"**
3. Observer les dApps découvertes en temps réel
4. Voir les scores de qualité et classifications

---

## Architecture technique

```
┌─────────────────────────────────────────────┐
│         Frontend (React Router)             │
│  - DiscoveryModal.tsx                       │
│  - Server-Sent Events (SSE)                 │
│  - Quality Score UI                         │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│         DiscoveryScannerService             │
│  - Orchestre le scan                        │
│  - Émet des événements (progress, etc)      │
│  - Classification + Quality Scoring         │
└─────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ EnvioService │ │  Contract    │ │  Metadata    │
│              │ │  Detector    │ │  Enrichment  │
│ - HyperSync  │ │              │ │              │
│ - classify() │ │ - Grouping   │ │ - On-chain   │
│ - findMost   │ │ - Quality    │ │ - CoinGecko  │
│   Active     │ │   Scoring    │ │ - Avatars    │
└──────────────┘ └──────────────┘ └──────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│         Prisma ORM + SQLite                 │
│  - DApp (quality scoring)                   │
│  - Contract (metadata)                      │
│  - Activity                                 │
└─────────────────────────────────────────────┘
```

---

## API Routes

### `GET /api/discovery/scan`
Lance un nouveau scan de découverte.

**Query params** :
- Aucun

**Response** :
```json
{
  "message": "Scan démarré avec succès"
}
```

### `POST /api/discovery/scan`
Contrôle le scan (start/stop).

**Body** :
```json
{
  "action": "start" | "stop"
}
```

### `GET /api/discovery/events` (SSE)
Stream des événements de progression en temps réel.

**Events** :
- `progress` : { currentBlock, totalBlocks, progress, dappsDiscovered, contractsFound }
- `dapp-discovered` : { id, name, category, qualityScore, ... }
- `completed` : { status: 'completed' }
- `error` : { status: 'error', error: string }

---

## Scripts utiles

### Test du système de découverte

```bash
npx tsx scripts/test-discovery.ts
```

Affiche :
- Progression en temps réel
- dApps découvertes au fur et à mesure
- Statistiques finales (top dApps, répartition par catégorie)

### Scanner standalone

```bash
npx tsx scripts/simple-scanner.ts
```

Script indépendant qui scanne directement la blockchain sans passer par le serveur.

---

## Structure des fichiers

```
Sherlock/
├── app/
│   ├── components/
│   │   └── DiscoveryModal.tsx           # UI du scan
│   ├── services/
│   │   ├── discovery-scanner.service.ts  # Orchestration
│   │   ├── envio.service.ts              # HyperSync + Classification
│   │   ├── contract-detector.service.ts  # Quality Scoring
│   │   ├── metadata-enrichment.service.ts # Enrichissement
│   │   └── contract-metadata.service.ts  # Métadonnées on-chain
│   └── routes/
│       └── api+/
│           └── discovery+/
│               ├── scan.ts               # Route API scan
│               └── events.ts             # Route SSE
├── prisma/
│   ├── schema.prisma                    # Schema DB
│   └── dev.db                           # SQLite DB
├── scripts/
│   ├── test-discovery.ts                # Script de test
│   └── simple-scanner.ts                # Scanner standalone
├── DISCOVERY_SYSTEM.md                  # Doc technique complète
├── QUICK_START.md                       # Guide rapide
├── IMPLEMENTATION_SUMMARY.md            # Résumé implémentation
└── README_DISCOVERY.md                  # Ce fichier
```

---

## Exemples de résultats

### Scan terminé

```
🔍 Démarrage de la découverte...
✓ 250 contrats découverts

📊 Contrat 0x1234... classé comme DEX (confidence: 92%)
✓ Quality score: 7.8/10

📊 Contrat 0x5678... classé comme LENDING (confidence: 88%)
✓ Quality score: 6.3/10

✓ Découverte terminée : 8 dApps trouvées

🏆 Top dApps :
1. UniswapV2Pair (DEX) - Score: 7.8/10
2. Aave Protocol (LENDING) - Score: 6.3/10
3. NFT Marketplace (NFT_MARKETPLACE) - Score: 5.9/10
```

### Interface web

Les dApps s'affichent en temps réel avec :
- Logo (ou avatar généré)
- Nom et symbole
- Badge de catégorie (DEX, Lending, etc.)
- Quality Score avec étoile (7.8/10)
- Détails des sous-scores (Activity, Diversity, Age)
- Liste des contrats associés

---

## Performance

| Métrique | Valeur |
|----------|--------|
| **Scan de 100 000 blocs** | ~30 secondes |
| **Analyse de 500 contrats** | ~2 minutes |
| **Enrichissement de 10 dApps** | ~1 minute |
| **Scan complet** | ~3-4 minutes |

---

## Comparaison avec la concurrence

| Fonctionnalité | Sherlock | DappRadar | DeFiLlama |
|----------------|----------|-----------|-----------|
| Découverte automatique | ✅ Oui | ⚠️ Hybride | ❌ Manuel |
| Classification intelligente | ✅ Oui (9 types) | ✅ Oui | ✅ Oui |
| Quality Scoring | ✅ Oui | ✅ Oui | ❌ Non |
| Temps réel (SSE) | ✅ Oui | ❌ Non | ❌ Non |
| TVL Calculation | ⚠️ WIP | ✅ Oui | ✅ Oui |
| Multi-chain | ❌ Monad | ✅ 50+ | ✅ 100+ |
| Open-source | ✅ Oui | ❌ Non | ✅ Oui |

---

## Roadmap

### v1.0 (Actuel) ✅
- [x] Découverte automatique
- [x] Classification intelligente
- [x] Quality Scoring
- [x] Enrichissement métadonnées
- [x] Interface temps réel

### v1.1 (Court terme)
- [ ] Filtres dans l'UI (par catégorie, score)
- [ ] Export JSON/CSV
- [ ] Page de détails pour chaque dApp
- [ ] Historique des scans

### v1.2 (Moyen terme)
- [ ] Calcul de TVL (Total Value Locked)
- [ ] Détection des interactions entre contrats
- [ ] Cron job automatique
- [ ] API REST publique

### v2.0 (Long terme)
- [ ] Support multi-chain
- [ ] Dashboard analytics avancé
- [ ] Système de reputation/voting
- [ ] Intégration DefiLlama

---

## Contribuer

Les contributions sont les bienvenues !

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push sur la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

---

## Support

- Documentation technique : [DISCOVERY_SYSTEM.md](./DISCOVERY_SYSTEM.md)
- Guide rapide : [QUICK_START.md](./QUICK_START.md)
- Résumé d'implémentation : [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- Issues : GitHub Issues

---

## License

MIT

---

## Remerciements

- **Envio** pour HyperSync (indexeur ultra-rapide)
- **Monad** pour le testnet
- **Viem** pour la bibliothèque Ethereum TypeScript
- **Prisma** pour l'ORM
- **React Router** pour le framework

---

**Fait avec ❤️ pour la communauté Monad**
