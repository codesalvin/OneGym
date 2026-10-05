$ErrorActionPreference = 'Stop'

wsl.exe -d Ubuntu -u root -- pg_ctlcluster 18 main start
if ($LASTEXITCODE -ne 0) {
    throw 'PostgreSQL could not be started in WSL.'
}

wsl.exe -d Ubuntu -- bash -lc 'cd /mnt/c/Users/Qen/Desktop/Things/OneGym/OneGym-backend && exec ~/.venvs/onegym/bin/python manage.py runserver 0.0.0.0:8000 --noreload'
