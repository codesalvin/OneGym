# PostgreSQL development setup

The active local database is PostgreSQL 18 in WSL Ubuntu. Django reads its
connection settings from `.env`. The previous MySQL settings remain in that
file so `DATABASE_ENGINE=mysql` can be used for rollback.

Start the API from PowerShell:

```powershell
.\scripts\start_postgres_backend.ps1
```

The API is available at `http://127.0.0.1:8000`. Start the React application
from the `OneGym` frontend directory with `npm run dev`.

For another PostgreSQL server or Supabase, copy the variable names from
`postgres.env.example`, replace the connection values, and use
`POSTGRES_SSLMODE=require` for a hosted database.

`scripts/postgres_finalize.sql` restores timestamp defaults and update
triggers after a pgloader import. It is safe to run again.

Validation commands:

```bash
python manage.py check
python scripts/compare_database_counts.py
python scripts/postgres_smoke.py
python scripts/postgres_write_smoke.py
```

The write smoke test uses a transaction and rolls back its temporary records.
