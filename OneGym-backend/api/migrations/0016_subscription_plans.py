from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0015_personal_record_proof'),
    ]

    operations = [
        migrations.RunSQL(
            '''
            CREATE TABLE IF NOT EXISTS plans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(30) NOT NULL UNIQUE,
                name VARCHAR(80) NOT NULL,
                price_cents INT UNSIGNED NOT NULL DEFAULT 0,
                currency VARCHAR(10) NOT NULL DEFAULT 'MYR',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
            )
            ''',
            'DROP TABLE IF EXISTS plans',
        ),
        migrations.RunSQL(
            '''
            CREATE TABLE IF NOT EXISTS user_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                plan_id INT NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'free',
                stripe_customer_id VARCHAR(255) NULL,
                stripe_subscription_id VARCHAR(255) NULL,
                stripe_payment_link_id VARCHAR(255) NULL,
                current_period_start DATETIME(6) NULL,
                current_period_end DATETIME(6) NULL,
                canceled_at DATETIME(6) NULL,
                created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                INDEX user_subscriptions_user_idx (user_id),
                INDEX user_subscriptions_plan_idx (plan_id),
                INDEX user_subscriptions_status_idx (status),
                CONSTRAINT user_subscriptions_user_fk
                    FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE,
                CONSTRAINT user_subscriptions_plan_fk
                    FOREIGN KEY (plan_id) REFERENCES plans(id)
                    ON DELETE RESTRICT
            )
            ''',
            'DROP TABLE IF EXISTS user_subscriptions',
        ),
        migrations.RunSQL(
            '''
            CREATE TABLE IF NOT EXISTS payment_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
                event_type VARCHAR(120) NOT NULL,
                payload_json JSON NOT NULL,
                created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX payment_events_user_idx (user_id),
                CONSTRAINT payment_events_user_fk
                    FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE SET NULL
            )
            ''',
            'DROP TABLE IF EXISTS payment_events',
        ),
        migrations.RunSQL(
            '''
            INSERT INTO plans (code, name, price_cents, currency, is_active)
            VALUES
                ('free', 'Free', 0, 'MYR', TRUE),
                ('pro', 'Pro', 2900, 'MYR', TRUE),
                ('studio', 'Studio', 9900, 'MYR', TRUE)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                price_cents = VALUES(price_cents),
                currency = VALUES(currency),
                is_active = VALUES(is_active)
            ''',
            '''
            DELETE FROM plans WHERE code IN ('free', 'pro', 'studio')
            ''',
        ),
    ]
