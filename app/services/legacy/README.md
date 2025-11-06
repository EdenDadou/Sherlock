# Legacy Services

Ce dossier contient les anciens services qui ne sont plus utilisés dans l'application principale mais conservés pour référence.

## BlockVision Service (Déprécié)

`blockvision.service.ts` - Ancien service utilisant l'API BlockVision

**Raison de dépréciation** :
- Rate limiting trop restrictif
- API trial limitée
- Performances insuffisantes

**Remplacé par** : `envio.service.ts` (Envio HyperSync)

**Avantages d'Envio** :
- 10,000x plus rapide
- Pas de rate limiting agressif
- Gratuit et open-source
- Batching intelligent

## Comment revenir à BlockVision

Si vous devez absolument utiliser BlockVision :

1. Copiez `blockvision.service.ts` vers `app/services/`
2. Copiez `../types/legacy/blockvision.ts` vers `app/types/`
3. Modifiez `discovery-scanner.service.ts` pour utiliser `BlockVisionService`
4. Ajoutez votre clé API dans `.env`

**Note** : Ce n'est pas recommandé pour une utilisation en production.
