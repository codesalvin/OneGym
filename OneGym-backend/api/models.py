from django.db import models


class User(models.Model):
    ROLE_CHOICES = [
        ('member', 'Member'),
        ('pro', 'Pro Member'),
        ('studio', 'Studio Member'),
        ('trainer', 'Trainer'),
        ('admin', 'Admin'),
        ('owner', 'Owner'),
    ]

    id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(max_length=254, unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    profile_photo_url = models.CharField(max_length=255, blank=True, null=True)
    fitness_goal = models.CharField(max_length=255, blank=True, null=True)
    training_style = models.CharField(max_length=80, blank=True, null=True)
    weekly_target = models.PositiveIntegerField(blank=True, null=True)
    weight_goal = models.CharField(max_length=80, blank=True, null=True)
    starting_weight = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    current_weight = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    goal_weight = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    weekly_goal = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    calorie_goal = models.PositiveIntegerField(blank=True, null=True)
    protein_goal = models.PositiveIntegerField(blank=True, null=True)
    carbs_goal = models.PositiveIntegerField(blank=True, null=True)
    fats_goal = models.PositiveIntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'users'

    def __str__(self):
        return self.username


class PasswordResetCode(models.Model):
    email = models.EmailField(max_length=254, db_index=True)
    code_hash = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'password_reset_codes'
        ordering = ['-created_at']


class Plan(models.Model):
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=80)
    price_cents = models.PositiveIntegerField(default=0)
    currency = models.CharField(max_length=10, default='MYR')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'plans'
        ordering = ['price_cents']

    def __str__(self):
        return self.name


class UserSubscription(models.Model):
    STATUS_CHOICES = [
        ('free', 'Free'),
        ('active', 'Active'),
        ('trialing', 'Trialing'),
        ('past_due', 'Past due'),
        ('canceled', 'Canceled'),
    ]

    user = models.ForeignKey(User, models.CASCADE, db_column='user_id', related_name='subscriptions')
    plan = models.ForeignKey(Plan, models.PROTECT, db_column='plan_id')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='free')
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_subscription_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_payment_link_id = models.CharField(max_length=255, blank=True, null=True)
    current_period_start = models.DateTimeField(blank=True, null=True)
    current_period_end = models.DateTimeField(blank=True, null=True)
    canceled_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_subscriptions'
        ordering = ['-created_at']


class PaymentEvent(models.Model):
    user = models.ForeignKey(User, models.SET_NULL, db_column='user_id', blank=True, null=True)
    stripe_event_id = models.CharField(max_length=255, unique=True)
    event_type = models.CharField(max_length=120)
    payload_json = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payment_events'
        ordering = ['-created_at']


class FitnessClass(models.Model):
    trainer = models.ForeignKey(User, models.SET_NULL, db_column='trainer_id', blank=True, null=True, related_name='classes')
    title = models.CharField(max_length=255)
    instructor_name = models.CharField(max_length=150)
    room = models.CharField(max_length=100)
    schedule_time = models.DateTimeField()
    slots = models.PositiveIntegerField(default=12)

    class Meta:
        db_table = 'classes'
        ordering = ['schedule_time']

    def __str__(self):
        return self.title


class ClassBooking(models.Model):
    user = models.ForeignKey(User, models.DO_NOTHING, db_column='user_id')
    fitness_class = models.ForeignKey(FitnessClass, models.CASCADE, db_column='class_id')
    booked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'class_bookings'
        unique_together = (('user', 'fitness_class'),)
        ordering = ['-booked_at']


class Workout(models.Model):
    INTENSITY_CHOICES = [
        ('low', 'Gentle / Restorative'),
        ('moderate', 'Moderate / Flow'),
        ('high', 'High / Peak Power'),
    ]

    user = models.ForeignKey(User, models.CASCADE, db_column='user_id')
    name = models.CharField(max_length=150)
    duration_minutes = models.PositiveIntegerField()
    intensity = models.CharField(max_length=30, choices=INTENSITY_CHOICES)
    calories_burned = models.PositiveIntegerField()
    workout_date = models.DateTimeField()
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workouts'
        ordering = ['-workout_date']

    def __str__(self):
        return self.name


class WorkoutExercise(models.Model):
    workout = models.ForeignKey(Workout, models.CASCADE, db_column='workout_id', related_name='exercises')
    exercise_name = models.CharField(max_length=150)
    sets = models.PositiveIntegerField()
    reps = models.PositiveIntegerField()
    weight = models.DecimalField(max_digits=6, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workout_exercises'
        ordering = ['id']

    def __str__(self):
        return self.exercise_name


class Exercise(models.Model):
    name = models.CharField(max_length=150, unique=True)
    category = models.CharField(max_length=80, blank=True, null=True)
    default_unit = models.CharField(max_length=30, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'exercises'
        ordering = ['name']

    def __str__(self):
        return self.name


class PersonalRecord(models.Model):
    user = models.ForeignKey(User, models.CASCADE, db_column='user_id')
    exercise = models.ForeignKey(Exercise, models.CASCADE, db_column='exercise_id')
    record_type = models.CharField(max_length=50)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=30)
    recorded_at = models.DateTimeField()
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=30, default='auto_accepted')
    is_verified = models.BooleanField(default=True)
    verification_reason = models.CharField(max_length=255, blank=True, null=True)
    proof_url = models.CharField(max_length=255, blank=True, null=True)
    proof_file_name = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'personal_records'
        ordering = ['-recorded_at']


class Meal(models.Model):
    user = models.ForeignKey(User, models.CASCADE, db_column='user_id')
    meal_type = models.CharField(max_length=50)
    description = models.CharField(max_length=255)
    calories = models.PositiveIntegerField()
    protein_g = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    carbs_g = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    fats_g = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    photo_url = models.CharField(max_length=255, blank=True, null=True)
    meal_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'meals'
        ordering = ['-meal_date']

    def __str__(self):
        return f'{self.meal_type}: {self.description}'


class TrainerApplication(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    user = models.ForeignKey(User, models.SET_NULL, db_column='user_id', blank=True, null=True, related_name='trainer_applications')
    full_name = models.CharField(max_length=150)
    email = models.EmailField(max_length=254)
    phone = models.CharField(max_length=40, blank=True, null=True)
    specialties = models.CharField(max_length=255)
    experience_years = models.PositiveIntegerField(default=0)
    certification_file_url = models.CharField(max_length=255)
    certification_file_name = models.CharField(max_length=255)
    bio = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reviewed_by = models.ForeignKey(User, models.SET_NULL, db_column='reviewed_by', blank=True, null=True, related_name='reviewed_trainer_applications')
    reviewed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'trainer_applications'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.full_name} ({self.status})'



# Normalized target-ERD models. Existing compatibility models above remain in
# place while API queries are migrated away from legacy columns.
class Role(models.Model):
    name = models.CharField(max_length=30, unique=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'roles'


class AuthToken(models.Model):
    user = models.ForeignKey(User, models.CASCADE, db_column='user_id')
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'auth_tokens'


class AdminAuditLog(models.Model):
    actor_user = models.ForeignKey(User, models.SET_NULL, db_column='actor_user_id', blank=True, null=True)
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=100)
    entity_id = models.PositiveBigIntegerField(blank=True, null=True)
    details_json = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'admin_audit_logs'


class MemberProfile(models.Model):
    user = models.OneToOneField(User, models.CASCADE, db_column='user_id', primary_key=True)
    display_name = models.CharField(max_length=150, blank=True, null=True)
    profile_photo_url = models.CharField(max_length=500, blank=True, null=True)
    fitness_goal = models.CharField(max_length=255, blank=True, null=True)
    training_style = models.CharField(max_length=80, blank=True, null=True)
    weekly_target = models.PositiveIntegerField(blank=True, null=True)
    weight_goal = models.CharField(max_length=80, blank=True, null=True)
    starting_weight = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    goal_weight = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'member_profiles'


class ProgressMeasurement(models.Model):
    user = models.ForeignKey(User, models.CASCADE, db_column='user_id')
    weight_kg = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    body_fat_pct = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    muscle_mass_kg = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    recorded_at = models.DateTimeField()

    class Meta:
        db_table = 'progress_measurements'


class AIChatMessage(models.Model):
    user = models.ForeignKey(User, models.CASCADE, db_column='user_id')
    role = models.CharField(max_length=20)
    title = models.CharField(max_length=255, blank=True, null=True)
    body = models.TextField()
    cards_json = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_chat_messages'


class Notification(models.Model):
    user = models.ForeignKey(User, models.CASCADE, db_column='user_id')
    notification_type = models.CharField(max_length=80)
    title = models.CharField(max_length=255)
    body = models.TextField()
    read_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'


class ClassAttendance(models.Model):
    booking = models.OneToOneField(ClassBooking, models.CASCADE, db_column='booking_id')
    recorded_by = models.ForeignKey(User, models.SET_NULL, db_column='recorded_by', blank=True, null=True)
    attendance_status = models.CharField(max_length=30)
    checked_in_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'class_attendance'


class ClassReview(models.Model):
    fitness_class = models.ForeignKey(FitnessClass, models.CASCADE, db_column='class_id')
    reviewer = models.ForeignKey(User, models.CASCADE, db_column='reviewer_id')
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'class_reviews'
        unique_together = (('fitness_class', 'reviewer'),)


class TrainingProgram(models.Model):
    trainer = models.ForeignKey(User, models.CASCADE, db_column='trainer_id', related_name='programs_created')
    client = models.ForeignKey(User, models.CASCADE, db_column='client_id', related_name='training_programs')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=30, default='active')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'training_programs'


class ProgramExercise(models.Model):
    program = models.ForeignKey(TrainingProgram, models.CASCADE, db_column='program_id')
    exercise = models.ForeignKey(Exercise, models.PROTECT, db_column='exercise_id')
    day_number = models.PositiveIntegerField()
    sets = models.PositiveIntegerField(blank=True, null=True)
    reps = models.PositiveIntegerField(blank=True, null=True)
    target_value = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'program_exercises'


class TrainingSession(models.Model):
    trainer = models.ForeignKey(User, models.CASCADE, db_column='trainer_id', related_name='sessions_as_trainer')
    client = models.ForeignKey(User, models.CASCADE, db_column='client_id', related_name='sessions_as_client')
    program = models.ForeignKey(TrainingProgram, models.SET_NULL, db_column='program_id', blank=True, null=True)
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField()
    status = models.CharField(max_length=30, default='scheduled')
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'training_sessions'


class NutritionGoal(models.Model):
    user = models.ForeignKey(User, models.CASCADE, db_column='user_id')
    calorie_goal = models.PositiveIntegerField(blank=True, null=True)
    protein_goal = models.PositiveIntegerField(blank=True, null=True)
    carbs_goal = models.PositiveIntegerField(blank=True, null=True)
    fats_goal = models.PositiveIntegerField(blank=True, null=True)
    effective_from = models.DateField()
    effective_to = models.DateField(blank=True, null=True)

    class Meta:
        db_table = 'nutrition_goals'


class TrainerClient(models.Model):
    trainer = models.ForeignKey(User, models.CASCADE, db_column='trainer_id', related_name='assigned_clients')
    member = models.ForeignKey(User, models.CASCADE, db_column='member_id', related_name='assigned_trainers')
    assigned_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=30, default='active')
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'trainer_clients'
        unique_together = (('trainer', 'member'),)


class TrainerReview(models.Model):
    trainer = models.ForeignKey(User, models.CASCADE, db_column='trainer_id', related_name='trainer_reviews')
    reviewer = models.ForeignKey(User, models.CASCADE, db_column='reviewer_id', related_name='trainer_reviews_written')
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'trainer_reviews'
        unique_together = (('trainer', 'reviewer'),)


class Payment(models.Model):
    user = models.ForeignKey(User, models.CASCADE, db_column='user_id')
    subscription = models.ForeignKey(UserSubscription, models.SET_NULL, db_column='subscription_id', blank=True, null=True)
    stripe_payment_id = models.CharField(max_length=255, unique=True)
    amount_cents = models.PositiveIntegerField()
    currency = models.CharField(max_length=10)
    status = models.CharField(max_length=30)
    paid_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payments'
