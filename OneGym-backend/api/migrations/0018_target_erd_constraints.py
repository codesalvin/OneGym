from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('api', '0017_target_erd')]
    operations = [
        migrations.RunSQL(
            r'''
            ALTER TABLE users ADD CONSTRAINT users_role_fk FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE RESTRICT;
            ALTER TABLE password_reset_codes ADD CONSTRAINT reset_codes_user_fk FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE;
            ALTER TABLE workout_exercises ADD CONSTRAINT workout_exercise_exercise_fk FOREIGN KEY(exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT;
            ALTER TABLE personal_records ADD CONSTRAINT personal_records_reviewer_fk FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
            ALTER TABLE trainer_applications ADD CONSTRAINT trainer_application_applicant_fk FOREIGN KEY(applicant_id) REFERENCES users(id) ON DELETE CASCADE;
            ALTER TABLE trainer_applications ADD CONSTRAINT trainer_application_reviewer_fk FOREIGN KEY(reviewer_id) REFERENCES users(id) ON DELETE SET NULL;
            ALTER TABLE payment_events ADD CONSTRAINT payment_event_payment_fk FOREIGN KEY(payment_id) REFERENCES payments(id) ON DELETE SET NULL;
            ''',
            migrations.RunSQL.noop,
        )
    ]
