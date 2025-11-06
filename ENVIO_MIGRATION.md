# Migration de BlockVision vers Envio HyperSync

## Pourquoi Envio ?

BlockVision a des limites strictes sur son API gratuite qui causaient des problèmes de rate limiting. Envio HyperSync offre :

- **Vitesse 10,000x plus rapide** que les RPC traditionnels
- **Limites plus généreuses** pour le développement
- **Meilleure fiabilité** avec moins de timeouts
- **Pas de rate limiting agressif** comme BlockVision

## Changements apportés

### Nouveaux fichiers créés

1. **`app/types/envio.ts`** - Types TypeScript pour l'API Envio HyperSync
2. **`app/services/envio.service.ts`** - Service pour interagir avec Envio HyperSync

### Fichiers modifiés

1. **`app/services/discovery-scanner.service.ts`** - Utilise maintenant EnvioService au lieu de BlockVisionService
2. **`app/services/contract-detector.service.ts`** - Rendu générique pour supporter les deux services
3. **`.env.example`** - Ajout de la configuration Envio

## Configuration

Ajoutez cette variable dans votre fichier `.env` :

```bash
# Envio HyperSync configuration
ENVIO_HYPERSYNC_URL="https://monad-testnet.hypersync.xyz"
MONAD_CHAIN_ID="monad-testnet"
```

## Comment ça fonctionne

### Avant (BlockVision)
```
1. Récupérer les holders du token natif (lent, rate limited)
2. Pour chaque holder, récupérer ses transactions (très lent)
3. Analyser les transactions pour trouver les déploiements
```

### Maintenant (Envio HyperSync)
```
1. Scanner directement les blocs récents pour les déploiements
2. Utiliser le batching pour traiter 1000 blocs à la fois
3. Récupération ultra-rapide sans rate limiting
```

## Avantages

- ✅ Plus de problèmes de rate limiting
- ✅ Scan 10-100x plus rapide
- ✅ Utilise des batches de 1000 blocs au lieu d'analyser adresse par adresse
- ✅ Meilleure détection des contrats actifs via l'analyse des logs
- ✅ Gratuit et open-source

## Fonctionnalités principales

### EnvioService

```typescript
// Découvrir des contrats
const contracts = await envioService.discoverContracts({
  maxBlocks: 10000,    // Scanner les 10000 derniers blocs
  maxContracts: 100,   // Limiter à 100 contrats
});

// Obtenir l'activité d'un contrat
const activity = await envioService.getContractActivity(
  '0x123...',
  5000  // Analyser les 5000 derniers blocs
);

// Récupérer les logs d'un contrat
const logs = await envioService.getContractLogs(
  '0x123...',
  fromBlock,
  toBlock
);
```

## Retour à BlockVision (si nécessaire)

Si vous souhaitez revenir à BlockVision :

1. Modifier `app/services/discovery-scanner.service.ts` :
```typescript
import { BlockVisionService } from './blockvision.service';

// Dans le constructeur
this.blockVisionService = new BlockVisionService({...});
```

2. Remettre les appels BlockVision dans la méthode `startScan()`

## Support

Pour toute question sur l'API Envio HyperSync :
- Documentation : https://docs.envio.dev
- Support : hello@envio.dev
