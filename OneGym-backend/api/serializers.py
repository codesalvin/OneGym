from rest_framework import serializers


class UserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.CharField()
    created_at = serializers.DateTimeField()


class FitnessClassSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    trainer_id = serializers.IntegerField(allow_null=True)
    title = serializers.CharField()
    instructor_name = serializers.CharField()
    room = serializers.CharField()
    schedule_time = serializers.DateTimeField()
    slots = serializers.IntegerField()
    booked_slots = serializers.IntegerField()
    available_slots = serializers.IntegerField()


class FitnessClassCreateSerializer(serializers.Serializer):
    trainer_id = serializers.IntegerField()
    title = serializers.CharField(max_length=255)
    room = serializers.CharField(max_length=100)
    schedule_time = serializers.DateTimeField()
    slots = serializers.IntegerField(min_value=1, max_value=500)

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Class title is required.')

        return value

    def validate_room(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Room is required.')

        return value


class ClassBookingSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    class_id = serializers.IntegerField()
    trainer_id = serializers.IntegerField(allow_null=True)
    title = serializers.CharField()
    instructor_name = serializers.CharField()
    room = serializers.CharField()
    schedule_time = serializers.DateTimeField()
    slots = serializers.IntegerField()
    booked_slots = serializers.IntegerField()
    available_slots = serializers.IntegerField()
    booked_at = serializers.DateTimeField()


class WorkoutExerciseInputSerializer(serializers.Serializer):
    exercise_name = serializers.CharField(max_length=150)
    sets = serializers.IntegerField(min_value=0)
    reps = serializers.IntegerField(min_value=0)
    weight = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0)

    def validate_exercise_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Exercise name is required.')

        return value


class WorkoutCreateSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    name = serializers.CharField(max_length=150)
    duration_minutes = serializers.IntegerField(min_value=1)
    intensity = serializers.ChoiceField(choices=['low', 'moderate', 'high'])
    calories_burned = serializers.IntegerField(min_value=0)
    workout_date = serializers.DateTimeField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    exercises = WorkoutExerciseInputSerializer(many=True)

    def validate_exercises(self, value):
        if not value:
            raise serializers.ValidationError('At least one exercise is required.')

        return value


class WorkoutSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    duration_minutes = serializers.IntegerField()
    intensity = serializers.CharField()
    calories_burned = serializers.IntegerField()
    workout_date = serializers.DateTimeField()
    created_at = serializers.DateTimeField()
    exercise_count = serializers.IntegerField()


class MealCreateSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    meal_type = serializers.CharField(max_length=50, default='Meal')
    description = serializers.CharField(max_length=255)
    calories = serializers.IntegerField(min_value=0)
    protein_g = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0, required=False, allow_null=True)
    carbs_g = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0, required=False, allow_null=True)
    fats_g = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0, required=False, allow_null=True)
    photo_url = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)


class MealSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    meal_type = serializers.CharField()
    description = serializers.CharField()
    calories = serializers.IntegerField()
    protein_g = serializers.DecimalField(max_digits=6, decimal_places=2, allow_null=True)
    carbs_g = serializers.DecimalField(max_digits=6, decimal_places=2, allow_null=True)
    fats_g = serializers.DecimalField(max_digits=6, decimal_places=2, allow_null=True)
    photo_url = serializers.CharField(allow_blank=True, allow_null=True)
    meal_date = serializers.DateTimeField()
    created_at = serializers.DateTimeField()


class TrainerApplicationCreateSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=False, allow_null=True)
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True, allow_null=True)
    specialties = serializers.CharField(max_length=255)
    experience_years = serializers.IntegerField(min_value=0, max_value=80, default=0)
    bio = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_full_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Full name is required.')

        return value

    def validate_specialties(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('At least one specialty is required.')

        return value


class TrainerApplicationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    user_id = serializers.IntegerField(allow_null=True)
    full_name = serializers.CharField()
    email = serializers.EmailField()
    phone = serializers.CharField(allow_blank=True, allow_null=True)
    specialties = serializers.CharField()
    experience_years = serializers.IntegerField()
    certification_file_url = serializers.CharField()
    certification_file_name = serializers.CharField()
    bio = serializers.CharField(allow_blank=True, allow_null=True)
    status = serializers.CharField()
    reviewed_by = serializers.IntegerField(allow_null=True)
    reviewed_at = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField()


class TrainerApplicationReviewSerializer(serializers.Serializer):
    reviewer_id = serializers.IntegerField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=['approved', 'rejected'])


class TrainerChatMessageSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    sender_id = serializers.IntegerField()
    sender_name = serializers.CharField()
    recipient_id = serializers.IntegerField()
    recipient_name = serializers.CharField()
    body = serializers.CharField()
    read_at = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField()


class TrainerChatConversationSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.CharField()
    last_message = serializers.CharField()
    last_message_at = serializers.DateTimeField()
    unread_count = serializers.IntegerField()


class SignUpSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(max_length=255, write_only=True)
    role = serializers.CharField(max_length=20, default='member')


class SignInSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(max_length=255, write_only=True)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    code = serializers.CharField(max_length=6)
    password = serializers.CharField(max_length=255, write_only=True)


class SocialAuthSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=['google'])
    id_token = serializers.CharField(required=False, allow_blank=True)
    access_token = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get('id_token') and not attrs.get('access_token'):
            raise serializers.ValidationError('Google token is required.')

        return attrs
