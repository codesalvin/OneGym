from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_exercises_personal_records'),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
                ALTER TABLE personal_records
                    ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'auto_accepted',
                    ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT TRUE,
                    ADD COLUMN verification_reason VARCHAR(255) NULL;

                CREATE INDEX personal_records_status_idx
                    ON personal_records (status, is_verified);
            ''',
            reverse_sql='''
                DROP INDEX personal_records_status_idx ON personal_records;

                ALTER TABLE personal_records
                    DROP COLUMN verification_reason,
                    DROP COLUMN is_verified,
                    DROP COLUMN status;
            ''',
        ),
    ]
