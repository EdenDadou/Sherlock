# Guide de démarrage rapide - Sherlock Discovery

## Système de découverte amélioré

Ton système peut maintenant :

### 1. Trouver TOUS les smart contracts déployés
- Scan via Envio HyperSync (ultra-rapide)
- Détection des contrats actifs (avec événements)
- Récupération automatique des deployers

### 2. Filtrer les contrats par activité
- **Nombre de transactions** : Trie par volume
- **Type d'interactions** : Détecte ERC-20, ERC-721, ERC-1155
- **Patterns connus** : DEX, Lending, NFT Marketplace, Bridge, Governance

### 3. Classification intelligente

Le système analyse automatiquement les event signatures et classe les dApps :

| Catégorie | Détection |
|-----------|-----------|
| **DEX** | Events: Swap, Sync, PairCreated, Mint+Burn |
| **Lending** | Events: Borrow, Repay, Deposit+Withdraw |
| **NFT** | Events: TransferSingle, TransferBatch (ERC-1155) |
| **NFT Marketplace** | Events: OrderFilled, ItemSold |
| **Bridge** | Events: TokensLocked, TokensUnlocked |
| **Governance** | Events: ProposalCreated, VoteCast |
| **Token** | Events: Transfer, Approval (simple ERC-20) |

### 4. Quality Scoring

Chaque dApp reçoit un score de qualité (0-10) basé sur :

- **Activity Score (35%)** : Nombre de transactions
- **Diversity Score (30%)** : Nombre d'utilisateurs uniques
- **Age Score (20%)** : Ancienneté du contrat
- **Contract Count Score (15%)** : Nombre de contrats dans la dApp

**Score > 5** = dApp légitime et active
**Score < 3** = Probablement un token spam

---

## Utilisation

### Lancer un scan de découverte

```bash
# 1. Démarrer le serveur
npm run dev

# 2. Ouvrir l'interface dans le navigateur
# http://localhost:5173

# 3. Cliquer sur "Discovery" dans le menu
# 4. Cliquer sur "Start Scan"
```

Le scan va :
1. ✅ Analyser les 100 000 derniers blocs
2. ✅ Trouver les 500 contrats les plus actifs
3. ✅ Grouper par factory (max 10 dApps uniques)
4. ✅ Classifier chaque contrat (DEX, Lending, NFT, etc.)
5. ✅ Calculer le quality score
6. ✅ Enrichir avec métadonnées (name, symbol, logo)

### Progression en temps réel

Le système émet des événements SSE (Server-Sent Events) :

- **progress** : Mise à jour de la barre de progression
- **dapp-discovered** : Nouvelle dApp découverte
- **completed** : Scan terminé
- **error** : Erreur rencontrée

---

## Exemples de résultats

### Exemple 1 : DEX détecté

```json
{
  "id": "clx1234567890",
  "name": "UniswapV2Pair",
  "category": "DEX",
  "qualityScore": 8.5,
  "activityScore": 9.2,
  "diversityScore": 8.1,
  "contracts": [
    {
      "address": "0xabc123...",
      "type": "ERC20",
      "eventCount": 15234
    }
  ]
}
```

### Exemple 2 : Lending protocol détecté

```json
{
  "id": "clx0987654321",
  "name": "Aave-like Protocol",
  "category": "LENDING",
  "qualityScore": 7.3,
  "activityScore": 6.5,
  "diversityScore": 8.0,
  "contracts": [
    {
      "address": "0xdef456...",
      "type": "CUSTOM",
      "eventCount": 8423
    }
  ]
}
```

---

## API Routes disponibles

### 1. Lancer un scan
```bash
GET /api/discovery/scan
```

Démarre un nouveau scan de découverte.

### 2. Écouter les événements (SSE)
```bash
GET /api/discovery/events
```

Stream des événements de progression en temps réel.

### 3. Nettoyer les dApps (utilitaire)
```bash
POST /api/dapps/cleanup
```

Nettoie les dApps avec un quality score < 3 (spam).

---

## Configuration

### Variables d'environnement

```bash
# .env
VITE_MONAD_RPC_URL="https://monad-testnet.g.alchemy.com/v2/YOUR_KEY"
ENVIO_HYPERSYNC_URL="https://monad-testnet.hypersync.xyz"
MONAD_CHAIN_ID="monad-testnet"

# Scanner config
ENABLE_BLOCK_SCANNER="true"
ENABLE_ACTIVITY_TRACKER="true"
```

### Paramètres de scan (modifiables dans `discovery-scanner.service.ts`)

```typescript
const discoveredContracts = await this.envioService.discoverContracts({
  maxBlocks: 100000,    // Nombre de blocs à scanner
  maxContracts: 500,    // Nombre max de contrats à analyser
  maxDApps: 10,         // Nombre max de dApps uniques à découvrir
});
```

---

## Architecture du système

```
┌─────────────────────────────────────────────┐
│         Frontend (React)                    │
│  - DiscoveryModal.tsx                       │
│  - Progress bar + SSE events                │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│         DiscoveryScannerService             │
│  - Orchestre le scan                        │
│  - Émet des événements (progress, etc)      │
└─────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ EnvioService │ │  Contract    │ │  Metadata    │
│              │ │  Detector    │ │  Enrichment  │
│ - HyperSync  │ │              │ │              │
│ - Classify   │ │ - Grouping   │ │ - On-chain   │
│ - Find most  │ │ - Quality    │ │ - CoinGecko  │
│   active     │ │   scoring    │ │ - Logos      │
└──────────────┘ └──────────────┘ └──────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│         Prisma ORM + SQLite                 │
│  - DApp (avec quality scoring)              │
│  - Contract (avec metadata)                 │
│  - Activity                                 │
└─────────────────────────────────────────────┘
```

---

## Prochaines améliorations possibles

### Court terme (facile)
- [ ] Ajouter un filtre par quality score dans l'UI
- [ ] Afficher les event signatures détectées
- [ ] Export JSON/CSV des dApps découvertes

### Moyen terme (modéré)
- [ ] Calcul de TVL (Total Value Locked)
- [ ] Détection des interactions entre contrats
- [ ] Historique des scans

### Long terme (complexe)
- [ ] Multi-chain (supporter plusieurs blockchains)
- [ ] API publique pour exposer les dApps
- [ ] Dashboard analytics avancé
- [ ] Système de voting communautaire

---

## Dépannage

### Erreur : "HyperSync timeout"
**Solution** : Réduire `maxBlocks` dans la config (passer à 10000 au lieu de 100000)

### Erreur : "No contracts found"
**Solution** : Vérifier que `ENVIO_HYPERSYNC_URL` est correct dans `.env`

### Performance lente
**Solution** : Réduire `maxContracts` et `maxDApps` pour un scan plus rapide

### Database locked
**Solution** : Arrêter le serveur et relancer : `npm run dev`

---

## Comparaison avec les concurrents

| Fonctionnalité | Sherlock | DappRadar | DeFiLlama |
|----------------|----------|-----------|-----------|
| Découverte automatique | ✅ Oui | ⚠️ Hybride | ❌ Manuel |
| Classification intelligente | ✅ Oui | ✅ Oui | ✅ Oui |
| Quality scoring | ✅ Oui | ✅ Oui | ❌ Non |
| Temps réel (SSE) | ✅ Oui | ❌ Non | ❌ Non |
| TVL calculation | ❌ WIP | ✅ Oui | ✅ Oui |
| Multi-chain | ❌ Monad | ✅ 50+ | ✅ 100+ |

---

**Fait avec ❤️ pour Sherlock - Monad dApp Explorer**

Pour plus d'informations techniques, voir [DISCOVERY_SYSTEM.md](./DISCOVERY_SYSTEM.md)
