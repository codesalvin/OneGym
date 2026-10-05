import json

from django.db import connection, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .db_compat import get_last_insert_id
from .views import get_authenticated_user


ADMIN_ROLES = {'admin', 'owner'}
USER_ROLES = {'member', 'pro', 'studio', 'trainer', 'admin', 'owner'}


def require_admin(request):
    actor = get_authenticated_user(request)
    if not actor:
        return None, Response({'detail': 'Authentication is required.'}, status=status.HTTP_401_UNAUTHORIZED)
    actor['role'] = (actor.get('role') or '').lower()
    if actor['role'] not in ADMIN_ROLES:
        return None, Response({'detail': 'Administrator access is required.'}, status=status.HTTP_403_FORBIDDEN)
    return actor, None


def rows_as_dicts(cursor):
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def audit(cursor, actor_id, action, entity_type, entity_id=None, details=None):
    cursor.execute(
        '''
        INSERT INTO admin_audit_logs
            (actor_user_id, action, entity_type, entity_id, details_json, created_at)
        VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        ''',
        [actor_id, action, entity_type, entity_id, json.dumps(details or {})],
    )


@api_view(['GET'])
def admin_overview(request):
    actor, error = require_admin(request)
    if error:
        return error

    with connection.cursor() as cursor:
        cursor.execute('SELECT COUNT(*) FROM users WHERE is_active = TRUE')
        total_users = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM users WHERE LOWER(role) = 'trainer' AND is_active = TRUE")
        trainers = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM trainer_applications WHERE status = 'pending'")
        pending_trainers = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM classes WHERE COALESCE(status, 'scheduled') = 'scheduled' AND COALESCE(start_time, schedule_time) >= NOW()")
        upcoming_classes = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM user_subscriptions WHERE status IN ('active', 'trialing')")
        active_subscriptions = cursor.fetchone()[0]
        cursor.execute("SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE status IN ('paid', 'succeeded')")
        revenue_cents = cursor.fetchone()[0]
        cursor.execute('''
            SELECT l.id, l.action, l.entity_type, l.entity_id, l.created_at,
                   COALESCE(u.username, 'System') AS actor_name
            FROM admin_audit_logs l
            LEFT JOIN users u ON u.id = l.actor_user_id
            ORDER BY l.created_at DESC LIMIT 8
        ''')
        recent_activity = rows_as_dicts(cursor)

    return Response({
        'counts': {
            'users': total_users,
            'trainers': trainers,
            'pending_trainers': pending_trainers,
            'upcoming_classes': upcoming_classes,
            'active_subscriptions': active_subscriptions,
            'revenue_cents': revenue_cents,
        },
        'recent_activity': recent_activity,
        'administrator': actor,
    })


@api_view(['GET'])
def admin_users(request):
    actor, error = require_admin(request)
    if error:
        return error

    search = (request.query_params.get('search') or '').strip()
    role = (request.query_params.get('role') or '').strip().lower()
    params = []
    filters = []
    if search:
        filters.append('(u.username LIKE %s OR u.email LIKE %s)')
        params.extend([f'%{search}%', f'%{search}%'])
    if role in USER_ROLES:
        filters.append('LOWER(u.role) = %s')
        params.append(role)
    where = f"WHERE {' AND '.join(filters)}" if filters else ''

    with connection.cursor() as cursor:
        cursor.execute(f'''
            SELECT u.id, u.username, u.email, LOWER(u.role) AS role, u.is_active,
                   u.created_at, COALESCE(p.name, 'Free') AS plan_name,
                   COALESCE(s.status, 'free') AS subscription_status
            FROM users u
            LEFT JOIN user_subscriptions s ON s.id = (
                SELECT s2.id FROM user_subscriptions s2 WHERE s2.user_id = u.id
                ORDER BY s2.created_at DESC, s2.id DESC LIMIT 1
            )
            LEFT JOIN plans p ON p.id = s.plan_id
            {where}
            ORDER BY u.created_at DESC, u.id DESC
            LIMIT 250
        ''', params)
        users = rows_as_dicts(cursor)

    return Response(users)


@api_view(['PATCH'])
def admin_user_detail(request, user_id):
    actor, error = require_admin(request)
    if error:
        return error

    requested_role = request.data.get('role')
    requested_active = request.data.get('is_active')
    if requested_role is not None:
        requested_role = str(requested_role).lower()
        if requested_role not in USER_ROLES:
            return Response({'detail': 'Invalid user role.'}, status=status.HTTP_400_BAD_REQUEST)
        if requested_role == 'owner' and actor['role'] != 'owner':
            return Response({'detail': 'Only an owner can assign the owner role.'}, status=status.HTTP_403_FORBIDDEN)
    if actor['id'] == user_id and requested_active is False:
        return Response({'detail': 'You cannot deactivate your own account.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic(), connection.cursor() as cursor:
        cursor.execute('SELECT username, email, LOWER(role), is_active FROM users WHERE id=%s', [user_id])
        before = cursor.fetchone()
        if not before:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        updates, params = [], []
        if requested_role is not None:
            updates.extend(['role=%s', 'role_id=(SELECT id FROM roles WHERE name=%s LIMIT 1)'])
            params.extend([requested_role, requested_role])
        if requested_active is not None:
            updates.append('is_active=%s')
            params.append(bool(requested_active))
        if updates:
            params.append(user_id)
            cursor.execute(f"UPDATE users SET {', '.join(updates)} WHERE id=%s", params)
            audit(cursor, actor['id'], 'update_user', 'user', user_id, {
                'role': requested_role,
                'is_active': requested_active,
            })

    return Response({'detail': 'User updated.'})


@api_view(['GET'])
def admin_trainer_applications(request):
    actor, error = require_admin(request)
    if error:
        return error
    requested_status = (request.query_params.get('status') or '').strip()
    params = []
    where = ''
    if requested_status:
        where = 'WHERE a.status=%s'
        params.append(requested_status)
    with connection.cursor() as cursor:
        cursor.execute(f'''
            SELECT a.id, a.user_id, a.full_name, a.email, a.phone, a.specialties,
                   a.experience_years, a.certification_file_url, a.bio, a.status,
                   a.reviewed_at, a.created_at, reviewer.username AS reviewer_name
            FROM trainer_applications a
            LEFT JOIN users reviewer ON reviewer.id=a.reviewed_by
            {where}
            ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.created_at DESC
        ''', params)
        applications = rows_as_dicts(cursor)
    return Response(applications)


@api_view(['PATCH'])
def admin_trainer_application_detail(request, application_id):
    actor, error = require_admin(request)
    if error:
        return error
    decision = (request.data.get('status') or '').lower()
    if decision not in {'approved', 'rejected'}:
        return Response({'detail': 'Status must be approved or rejected.'}, status=status.HTTP_400_BAD_REQUEST)
    with transaction.atomic(), connection.cursor() as cursor:
        cursor.execute('SELECT user_id, email FROM trainer_applications WHERE id=%s', [application_id])
        application = cursor.fetchone()
        if not application:
            return Response({'detail': 'Trainer application not found.'}, status=status.HTTP_404_NOT_FOUND)
        cursor.execute('''
            UPDATE trainer_applications
            SET status=%s, reviewed_by=%s, reviewer_id=%s, reviewed_at=CURRENT_TIMESTAMP
            WHERE id=%s
        ''', [decision, actor['id'], actor['id'], application_id])
        if decision == 'approved':
            if application[0]:
                cursor.execute("UPDATE users SET role='trainer', role_id=(SELECT id FROM roles WHERE name='trainer') WHERE id=%s", [application[0]])
            else:
                cursor.execute("UPDATE users SET role='trainer', role_id=(SELECT id FROM roles WHERE name='trainer') WHERE email=%s", [application[1]])
        audit(cursor, actor['id'], f'{decision}_trainer_application', 'trainer_application', application_id)
    return Response({'detail': f'Trainer application {decision}.'})


@api_view(['GET', 'PATCH', 'DELETE'])
def admin_classes(request, class_id=None):
    actor, error = require_admin(request)
    if error:
        return error
    with transaction.atomic(), connection.cursor() as cursor:
        if request.method == 'GET':
            cursor.execute('''
                SELECT c.id, c.title, c.room, COALESCE(c.start_time,c.schedule_time) AS start_time,
                       COALESCE(c.duration_minutes,60) AS duration_minutes,
                       COALESCE(c.capacity,c.slots) AS capacity, COALESCE(c.status,'scheduled') AS status,
                       c.trainer_id, COALESCE(u.username,c.instructor_name) AS trainer_name,
                       COUNT(b.id) AS booking_count
                FROM classes c LEFT JOIN users u ON u.id=c.trainer_id
                LEFT JOIN class_bookings b ON b.class_id=c.id AND COALESCE(b.status,'booked')='booked'
                GROUP BY c.id,c.title,c.room,c.start_time,c.schedule_time,c.duration_minutes,c.capacity,c.slots,c.status,c.trainer_id,u.username,c.instructor_name
                ORDER BY start_time DESC LIMIT 250
            ''')
            return Response(rows_as_dicts(cursor))
        cursor.execute('SELECT id FROM classes WHERE id=%s', [class_id])
        if not cursor.fetchone():
            return Response({'detail': 'Class not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'DELETE':
            cursor.execute('DELETE FROM classes WHERE id=%s', [class_id])
            audit(cursor, actor['id'], 'delete_class', 'class', class_id)
            return Response(status=status.HTTP_204_NO_CONTENT)
        allowed = {'title', 'room', 'start_time', 'duration_minutes', 'capacity', 'status', 'trainer_id'}
        updates, params = [], []
        for field in allowed:
            if field in request.data:
                updates.append(f'{field}=%s')
                params.append(request.data[field] or None)
        if updates:
            params.append(class_id)
            cursor.execute(f"UPDATE classes SET {', '.join(updates)} WHERE id=%s", params)
            cursor.execute('UPDATE classes SET schedule_time=COALESCE(start_time,schedule_time), slots=COALESCE(capacity,slots) WHERE id=%s', [class_id])
            audit(cursor, actor['id'], 'update_class', 'class', class_id, request.data)
    return Response({'detail': 'Class updated.'})


@api_view(['GET'])
def public_plans(request):
    with connection.cursor() as cursor:
        cursor.execute('''
            SELECT id, code, name, price_cents, currency
            FROM plans
            WHERE is_active = TRUE
            ORDER BY price_cents, id
        ''')
        return Response(rows_as_dicts(cursor))


@api_view(['GET', 'POST'])
def admin_plans(request):
    actor, error = require_admin(request)
    if error:
        return error
    with transaction.atomic(), connection.cursor() as cursor:
        if request.method == 'GET':
            cursor.execute('''SELECT p.id,p.code,p.name,p.price_cents,p.currency,p.is_active,p.created_at,
                              COUNT(s.id) AS subscriber_count FROM plans p
                              LEFT JOIN user_subscriptions s ON s.plan_id=p.id AND s.status IN ('active','trialing')
                              GROUP BY p.id ORDER BY p.price_cents''')
            return Response(rows_as_dicts(cursor))
        code = (request.data.get('code') or '').strip().lower()
        name = (request.data.get('name') or '').strip()
        if not code or not name:
            return Response({'detail': 'Plan code and name are required.'}, status=status.HTTP_400_BAD_REQUEST)
        cursor.execute('''INSERT INTO plans(code,name,price_cents,currency,is_active,created_at)
                          VALUES(%s,%s,%s,%s,%s,CURRENT_TIMESTAMP)''', [code,name,int(request.data.get('price_cents') or 0),(request.data.get('currency') or 'MYR').upper(),True])
        plan_id = get_last_insert_id(cursor)
        audit(cursor, actor['id'], 'create_plan', 'plan', plan_id, request.data)
    return Response({'detail': 'Plan created.', 'id': plan_id}, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
def admin_plan_detail(request, plan_id):
    actor, error = require_admin(request)
    if error:
        return error
    allowed = {'name', 'price_cents', 'currency', 'is_active'}
    updates, params = [], []
    for field in allowed:
        if field in request.data:
            updates.append(f'{field}=%s')
            value = request.data[field]
            if field == 'currency': value = str(value).upper()
            params.append(value)
    with transaction.atomic(), connection.cursor() as cursor:
        if updates:
            params.append(plan_id)
            cursor.execute(f"UPDATE plans SET {', '.join(updates)} WHERE id=%s", params)
            if not cursor.rowcount:
                return Response({'detail': 'Plan not found.'}, status=status.HTTP_404_NOT_FOUND)
            audit(cursor, actor['id'], 'update_plan', 'plan', plan_id, request.data)
    return Response({'detail': 'Plan updated.'})


@api_view(['GET'])
def admin_subscriptions(request):
    actor, error = require_admin(request)
    if error: return error
    with connection.cursor() as cursor:
        cursor.execute('''SELECT s.id,s.user_id,u.username,u.email,s.plan_id,p.name AS plan_name,s.status,
                          s.current_period_start,s.current_period_end,s.canceled_at,s.created_at,s.updated_at
                          FROM user_subscriptions s JOIN users u ON u.id=s.user_id JOIN plans p ON p.id=s.plan_id
                          ORDER BY s.created_at DESC LIMIT 300''')
        return Response(rows_as_dicts(cursor))


@api_view(['GET'])
def admin_payments(request):
    actor, error = require_admin(request)
    if error: return error
    with connection.cursor() as cursor:
        cursor.execute('''SELECT p.id,p.user_id,u.username,u.email,p.subscription_id,p.stripe_payment_id,
                          p.amount_cents,p.currency,p.status,p.paid_at,p.created_at
                          FROM payments p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 300''')
        return Response(rows_as_dicts(cursor))


@api_view(['GET', 'POST'])
def admin_notifications(request):
    actor, error = require_admin(request)
    if error: return error
    with transaction.atomic(), connection.cursor() as cursor:
        if request.method == 'GET':
            cursor.execute('''SELECT n.id,n.user_id,u.username,n.notification_type,n.title,n.body,n.read_at,n.created_at
                              FROM notifications n JOIN users u ON u.id=n.user_id ORDER BY n.created_at DESC LIMIT 200''')
            return Response(rows_as_dicts(cursor))
        title = (request.data.get('title') or '').strip()
        body = (request.data.get('body') or '').strip()
        audience = (request.data.get('audience') or 'all').lower()
        if not title or not body:
            return Response({'detail': 'Title and message are required.'}, status=status.HTTP_400_BAD_REQUEST)
        if audience == 'all':
            cursor.execute("SELECT id FROM users WHERE is_active=TRUE")
        elif audience in USER_ROLES:
            cursor.execute('SELECT id FROM users WHERE is_active=TRUE AND LOWER(role)=%s', [audience])
        else:
            try: cursor.execute('SELECT id FROM users WHERE id=%s AND is_active=TRUE', [int(audience)])
            except ValueError: return Response({'detail': 'Invalid audience.'}, status=status.HTTP_400_BAD_REQUEST)
        recipients = [row[0] for row in cursor.fetchall()]
        cursor.executemany('''INSERT INTO notifications(user_id,notification_type,title,body,created_at)
                              VALUES(%s,'admin_announcement',%s,%s,CURRENT_TIMESTAMP)''', [(uid,title,body) for uid in recipients])
        audit(cursor, actor['id'], 'send_notification', 'notification', None, {'audience': audience, 'recipients': len(recipients), 'title': title})
    return Response({'detail': f'Notification sent to {len(recipients)} users.'}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def admin_reviews(request):
    actor, error = require_admin(request)
    if error: return error
    with connection.cursor() as cursor:
        cursor.execute('''SELECT 'class' AS review_type,r.id,c.title AS subject,u.username AS reviewer,
                          r.rating,r.comment,r.created_at FROM class_reviews r
                          JOIN classes c ON c.id=r.class_id JOIN users u ON u.id=r.reviewer_id
                          UNION ALL
                          SELECT 'trainer',r.id,t.username,u.username,r.rating,r.comment,r.created_at
                          FROM trainer_reviews r JOIN users t ON t.id=r.trainer_id JOIN users u ON u.id=r.reviewer_id
                          ORDER BY created_at DESC LIMIT 250''')
        return Response(rows_as_dicts(cursor))


@api_view(['DELETE'])
def admin_review_detail(request, review_type, review_id):
    actor, error = require_admin(request)
    if error: return error
    table = {'class': 'class_reviews', 'trainer': 'trainer_reviews'}.get(review_type)
    if not table: return Response({'detail': 'Invalid review type.'}, status=status.HTTP_400_BAD_REQUEST)
    with transaction.atomic(), connection.cursor() as cursor:
        cursor.execute(f'DELETE FROM {table} WHERE id=%s', [review_id])
        if not cursor.rowcount: return Response({'detail': 'Review not found.'}, status=status.HTTP_404_NOT_FOUND)
        audit(cursor, actor['id'], 'delete_review', review_type + '_review', review_id)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
def admin_training(request):
    actor, error = require_admin(request)
    if error: return error
    with connection.cursor() as cursor:
        cursor.execute('''SELECT p.id,p.title,p.status,p.start_date,p.end_date,p.created_at,
                          t.username AS trainer_name,c.username AS client_name,
                          COUNT(e.id) AS exercise_count FROM training_programs p
                          JOIN users t ON t.id=p.trainer_id JOIN users c ON c.id=p.client_id
                          LEFT JOIN program_exercises e ON e.program_id=p.id
                          GROUP BY p.id,t.username,c.username
                          ORDER BY p.created_at DESC LIMIT 200''')
        programs = rows_as_dicts(cursor)
        cursor.execute('''SELECT s.id,s.scheduled_at,s.duration_minutes,s.status,s.notes,
                          t.username AS trainer_name,c.username AS client_name,p.title AS program_title
                          FROM training_sessions s JOIN users t ON t.id=s.trainer_id JOIN users c ON c.id=s.client_id
                          LEFT JOIN training_programs p ON p.id=s.program_id ORDER BY s.scheduled_at DESC LIMIT 200''')
        sessions = rows_as_dicts(cursor)
    return Response({'programs': programs, 'sessions': sessions})


@api_view(['GET'])
def admin_audit_logs(request):
    actor, error = require_admin(request)
    if error: return error
    with connection.cursor() as cursor:
        cursor.execute('''SELECT l.id,l.action,l.entity_type,l.entity_id,l.details_json,l.created_at,
                          COALESCE(u.username,'System') AS actor_name FROM admin_audit_logs l
                          LEFT JOIN users u ON u.id=l.actor_user_id ORDER BY l.created_at DESC LIMIT 300''')
        return Response(rows_as_dicts(cursor))
