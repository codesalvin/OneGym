from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_user_goal_fields'),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
                CREATE TABLE IF NOT EXISTS exercises (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(150) NOT NULL UNIQUE,
                    category VARCHAR(80) NULL,
                    default_unit VARCHAR(30) NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                );

                CREATE TABLE IF NOT EXISTS personal_records (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    exercise_id INT NOT NULL,
                    record_type VARCHAR(50) NOT NULL,
                    value DECIMAL(10,2) NOT NULL,
                    unit VARCHAR(30) NOT NULL,
                    recorded_at DATETIME(6) NOT NULL,
                    notes TEXT NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    INDEX personal_records_user_idx (user_id),
                    INDEX personal_records_exercise_idx (exercise_id),
                    CONSTRAINT personal_records_user_fk
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    CONSTRAINT personal_records_exercise_fk
                        FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
                )
            ''',
            reverse_sql='''
                DROP TABLE IF EXISTS personal_records;
                DROP TABLE IF EXISTS exercises
            ''',
        ),
    ]
