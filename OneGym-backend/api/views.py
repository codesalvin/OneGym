from django.db import connection
from django.db import transaction
from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.conf import settings
from django.core.mail import send_mail
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.utils import timezone
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
import requests as http_requests
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from datetime import timedelta
import base64
import json
from pathlib import Path
import re
import secrets

from .models import PasswordResetCode
from .serializers import (
    ClassBookingSerializer,
    FitnessClassSerializer,
    MealCreateSerializer,
    MealSummarySerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    SignInSerializer,
    SignUpSerializer,
    SocialAuthSerializer,
    UserSerializer,
    WorkoutCreateSerializer,
    WorkoutSummarySerializer,
)


def extract_json_object(text):
    if isinstance(text, dict):
        return text

    stripped = (text or '').strip()
    if stripped.startswith('```'):
        stripped = re.sub(r'^```(?:json)?\s*', '', stripped)
        stripped = re.sub(r'\s*```$', '', stripped)

    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
            return parsed[0]
        if isinstance(parsed, dict):
            return parsed
    except ValueError:
        pass

    match = re.search(r'\{.*\}', stripped, re.DOTALL)
    if match:
        return json.loads(match.group(0))

    if any(label in stripped.lower() for label in ['calories', 'protein', 'carb', 'fat']):
        return parse_nutrition_text(stripped)

    preview = stripped[:160].replace('\n', ' ')
    raise ValueError(f'AI response did not include nutrition JSON. Response started with: {preview}')


def parse_nutrition_text(text):
    def number_after(pattern):
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            return 0
        return first_number(match.group(1))

    description_match = re.search(r'(?:description|meal|food)\s*[:\-]\s*(.+)', text, re.IGNORECASE)
    description = description_match.group(1).splitlines()[0].strip() if description_match else 'Estimated meal'

    foods = []
    foods_match = re.search(r'(?:detected foods|foods?)\s*[:\-]\s*(.+)', text, re.IGNORECASE)
    if foods_match:
        foods = [item.strip(' .') for item in re.split(r'[,;]', foods_match.group(1).splitlines()[0]) if item.strip()]

    return {
        'description': description,
        'calories': number_after(r'(?:calories|kcal)\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)'),
        'protein_g': number_after(r'protein(?:_g|\s*\(g\)|\s*g)?\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)'),
        'carbs_g': number_after(r'(?:carbs|carbohydrates)(?:_g|\s*\(g\)|\s*g)?\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)'),
        'fats_g': number_after(r'(?:fats|fat)(?:_g|\s*\(g\)|\s*g)?\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)'),
        'confidence': 'low',
        'detected_foods': foods,
    }


def extract_partial_description(text):
    match = re.search(r'"description"\s*:\s*"([^"]+)', text or '', re.IGNORECASE)
    if match:
        return shorten_description(match.group(1))

    return 'Estimated meal'


def shorten_description(value):
    text = re.sub(r'\s+', ' ', str(value or '')).strip(' .,')
    if not text:
        return 'Estimated meal'

    text = re.sub(r'^(a serving of|a plate of|a bowl of|an image of)\s+', '', text, flags=re.IGNORECASE)
    parts = re.split(r'\s*(?:,| with | garnished with | topped with )\s*', text)
    short = ', '.join(part for part in parts[:2] if part).strip(' .,')
    return short[:80] or 'Estimated meal'


def first_number(*values):
    for value in values:
        if value is None or value == '':
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue

    return 0


def get_gemini_text(payload):
    texts = []
    for candidate in payload.get('candidates', []):
        for part in candidate.get('content', {}).get('parts', []):
            text = part.get('text')
            if text:
                texts.append(text)

    return '\n'.join(texts)


def find_nested_value(data, keys):
    if isinstance(data, dict):
        for key in keys:
            if key in data and data[key] not in [None, '']:
                return data[key]

        for value in data.values():
            found = find_nested_value(value, keys)
            if found not in [None, '']:
                return found

    if isinstance(data, list):
        for item in data:
            found = find_nested_value(item, keys)
            if found not in [None, '']:
                return found

    return None


def normalize_food_estimate(estimate, raw_text=''):
    if not isinstance(estimate, dict):
        estimate = {}

    description = (
        find_nested_value(estimate, ['description', 'meal_description', 'meal', 'food', 'dish', 'name'])
        or 'Estimated meal'
    )
    calories = int(first_number(find_nested_value(estimate, ['calories', 'kcal', 'calories_kcal', 'estimated_calories'])))
    protein = first_number(find_nested_value(estimate, ['protein_g', 'protein', 'proteinGrams', 'protein_grams']))
    carbs = first_number(find_nested_value(estimate, ['carbs_g', 'carbs', 'carbohydrates', 'carbohydrates_g', 'carb_grams']))
    fats = first_number(find_nested_value(estimate, ['fats_g', 'fat_g', 'fats', 'fat', 'fat_grams']))
    detected_foods = find_nested_value(estimate, ['detected_foods', 'foods', 'items', 'ingredients'])

    if not isinstance(detected_foods, list):
        detected_foods = []

    if calories == 0 and protein == 0 and carbs == 0 and fats == 0:
        fallback = parse_nutrition_text(raw_text)
        calories = int(first_number(fallback.get('calories')))
        protein = first_number(fallback.get('protein_g'))
        carbs = first_number(fallback.get('carbs_g'))
        fats = first_number(fallback.get('fats_g'))
        if description == 'Estimated meal':
            description = fallback.get('description') or description
        if not detected_foods:
            detected_foods = fallback.get('detected_foods') or []

    return {
        'description': str(description),
        'calories': calories,
        'protein_g': protein,
        'protein': protein,
        'carbs_g': carbs,
        'carbs': carbs,
        'fats_g': fats,
        'fats': fats,
        'confidence': str(find_nested_value(estimate, ['confidence']) or 'low'),
        'detected_foods': detected_foods,
    }


def build_gemini_payload(uploaded_file, image_data, strict_retry=False):
    instruction = (
        'You are estimating nutrition from a food photo for a gym meal logger. '
        'Identify the visible food and estimate one serving shown in the image. '
        'Do not write JSON, markdown, explanations, apologies, or prose. '
        'Return exactly these five short lines and nothing else:\n'
        'DESCRIPTION: short food name under 6 words\n'
        'CALORIES: number\n'
        'PROTEIN_G: number\n'
        'CARBS_G: number\n'
        'FATS_G: number\n'
        'Calories must be kcal. Protein, carbs, and fats must be grams. '
        'If exact portion size is uncertain, make a reasonable visual estimate instead of using 0.'
    )

    if strict_retry:
        instruction += ' Important: do not return 0 unless there is no food visible. Estimate from the plate/bowl size and visible ingredients.'

    return {
        'contents': [
            {
                'parts': [
                    {'text': instruction},
                    {
                        'inline_data': {
                            'mime_type': uploaded_file.content_type,
                            'data': image_data,
                        },
                    },
                ],
            },
        ],
        'generationConfig': {
            'temperature': 0.2 if strict_retry else 0.1,
            'maxOutputTokens': 1000,
        },
    }


def build_gemini_text_payload(text):
    return {
        'contents': [
            {
                'parts': [
                    {
                        'text': (
                            'Convert this food analysis text into nutrition numbers. '
                            'If nutrition numbers are missing, estimate them from the described food. '
                            'Do not write JSON, markdown, explanations, apologies, or prose. '
                            'Return exactly these five short lines and nothing else:\n'
                            'DESCRIPTION: short food name under 6 words\n'
                            'CALORIES: number\n'
                            'PROTEIN_G: number\n'
                            'CARBS_G: number\n'
                            'FATS_G: number\n'
                            f'Food analysis text: {text[:1200]}'
                        ),
                    },
                ],
            },
        ],
        'generationConfig': {
            'temperature': 0.2,
            'maxOutputTokens': 500,
        },
    }


def analyze_food_image(uploaded_file):
    if not settings.GEMINI_API_KEY:
        return {
            'description': '',
            'calories': '',
            'protein_g': '',
            'carbs_g': '',
            'fats_g': '',
            'confidence': 'manual_required',
            'detected_foods': [],
            'detail': 'Add GEMINI_API_KEY to OneGym-backend/.env to enable food photo estimates.',
        }

    uploaded_file.seek(0)
    image_bytes = uploaded_file.read()
    image_data = base64.b64encode(image_bytes).decode('ascii')

    endpoint = f'https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_VISION_MODEL}:generateContent'
    headers = {
        'x-goog-api-key': settings.GEMINI_API_KEY,
        'Content-Type': 'application/json',
    }

    response = http_requests.post(
        endpoint,
        headers=headers,
        json=build_gemini_payload(uploaded_file, image_data),
        timeout=45,
    )

    if response.status_code >= 400:
        try:
            error_data = response.json().get('error', {})
            error_message = error_data.get('message') or 'Food analysis service is unavailable.'
        except ValueError:
            error_message = 'Food analysis service is unavailable.'

        raise ValueError(error_message)

    response_data = response.json()
    content = get_gemini_text(response_data)
    if not content:
        raise ValueError('Gemini did not return a nutrition estimate.')

    estimate = extract_json_object(content)
    normalized = normalize_food_estimate(estimate, content)

    if normalized['calories'] == 0 and normalized['protein_g'] == 0 and normalized['carbs_g'] == 0 and normalized['fats_g'] == 0:
        retry_response = http_requests.post(
            endpoint,
            headers=headers,
            json=build_gemini_text_payload(content),
            timeout=45,
        )
        if retry_response.status_code >= 400:
            raise ValueError('Gemini described the food but did not return nutrition numbers.')
        retry_content = get_gemini_text(retry_response.json())
        if not retry_content:
            raise ValueError('Gemini described the food but did not return nutrition numbers.')
        normalized = normalize_food_estimate(extract_json_object(retry_content), retry_content)

    normalized['description'] = shorten_description(normalized['description'])

    if normalized['calories'] == 0 and normalized['protein_g'] == 0 and normalized['carbs_g'] == 0 and normalized['fats_g'] == 0:
        retry_response = http_requests.post(
            endpoint,
            headers=headers,
            json=build_gemini_payload(uploaded_file, image_data, strict_retry=True),
            timeout=45,
        )
        if retry_response.status_code < 400:
            retry_content = get_gemini_text(retry_response.json())
            if retry_content:
                normalized = normalize_food_estimate(extract_json_object(retry_content), retry_content)
                normalized['description'] = shorten_description(normalized['description'])

    if normalized['calories'] == 0 and normalized['protein_g'] == 0 and normalized['carbs_g'] == 0 and normalized['fats_g'] == 0:
        text_retry_response = http_requests.post(
            endpoint,
            headers=headers,
            json=build_gemini_text_payload(content),
            timeout=45,
        )
        if text_retry_response.status_code < 400:
            text_retry_content = get_gemini_text(text_retry_response.json())
            if text_retry_content:
                normalized = normalize_food_estimate(extract_json_object(text_retry_content), text_retry_content)
                normalized['description'] = shorten_description(normalized['description'])

    if normalized['calories'] == 0 and normalized['protein_g'] == 0 and normalized['carbs_g'] == 0 and normalized['fats_g'] == 0:
        normalized['description'] = extract_partial_description(content)
        raise ValueError('Gemini described the food but did not return nutrition numbers. Try a clearer, closer food photo.')

    normalized['detail'] = 'Nutrition estimate generated from photo.'
    return normalized


def save_meal_photo(uploaded_file):
    if not uploaded_file:
        return None

    extension = Path(uploaded_file.name).suffix.lower()
    if extension not in ['.jpg', '.jpeg', '.png', '.webp']:
        extension = '.jpg'

    filename = f'meal_photos/{secrets.token_urlsafe(16)}{extension}'
    saved_path = default_storage.save(filename, ContentFile(uploaded_file.read()))
    return default_storage.url(saved_path)


@api_view(['GET'])
def health_check(_request):
    return Response({
        'status': 'ok',
        'service': 'OneGym API',
    })


@api_view(['GET'])
def user_list(_request):
    with connection.cursor() as cursor:
        cursor.execute('SELECT id, username, email, role, created_at FROM users ORDER BY id')
        users = [
            {
                'id': user_id,
                'username': username,
                'email': email,
                'role': role,
                'created_at': created_at,
            }
            for user_id, username, email, role, created_at in cursor.fetchall()
        ]

    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def user_detail(_request, user_id):
    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT id, username, email, role, created_at FROM users WHERE id = %s LIMIT 1',
            [user_id],
        )
        row = cursor.fetchone()

    if not row:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    user_id, username, email, role, created_at = row
    serializer = UserSerializer({
        'id': user_id,
        'username': username,
        'email': email,
        'role': role,
        'created_at': created_at,
    })
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
        cursor.execute('SELECT id, created_at FROM users WHERE id = %s LIMIT 1', [data['user_id']])
        user_row = cursor.fetchone()
        if not user_row:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    workout_date = data.get('workout_date') or timezone.now()
    _, user_created_at = user_row
    if workout_date.date() < user_created_at.date():
        return Response(
            {'detail': 'Workout date cannot be before your registration date.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if workout_date.date() > timezone.localdate():
        return Response(
            {'detail': 'Workout date cannot be in the future.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

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


@api_view(['DELETE', 'POST'])
def delete_workout(request, workout_id=None):
    workout_id = workout_id or request.data.get('workout_id') or request.query_params.get('workout_id')
    user_id = request.data.get('user_id') or request.query_params.get('user_id')
    if not user_id:
        return Response({'detail': 'User id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        workout_id = int(workout_id)
    except (TypeError, ValueError):
        return Response({'detail': 'Valid workout id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT id FROM workouts WHERE id = %s AND user_id = %s LIMIT 1',
            [workout_id, user_id],
        )
        if not cursor.fetchone():
            return Response({'detail': 'Workout not found.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            cursor.execute('DELETE FROM workout_exercises WHERE workout_id = %s', [workout_id])
            cursor.execute(
                'DELETE FROM workouts WHERE id = %s AND user_id = %s',
                [workout_id, user_id],
            )

    return Response({'detail': 'Workout deleted.'})


@api_view(['GET'])
def user_workouts(request, user_id):
    with connection.cursor() as cursor:
        cursor.execute('SELECT id FROM users WHERE id = %s LIMIT 1', [user_id])
        if not cursor.fetchone():
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        limit_clause = '' if request.query_params.get('limit') == 'all' else 'LIMIT 5'
        cursor.execute(
            f'''
            SELECT
                w.id,
                w.name,
                w.duration_minutes,
                w.intensity,
                w.calories_burned,
                w.workout_date,
                w.created_at,
                COUNT(we.id) AS exercise_count
            FROM workouts w
            LEFT JOIN workout_exercises we ON we.workout_id = w.id
            WHERE w.user_id = %s
            GROUP BY
                w.id,
                w.name,
                w.duration_minutes,
                w.intensity,
                w.calories_burned,
                w.workout_date,
                w.created_at
            ORDER BY w.workout_date DESC, w.created_at DESC
            {limit_clause}
            ''',
            [user_id],
        )
        workouts = [
            {
                'id': workout_id,
                'name': name,
                'duration_minutes': duration_minutes,
                'intensity': intensity,
                'calories_burned': calories_burned,
                'workout_date': workout_date,
                'created_at': created_at,
                'exercise_count': exercise_count,
            }
            for (
                workout_id,
                name,
                duration_minutes,
                intensity,
                calories_burned,
                workout_date,
                created_at,
                exercise_count,
            ) in cursor.fetchall()
        ]

    serializer = WorkoutSummarySerializer(workouts, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def user_meals(request, user_id):
    with connection.cursor() as cursor:
        cursor.execute('SELECT id FROM users WHERE id = %s LIMIT 1', [user_id])
        if not cursor.fetchone():
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        cursor.execute(
            '''
            SELECT
                id,
                meal_type,
                description,
                calories,
                protein_g,
                carbs_g,
                fats_g,
                photo_url,
                meal_date,
                created_at
            FROM meals
            WHERE user_id = %s AND DATE(meal_date) = %s
            ORDER BY meal_date DESC, created_at DESC
            ''',
            [user_id, request.query_params.get('date') or timezone.localdate()],
        )
        meals = [
            {
                'id': meal_id,
                'meal_type': meal_type,
                'description': description,
                'calories': calories,
                'protein_g': protein_g,
                'carbs_g': carbs_g,
                'fats_g': fats_g,
                'photo_url': photo_url,
                'meal_date': meal_date,
                'created_at': created_at,
            }
            for (
                meal_id,
                meal_type,
                description,
                calories,
                protein_g,
                carbs_g,
                fats_g,
                photo_url,
                meal_date,
                created_at,
            ) in cursor.fetchall()
        ]

    serializer = MealSummarySerializer(meals, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def analyze_meal_photo(request):
    user_id = request.data.get('user_id')
    uploaded_file = request.FILES.get('meal_photo')

    if not user_id:
        return Response({'detail': 'User id is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not uploaded_file:
        return Response({'detail': 'Meal photo is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if uploaded_file.size > 8 * 1024 * 1024:
        return Response({'detail': 'Meal photo must be under 8MB.'}, status=status.HTTP_400_BAD_REQUEST)
    if not uploaded_file.content_type.startswith('image/'):
        return Response({'detail': 'Meal photo must be an image.'}, status=status.HTTP_400_BAD_REQUEST)

    with connection.cursor() as cursor:
        cursor.execute('SELECT id FROM users WHERE id = %s LIMIT 1', [user_id])
        if not cursor.fetchone():
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        estimate = analyze_food_image(uploaded_file)
    except Exception as error:
        return Response(
            {'detail': str(error) or 'Unable to analyze this meal photo.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(estimate)


@api_view(['POST'])
def create_meal(request):
    serializer = MealCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    uploaded_file = request.FILES.get('meal_photo')

    if uploaded_file:
        if uploaded_file.size > 8 * 1024 * 1024:
            return Response({'detail': 'Meal photo must be under 8MB.'}, status=status.HTTP_400_BAD_REQUEST)
        if not uploaded_file.content_type.startswith('image/'):
            return Response({'detail': 'Meal photo must be an image.'}, status=status.HTTP_400_BAD_REQUEST)

    photo_url = save_meal_photo(uploaded_file) if uploaded_file else (data.get('photo_url') or None)

    with connection.cursor() as cursor:
        cursor.execute('SELECT id FROM users WHERE id = %s LIMIT 1', [data['user_id']])
        if not cursor.fetchone():
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        meal_date = timezone.now()
        cursor.execute(
            '''
            INSERT INTO meals
                (user_id, meal_type, description, calories, protein_g, carbs_g, fats_g, photo_url, meal_date, created_at)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(6))
            ''',
            [
                data['user_id'],
                data.get('meal_type') or 'Meal',
                data['description'],
                data['calories'],
                data.get('protein_g'),
                data.get('carbs_g'),
                data.get('fats_g'),
                photo_url,
                meal_date,
            ],
        )
        meal_id = cursor.lastrowid

    return Response(
        {
            'detail': 'Meal logged successfully.',
            'meal_id': meal_id,
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
            'SELECT id, username, email, role, created_at FROM users WHERE email = %s LIMIT 1',
            [normalized_email],
        )
        row = cursor.fetchone()

        if row:
            user_id, username, user_email, role, created_at = row
            return {
                'id': user_id,
                'username': username,
                'email': user_email,
                'role': role,
                'created_at': created_at,
            }

        username = generate_username(normalized_email, preferred_name)
        cursor.execute(
            'INSERT INTO users (username, email, password, role) VALUES (%s, %s, %s, %s)',
            [username, normalized_email, make_password(secrets.token_urlsafe(32)), 'member'],
        )
        user_id = cursor.lastrowid
        cursor.execute('SELECT created_at FROM users WHERE id = %s LIMIT 1', [user_id])
        created_at = cursor.fetchone()[0]

    return {
        'id': user_id,
        'username': username,
        'email': normalized_email,
        'role': 'member',
        'created_at': created_at,
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
        cursor.execute('SELECT created_at FROM users WHERE id = %s LIMIT 1', [user_id])
        created_at = cursor.fetchone()[0]

    return Response(
        {
            'user': {
                'id': user_id,
                'username': username,
                'email': email,
                'role': role,
                'created_at': created_at,
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
            'SELECT id, username, email, password, role, created_at FROM users WHERE email = %s LIMIT 1',
            [email],
        )
        row = cursor.fetchone()

    if not row:
        return Response(
            {'detail': 'Invalid email or password.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user_id, username, user_email, stored_password, role, created_at = row
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
            'created_at': created_at,
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
