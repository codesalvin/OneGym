from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_auth_tokens'),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
                CREATE TABLE IF NOT EXISTS trainer_chat_messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    sender_id INT NOT NULL,
                    recipient_id INT NOT NULL,
                    body TEXT NOT NULL,
                    read_at DATETIME(6) NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    INDEX trainer_chat_sender_idx (sender_id),
                    INDEX trainer_chat_recipient_idx (recipient_id),
                    INDEX trainer_chat_pair_idx (sender_id, recipient_id, created_at),
                    CONSTRAINT trainer_chat_sender_fk
                        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                    CONSTRAINT trainer_chat_recipient_fk
                        FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
                )
            ''',
            reverse_sql='DROP TABLE IF EXISTS trainer_chat_messages',
        ),
    ]
