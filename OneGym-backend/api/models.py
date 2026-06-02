from django.db import models


class User(models.Model):
    ROLE_CHOICES = [
        ('member', 'Member'),
        ('trainer', 'Trainer'),
        ('admin', 'Admin'),
    ]

    id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(max_length=254, unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
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
