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
    cursor.execute('''
        SELECT table_name, column_name, column_default, extra, is_nullable
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND (
            column_default LIKE 'CURRENT_TIMESTAMP%%'
            OR extra LIKE '%%on update CURRENT_TIMESTAMP%%'
          )
        ORDER BY table_name, ordinal_position
    ''')
    rows = cursor.fetchall()

print(json.dumps([
    {
        'table': row[0],
        'column': row[1],
        'default': row[2],
        'extra': row[3],
        'nullable': row[4],
    }
    for row in rows
], default=str))
