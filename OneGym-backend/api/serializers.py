from rest_framework import serializers


class UserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.CharField()


class FitnessClassSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    instructor_name = serializers.CharField()
    room = serializers.CharField()
    schedule_time = serializers.DateTimeField()
    slots = serializers.IntegerField()
    booked_slots = serializers.IntegerField()
    available_slots = serializers.IntegerField()


class ClassBookingSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    class_id = serializers.IntegerField()
    title = serializers.CharField()
    instructor_name = serializers.CharField()
    room = serializers.CharField()
    schedule_time = serializers.DateTimeField()
    slots = serializers.IntegerField()
    booked_slots = serializers.IntegerField()
    available_slots = serializers.IntegerField()
    booked_at = serializers.DateTimeField()


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
