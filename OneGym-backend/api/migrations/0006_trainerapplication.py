from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_users_created_at'),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
                CREATE TABLE IF NOT EXISTS trainer_applications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NULL,
                    full_name VARCHAR(150) NOT NULL,
                    email VARCHAR(254) NOT NULL,
                    phone VARCHAR(40) NULL,
                    specialties VARCHAR(255) NOT NULL,
                    experience_years INT UNSIGNED NOT NULL DEFAULT 0,
                    certification_file_url VARCHAR(255) NOT NULL,
                    certification_file_name VARCHAR(255) NOT NULL,
                    bio TEXT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    reviewed_by INT NULL,
                    reviewed_at DATETIME(6) NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    INDEX trainer_applications_status_idx (status),
                    INDEX trainer_applications_email_idx (email),
                    CONSTRAINT trainer_applications_user_fk
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                    CONSTRAINT trainer_applications_reviewed_by_fk
                        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
                )
            ''',
            reverse_sql='DROP TABLE IF EXISTS trainer_applications',
        ),
    ]
