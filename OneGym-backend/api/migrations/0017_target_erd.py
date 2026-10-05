from django.db import migrations


FORWARD_SQL = r'''
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE,
    description TEXT NULL
);
INSERT INTO roles (name, description) VALUES
('member','Gym member'),('pro','Pro member'),('studio','Studio member'),
('trainer','Trainer'),('admin','Administrator'),('owner','Gym owner')
ON DUPLICATE KEY UPDATE description=VALUES(description);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS role_id INT NULL,
    ADD COLUMN IF NOT EXISTS updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);
UPDATE users SET password_hash=password WHERE password_hash IS NULL;
UPDATE users u JOIN roles r ON r.name=u.role SET u.role_id=r.id WHERE u.role_id IS NULL;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY, actor_user_id INT NULL, action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL, entity_id BIGINT UNSIGNED NULL, details_json JSON NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX admin_audit_actor_idx(actor_user_id),
    CONSTRAINT admin_audit_actor_fk FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE password_reset_codes ADD COLUMN IF NOT EXISTS user_id INT NULL;
UPDATE password_reset_codes p JOIN users u ON u.email=p.email SET p.user_id=u.id WHERE p.user_id IS NULL;

CREATE TABLE IF NOT EXISTS member_profiles (
    user_id INT PRIMARY KEY, display_name VARCHAR(150) NULL, profile_photo_url VARCHAR(500) NULL,
    fitness_goal VARCHAR(255) NULL, training_style VARCHAR(80) NULL, weekly_target INT UNSIGNED NULL,
    weight_goal VARCHAR(80) NULL, starting_weight DECIMAL(6,2) NULL, goal_weight DECIMAL(6,2) NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT member_profiles_user_fk FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO member_profiles(user_id,display_name,profile_photo_url,fitness_goal,training_style,weekly_target,weight_goal,starting_weight,goal_weight)
SELECT id,username,profile_photo_url,fitness_goal,training_style,weekly_target,weight_goal,starting_weight,goal_weight FROM users
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),profile_photo_url=VALUES(profile_photo_url),fitness_goal=VALUES(fitness_goal),training_style=VALUES(training_style),weekly_target=VALUES(weekly_target),weight_goal=VALUES(weight_goal),starting_weight=VALUES(starting_weight),goal_weight=VALUES(goal_weight);

CREATE TABLE IF NOT EXISTS progress_measurements (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, weight_kg DECIMAL(6,2) NULL,
    body_fat_pct DECIMAL(5,2) NULL, muscle_mass_kg DECIMAL(6,2) NULL, notes TEXT NULL,
    recorded_at DATETIME(6) NOT NULL, INDEX progress_user_idx(user_id),
    CONSTRAINT progress_user_fk FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, role VARCHAR(20) NOT NULL,
    title VARCHAR(255) NULL, body TEXT NOT NULL, cards_json JSON NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX ai_chat_user_idx(user_id),
    CONSTRAINT ai_chat_user_fk FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, notification_type VARCHAR(80) NOT NULL,
    title VARCHAR(255) NOT NULL, body TEXT NOT NULL, read_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX notifications_user_idx(user_id),
    CONSTRAINT notifications_user_fk FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE classes
    ADD COLUMN IF NOT EXISTS start_time DATETIME(6) NULL,
    ADD COLUMN IF NOT EXISTS duration_minutes INT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS capacity INT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
    ADD COLUMN IF NOT EXISTS created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE classes SET start_time=schedule_time WHERE start_time IS NULL;
UPDATE classes SET capacity=slots WHERE capacity IS NULL;
ALTER TABLE class_bookings
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'booked',
    ADD COLUMN IF NOT EXISTS canceled_at DATETIME(6) NULL;
CREATE TABLE IF NOT EXISTS class_attendance (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, booking_id BIGINT NOT NULL UNIQUE, recorded_by INT NULL,
    attendance_status VARCHAR(30) NOT NULL, checked_in_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT attendance_booking_fk FOREIGN KEY(booking_id) REFERENCES class_bookings(id) ON DELETE CASCADE,
    CONSTRAINT attendance_recorder_fk FOREIGN KEY(recorded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS class_reviews (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, class_id BIGINT NOT NULL, reviewer_id INT NOT NULL,
    rating SMALLINT UNSIGNED NOT NULL, comment TEXT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY class_review_uq(class_id,reviewer_id),
    CONSTRAINT class_review_class_fk FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT class_review_user_fk FOREIGN KEY(reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE workout_exercises
    ADD COLUMN IF NOT EXISTS exercise_id INT NULL,
    ADD COLUMN IF NOT EXISTS distance DECIMAL(10,2) NULL,
    ADD COLUMN IF NOT EXISTS duration_seconds INT UNSIGNED NULL;
UPDATE workout_exercises we JOIN exercises e ON e.name=we.exercise_name SET we.exercise_id=e.id WHERE we.exercise_id IS NULL;
ALTER TABLE personal_records ADD COLUMN IF NOT EXISTS reviewed_by INT NULL;
CREATE TABLE IF NOT EXISTS training_programs (
    id INT AUTO_INCREMENT PRIMARY KEY, trainer_id INT NOT NULL, client_id INT NOT NULL, title VARCHAR(255) NOT NULL,
    description TEXT NULL, start_date DATE NOT NULL, end_date DATE NULL, status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX programs_trainer_idx(trainer_id), INDEX programs_client_idx(client_id),
    CONSTRAINT programs_trainer_fk FOREIGN KEY(trainer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT programs_client_fk FOREIGN KEY(client_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS program_exercises (
    id INT AUTO_INCREMENT PRIMARY KEY, program_id INT NOT NULL, exercise_id INT NOT NULL, day_number INT UNSIGNED NOT NULL,
    sets INT UNSIGNED NULL, reps INT UNSIGNED NULL, target_value DECIMAL(10,2) NULL, notes TEXT NULL,
    CONSTRAINT program_exercise_program_fk FOREIGN KEY(program_id) REFERENCES training_programs(id) ON DELETE CASCADE,
    CONSTRAINT program_exercise_exercise_fk FOREIGN KEY(exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS training_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY, trainer_id INT NOT NULL, client_id INT NOT NULL, program_id INT NULL,
    scheduled_at DATETIME(6) NOT NULL, duration_minutes INT UNSIGNED NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'scheduled', notes TEXT NULL,
    CONSTRAINT sessions_trainer_fk FOREIGN KEY(trainer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT sessions_client_fk FOREIGN KEY(client_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT sessions_program_fk FOREIGN KEY(program_id) REFERENCES training_programs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS nutrition_goals (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, calorie_goal INT UNSIGNED NULL,
    protein_goal INT UNSIGNED NULL, carbs_goal INT UNSIGNED NULL, fats_goal INT UNSIGNED NULL,
    effective_from DATE NOT NULL, effective_to DATE NULL, INDEX nutrition_user_idx(user_id),
    CONSTRAINT nutrition_user_fk FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO nutrition_goals(user_id,calorie_goal,protein_goal,carbs_goal,fats_goal,effective_from)
SELECT id,calorie_goal,protein_goal,carbs_goal,fats_goal,CURRENT_DATE FROM users u
WHERE NOT EXISTS (SELECT 1 FROM nutrition_goals n WHERE n.user_id=u.id)
  AND (calorie_goal IS NOT NULL OR protein_goal IS NOT NULL OR carbs_goal IS NOT NULL OR fats_goal IS NOT NULL);
ALTER TABLE trainer_applications
    ADD COLUMN IF NOT EXISTS applicant_id INT NULL,
    ADD COLUMN IF NOT EXISTS reviewer_id INT NULL,
    ADD COLUMN IF NOT EXISTS certification_url VARCHAR(500) NULL;
UPDATE trainer_applications SET applicant_id=user_id WHERE applicant_id IS NULL;
UPDATE trainer_applications SET reviewer_id=reviewed_by WHERE reviewer_id IS NULL;
UPDATE trainer_applications SET certification_url=certification_file_url WHERE certification_url IS NULL;
CREATE TABLE IF NOT EXISTS trainer_clients (
    id INT AUTO_INCREMENT PRIMARY KEY, trainer_id INT NOT NULL, member_id INT NOT NULL,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), status VARCHAR(30) NOT NULL DEFAULT 'active', notes TEXT NULL,
    UNIQUE KEY trainer_client_uq(trainer_id,member_id),
    CONSTRAINT trainer_client_trainer_fk FOREIGN KEY(trainer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT trainer_client_member_fk FOREIGN KEY(member_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS trainer_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY, trainer_id INT NOT NULL, reviewer_id INT NOT NULL,
    rating SMALLINT UNSIGNED NOT NULL, comment TEXT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY trainer_review_uq(trainer_id,reviewer_id),
    CONSTRAINT trainer_review_trainer_fk FOREIGN KEY(trainer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT trainer_review_reviewer_fk FOREIGN KEY(reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, subscription_id INT NULL,
    stripe_payment_id VARCHAR(255) NOT NULL UNIQUE, amount_cents INT UNSIGNED NOT NULL,
    currency VARCHAR(10) NOT NULL, status VARCHAR(30) NOT NULL, paid_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT payments_user_fk FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT payments_subscription_fk FOREIGN KEY(subscription_id) REFERENCES user_subscriptions(id) ON DELETE SET NULL
);
ALTER TABLE payment_events ADD COLUMN IF NOT EXISTS payment_id INT NULL;
'''


class Migration(migrations.Migration):
    dependencies = [('api', '0016_subscription_plans')]
    operations = [migrations.RunSQL(FORWARD_SQL, migrations.RunSQL.noop)]
