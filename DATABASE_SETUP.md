# Configuration de la Base de Données

Vous avez plusieurs options pour configurer votre base de données PostgreSQL.

## Option 1 : Prisma Postgres (Local - Déjà configuré)

Si vous souhaitez utiliser le serveur Prisma Postgres local qui est déjà configuré :

```bash
# Démarrer le serveur Prisma Postgres
npx prisma dev
```

Cela démarrera un serveur PostgreSQL local et vous pourrez ensuite exécuter :

```bash
npx prisma db push
```

## Option 2 : PostgreSQL Local

Si vous avez PostgreSQL installé localement :

### Sur macOS avec Homebrew :
```bash
# Installer PostgreSQL
brew install postgresql@15

# Démarrer PostgreSQL
brew services start postgresql@15

# Créer la base de données
createdb sherlock_db

# Créer un utilisateur (optionnel)
psql -d sherlock_db -c "CREATE USER sherlock WITH PASSWORD 'sherlock';"
psql -d sherlock_db -c "GRANT ALL PRIVILEGES ON DATABASE sherlock_db TO sherlock;"
```

Ensuite, modifiez `.env` :
```env
DATABASE_URL="postgresql://sherlock:sherlock@localhost:5432/sherlock_db?schema=public"
```

### Sur Windows :
1. Télécharger PostgreSQL depuis https://www.postgresql.org/download/windows/
2. Installer et configurer
3. Utiliser pgAdmin pour créer une base de données `sherlock_db`
4. Mettre à jour le `DATABASE_URL` dans `.env`

## Option 3 : Base de données Cloud (Recommandé pour débutants)

### Supabase (Gratuit)
1. Aller sur https://supabase.com
2. Créer un compte et un nouveau projet
3. Récupérer la "Connection string" dans Settings > Database
4. Remplacer dans `.env` :
```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

### Neon (Gratuit)
1. Aller sur https://neon.tech
2. Créer un compte et un nouveau projet
3. Copier la connection string
4. Mettre à jour `.env`

### Railway (Gratuit pour commencer)
1. Aller sur https://railway.app
2. Créer un projet PostgreSQL
3. Copier la connection string
4. Mettre à jour `.env`

## Après avoir configuré la base de données

Une fois que vous avez choisi et configuré votre option :

```bash
# Générer le client Prisma
npx prisma generate

# Créer les tables
npx prisma db push

# (Optionnel) Visualiser votre base de données
npx prisma studio
```

## Vérifier la connexion

Pour tester si votre base de données est accessible :

```bash
npx prisma db execute --stdin <<EOF
SELECT 1;
EOF
```

Si vous voyez un résultat sans erreur, votre base de données est correctement configurée !
