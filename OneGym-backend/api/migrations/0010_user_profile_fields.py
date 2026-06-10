from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_trainer_chat_messages'),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
                ALTER TABLE users
                    ADD COLUMN profile_photo_url VARCHAR(255) NULL,
                    ADD COLUMN fitness_goal VARCHAR(255) NULL,
                    ADD COLUMN training_style VARCHAR(80) NULL,
                    ADD COLUMN weekly_target INT NULL
            ''',
            reverse_sql='''
                ALTER TABLE users
                    DROP COLUMN weekly_target,
                    DROP COLUMN training_style,
                    DROP COLUMN fitness_goal,
                    DROP COLUMN profile_photo_url
            ''',
        ),
    ]
