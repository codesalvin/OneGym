from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_classes_trainer_id'),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
                CREATE TABLE IF NOT EXISTS auth_tokens (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    token_hash CHAR(64) NOT NULL UNIQUE,
                    expires_at DATETIME(6) NOT NULL,
                    revoked_at DATETIME(6) NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    INDEX auth_tokens_user_idx (user_id),
                    INDEX auth_tokens_expires_idx (expires_at),
                    CONSTRAINT auth_tokens_user_fk
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            ''',
            reverse_sql='DROP TABLE IF EXISTS auth_tokens',
        ),
    ]
