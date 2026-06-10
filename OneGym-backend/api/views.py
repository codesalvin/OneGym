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
from datetime import datetime, timedelta
import base64
import hashlib
import json
from pathlib import Path
import re
import secrets

from .models import PasswordResetCode
from .serializers import (
    ClassBookingSerializer,
    ExerciseSerializer,
    FitnessClassCreateSerializer,
    FitnessClassSerializer,
    MealCreateSerializer,
    MealSummarySerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PersonalRecordCreateSerializer,
    PersonalRecordSerializer,
    SignInSerializer,
    SignUpSerializer,
    SocialAuthSerializer,
    TrainerApplicationCreateSerializer,
    TrainerApplicationReviewSerializer,
    TrainerApplicationSerializer,
    TrainerChatConversationSerializer,
    TrainerChatMessageSerializer,
    UserProfileUpdateSerializer,
    UserSerializer,
    WorkoutCreateSerializer,
    WorkoutSummarySerializer,
)


ALLOWED_CERTIFICATION_EXTENSIONS = {'.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp'}
ALLOWED_CERTIFICATION_CONTENT_TYPES = {
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
}
MAX_CERTIFICATION_FILE_SIZE = 10 * 1024 * 1024
AUTH_TOKEN_LIFETIME = timedelta(days=30)
AUTH_COOKIE_NAME = 'onegym_auth'


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


def get_ollama_text(payload):
    if isinstance(payload, dict):
        return payload.get('response') or payload.get('message', {}).get('content') or ''

    return ''


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


def build_food_prompt(strict_retry=False):
    prompt = (
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
        prompt += ' Important: do not return 0 unless there is no food visible. Estimate from the plate/bowl size and visible ingredients.'

    return prompt


def build_ollama_payload(image_data, strict_retry=False):
    return {
        'model': settings.OLLAMA_VISION_MODEL,
        'prompt': build_food_prompt(strict_retry),
        'images': [image_data],
        'stream': False,
        'options': {
            'temperature': 0.2 if strict_retry else 0.1,
            'num_predict': 500,
        },
    }


def build_ollama_text_payload(text):
    return {
        'model': settings.OLLAMA_VISION_MODEL,
        'prompt': (
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
        'stream': False,
        'options': {
            'temperature': 0.2,
            'num_predict': 500,
        },
    }


def post_ollama_generate(payload):
    base_url = settings.OLLAMA_BASE_URL.rstrip('/')
    endpoint = f"{base_url}/generate" if base_url.endswith('/api') else f"{base_url}/api/generate"
    headers = {}
    if settings.OLLAMA_API_KEY:
        headers['Authorization'] = f'Bearer {settings.OLLAMA_API_KEY}'

    try:
        response = http_requests.post(endpoint, headers=headers, json=payload, timeout=150)
    except http_requests.RequestException as error:
        raise ValueError(f'Ollama Cloud request failed: {error}') from error

    if response.status_code >= 400:
        try:
            error_message = response.json().get('error') or 'Food analysis service is unavailable.'
        except ValueError:
            error_message = response.text or 'Food analysis service is unavailable.'

        raise ValueError(error_message)

    try:
        return response.json()
    except ValueError as error:
        raise ValueError('Ollama returned an invalid response.') from error


def summarize_today_meals(user_id):
    with connection.cursor() as cursor:
        cursor.execute(
            '''
            SELECT
                description,
                calories,
                protein_g,
                carbs_g,
                fats_g,
                meal_date
            FROM meals
            WHERE user_id = %s AND DATE(meal_date) = %s
            ORDER BY meal_date DESC, created_at DESC
            LIMIT 8
            ''',
            [user_id, timezone.localdate()],
        )
        rows = cursor.fetchall()

    meals = []
    totals = {
        'calories': 0,
        'protein_g': 0,
        'carbs_g': 0,
        'fats_g': 0,
    }

    for description, calories, protein_g, carbs_g, fats_g, meal_date in rows:
        meal = {
            'description': description,
            'calories': float(calories or 0),
            'protein_g': float(protein_g or 0),
            'carbs_g': float(carbs_g or 0),
            'fats_g': float(fats_g or 0),
            'meal_date': meal_date,
        }
        meals.append(meal)
        totals['calories'] += meal['calories']
        totals['protein_g'] += meal['protein_g']
        totals['carbs_g'] += meal['carbs_g']
        totals['fats_g'] += meal['fats_g']

    return meals, totals


def build_assistant_prompt(message, meals, totals):
    meal_lines = [
        (
            f"- {meal['description']}: {meal['calories']:.0f} kcal, "
            f"{meal['protein_g']:.0f}g protein, {meal['carbs_g']:.0f}g carbs, {meal['fats_g']:.0f}g fats"
        )
        for meal in meals
    ]
    meal_summary = '\n'.join(meal_lines) if meal_lines else '- No meals logged today.'
    remaining_calories = max(0, 2500 - totals['calories'])

    return (
        'You are OneGym AI Assistant, a concise gym nutrition and wellness coach. '
        'Use the user\'s current day nutrition context when answering. '
        'Do not claim to diagnose medical conditions. '
        'Keep answers practical and specific. '
        'Return only valid JSON, with no markdown fences and no extra text. '
        'The JSON must match this shape:\n'
        '{'
        '"summary":"one short paragraph under 45 words",'
        '"cards":['
        '{"label":"RECOMMENDED RECIPE","title":"short recipe name","detail":"one short reason"},'
        '{"label":"MACRO ESTIMATE","macros":[{"value":"38g","label":"PRO"},{"value":"4g","label":"FAT"},{"value":"2g","label":"CHO"}]}'
        '],'
        '"note":"optional short italic note under 20 words"'
        '}\n\n'
        'Daily goals:\n'
        '- Calories: 2500 kcal\n'
        '- Protein: 180g\n'
        '- Carbs: 300g\n'
        '- Fats: 65g\n\n'
        'Today so far:\n'
        f"- Calories consumed: {totals['calories']:.0f} kcal\n"
        f"- Calories remaining: {remaining_calories:.0f} kcal\n"
        f"- Protein: {totals['protein_g']:.0f}g / 180g\n"
        f"- Carbs: {totals['carbs_g']:.0f}g / 300g\n"
        f"- Fats: {totals['fats_g']:.0f}g / 65g\n\n"
        f"Recent meals today:\n{meal_summary}\n\n"
        f"User message: {message}\n\n"
        'Answer the user directly.'
    )


def build_ollama_chat_payload(message, meals, totals):
    return {
        'model': settings.OLLAMA_CHAT_MODEL,
        'prompt': build_assistant_prompt(message, meals, totals),
        'stream': False,
        'options': {
            'temperature': 0.4,
            'num_predict': 320,
        },
    }


def save_ai_chat_message(user_id, role, body, title=None, cards=None, note=''):
    with connection.cursor() as cursor:
        cursor.execute(
            '''
            INSERT INTO ai_chat_messages
                (user_id, role, title, body, cards, note, created_at)
            VALUES
                (%s, %s, %s, %s, %s, %s, NOW(6))
            ''',
            [
                user_id,
                role,
                title,
                body,
                json.dumps(cards or []),
                note or None,
            ],
        )
        return cursor.lastrowid


def serialize_ai_chat_row(row):
    message_id, role, title, body, cards, note, created_at = row
    try:
        parsed_cards = json.loads(cards) if cards else []
    except (TypeError, ValueError):
        parsed_cards = []

    return {
        'id': message_id,
        'role': role,
        'title': title,
        'body': body,
        'cards': parsed_cards,
        'note': note or '',
        'created_at': created_at,
    }


def serialize_trainer_chat_row(row):
    (
        message_id,
        sender_id,
        sender_name,
        recipient_id,
        recipient_name,
        body,
        read_at,
        created_at,
    ) = row

    return {
        'id': message_id,
        'sender_id': sender_id,
        'sender_name': sender_name,
        'recipient_id': recipient_id,
        'recipient_name': recipient_name,
        'body': body,
        'read_at': read_at,
        'created_at': created_at,
    }


def serialize_trainer_conversation_row(row):
    user_id, username, email, role, last_message, last_message_at, unread_count = row
    return {
        'user_id': user_id,
        'username': username,
        'email': email,
        'role': role,
        'last_message': last_message,
        'last_message_at': last_message_at,
        'unread_count': unread_count,
    }


def parse_assistant_reply(content):
    try:
        data = extract_json_object(content)
    except ValueError:
        return {
            'summary': content,
            'cards': [],
            'note': '',
        }

    if not isinstance(data, dict):
        return {
            'summary': content,
            'cards': [],
            'note': '',
        }

    cards = data.get('cards') if isinstance(data.get('cards'), list) else []
    return {
        'summary': str(data.get('summary') or data.get('reply') or content),
        'cards': cards[:2],
        'note': str(data.get('note') or ''),
    }


@api_view(['GET'])
def user_ai_chat_messages(_request, user_id):
    with connection.cursor() as cursor:
        cursor.execute('SELECT id FROM users WHERE id = %s LIMIT 1', [user_id])
        if not cursor.fetchone():
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        cursor.execute(
            '''
            SELECT id, role, title, body, cards, note, created_at
            FROM ai_chat_messages
            WHERE user_id = %s
            ORDER BY created_at ASC, id ASC
            LIMIT 60
            ''',
            [user_id],
        )
        messages = [serialize_ai_chat_row(row) for row in cursor.fetchall()]

    return Response(messages)


@api_view(['GET'])
def user_trainer_chat_messages(request, user_id):
    trainer_id = request.query_params.get('trainer_id')
    if not trainer_id:
        return Response({'detail': 'Trainer id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    actor = get_authenticated_user(request)
    if not actor:
        return Response({'detail': 'Authentication is required.'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        member_id = int(user_id)
        trainer_id = int(trainer_id)
    except (TypeError, ValueError):
        return Response({'detail': 'Invalid conversation users.'}, status=status.HTTP_400_BAD_REQUEST)

    if actor['role'] not in ['admin', 'owner'] and actor['id'] not in [member_id, trainer_id]:
        return Response({'detail': 'You cannot view this conversation.'}, status=status.HTTP_403_FORBIDDEN)

    with connection.cursor() as cursor:
        cursor.execute(
            '''
            SELECT id, username, role
            FROM users
            WHERE id IN (%s, %s)
            ''',
            [member_id, trainer_id],
        )
        users = {row[0]: {'username': row[1], 'role': row[2]} for row in cursor.fetchall()}
        if member_id not in users or trainer_id not in users:
            return Response({'detail': 'Conversation user not found.'}, status=status.HTTP_404_NOT_FOUND)
        if users[member_id]['role'] != 'member' or users[trainer_id]['role'] != 'trainer':
            return Response({'detail': 'Trainer chat must be between a member and a trainer.'}, status=status.HTTP_400_BAD_REQUEST)

        cursor.execute(
            '''
            SELECT
                message.id,
                message.sender_id,
                sender.username AS sender_name,
                message.recipient_id,
                recipient.username AS recipient_name,
                message.body,
                message.read_at,
                message.created_at
            FROM trainer_chat_messages message
            INNER JOIN users sender ON sender.id = message.sender_id
            INNER JOIN users recipient ON recipient.id = message.recipient_id
            WHERE (
                message.sender_id = %s AND message.recipient_id = %s
            ) OR (
                message.sender_id = %s AND message.recipient_id = %s
            )
            ORDER BY message.created_at ASC, message.id ASC
            LIMIT 120
            ''',
            [member_id, trainer_id, trainer_id, member_id],
        )
        messages = [serialize_trainer_chat_row(row) for row in cursor.fetchall()]

        cursor.execute(
            '''
            UPDATE trainer_chat_messages
            SET read_at = NOW(6)
            WHERE recipient_id = %s
                AND sender_id = %s
                AND read_at IS NULL
            ''',
            [actor['id'], trainer_id if actor['id'] == member_id else member_id],
        )

    serializer = TrainerChatMessageSerializer(messages, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def trainer_chat_conversations(request):
    actor = get_authenticated_user(request)
    if not actor:
        return Response({'detail': 'Authentication is required.'}, status=status.HTTP_401_UNAUTHORIZED)

    if actor['role'] not in ['trainer', 'admin', 'owner']:
        return Response({'detail': 'Only trainers can view trainer conversations.'}, status=status.HTTP_403_FORBIDDEN)

    with connection.cursor() as cursor:
        cursor.execute(
            '''
            SELECT
                other_user.id,
                other_user.username,
                other_user.email,
                other_user.role,
                latest.body AS last_message,
                latest.created_at AS last_message_at,
                COALESCE(unread.unread_count, 0) AS unread_count
            FROM trainer_chat_messages latest
            INNER JOIN (
                SELECT
                    CASE
                        WHEN sender_id = %s THEN recipient_id
                        ELSE sender_id
                    END AS other_user_id,
                    MAX(id) AS latest_id
                FROM trainer_chat_messages
                WHERE sender_id = %s OR recipient_id = %s
                GROUP BY other_user_id
            ) grouped ON grouped.latest_id = latest.id
            INNER JOIN users other_user ON other_user.id = grouped.other_user_id
            LEFT JOIN (
                SELECT sender_id, COUNT(*) AS unread_count
                FROM trainer_chat_messages
                WHERE recipient_id = %s
                    AND read_at IS NULL
                GROUP BY sender_id
            ) unread ON unread.sender_id = other_user.id
            ORDER BY latest.created_at DESC, latest.id DESC
            LIMIT 60
            ''',
            [actor['id'], actor['id'], actor['id'], actor['id']],
        )
        conversations = [serialize_trainer_conversation_row(row) for row in cursor.fetchall()]

    serializer = TrainerChatConversationSerializer(conversations, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def trainer_chat_message(request):
    actor = get_authenticated_user(request)
    if not actor:
        return Response({'detail': 'Authentication is required.'}, status=status.HTTP_401_UNAUTHORIZED)

    recipient_id = request.data.get('recipient_id')
    body = (request.data.get('body') or '').strip()
    if not recipient_id:
        return Response({'detail': 'Recipient id is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not body:
        return Response({'detail': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        recipient_id = int(recipient_id)
    except (TypeError, ValueError):
        return Response({'detail': 'Recipient id is invalid.'}, status=status.HTTP_400_BAD_REQUEST)

    with connection.cursor() as cursor:
        cursor.execute('SELECT id, username, role FROM users WHERE id = %s LIMIT 1', [recipient_id])
        recipient = cursor.fetchone()
        if not recipient:
            return Response({'detail': 'Recipient not found.'}, status=status.HTTP_404_NOT_FOUND)

        valid_pair = (
            actor['role'] == 'member' and recipient[2] == 'trainer'
        ) or (
            actor['role'] == 'trainer' and recipient[2] == 'member'
        )
        if actor['role'] not in ['admin', 'owner'] and not valid_pair:
            return Response({'detail': 'Trainer chat must be between a member and a trainer.'}, status=status.HTTP_403_FORBIDDEN)

        cursor.execute(
            '''
            INSERT INTO trainer_chat_messages (sender_id, recipient_id, body, created_at)
            VALUES (%s, %s, %s, NOW(6))
            ''',
            [actor['id'], recipient_id, body],
        )
        message_id = cursor.lastrowid

        cursor.execute(
            '''
            SELECT
                message.id,
                message.sender_id,
                sender.username AS sender_name,
                message.recipient_id,
                recipient.username AS recipient_name,
                message.body,
                message.read_at,
                message.created_at
            FROM trainer_chat_messages message
            INNER JOIN users sender ON sender.id = message.sender_id
            INNER JOIN users recipient ON recipient.id = message.recipient_id
            WHERE message.id = %s
            LIMIT 1
            ''',
            [message_id],
        )
        message = serialize_trainer_chat_row(cursor.fetchone())

    serializer = TrainerChatMessageSerializer(message)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def ai_assistant_chat(request):
    user_id = request.data.get('user_id')
    message = (request.data.get('message') or '').strip()

    if not user_id:
        return Response({'detail': 'User id is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not message:
        return Response({'detail': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if settings.OLLAMA_BASE_URL.rstrip('/').startswith('https://ollama.com') and not settings.OLLAMA_API_KEY:
        return Response(
            {'detail': 'Add OLLAMA_API_KEY to OneGym-backend/.env to enable AI Assistant chat.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with connection.cursor() as cursor:
        cursor.execute('SELECT id FROM users WHERE id = %s LIMIT 1', [user_id])
        if not cursor.fetchone():
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    meals, totals = summarize_today_meals(user_id)
    save_ai_chat_message(user_id, 'user', message)

    try:
        response_data = post_ollama_generate(build_ollama_chat_payload(message, meals, totals))
        reply = get_ollama_text(response_data).strip()
    except Exception as error:
        return Response(
            {'detail': str(error) or 'AI Assistant is unavailable.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not reply:
        return Response({'detail': 'AI Assistant did not return a response.'}, status=status.HTTP_400_BAD_REQUEST)

    formatted = parse_assistant_reply(reply)
    assistant_id = save_ai_chat_message(
        user_id,
        'assistant',
        formatted['summary'],
        title='Assistant Recommendation',
        cards=formatted['cards'],
        note=formatted['note'],
    )
    return Response({
        'id': assistant_id,
        'reply': formatted['summary'],
        'cards': formatted['cards'],
        'note': formatted['note'],
    })


def analyze_food_image(uploaded_file):
    if settings.OLLAMA_BASE_URL.rstrip('/').startswith('https://ollama.com') and not settings.OLLAMA_API_KEY:
        return {
            'description': '',
            'calories': '',
            'protein_g': '',
            'carbs_g': '',
            'fats_g': '',
            'confidence': 'manual_required',
            'detected_foods': [],
            'detail': 'Add OLLAMA_API_KEY to OneGym-backend/.env to enable Ollama Cloud food photo estimates.',
        }

    if not settings.OLLAMA_VISION_MODEL:
        return {
            'description': '',
            'calories': '',
            'protein_g': '',
            'carbs_g': '',
            'fats_g': '',
            'confidence': 'manual_required',
            'detected_foods': [],
            'detail': 'Add OLLAMA_VISION_MODEL to OneGym-backend/.env to enable food photo estimates.',
        }

    uploaded_file.seek(0)
    image_bytes = uploaded_file.read()
    image_data = base64.b64encode(image_bytes).decode('ascii')

    response_data = post_ollama_generate(build_ollama_payload(image_data))
    content = get_ollama_text(response_data)
    if not content:
        raise ValueError('Ollama did not return a nutrition estimate.')

    estimate = extract_json_object(content)
    normalized = normalize_food_estimate(estimate, content)

    if normalized['calories'] == 0 and normalized['protein_g'] == 0 and normalized['carbs_g'] == 0 and normalized['fats_g'] == 0:
        retry_content = get_ollama_text(post_ollama_generate(build_ollama_text_payload(content)))
        if not retry_content:
            raise ValueError('Ollama described the food but did not return nutrition numbers.')
        normalized = normalize_food_estimate(extract_json_object(retry_content), retry_content)

    normalized['description'] = shorten_description(normalized['description'])

    if normalized['calories'] == 0 and normalized['protein_g'] == 0 and normalized['carbs_g'] == 0 and normalized['fats_g'] == 0:
        retry_content = get_ollama_text(post_ollama_generate(build_ollama_payload(image_data, strict_retry=True)))
        if retry_content:
            normalized = normalize_food_estimate(extract_json_object(retry_content), retry_content)
            normalized['description'] = shorten_description(normalized['description'])

    if normalized['calories'] == 0 and normalized['protein_g'] == 0 and normalized['carbs_g'] == 0 and normalized['fats_g'] == 0:
        text_retry_content = get_ollama_text(post_ollama_generate(build_ollama_text_payload(content)))
        if text_retry_content:
            normalized = normalize_food_estimate(extract_json_object(text_retry_content), text_retry_content)
            normalized['description'] = shorten_description(normalized['description'])

    if normalized['calories'] == 0 and normalized['protein_g'] == 0 and normalized['carbs_g'] == 0 and normalized['fats_g'] == 0:
        normalized['description'] = extract_partial_description(content)
        raise ValueError('Ollama described the food but did not return nutrition numbers. Try a clearer, closer food photo.')

    normalized['detail'] = 'Nutrition estimate generated from photo.'
    return normalized


def validate_certification_file(uploaded_file):
    if not uploaded_file:
        raise ValueError('Certification document is required.')

    extension = Path(uploaded_file.name).suffix.lower()
    if extension not in ALLOWED_CERTIFICATION_EXTENSIONS:
        raise ValueError('Certification must be a PDF, DOC, DOCX, JPG, PNG, or WEBP file.')

    if uploaded_file.size > MAX_CERTIFICATION_FILE_SIZE:
        raise ValueError('Certification file must be under 10MB.')

    if uploaded_file.content_type and uploaded_file.content_type not in ALLOWED_CERTIFICATION_CONTENT_TYPES:
        raise ValueError('Certification file type is not supported.')


def save_certification_file(uploaded_file):
    validate_certification_file(uploaded_file)
    extension = Path(uploaded_file.name).suffix.lower()
    filename = f'trainer_certifications/{secrets.token_urlsafe(16)}{extension}'
    saved_path = default_storage.save(filename, ContentFile(uploaded_file.read()))
    return default_storage.url(saved_path)


def save_meal_photo(uploaded_file):
    if not uploaded_file:
        return None

    extension = Path(uploaded_file.name).suffix.lower()
    if extension not in ['.jpg', '.jpeg', '.png', '.webp']:
        extension = '.jpg'

    filename = f'meal_photos/{secrets.token_urlsafe(16)}{extension}'
    saved_path = default_storage.save(filename, ContentFile(uploaded_file.read()))
    return default_storage.url(saved_path)


def save_profile_photo(uploaded_file):
    if not uploaded_file:
        return None

    if uploaded_file.size > 5 * 1024 * 1024:
        raise ValueError('Profile photo must be 5MB or smaller.')
    if uploaded_file.content_type and not uploaded_file.content_type.startswith('image/'):
        raise ValueError('Profile photo must be an image file.')

    extension = Path(uploaded_file.name).suffix.lower() or '.jpg'
    filename = f'profile_photos/{secrets.token_urlsafe(16)}{extension}'
    saved_path = default_storage.save(filename, ContentFile(uploaded_file.read()))
    return default_storage.url(saved_path)


def serialize_trainer_application_row(row):
    (
        application_id,
        user_id,
        full_name,
        email,
        phone,
        specialties,
        experience_years,
        certification_file_url,
        certification_file_name,
        bio,
        application_status,
        reviewed_by,
        reviewed_at,
        created_at,
    ) = row

    return {
        'id': application_id,
        'user_id': user_id,
        'full_name': full_name,
        'email': email,
        'phone': phone,
        'specialties': specialties,
        'experience_years': experience_years,
        'certification_file_url': certification_file_url,
        'certification_file_name': certification_file_name,
        'bio': bio,
        'status': application_status,
        'reviewed_by': reviewed_by,
        'reviewed_at': reviewed_at,
        'created_at': created_at,
    }


@api_view(['GET', 'POST'])
def trainer_applications(request):
    if request.method == 'GET':
        requested_status = request.query_params.get('status')
        params = []
        where_clause = ''
        if requested_status:
            where_clause = 'WHERE status = %s'
            params.append(requested_status)

        with connection.cursor() as cursor:
            cursor.execute(
                f'''
                SELECT
                    id,
                    user_id,
                    full_name,
                    email,
                    phone,
                    specialties,
                    experience_years,
                    certification_file_url,
                    certification_file_name,
                    bio,
                    status,
                    reviewed_by,
                    reviewed_at,
                    created_at
                FROM trainer_applications
                {where_clause}
                ORDER BY created_at DESC
                ''',
                params,
            )
            applications = [serialize_trainer_application_row(row) for row in cursor.fetchall()]

        serializer = TrainerApplicationSerializer(applications, many=True)
        return Response(serializer.data)

    serializer = TrainerApplicationCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    uploaded_file = request.FILES.get('certification_file') or request.FILES.get('certifications')

    try:
        certification_file_url = save_certification_file(uploaded_file)
    except ValueError as error:
        return Response({'detail': str(error)}, status=status.HTTP_400_BAD_REQUEST)

    user_id = data.get('user_id')
    normalized_email = data['email'].strip().lower()

    with connection.cursor() as cursor:
        if user_id:
            cursor.execute('SELECT id FROM users WHERE id = %s LIMIT 1', [user_id])
            if not cursor.fetchone():
                return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            cursor.execute('SELECT id FROM users WHERE email = %s LIMIT 1', [normalized_email])
            row = cursor.fetchone()
            user_id = row[0] if row else None

        cursor.execute(
            '''
            INSERT INTO trainer_applications
                (
                    user_id,
                    full_name,
                    email,
                    phone,
                    specialties,
                    experience_years,
                    certification_file_url,
                    certification_file_name,
                    bio,
                    status,
                    created_at
                )
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', NOW(6))
            ''',
            [
                user_id,
                data['full_name'].strip(),
                normalized_email,
                data.get('phone') or None,
                data['specialties'].strip(),
                data.get('experience_years') or 0,
                certification_file_url,
                uploaded_file.name,
                data.get('bio') or None,
            ],
        )
        application_id = cursor.lastrowid

    return Response(
        {
            'detail': 'Trainer application submitted for review.',
            'application_id': application_id,
            'status': 'pending',
            'certification_file_url': certification_file_url,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST', 'PATCH'])
def review_trainer_application(request, application_id):
    serializer = TrainerApplicationReviewSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    review_status = serializer.validated_data['status']
    reviewer_id = serializer.validated_data.get('reviewer_id')

    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT user_id, email FROM trainer_applications WHERE id = %s LIMIT 1',
            [application_id],
        )
        row = cursor.fetchone()
        if not row:
            return Response({'detail': 'Trainer application not found.'}, status=status.HTTP_404_NOT_FOUND)

        application_user_id, application_email = row

        if reviewer_id:
            cursor.execute('SELECT id FROM users WHERE id = %s AND role IN (%s, %s) LIMIT 1', [reviewer_id, 'admin', 'owner'])
            if not cursor.fetchone():
                return Response({'detail': 'Reviewer must be an admin or owner.'}, status=status.HTTP_400_BAD_REQUEST)

        cursor.execute(
            '''
            UPDATE trainer_applications
            SET status = %s, reviewed_by = %s, reviewed_at = NOW(6)
            WHERE id = %s
            ''',
            [review_status, reviewer_id, application_id],
        )

        if review_status == 'approved':
            if application_user_id:
                cursor.execute('UPDATE users SET role = %s WHERE id = %s', ['trainer', application_user_id])
            else:
                cursor.execute('UPDATE users SET role = %s WHERE email = %s', ['trainer', application_email])

    return Response({'detail': f'Trainer application {review_status}.'})


@api_view(['GET'])
def health_check(_request):
    return Response({
        'status': 'ok',
        'service': 'OneGym API',
    })


def serialize_personal_record_row(row):
    (
        record_id,
        user_id,
        exercise_id,
        exercise_name,
        category,
        record_type,
        value,
        unit,
        recorded_at,
        notes,
        created_at,
    ) = row

    return {
        'id': record_id,
        'user_id': user_id,
        'exercise_id': exercise_id,
        'exercise_name': exercise_name,
        'category': category,
        'record_type': record_type,
        'value': value,
        'unit': unit,
        'recorded_at': recorded_at,
        'notes': notes,
        'created_at': created_at,
    }


@api_view(['GET'])
def exercise_list(_request):
    with connection.cursor() as cursor:
        cursor.execute('SELECT id, name, category, default_unit, created_at FROM exercises ORDER BY name')
        exercises = [
            {
                'id': exercise_id,
                'name': name,
                'category': category,
                'default_unit': default_unit,
                'created_at': created_at,
            }
            for exercise_id, name, category, default_unit, created_at in cursor.fetchall()
        ]

    serializer = ExerciseSerializer(exercises, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def user_personal_records(_request, user_id):
    with connection.cursor() as cursor:
        cursor.execute('SELECT id FROM users WHERE id = %s LIMIT 1', [user_id])
        if not cursor.fetchone():
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        cursor.execute(
            '''
            SELECT
                pr.id,
                pr.user_id,
                e.id AS exercise_id,
                e.name AS exercise_name,
                e.category,
                pr.record_type,
                pr.value,
                pr.unit,
                pr.recorded_at,
                pr.notes,
                pr.created_at
            FROM personal_records pr
            INNER JOIN exercises e ON e.id = pr.exercise_id
            WHERE pr.user_id = %s
            ORDER BY pr.recorded_at DESC, pr.id DESC
            ''',
            [user_id],
        )
        records = [serialize_personal_record_row(row) for row in cursor.fetchall()]

    serializer = PersonalRecordSerializer(records, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def create_personal_record(request):
    serializer = PersonalRecordCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    actor = get_authenticated_user(request)
    if not actor:
        return Response({'detail': 'Authentication is required.'}, status=status.HTTP_401_UNAUTHORIZED)
    if actor['role'] not in ['admin', 'owner'] and actor['id'] != data['user_id']:
        return Response({'detail': 'You cannot save records for this user.'}, status=status.HTTP_403_FORBIDDEN)

    exercise_name = data['exercise_name'].strip()
    category = (data.get('category') or '').strip() or None
    unit = data['unit'].strip() or 'kg'
    recorded_at = data.get('recorded_at') or timezone.now()

    with connection.cursor() as cursor:
        cursor.execute('SELECT id FROM users WHERE id = %s LIMIT 1', [data['user_id']])
        if not cursor.fetchone():
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        cursor.execute('SELECT id FROM exercises WHERE name = %s LIMIT 1', [exercise_name])
        exercise_row = cursor.fetchone()
        if exercise_row:
            exercise_id = exercise_row[0]
            if category:
                cursor.execute('UPDATE exercises SET category = COALESCE(category, %s), default_unit = COALESCE(default_unit, %s) WHERE id = %s', [category, unit, exercise_id])
        else:
            cursor.execute(
                'INSERT INTO exercises (name, category, default_unit, created_at) VALUES (%s, %s, %s, NOW(6))',
                [exercise_name, category, unit],
            )
            exercise_id = cursor.lastrowid

        cursor.execute(
            '''
            INSERT INTO personal_records
                (user_id, exercise_id, record_type, value, unit, recorded_at, notes, created_at)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, NOW(6))
            ''',
            [
                data['user_id'],
                exercise_id,
                data['record_type'],
                data['value'],
                unit,
                recorded_at,
                data.get('notes') or None,
            ],
        )
        record_id = cursor.lastrowid

        cursor.execute(
            '''
            SELECT
                pr.id,
                pr.user_id,
                e.id AS exercise_id,
                e.name AS exercise_name,
                e.category,
                pr.record_type,
                pr.value,
                pr.unit,
                pr.recorded_at,
                pr.notes,
                pr.created_at
            FROM personal_records pr
            INNER JOIN exercises e ON e.id = pr.exercise_id
            WHERE pr.id = %s
            LIMIT 1
            ''',
            [record_id],
        )
        record = serialize_personal_record_row(cursor.fetchone())

    return Response(PersonalRecordSerializer(record).data, status=status.HTTP_201_CREATED)


@api_view(['DELETE', 'POST'])
def delete_personal_record(request, record_id=None):
    record_id = record_id or request.data.get('record_id')
    user_id = request.data.get('user_id') or request.query_params.get('user_id')

    if not record_id or not user_id:
        return Response({'detail': 'Record id and user id are required.'}, status=status.HTTP_400_BAD_REQUEST)

    actor = get_authenticated_user(request)
    if not actor:
        return Response({'detail': 'Authentication is required.'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        record_id = int(record_id)
        user_id = int(user_id)
    except (TypeError, ValueError):
        return Response({'detail': 'Record id and user id must be numbers.'}, status=status.HTTP_400_BAD_REQUEST)

    if actor['role'] not in ['admin', 'owner'] and actor['id'] != user_id:
        return Response({'detail': 'You cannot delete this record.'}, status=status.HTTP_403_FORBIDDEN)

    with connection.cursor() as cursor:
        cursor.execute('SELECT id FROM personal_records WHERE id = %s AND user_id = %s LIMIT 1', [record_id, user_id])
        if not cursor.fetchone():
            return Response({'detail': 'Personal record not found.'}, status=status.HTTP_404_NOT_FOUND)

        cursor.execute('DELETE FROM personal_records WHERE id = %s AND user_id = %s', [record_id, user_id])

    return Response({'detail': 'Personal record deleted.'})


@api_view(['GET'])
def user_list(_request):
    with connection.cursor() as cursor:
        cursor.execute(
            '''
            SELECT
                id,
                username,
                email,
                role,
                profile_photo_url,
                fitness_goal,
                training_style,
                weekly_target,
                weight_goal,
                starting_weight,
                current_weight,
                goal_weight,
                weekly_goal,
                calorie_goal,
                protein_goal,
                carbs_goal,
                fats_goal,
                created_at
            FROM users
            ORDER BY id
            '''
        )
        users = [
            {
                'id': user_id,
                'username': username,
                'email': email,
                'role': role,
                'profile_photo_url': profile_photo_url,
                'fitness_goal': fitness_goal,
                'training_style': training_style,
                'weekly_target': weekly_target,
                'weight_goal': weight_goal,
                'starting_weight': starting_weight,
                'current_weight': current_weight,
                'goal_weight': goal_weight,
                'weekly_goal': weekly_goal,
                'calorie_goal': calorie_goal,
                'protein_goal': protein_goal,
                'carbs_goal': carbs_goal,
                'fats_goal': fats_goal,
                'created_at': created_at,
            }
            for (
                user_id,
                username,
                email,
                role,
                profile_photo_url,
                fitness_goal,
                training_style,
                weekly_target,
                weight_goal,
                starting_weight,
                current_weight,
                goal_weight,
                weekly_goal,
                calorie_goal,
                protein_goal,
                carbs_goal,
                fats_goal,
                created_at,
            ) in cursor.fetchall()
        ]

    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)


@api_view(['GET', 'PATCH', 'POST'])
def user_detail(request, user_id):
    if request.method in ['PATCH', 'POST']:
        actor = get_authenticated_user(request)
        if not actor:
            return Response({'detail': 'Authentication is required.'}, status=status.HTTP_401_UNAUTHORIZED)
        if actor['role'] not in ['admin', 'owner'] and actor['id'] != user_id:
            return Response({'detail': 'You cannot edit this profile.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = UserProfileUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        profile_photo_url = None
        uploaded_file = request.FILES.get('profile_photo')
        if uploaded_file:
            try:
                profile_photo_url = save_profile_photo(uploaded_file)
            except ValueError as error:
                return Response({'detail': str(error)}, status=status.HTTP_400_BAD_REQUEST)

        updates = []
        params = []
        for field in [
            'username',
            'fitness_goal',
            'training_style',
            'weekly_target',
            'weight_goal',
            'starting_weight',
            'current_weight',
            'goal_weight',
            'weekly_goal',
            'calorie_goal',
            'protein_goal',
            'carbs_goal',
            'fats_goal',
        ]:
            if field in data:
                updates.append(f'{field} = %s')
                params.append(data[field] if data[field] != '' else None)
        if profile_photo_url:
            updates.append('profile_photo_url = %s')
            params.append(profile_photo_url)

        if updates:
            params.append(user_id)
            with connection.cursor() as cursor:
                if 'username' in data:
                    cursor.execute('SELECT id FROM users WHERE username = %s AND id <> %s LIMIT 1', [data['username'], user_id])
                    if cursor.fetchone():
                        return Response({'detail': 'Username is already taken.'}, status=status.HTTP_400_BAD_REQUEST)
                cursor.execute(f'UPDATE users SET {", ".join(updates)} WHERE id = %s', params)

    with connection.cursor() as cursor:
        cursor.execute(
            '''
            SELECT
                id,
                username,
                email,
                role,
                profile_photo_url,
                fitness_goal,
                training_style,
                weekly_target,
                weight_goal,
                starting_weight,
                current_weight,
                goal_weight,
                weekly_goal,
                calorie_goal,
                protein_goal,
                carbs_goal,
                fats_goal,
                created_at
            FROM users
            WHERE id = %s
            LIMIT 1
            ''',
            [user_id],
        )
        row = cursor.fetchone()

    if not row:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    (
        user_id,
        username,
        email,
        role,
        profile_photo_url,
        fitness_goal,
        training_style,
        weekly_target,
        weight_goal,
        starting_weight,
        current_weight,
        goal_weight,
        weekly_goal,
        calorie_goal,
        protein_goal,
        carbs_goal,
        fats_goal,
        created_at,
    ) = row
    serializer = UserSerializer({
        'id': user_id,
        'username': username,
        'email': email,
        'role': role,
        'profile_photo_url': profile_photo_url,
        'fitness_goal': fitness_goal,
        'training_style': training_style,
        'weekly_target': weekly_target,
        'weight_goal': weight_goal,
        'starting_weight': starting_weight,
        'current_weight': current_weight,
        'goal_weight': goal_weight,
        'weekly_goal': weekly_goal,
        'calorie_goal': calorie_goal,
        'protein_goal': protein_goal,
        'carbs_goal': carbs_goal,
        'fats_goal': fats_goal,
        'created_at': created_at,
    })
    return Response(serializer.data)


@api_view(['GET', 'POST'])
def class_list(request):
    if request.method == 'POST':
        user = get_authenticated_user(request)
        if not user:
            return Response({'detail': 'Authentication is required.'}, status=status.HTTP_401_UNAUTHORIZED)

        if user['role'] not in ['trainer', 'admin', 'owner']:
            return Response({'detail': 'Only approved trainers can create classes.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = FitnessClassCreateSerializer(data={
            **request.data,
            'trainer_id': user['id'],
        })
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        raw_schedule_time = str(request.data.get('schedule_time') or '')

        try:
            local_schedule_time = datetime.fromisoformat(raw_schedule_time)
        except ValueError:
            return Response({'detail': 'Class time is invalid.'}, status=status.HTTP_400_BAD_REQUEST)

        if local_schedule_time.tzinfo is not None:
            local_schedule_time = timezone.localtime(local_schedule_time).replace(tzinfo=None)

        if local_schedule_time <= datetime.now():
            return Response({'detail': 'Class time must be in the future.'}, status=status.HTTP_400_BAD_REQUEST)

        with connection.cursor() as cursor:
            cursor.execute(
                '''
                INSERT INTO classes
                    (trainer_id, title, instructor_name, room, schedule_time, slots)
                VALUES
                    (%s, %s, %s, %s, %s, %s)
                ''',
                [
                    user['id'],
                    data['title'],
                    user['username'],
                    data['room'],
                    local_schedule_time,
                    data['slots'],
                ],
            )
            class_id = cursor.lastrowid

        return Response(
            {
                'detail': 'Class created successfully.',
                'class_id': class_id,
            },
            status=status.HTTP_201_CREATED,
        )

    with connection.cursor() as cursor:
        cursor.execute(
            '''
            SELECT
                c.id,
                c.trainer_id,
                c.title,
                COALESCE(u.username, c.instructor_name) AS instructor_name,
                c.room,
                c.schedule_time,
                c.slots,
                COUNT(cb.id) AS booked_slots
            FROM classes c
            LEFT JOIN users u ON u.id = c.trainer_id
            LEFT JOIN class_bookings cb ON cb.class_id = c.id
            WHERE c.schedule_time >= NOW()
            GROUP BY c.id, c.trainer_id, c.title, u.username, c.instructor_name, c.room, c.schedule_time, c.slots
            ORDER BY c.schedule_time
            '''
        )
        classes = [
            {
                'id': class_id,
                'trainer_id': trainer_id,
                'title': title,
                'instructor_name': instructor_name,
                'room': room,
                'schedule_time': schedule_time,
                'slots': slots,
                'booked_slots': booked_slots,
                'available_slots': max(slots - booked_slots, 0),
            }
            for class_id, trainer_id, title, instructor_name, room, schedule_time, slots, booked_slots in cursor.fetchall()
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
                c.trainer_id,
                c.title,
                COALESCE(u.username, c.instructor_name) AS instructor_name,
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
            LEFT JOIN users u ON u.id = c.trainer_id
            WHERE cb.user_id = %s
                AND c.schedule_time >= NOW()
            ORDER BY c.schedule_time
            ''',
            [user_id],
        )
        bookings = [
            {
                'id': booking_id,
                'class_id': class_id,
                'trainer_id': trainer_id,
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
                trainer_id,
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

        query = '''
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
            WHERE user_id = %s
        '''
        params = [user_id]

        if request.query_params.get('limit') != 'all':
            query += ' AND DATE(meal_date) = %s'
            params.append(request.query_params.get('date') or timezone.localdate())

        query += ' ORDER BY meal_date DESC, created_at DESC'
        cursor.execute(query, params)
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


@api_view(['POST', 'PATCH', 'PUT'])
def update_meal(request, meal_id=None):
    meal_id = meal_id or request.data.get('meal_id') or request.query_params.get('meal_id')
    user_id = request.data.get('user_id') or request.query_params.get('user_id')

    if not user_id:
        return Response({'detail': 'User id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        meal_id = int(meal_id)
    except (TypeError, ValueError):
        return Response({'detail': 'Valid meal id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = MealCreateSerializer(data={
        'user_id': user_id,
        'meal_type': request.data.get('meal_type') or 'Meal',
        'description': request.data.get('description'),
        'calories': request.data.get('calories'),
        'protein_g': request.data.get('protein_g'),
        'carbs_g': request.data.get('carbs_g'),
        'fats_g': request.data.get('fats_g'),
        'photo_url': request.data.get('photo_url') or '',
    })
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT id FROM meals WHERE id = %s AND user_id = %s LIMIT 1',
            [meal_id, user_id],
        )
        if not cursor.fetchone():
            return Response({'detail': 'Meal not found.'}, status=status.HTTP_404_NOT_FOUND)

        cursor.execute(
            '''
            UPDATE meals
            SET
                meal_type = %s,
                description = %s,
                calories = %s,
                protein_g = %s,
                carbs_g = %s,
                fats_g = %s
            WHERE id = %s AND user_id = %s
            ''',
            [
                data.get('meal_type') or 'Meal',
                data['description'],
                data['calories'],
                data.get('protein_g'),
                data.get('carbs_g'),
                data.get('fats_g'),
                meal_id,
                user_id,
            ],
        )

    return Response({'detail': 'Meal updated.'})


@api_view(['DELETE', 'POST'])
def delete_meal(request, meal_id=None):
    meal_id = meal_id or request.data.get('meal_id') or request.query_params.get('meal_id')
    user_id = request.data.get('user_id') or request.query_params.get('user_id')

    if not user_id:
        return Response({'detail': 'User id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        meal_id = int(meal_id)
    except (TypeError, ValueError):
        return Response({'detail': 'Valid meal id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT id FROM meals WHERE id = %s AND user_id = %s LIMIT 1',
            [meal_id, user_id],
        )
        if not cursor.fetchone():
            return Response({'detail': 'Meal not found.'}, status=status.HTTP_404_NOT_FOUND)

        cursor.execute(
            'DELETE FROM meals WHERE id = %s AND user_id = %s',
            [meal_id, user_id],
        )

    return Response({'detail': 'Meal deleted.'})


def password_matches(raw_password, stored_password):
    try:
        identify_hasher(stored_password)
    except ValueError:
        return raw_password == stored_password

    return check_password(raw_password, stored_password)


def hash_token(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def create_auth_token(user_id):
    token = secrets.token_urlsafe(48)
    expires_at = timezone.now() + AUTH_TOKEN_LIFETIME

    with connection.cursor() as cursor:
        cursor.execute(
            '''
            INSERT INTO auth_tokens (user_id, token_hash, expires_at, created_at)
            VALUES (%s, %s, %s, NOW(6))
            ''',
            [user_id, hash_token(token), expires_at],
        )

    return token


def build_auth_response(user, response_status=status.HTTP_200_OK):
    token = create_auth_token(user['id'])
    response = Response({'user': user}, status=response_status)
    response.set_cookie(
        AUTH_COOKIE_NAME,
        token,
        max_age=int(AUTH_TOKEN_LIFETIME.total_seconds()),
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Lax',
        path='/',
    )
    return response


def get_authenticated_user(request):
    header = request.headers.get('Authorization', '')
    prefix = 'Bearer '
    token = request.COOKIES.get(AUTH_COOKIE_NAME, '')
    if header.startswith(prefix):
        token = header[len(prefix):].strip()
    if not token:
        return None

    with connection.cursor() as cursor:
        cursor.execute(
            '''
            SELECT u.id, u.username, u.email, u.role, u.created_at
            FROM auth_tokens t
            INNER JOIN users u ON u.id = t.user_id
            WHERE t.token_hash = %s
                AND t.expires_at > NOW(6)
                AND t.revoked_at IS NULL
            LIMIT 1
            ''',
            [hash_token(token)],
        )
        row = cursor.fetchone()

    if not row:
        return None

    user_id, username, email, role, created_at = row
    return {
        'id': user_id,
        'username': username,
        'email': email,
        'role': role,
        'created_at': created_at,
    }


@api_view(['POST'])
def sign_out(request):
    token = request.COOKIES.get(AUTH_COOKIE_NAME, '')
    if token:
        with connection.cursor() as cursor:
            cursor.execute(
                'UPDATE auth_tokens SET revoked_at = NOW(6) WHERE token_hash = %s',
                [hash_token(token)],
            )

    response = Response({'detail': 'Signed out.'})
    response.delete_cookie(AUTH_COOKIE_NAME, path='/', samesite='Lax')
    return response


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

    return build_auth_response(
        {
            'id': user_id,
            'username': username,
            'email': email,
            'role': role,
            'created_at': created_at,
        },
        status.HTTP_201_CREATED,
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

    return build_auth_response(
        {
            'id': user_id,
            'username': username,
            'email': user_email,
            'role': role,
            'created_at': created_at,
        },
    )


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
    return build_auth_response(user)


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
