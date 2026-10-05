import json
import os
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'onegym_backend.settings')

import django  # noqa: E402

django.setup()

from django.db import connection  # noqa: E402


with connection.cursor() as cursor:
    tables = sorted(connection.introspection.table_names(cursor))
    counts = {}
    for table in tables:
        cursor.execute(f'SELECT COUNT(*) FROM {connection.ops.quote_name(table)}')
        counts[table] = cursor.fetchone()[0]

print(json.dumps({'vendor': connection.vendor, 'tables': counts}, sort_keys=True))
