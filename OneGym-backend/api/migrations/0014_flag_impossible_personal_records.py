from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_personal_record_verification'),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
                UPDATE personal_records pr
                INNER JOIN exercises e ON e.id = pr.exercise_id
                SET
                    pr.status = 'pending',
                    pr.is_verified = FALSE,
                    pr.verification_reason = 'Existing PR exceeds OneGym verification limits.'
                WHERE
                    (pr.record_type = 'weight' AND pr.value > 500)
                    OR (pr.record_type = 'reps' AND pr.value > 1000)
                    OR (pr.record_type = 'time' AND pr.value > 1440)
                    OR (pr.record_type = 'distance' AND pr.value > 300)
                    OR (pr.record_type = 'volume' AND pr.value > 200000)
                    OR (pr.record_type = 'weight' AND e.name = 'Bench Press' AND pr.value > 500);
            ''',
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
