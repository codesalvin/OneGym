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
