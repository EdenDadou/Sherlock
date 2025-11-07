# 🚀 START HERE - Sherlock dApp Discovery

## Bienvenue! Tout est prêt à l'emploi.

---

## ⚡ Démarrage rapide (1 commande)

```bash
npm run verify
```

**Cette commande va** :
- ✅ Vérifier tous les fichiers
- ✅ Tester la classification
- ✅ Tester le quality scoring
- ✅ Tester l'identification multi-sources
- ✅ Vérifier la base de données

**Résultat attendu** :
```
✅ TOUS LES TESTS RÉUSSIS
🎉 Le système de découverte est 100% fonctionnel !
```

---

## 🎯 Les 3 façons d'utiliser le système

### 1️⃣ Interface web (recommandé)

```bash
npm run dev
```

Puis ouvrir **http://localhost:5173** et cliquer sur **"Discovery"**.

**Tu verras** :
- Barre de progression en temps réel
- dApps découvertes au fur et à mesure
- Quality scores avec étoiles ⭐
- Classifications (DEX, LENDING, NFT, etc.)

---

### 2️⃣ Script de test (pour voir les logs)

```bash
npm run test:discovery
```

**Tu verras** :
```
🔍 Démarrage de la découverte...

📊 Analyse de 100 000 blocs
✓ 31,242 événements récupérés
✓ Top 5000 contrats actifs trouvés

🔍 Recherche des deployers...
  🎉 Nouvelle dApp découverte (1/20): MonadSwap (DEX)
     ✓ DApp identifiée: MonadSwap (source: manual, confidence: 100%)
     📊 Classé comme DEX (confidence: 92%)
     ✓ Quality score: 8.5/10

✅ Découverte terminée !

🏆 Top dApps découvertes:
1. MonadSwap (DEX) - Score: 8.5/10 ⭐
2. MonadLend (LENDING) - Score: 7.3/10 ⭐
```

---

### 3️⃣ Fetch des protocoles officiels Monad

```bash
npm run fetch:protocols
```

Récupère automatiquement tous les protocoles depuis :
**https://github.com/monad-crypto/protocols**

---

## 📚 Documentation disponible

| Fichier | Description | Recommandé pour |
|---------|-------------|-----------------|
| **[START_HERE.md](START_HERE.md)** | Ce fichier - Guide de démarrage | **Commencer ici** |
| **[IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md)** | Vue d'ensemble complète | Voir ce qui a été fait |
| **[FINAL_IMPLEMENTATION.md](FINAL_IMPLEMENTATION.md)** | Détails techniques | Comprendre l'architecture |
| **[SYSTEM_READY.md](SYSTEM_READY.md)** | Guide complet d'utilisation | Utilisation avancée |
| **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** | Dépannage | Résoudre des problèmes |
| **[KNOWN_CONTRACTS.md](KNOWN_CONTRACTS.md)** | Gérer les contrats connus | Ajouter des contrats |

---

## ✅ Ce qui est déjà fait

### ✅ Découverte automatique
- Scan de 100 000 blocs
- Analyse de 5000 contrats actifs
- 20 dApps par scan

### ✅ Classification intelligente
- 11 catégories (DEX, LENDING, NFT, etc.)
- Support noms d'événements + signatures
- Score de confiance 0-100%

### ✅ Identification multi-sources
- 5 sources externes
- Base locale (known-contracts.json)
- Repo officiel Monad

### ✅ Quality Scoring
- Score 0-10 avec 4 sous-scores
- Filtrage automatique du spam

### ✅ Interface temps réel
- Server-Sent Events (SSE)
- Progression live
- Quality scores avec badges

### ✅ Tests automatisés
- 7 tests qui passent
- `npm run verify` pour tout vérifier

---

## 🎁 Commandes disponibles

```bash
# ⚡ Vérification rapide
npm run verify              # Vérifier que tout fonctionne (RECOMMANDÉ)

# 🔍 Discovery
npm run test:discovery      # Test avec logs détaillés
npm run fetch:protocols     # Récupérer protocoles officiels Monad

# 🚀 Développement
npm run dev                 # Démarrer le serveur
npm run typecheck           # Vérifier les types

# 💾 Base de données
npx prisma studio           # Interface web pour la DB
npx prisma migrate dev      # Créer une migration
```

---

## 🔥 Exemples de logs

### Quand tu lances un scan, tu vois :

```
🔍 Démarrage de la découverte...

📊 Analyse de 100 000 blocs
✓ 31,242 événements récupérés
✓ Top 5000 contrats actifs trouvés

🔍 Recherche des deployers...
  🎉 Nouvelle dApp découverte (1/20): MonadSwap (DEX)
     🔍 Identification de la dApp via sources externes...
     ✓ DApp identifiée: MonadSwap (source: manual, confidence: 100%)
     📊 Classé comme DEX (confidence: 92%)
     ✓ Quality score: 8.5/10

  🎉 Nouvelle dApp découverte (2/20): MonadLend (LENDING)
     🔍 Identification de la dApp via sources externes...
     ✓ DApp identifiée: MonadLend (source: manual, confidence: 100%)
     📊 Classé comme LENDING (confidence: 88%)
     ✓ Quality score: 7.3/10

  ...

✅ Découverte terminée !

🏆 Top dApps découvertes:
1. MonadSwap (DEX) - Score: 8.5/10 ⭐
2. MonadLend (LENDING) - Score: 7.3/10 ⭐
3. MonadNFT (NFT_MARKETPLACE) - Score: 6.9/10 ⭐
4. MonadBridge (BRIDGE) - Score: 6.5/10
5. WMON Token (TOKEN) - Score: 5.2/10
```

---

## 🎯 Premiers pas

### Étape 1 : Vérifier que tout fonctionne
```bash
npm run verify
```

### Étape 2 : Tester la découverte
```bash
npm run test:discovery
```

### Étape 3 : Lancer l'interface web
```bash
npm run dev
# Ouvrir http://localhost:5173
```

---

## ❓ Questions fréquentes

### Q : Comment ajouter des contrats connus ?

**Réponse** : Deux façons :

1. **Automatique** (recommandé) :
```bash
npm run fetch:protocols
```

2. **Manuel** :
Éditer [data/known-contracts.json](data/known-contracts.json) :
```json
{
  "0xADDRESS": {
    "name": "Nom de la dApp",
    "category": "DEX",
    "confidence": 1.0,
    "source": "manual"
  }
}
```

---

### Q : Comment changer le nombre de contrats scannés ?

**Réponse** : Éditer [app/services/discovery-scanner.service.ts:85-88](app/services/discovery-scanner.service.ts#L85-L88) :
```typescript
const discoveredContracts = await this.envioService.discoverContracts({
  maxBlocks: 100000,   // ← Changer ici
  maxContracts: 5000,  // ← Changer ici
  maxDApps: 20,        // ← Changer ici
});
```

---

### Q : Pourquoi je n'ai que des "UNKNOWN" ou "TOKEN" ?

**Réponse** : Normal si les contrats sont simples. Solutions :

1. Augmenter `maxContracts` à 10000
2. Ajouter plus de contrats connus avec `npm run fetch:protocols`
3. Vérifier que le testnet Monad a de l'activité

---

### Q : Les tests échouent ?

**Réponse** : Consulter [TROUBLESHOOTING.md](TROUBLESHOOTING.md) ou :

```bash
# Réinitialiser la DB
npx prisma migrate reset --force
npx prisma migrate dev --name init
npx prisma generate

# Relancer
npm run verify
```

---

## 🔗 Liens utiles

- **Documentation technique** : [DISCOVERY_SYSTEM.md](DISCOVERY_SYSTEM.md)
- **Guide complet** : [SYSTEM_READY.md](SYSTEM_READY.md)
- **Implémentation complète** : [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md)
- **Dépannage** : [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 🎉 C'est tout !

**Tu es prêt à lancer ton premier scan.**

```bash
npm run verify && npm run test:discovery
```

Ou directement :
```bash
npm run dev
# http://localhost:5173 → Discovery
```

---

**Questions ? Consulte [TROUBLESHOOTING.md](TROUBLESHOOTING.md)**

**Fait avec ❤️ pour Sherlock - Monad dApp Explorer**
