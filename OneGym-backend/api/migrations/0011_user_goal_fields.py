from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_user_profile_fields'),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
                ALTER TABLE users
                    ADD COLUMN weight_goal VARCHAR(80) NULL,
                    ADD COLUMN starting_weight DECIMAL(6,2) NULL,
                    ADD COLUMN current_weight DECIMAL(6,2) NULL,
                    ADD COLUMN goal_weight DECIMAL(6,2) NULL,
                    ADD COLUMN weekly_goal DECIMAL(5,2) NULL,
                    ADD COLUMN calorie_goal INT NULL,
                    ADD COLUMN protein_goal INT NULL,
                    ADD COLUMN carbs_goal INT NULL,
                    ADD COLUMN fats_goal INT NULL
            ''',
            reverse_sql='''
                ALTER TABLE users
                    DROP COLUMN fats_goal,
                    DROP COLUMN carbs_goal,
                    DROP COLUMN protein_goal,
                    DROP COLUMN calorie_goal,
                    DROP COLUMN weekly_goal,
                    DROP COLUMN goal_weight,
                    DROP COLUMN current_weight,
                    DROP COLUMN starting_weight,
                    DROP COLUMN weight_goal
            ''',
        ),
    ]
