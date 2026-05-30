# OneGym Backend

Django API backend for OneGym.

## Setup

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver
```

## MySQL

Create a `.env` file or set these environment variables before running migrations:

```powershell
$env:MYSQL_DATABASE="onegym"
$env:MYSQL_USER="root"
$env:MYSQL_PASSWORD="your_password"
$env:MYSQL_HOST="127.0.0.1"
$env:MYSQL_PORT="3306"
```

Make sure the MySQL database exists before running `migrate`.

## Endpoints

- `GET /api/health/` returns a simple API health response.

The backend allows CORS requests from the Vite frontend at `http://localhost:5173` and `http://127.0.0.1:5173`.
