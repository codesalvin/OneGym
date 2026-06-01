from django.db import connection
from django.db import transaction
from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
import requests as http_requests
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from datetime import timedelta
import secrets

from .models import PasswordResetCode
from .serializers import (
    ClassBookingSerializer,
    FitnessClassSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    SignInSerializer,
    SignUpSerializer,
    SocialAuthSerializer,
    UserSerializer,
    WorkoutCreateSerializer,
)


@api_view(['GET'])
def health_check(_request):
    return Response({
        'status': 'ok',
        'service': 'OneGym API',
    })


@api_view(['GET'])
def user_list(_request):
    with connection.cursor() as cursor:
        cursor.execute('SELECT id, username, email, role FROM users ORDER BY id')
        users = [
            {
                'id': user_id,
                'username': username,
                'email': email,
                'role': role,
            }
            for user_id, username, email, role in cursor.fetchall()
        ]

    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def class_list(_request):
    with connection.cursor() as cursor:
        cursor.execute(
            '''
            SELECT
                c.id,
                c.title,
                c.instructor_name,
                c.room,
                c.schedule_time,
                c.slots,
                COUNT(cb.id) AS booked_slots
            FROM classes c
            LEFT JOIN class_bookings cb ON cb.class_id = c.id
            GROUP BY c.id, c.title, c.instructor_name, c.room, c.schedule_time, c.slots
            ORDER BY c.schedule_time
            '''
        )
        classes = [
            {
                'id': class_id,
                'title': title,
                'instructor_name': instructor_name,
                'room': room,
                'schedule_time': schedule_time,
                'slots': slots,
                'booked_slots': booked_slots,
                'available_slots': max(slots - booked_slots, 0),
            }
            for class_id, title, instructor_name, room, schedule_time, slots, booked_slots in cursor.fetchall()
        ]

    serializer = FitnessClassSerializer(classes, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def book_class(request, class_id):
    user_id = request.data.get('user_id')
    if not user_id:
        return Response(
            {'detail': 'User id is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with connection.cursor() as cursor:
        cursor.execute('SELECT slots FROM classes WHERE id = %s LIMIT 1', [class_id])
        class_row = cursor.fetchone()
        if not class_row:
            return Response({'detail': 'Class not found.'}, status=status.HTTP_404_NOT_FOUND)

        slots = class_row[0]
        cursor.execute('SELECT COUNT(*) FROM class_bookings WHERE class_id = %s', [class_id])
        booked_slots = cursor.fetchone()[0]
        if booked_slots >= slots:
            return Response({'detail': 'This class is full.'}, status=status.HTTP_400_BAD_REQUEST)

        cursor.execute(
            'SELECT id FROM class_bookings WHERE user_id = %s AND class_id = %s LIMIT 1',
            [user_id, class_id],
        )
        if cursor.fetchone():
            return Response({'detail': 'You already booked this class.'}, status=status.HTTP_400_BAD_REQUEST)

        cursor.execute(
            'INSERT INTO class_bookings (user_id, class_id, booked_at) VALUES (%s, %s, NOW(6))',
            [user_id, class_id],
        )

    return Response({'detail': 'Class booked successfully.'}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def user_bookings(_request, user_id):
    with connection.cursor() as cursor:
        cursor.execute('SELECT id FROM users WHERE id = %s LIMIT 1', [user_id])
        if not cursor.fetchone():
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        cursor.execute(
            '''
            SELECT
                cb.id,
                c.id AS class_id,
                c.title,
                c.instructor_name,
                c.room,
                c.schedule_time,
                c.slots,
                (
                    SELECT COUNT(*)
                    FROM class_bookings booked
                    WHERE booked.class_id = c.id
                ) AS booked_slots,
                cb.booked_at
            FROM class_bookings cb
            INNER JOIN classes c ON c.id = cb.class_id
            WHERE cb.user_id = %s
            ORDER BY c.schedule_time
            ''',
            [user_id],
        )
        bookings = [
            {
                'id': booking_id,
                'class_id': class_id,
                'title': title,
                'instructor_name': instructor_name,
                'room': room,
                'schedule_time': schedule_time,
                'slots': slots,
                'booked_slots': booked_slots,
                'available_slots': max(slots - booked_slots, 0),
                'booked_at': booked_at,
            }
            for (
                booking_id,
                class_id,
                title,
                instructor_name,
                room,
                schedule_time,
                slots,
                booked_slots,
                booked_at,
            ) in cursor.fetchall()
        ]

    serializer = ClassBookingSerializer(bookings, many=True)
    return Response(serializer.data)


@api_view(['DELETE'])
def cancel_booking(request, booking_id):
    user_id = request.data.get('user_id') or request.query_params.get('user_id')
    if not user_id:
        return Response(
            {'detail': 'User id is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT id FROM class_bookings WHERE id = %s AND user_id = %s LIMIT 1',
            [booking_id, user_id],
        )
        if not cursor.fetchone():
            return Response({'detail': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        cursor.execute(
            'DELETE FROM class_bookings WHERE id = %s AND user_id = %s',
            [booking_id, user_id],
        )

    return Response({'detail': 'Booking cancelled.'})


@api_view(['POST'])
def create_workout(request):
    serializer = WorkoutCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    with connection.cursor() as cursor:
        cursor.execute('SELECT id FROM users WHERE id = %s LIMIT 1', [data['user_id']])
        if not cursor.fetchone():
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    workout_date = data.get('workout_date') or timezone.now()
    notes = data.get('notes') or None

    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute(
                '''
                INSERT INTO workouts
                    (user_id, name, duration_minutes, intensity, calories_burned, workout_date, notes, created_at)
                VALUES
                    (%s, %s, %s, %s, %s, %s, %s, NOW(6))
                ''',
                [
                    data['user_id'],
                    data['name'],
                    data['duration_minutes'],
                    data['intensity'],
                    data['calories_burned'],
                    workout_date,
                    notes,
                ],
            )
            workout_id = cursor.lastrowid

            for exercise in data['exercises']:
                cursor.execute(
                    '''
                    INSERT INTO workout_exercises
                        (workout_id, exercise_name, sets, reps, weight, created_at)
                    VALUES
                        (%s, %s, %s, %s, %s, NOW(6))
                    ''',
                    [
                        workout_id,
                        exercise['exercise_name'],
                        exercise['sets'],
                        exercise['reps'],
                        exercise['weight'],
                    ],
                )

    return Response(
        {
            'detail': 'Workout saved successfully.',
            'workout_id': workout_id,
        },
        status=status.HTTP_201_CREATED,
    )


def password_matches(raw_password, stored_password):
    try:
        identify_hasher(stored_password)
    except ValueError:
        return raw_password == stored_password

    return check_password(raw_password, stored_password)


def generate_username(email, preferred_name=''):
    base = (preferred_name or email.split('@')[0]).strip().lower()
    base = ''.join(character for character in base if character.isalnum() or character in ['_', '-'])
    base = base[:130] or 'member'

    with connection.cursor() as cursor:
        cursor.execute('SELECT id FROM users WHERE username = %s LIMIT 1', [base])
        if not cursor.fetchone():
            return base

        for suffix in range(2, 1000):
            candidate = f'{base}{suffix}'
            cursor.execute('SELECT id FROM users WHERE username = %s LIMIT 1', [candidate])
            if not cursor.fetchone():
                return candidate

    return f'{base}{secrets.randbelow(100000)}'


def get_or_create_social_user(email, preferred_name=''):
    normalized_email = email.strip().lower()

    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT id, username, email, role FROM users WHERE email = %s LIMIT 1',
            [normalized_email],
        )
        row = cursor.fetchone()

        if row:
            user_id, username, user_email, role = row
            return {
                'id': user_id,
                'username': username,
                'email': user_email,
                'role': role,
            }

        username = generate_username(normalized_email, preferred_name)
        cursor.execute(
            'INSERT INTO users (username, email, password, role) VALUES (%s, %s, %s, %s)',
            [username, normalized_email, make_password(secrets.token_urlsafe(32)), 'member'],
        )
        user_id = cursor.lastrowid

    return {
        'id': user_id,
        'username': username,
        'email': normalized_email,
        'role': 'member',
    }


def verify_google_token(token):
    if not settings.GOOGLE_CLIENT_ID:
        raise ValueError('Google login is not configured.')

    payload = google_id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        settings.GOOGLE_CLIENT_ID,
        clock_skew_in_seconds=30,
    )

    email = payload.get('email')
    if not email or not payload.get('email_verified'):
        raise ValueError('Google account email is not verified.')

    return {
        'email': email,
        'name': payload.get('name') or payload.get('given_name') or '',
    }


def verify_google_access_token(token):
    response = http_requests.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        headers={'Authorization': f'Bearer {token}'},
        timeout=10,
    )
    if response.status_code != 200:
        raise ValueError('Unable to verify Google account.')

    payload = response.json()
    email = payload.get('email')
    if not email or not payload.get('email_verified'):
        raise ValueError('Google account email is not verified.')

    return {
        'email': email,
        'name': payload.get('name') or payload.get('given_name') or '',
    }


@api_view(['POST'])
def sign_up(request):
    serializer = SignUpSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    username = serializer.validated_data['username'].strip()
    email = serializer.validated_data['email'].strip().lower()
    password = serializer.validated_data['password']
    role = serializer.validated_data.get('role', 'member').strip() or 'member'

    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT id FROM users WHERE username = %s OR email = %s LIMIT 1',
            [username, email],
        )
        if cursor.fetchone():
            return Response(
                {'detail': 'Username or email already exists.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cursor.execute(
            'INSERT INTO users (username, email, password, role) VALUES (%s, %s, %s, %s)',
            [username, email, make_password(password), role],
        )
        user_id = cursor.lastrowid

    return Response(
        {
            'user': {
                'id': user_id,
                'username': username,
                'email': email,
                'role': role,
            }
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
def sign_in(request):
    serializer = SignInSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data['email'].strip().lower()
    password = serializer.validated_data['password']

    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT id, username, email, password, role FROM users WHERE email = %s LIMIT 1',
            [email],
        )
        row = cursor.fetchone()

    if not row:
        return Response(
            {'detail': 'Invalid email or password.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user_id, username, user_email, stored_password, role = row
    if not password_matches(password, stored_password):
        return Response(
            {'detail': 'Invalid email or password.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({
        'user': {
            'id': user_id,
            'username': username,
            'email': user_email,
            'role': role,
        }
    })


@api_view(['POST'])
def social_auth(request):
    serializer = SocialAuthSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    provider = serializer.validated_data['provider']

    try:
        if serializer.validated_data.get('id_token'):
            profile = verify_google_token(serializer.validated_data['id_token'])
        else:
            profile = verify_google_access_token(serializer.validated_data['access_token'])
    except Exception as error:
        return Response(
            {'detail': str(error) or 'Unable to verify social login.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = get_or_create_social_user(profile['email'], profile.get('name', ''))
    return Response({'user': user})


def generate_reset_code():
    return f'{secrets.randbelow(1_000_000):06d}'


@api_view(['POST'])
def request_password_reset(request):
    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data['email'].strip().lower()

    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT id FROM users WHERE email = %s LIMIT 1',
            [email],
        )
        row = cursor.fetchone()

    if not row:
        return Response(
            {'detail': 'No account found for that email.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    code = generate_reset_code()
    PasswordResetCode.objects.create(
        email=email,
        code_hash=make_password(code),
        expires_at=timezone.now() + timedelta(minutes=10),
    )

    send_mail(
        subject='Your OneGym password reset code',
        message=f'Use this code to reset your OneGym password: {code}\n\nThis code expires in 10 minutes.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )

    return Response({'detail': 'Confirmation code sent to your email.'})


@api_view(['POST'])
def reset_password(request):
    serializer = PasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data['email'].strip().lower()
    code = serializer.validated_data['code'].strip()
    password = serializer.validated_data['password']

    reset_code = PasswordResetCode.objects.filter(
        email=email,
        used_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()

    if not reset_code or not check_password(code, reset_code.code_hash):
        return Response(
            {'detail': 'Invalid or expired confirmation code.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with connection.cursor() as cursor:
        cursor.execute(
            'UPDATE users SET password = %s WHERE email = %s',
            [make_password(password), email],
        )

    reset_code.used_at = timezone.now()
    reset_code.save(update_fields=['used_at'])

    return Response({'detail': 'Password updated. You can sign in now.'})
