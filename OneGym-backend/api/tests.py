from unittest.mock import patch
import json

from django.test import SimpleTestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.hashers import make_password
from rest_framework.test import APIRequestFactory

from . import views


class UserDataAuthorizationTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def assert_authentication_required(self, view, request, *args):
        with patch.object(views, 'get_authenticated_user', return_value=None):
            response = view(request, *args)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['detail'], 'Authentication is required.')

    def test_user_list_requires_authentication(self):
        self.assert_authentication_required(
            views.user_list,
            self.factory.get('/api/users/'),
        )

    def test_profile_requires_authentication(self):
        self.assert_authentication_required(
            views.user_detail,
            self.factory.get('/api/users/2/'),
            2,
        )

    def test_ai_history_requires_authentication(self):
        self.assert_authentication_required(
            views.user_ai_chat_messages,
            self.factory.get('/api/users/2/ai-messages/'),
            2,
        )

    def test_bookings_require_authentication(self):
        self.assert_authentication_required(
            views.user_bookings,
            self.factory.get('/api/users/2/bookings/'),
            2,
        )

    def test_workouts_require_authentication(self):
        self.assert_authentication_required(
            views.user_workouts,
            self.factory.get('/api/users/2/workouts/'),
            2,
        )

    def test_meals_require_authentication(self):
        self.assert_authentication_required(
            views.user_meals,
            self.factory.get('/api/users/2/meals/'),
            2,
        )

    def test_member_cannot_read_another_profile(self):
        actor = {'id': 1, 'role': 'member', 'username': 'member'}
        with patch.object(views, 'get_authenticated_user', return_value=actor):
            response = views.user_detail(self.factory.get('/api/users/2/'), 2)
        self.assertEqual(response.status_code, 403)

    def test_leaderboard_requires_authentication(self):
        self.assert_authentication_required(
            views.leaderboard,
            self.factory.get('/api/leaderboard/'),
        )

    def test_reviews_require_authentication(self):
        self.assert_authentication_required(
            views.reviews,
            self.factory.get('/api/reviews/'),
        )

    def test_attendance_requires_authentication(self):
        self.assert_authentication_required(
            views.class_attendance,
            self.factory.get('/api/classes/1/attendance/'),
            1,
        )

    def test_support_ticket_validates_required_fields(self):
        with patch.object(views, 'get_authenticated_user', return_value=None):
            response = views.support_tickets(self.factory.post('/api/support-tickets/', {}, format='json'))
        self.assertEqual(response.status_code, 400)


class SecurityHelperTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_password_matches_django_hash(self):
        self.assertTrue(views.password_matches('safe-password', make_password('safe-password')))
        self.assertFalse(views.password_matches('wrong-password', make_password('safe-password')))

    def test_image_validation_rejects_fake_image(self):
        uploaded = SimpleUploadedFile('photo.jpg', b'<!doctype html>', content_type='image/jpeg')
        with self.assertRaisesMessage(ValueError, 'must be a valid JPG, PNG, or WEBP image'):
            views.validate_image_upload(uploaded, 1024, 'Profile photo')

    def test_image_validation_accepts_png_signature(self):
        uploaded = SimpleUploadedFile(
            'photo.png',
            b'\x89PNG\r\n\x1a\n' + b'\x00' * 16,
            content_type='image/png',
        )
        self.assertEqual(views.validate_image_upload(uploaded, 1024, 'Profile photo'), ('.png', 'image/png'))

    def test_member_cannot_create_workout_for_another_user(self):
        request = self.factory.post('/api/workouts/', {
            'user_id': 2,
            'name': 'Test workout',
            'duration_minutes': 30,
            'intensity': 'moderate',
            'calories_burned': 100,
            'exercises': [{
                'exercise_name': 'Squat',
                'sets': 3,
                'reps': 8,
                'weight': '40.00',
            }],
        }, format='json')
        actor = {'id': 1, 'role': 'member', 'username': 'member'}
        with patch.object(views, 'get_authenticated_user', return_value=actor):
            response = views.create_workout(request)
        self.assertEqual(response.status_code, 403)

    def test_member_cannot_delete_another_users_meal(self):
        request = self.factory.delete('/api/meals/4/?user_id=2')
        actor = {'id': 1, 'role': 'member', 'username': 'member'}
        with patch.object(views, 'get_authenticated_user', return_value=actor):
            response = views.delete_meal(request, 4)
        self.assertEqual(response.status_code, 403)


class GeminiResponseTests(SimpleTestCase):
    def test_nutrition_payload_requests_complete_json(self):
        payload = views.build_gemini_image_payload('encoded-image', 'image/jpeg')
        config = payload['generationConfig']

        self.assertEqual(config['responseMimeType'], 'application/json')
        self.assertEqual(
            config['responseJsonSchema']['required'],
            ['description', 'calories', 'protein_g', 'carbs_g', 'fats_g'],
        )

    def test_normalize_food_estimate_calculates_missing_calories(self):
        estimate = views.normalize_food_estimate({
            'description': 'Chicken rice',
            'protein_g': 35,
            'carbs_g': 70,
            'fats_g': 18,
        })

        self.assertEqual(estimate['calories'], 582)
        self.assertEqual(estimate['protein_g'], 35)
        self.assertEqual(estimate['carbs_g'], 70)
        self.assertEqual(estimate['fats_g'], 18)

    @override_settings(GEMINI_API_KEY='test', GEMINI_MODEL='test-model')
    def test_photo_retries_missing_macro_and_accepts_explicit_zero(self):
        photo = SimpleUploadedFile('meal.jpg', b'\xff\xd8\xff\x00', content_type='image/jpeg')
        estimate = {'description': 'Apple slices', 'calories': 80, 'protein_g': 0, 'carbs_g': 21}
        complete = {**estimate, 'fats_g': 0}

        def gemini_response(data):
            return {'candidates': [{'content': {'parts': [{'text': json.dumps(data)}]}}]}

        with patch.object(views, 'post_gemini_generate', side_effect=map(gemini_response, [estimate, complete])) as generate:
            result = views.analyze_food_image(photo)

        self.assertEqual(generate.call_count, 2)
        self.assertEqual(result['calories'], 80)
        self.assertEqual(result['fats_g'], 0)

    def test_assistant_uses_saved_targets_and_requests_missing_profile(self):
        totals = {'calories': 600, 'protein_g': 20, 'carbs_g': 40, 'fats_g': 10}
        general = views.build_assistant_prompt('Suggest dinner', [], totals)
        self.assertIn('ask the member to save these missing fields in Profile', general)
        self.assertIn('Starting weight (kg): not provided', general)
        self.assertIn('no saved target', general)
        self.assertNotIn('2500', general)

        personalized = views.build_assistant_prompt('Suggest dinner', [], totals, {
            'weekly_goal': 0, 'starting_weight': 76, 'current_weight': 74, 'goal_weight': 74,
            'weight_goal': 'Maintain weight', 'calorie_goal': 2100,
        })
        self.assertIn('Weekly weight change (kg/week): 0', personalized)
        self.assertIn('Starting weight (kg): 76', personalized)
        self.assertIn('Current weight (kg): 74', personalized)
        self.assertIn('Goal weight (kg): 74', personalized)
        self.assertIn('Tailor suggestions to the saved profile', personalized)
        self.assertIn('Weight goal: Maintain weight', personalized)
        self.assertIn('saved target 2100, remaining 1500', personalized)

    def test_assistant_parser_does_not_treat_macros_as_nutrition_photo(self):
        reply = views.parse_assistant_reply(json.dumps({
            'summary': 'Add a protein-rich snack after training.',
            'cards': [{
                'label': 'SNACK',
                'title': 'Greek yogurt',
                'detail': 'Provides protein without many calories.',
            }],
        }))

        self.assertEqual(reply['summary'], 'Add a protein-rich snack after training.')
        self.assertEqual(reply['cards'][0]['title'], 'Greek yogurt')

    def test_assistant_payload_requires_useful_card_content(self):
        payload = views.build_gemini_assistant_payload('Help me recover after training')
        card_schema = payload['generationConfig']['responseJsonSchema']['properties']['cards']['items']

        self.assertEqual(card_schema['required'], ['label', 'title', 'detail'])
        self.assertGreaterEqual(payload['generationConfig']['maxOutputTokens'], 1200)

    def test_generic_assistant_summary_uses_card_detail(self):
        reply = views.parse_assistant_reply(json.dumps({
            'summary': 'Your recommendation is ready below.',
            'cards': [{
                'label': 'RECOVERY',
                'title': 'Eat after training',
                'detail': 'Have protein and carbohydrates within two hours.',
            }],
        }))

        self.assertEqual(reply['summary'], 'Have protein and carbohydrates within two hours.')

    def test_nutrition_retry_prompt_does_not_contradict_json_response(self):
        prompt = views.build_nutrition_retry_prompt('Chicken and rice, calories 500')

        self.assertIn('protein_g', prompt)
        self.assertNotIn('Do not write JSON', prompt)

