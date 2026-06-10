from django.db import models


class User(models.Model):
    ROLE_CHOICES = [
        ('member', 'Member'),
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
