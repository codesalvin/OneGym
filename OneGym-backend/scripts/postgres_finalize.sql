-- Restore timestamp behavior that MySQL expressed through column defaults.
-- pgloader intentionally omits these defaults because MySQL's
-- CURRENT_TIMESTAMP(6) syntax is not valid PostgreSQL DDL.

ALTER TABLE admin_audit_logs ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE auth_tokens ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE classes ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE class_attendance ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE class_reviews ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE exercises ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE member_profiles ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE notifications ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE payments ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE payment_events ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE personal_records ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE plans ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE trainer_applications ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE trainer_chat_messages ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE trainer_clients ALTER COLUMN assigned_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE trainer_reviews ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE training_programs ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_subscriptions ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_subscriptions ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_profiles_set_updated_at ON member_profiles;
CREATE TRIGGER member_profiles_set_updated_at
BEFORE UPDATE ON member_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS user_subscriptions_set_updated_at ON user_subscriptions;
CREATE TRIGGER user_subscriptions_set_updated_at
BEFORE UPDATE ON user_subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
