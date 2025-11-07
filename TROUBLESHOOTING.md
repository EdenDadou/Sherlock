# Dépannage - Système de découverte

## Problèmes courants et solutions

---

### ❌ Erreur : "The table `main.contracts` does not exist"

**Cause** : Les migrations Prisma n'ont pas été appliquées.

**Solution** :
```bash
npx prisma migrate dev --name init
```

Si cela ne fonctionne pas, réinitialiser complètement :
```bash
rm prisma/dev.db
npx prisma migrate dev --name init
npx prisma generate
```

---

### ❌ Erreur : "invalid JSON: unknown variant `blockNumber`"

**Cause** : Mauvais nom de champ pour l'API Envio HyperSync.

**Solution** : ✅ Déjà corrigé dans [app/services/envio.service.ts:430](app/services/envio.service.ts#L430)

Les champs corrects sont :
- `block_number` (pas `blockNumber`)
- `transaction_hash` (pas `transactionHash`)
- `log_index` (pas `logIndex`)

---

### ❌ Erreur : "HyperSync timeout" ou "Request timeout"

**Cause** : Trop de blocs à scanner en une seule requête.

**Solution** : Réduire `maxBlocks` dans [app/services/discovery-scanner.service.ts:67](app/services/discovery-scanner.service.ts#L67)

```typescript
const discoveredContracts = await this.envioService.discoverContracts({
  maxBlocks: 10000, // ← Réduire à 10 000 au lieu de 100 000
  maxContracts: 500,
  maxDApps: 10,
});
```

---

### ⚠️ Warning : "Creator non trouvé pour 0x..."

**Cause** : Le contrat a été déployé en dehors de la plage de blocs scannée, ou les transactions de création ne sont pas disponibles via HyperSync.

**Impact** : Faible - Le système utilise l'adresse du contrat comme fallback pour le grouping.

**Solution** : Normal, pas besoin d'action. C'est un comportement attendu.

Si vous voulez trouver les vrais deployers :
1. Augmenter `maxBlocks` pour scanner plus loin dans le passé
2. Ou utiliser un RPC call pour récupérer le deployer via `eth_getTransactionReceipt`

---

### ❌ Erreur : "No contracts found"

**Cause** : Aucun contrat actif dans la plage de blocs scannée.

**Solutions** :

1. **Vérifier la configuration Envio** :
```bash
# Dans .env
ENVIO_HYPERSYNC_URL="https://monad-testnet.hypersync.xyz"
```

2. **Augmenter la plage de scan** :
```typescript
maxBlocks: 200000, // Scanner plus de blocs
```

3. **Vérifier que le testnet est actif** :
```bash
curl https://monad-testnet.hypersync.xyz/health
```

---

### 🐌 Performance : Scan très lent

**Causes possibles** :
1. Trop de blocs à scanner
2. Trop de contrats à analyser
3. Rate limiting sur les APIs externes (CoinGecko)

**Solutions** :

1. **Optimiser les paramètres de scan** :
```typescript
const discoveredContracts = await this.envioService.discoverContracts({
  maxBlocks: 10000,   // ← Réduire
  maxContracts: 100,  // ← Réduire
  maxDApps: 5,        // ← Réduire
});
```

2. **Désactiver temporairement l'enrichissement externe** :
```typescript
// Dans discovery-scanner.service.ts
// Commenter ces lignes :
// await this.metadataEnrichmentService.enrichDApp(dapp.id);
// await this.metadataEnrichmentService.enrichContract(contract.address);
```

3. **Utiliser un cache Redis** (future amélioration) :
```typescript
// TODO: Implémenter un cache pour les métadonnées
```

---

### ❌ Erreur : "CoinGecko API rate limit exceeded"

**Cause** : Trop de requêtes à l'API CoinGecko (limite gratuite : 50/minute).

**Solutions** :

1. **Attendre 1 minute** avant de relancer le scan

2. **Désactiver CoinGecko temporairement** :
```typescript
// Dans metadata-enrichment.service.ts
private async tryCoinGeckoLogo(symbol: string): Promise<string | undefined> {
  return undefined; // ← Désactiver temporairement
}
```

3. **Obtenir une clé API CoinGecko Pro** (optionnel) :
https://www.coingecko.com/en/api/pricing

---

### ❌ Erreur : "Database locked"

**Cause** : Plusieurs processus tentent d'accéder à la DB SQLite en même temps.

**Solution** :

1. **Arrêter tous les serveurs** :
```bash
# Ctrl+C dans tous les terminaux
pkill -f "npm run dev"
```

2. **Relancer** :
```bash
npm run dev
```

3. **Migration vers PostgreSQL** (pour la production) :
```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql" // ← au lieu de "sqlite"
  url      = env("DATABASE_URL")
}
```

---

### ⚠️ Warning : "⊘ Contrat ignoré : token simple, pas une dApp"

**Cause** : Le contrat est détecté comme un simple token ERC20 sans dApp associée.

**Impact** : Normal - Le système filtre intelligemment les tokens simples.

**Solution** : Pas d'action nécessaire. C'est le comportement attendu.

Si vous voulez garder tous les tokens :
```typescript
// Dans contract-detector.service.ts:181
private async isLikelyDApp(contract: any, holderCount: number): Promise<boolean> {
  return true; // ← Toujours accepter
}
```

---

### ❌ Erreur : "Prisma Client could not locate the binary"

**Cause** : Prisma Client pas généré ou plateforme incompatible.

**Solution** :
```bash
npx prisma generate
```

Si le problème persiste :
```bash
rm -rf node_modules
rm package-lock.json
npm install
npx prisma generate
```

---

### 🔍 Debug : Voir les logs détaillés

Pour activer les logs détaillés d'Envio HyperSync :

```typescript
// Dans envio.service.ts
this.client.interceptors.request.use((config) => {
  console.log('📤 Request:', {
    url: config.url,
    data: config.data,
  });
  return config;
});
```

Pour voir les logs Prisma :
```bash
DEBUG="prisma:*" npm run dev
```

---

### ❌ Erreur : "Cannot find module 'viem'"

**Cause** : Dépendances manquantes.

**Solution** :
```bash
npm install
```

Ou forcer la réinstallation :
```bash
rm -rf node_modules
rm package-lock.json
npm install
```

---

### ⚠️ Performance : Quality Score toujours à 0

**Cause** : Pas assez d'activité enregistrée dans la table `Activity`.

**Explication** : Le quality score est calculé à partir des données d'activité historiques. Si la dApp vient juste d'être découverte, il n'y a pas encore d'historique.

**Solution** :

1. **Attendre** que le système collecte plus de données (via cron job)

2. **Simuler des données** (développement seulement) :
```typescript
await prisma.activity.create({
  data: {
    dappId: dapp.id,
    date: new Date(),
    txCount: 1000,
    userCount: 100,
    eventCount: 5000,
    gasUsed: 1000000n,
  },
});
```

3. **Implémenter un tracker d'activité** :
```typescript
// TODO: Créer un service qui track l'activité en temps réel
```

---

### 🔧 Outils de diagnostic

#### 1. Vérifier la santé de HyperSync
```bash
curl https://monad-testnet.hypersync.xyz/health
```

#### 2. Vérifier la base de données
```bash
npx prisma studio
# Ouvre une interface web sur http://localhost:5555
```

#### 3. Tester un contrat spécifique
```typescript
// scripts/test-contract.ts
import { EnvioService } from '../app/services/envio.service';

const service = new EnvioService({
  hyperSyncUrl: 'https://monad-testnet.hypersync.xyz',
  chainId: 'monad-testnet',
});

const logs = await service.getContractLogs(
  '0x4f6500c07a8a483a0aabb1bc0d5b2b44abc2f3f3',
  47885813,
  47985813
);

console.log(`${logs.length} logs trouvés`);
```

#### 4. Vérifier les migrations Prisma
```bash
npx prisma migrate status
```

---

### 📞 Support

Si aucune de ces solutions ne fonctionne :

1. **Vérifier les logs** dans la console
2. **Ouvrir une issue** avec :
   - Message d'erreur complet
   - Version de Node.js (`node --version`)
   - Système d'exploitation
   - Fichier `.env` (sans les clés API)

3. **Consulter la documentation** :
   - [DISCOVERY_SYSTEM.md](./DISCOVERY_SYSTEM.md)
   - [QUICK_START.md](./QUICK_START.md)
   - [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

---

**Fait avec ❤️ pour Sherlock**
