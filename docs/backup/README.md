# Database backups

Supabase's free plan does not include automatic backups, so the store backs itself up
with a nightly GitHub Actions job.

## Why it lives in a separate private repository

- Backups hold customer names, phone numbers, addresses and orders. This store repository
  is public, so backups must never be committed here.
- GitHub switches off scheduled workflows in public repositories after 60 days without
  activity. A private repository does not have that problem.

## Set up (once, after the Supabase project exists)

1. Create a new **private** GitHub repository, for example `rorisang-lu-backups`.
   It should belong to the business owner, with the developer added as a collaborator.
2. Copy `docs/backup/backup.yml` into it as `.github/workflows/backup.yml`.
3. In Supabase, open Project Settings, then Database, and copy the **Session pooler**
   connection string. Put the real database password in it.
4. In the private repository open Settings, then Secrets and variables, then Actions, and
   add a secret named `SUPABASE_DB_URL` with that connection string.
5. Open the Actions tab, choose "Nightly database backup" and press "Run workflow".
   Check that a file appears in `backups/`.
6. Set a reminder to check the backups folder once a month.

## What is covered

- The `public` schema of the database: products, orders, customers and stock.
- The latest 30 nightly files are kept.

## What is not covered

- Product photos kept in Supabase Storage. They are separate from the database. Keep the
  original photos on the owner's phone or drive, or add a storage export step later.
- Authentication users (the `auth` schema). Add it to the dump if customer accounts are used
  and need to be restorable.

## Restoring

```bash
gunzip -c backups/db-YYYY-MM-DD.sql.gz | psql "$SUPABASE_DB_URL"
```

Restore into an empty or new Supabase project, and test the restore once before launch.
