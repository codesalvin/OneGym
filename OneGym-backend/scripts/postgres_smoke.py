import os
import sys
from pathlib import Path
from unittest.mock import patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'onegym_backend.settings')

import django  # noqa: E402

django.setup()

from rest_framework.test import APIRequestFactory  # noqa: E402
from api import admin_views, views  # noqa: E402


factory = APIRequestFactory()
actor = {'id': 1, 'username': 'Migration Test', 'email': 'migration@example.test', 'role': 'admin'}
checks = [
    ('health', views.health_check, '/api/health/'),
    ('public-plans', admin_views.public_plans, '/api/plans/'),
    ('overview', admin_views.admin_overview, '/api/admin/overview/'),
    ('users', admin_views.admin_users, '/api/admin/users/'),
    ('trainer-applications', admin_views.admin_trainer_applications, '/api/admin/trainer-applications/'),
    ('classes', admin_views.admin_classes, '/api/admin/classes/'),
    ('training', admin_views.admin_training, '/api/admin/training/'),
    ('plans', admin_views.admin_plans, '/api/admin/plans/'),
    ('subscriptions', admin_views.admin_subscriptions, '/api/admin/subscriptions/'),
    ('payments', admin_views.admin_payments, '/api/admin/payments/'),
    ('notifications', admin_views.admin_notifications, '/api/admin/notifications/'),
    ('reviews', admin_views.admin_reviews, '/api/admin/reviews/'),
    ('audit-logs', admin_views.admin_audit_logs, '/api/admin/audit-logs/'),
]

results = []
with patch('api.admin_views.get_authenticated_user', return_value=actor):
    for name, view, path in checks:
        response = view(factory.get(path))
        results.append((name, response.status_code))

print(results)
failures = [(name, code) for name, code in results if code != 200]
if failures:
    raise SystemExit(f'PostgreSQL smoke failures: {failures}')
