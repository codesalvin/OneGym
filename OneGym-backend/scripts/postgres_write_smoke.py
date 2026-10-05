import os
import sys
from pathlib import Path
from unittest.mock import patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'onegym_backend.settings')

import django  # noqa: E402

django.setup()

from django.db import connection, transaction  # noqa: E402
from rest_framework.test import APIRequestFactory  # noqa: E402
from api import admin_views, views  # noqa: E402


factory = APIRequestFactory()
with connection.cursor() as cursor:
    cursor.execute("SELECT id,username,email,role FROM users WHERE role IN ('admin','owner') ORDER BY id LIMIT 1")
    row = cursor.fetchone()

if not row:
    raise SystemExit('An admin or owner is required for the PostgreSQL write smoke test.')

actor = {'id': row[0], 'username': row[1], 'email': row[2], 'role': row[3]}

with transaction.atomic():
    with patch('api.admin_views.get_authenticated_user', return_value=actor):
        plan_response = admin_views.admin_plans(factory.post(
            '/api/admin/plans/',
            {'code': 'migration-smoke', 'name': 'Migration Smoke', 'price_cents': 1234, 'currency': 'MYR'},
            format='json',
        ))
    signup_response = views.sign_up(factory.post(
        '/api/auth/signup/',
        {
            'username': 'migration_smoke_user',
            'email': 'migration-smoke@example.test',
            'password': 'Migration-Smoke-Password-2026!',
            'role': 'member',
        },
        format='json',
    ))
    results = {
        'create_plan': plan_response.status_code,
        'create_user': signup_response.status_code,
        'plan_id_generated': bool(plan_response.data.get('id')),
        'user_id_generated': bool(signup_response.data.get('user', {}).get('id')),
    }
    print(results)
    if results != {
        'create_plan': 201,
        'create_user': 201,
        'plan_id_generated': True,
        'user_id_generated': True,
    }:
        raise SystemExit('PostgreSQL write smoke test failed.')
    transaction.set_rollback(True)
