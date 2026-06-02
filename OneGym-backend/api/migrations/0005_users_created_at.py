from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_workout_workoutexercise_meal'),
    ]

    operations = [
        migrations.RunSQL(
            sql='ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)',
            reverse_sql='ALTER TABLE users DROP COLUMN IF EXISTS created_at',
        ),
    ]
