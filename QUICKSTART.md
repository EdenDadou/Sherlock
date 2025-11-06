# Guide de Démarrage Rapide

## 🚀 Démarrage en 3 étapes

### 1. Configuration de l'API BlockVision

Avant de commencer, vous avez besoin d'une clé API BlockVision :

1. Visitez [BlockVision](https://blockvision.org)
2. Créez un compte
3. Obtenez votre clé API

Ensuite, créez votre fichier `.env` :

```bash
cp .env.example .env
```

Éditez le fichier `.env` et ajoutez votre clé API :

```env
BLOCKVISION_API_KEY="votre_cle_api_ici"
BLOCKVISION_BASE_URL="https://api.blockvision.org/v1"
MONAD_CHAIN_ID="monad-testnet"
```

### 2. La base de données est déjà prête !

Avec SQLite, rien à installer ! La base de données a déjà été créée lors de l'installation :

```bash
# Vérifier que la base de données existe
ls -l prisma/dev.db
```

Si elle n'existe pas, créez-la :

```bash
npx prisma db push
```

### 3. Lancer l'application

```bash
yarn dev
```

Ouvrez votre navigateur sur [http://localhost:5173](http://localhost:5173)

---

## 📊 Visualiser les données

Pour voir les données dans la base de données :

```bash
npx prisma studio
```

Cela ouvrira une interface web sur [http://localhost:5555](http://localhost:5555)

---

## 🔄 Tester le scanner

### Option 1 : Via l'interface (bientôt disponible)
Naviguez vers `/admin/cron` pour lancer manuellement les scans.

### Option 2 : Via curl

```bash
# Scanner les nouveaux blocs
curl -X POST http://localhost:5173/api/admin/cron \
  -d "action=scan-blocks"

# Classifier les contrats
curl -X POST http://localhost:5173/api/admin/cron \
  -d "action=classify-contracts"

# Mettre à jour l'activité
curl -X POST http://localhost:5173/api/admin/cron \
  -d "action=update-activity"
```

---

## 🎯 Points d'entrée de l'application

Une fois l'application lancée :

- **Dashboard** : [http://localhost:5173/dashboard](http://localhost:5173/dashboard)
  - Vue d'ensemble avec statistiques
  - dApps trending
  - Nouvelles dApps découvertes

- **Liste des dApps** : [http://localhost:5173/dapps](http://localhost:5173/dapps)
  - Filtres par catégorie et statut
  - Recherche par nom/adresse
  - Pagination

- **API Stats** : [http://localhost:5173/api/stats](http://localhost:5173/api/stats)
  - Endpoint JSON avec les stats globales

---

## ⚙️ Configuration des Cron Jobs

Les cron jobs sont activés par défaut. Pour les désactiver temporairement :

Dans votre `.env` :

```env
ENABLE_BLOCK_SCANNER="false"    # Désactive le scanner de blocs
ENABLE_ACTIVITY_TRACKER="false"  # Désactive le tracker d'activité
```

Les schedules par défaut :
- 🔍 Scanner de blocs : **toutes les 2 minutes**
- 🏷️ Classifier : **toutes les 5 minutes**
- 📊 Tracker d'activité : **toutes les 10 minutes**
- 🧹 Nettoyage : **quotidien à minuit**

---

## 🐛 Dépannage

### La base de données n'existe pas
```bash
npx prisma db push
```

### Le client Prisma n'est pas généré
```bash
npx prisma generate
```

### Les cron jobs ne fonctionnent pas
Vérifiez les logs dans la console. Assurez-vous que votre clé API BlockVision est valide.

### Port 5173 déjà utilisé
Changez le port dans `vite.config.ts` ou arrêtez l'application qui utilise ce port.

---

## 📝 Prochaines étapes

1. **Tester le scanner** : Lancez un scan manuel pour détecter des contrats
2. **Explorer les dApps** : Naviguez dans l'interface pour voir les dApps découvertes
3. **Personnaliser** : Ajoutez vos propres catégories ou modifiez la classification

Bon développement ! 🎉
