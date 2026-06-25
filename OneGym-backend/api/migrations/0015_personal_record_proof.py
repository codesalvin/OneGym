from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0014_flag_impossible_personal_records'),
    ]

    operations = [
        migrations.RunSQL(
            '''
            ALTER TABLE personal_records
                ADD COLUMN proof_url VARCHAR(255) NULL,
                ADD COLUMN proof_file_name VARCHAR(255) NULL
            ''',
            '''
            ALTER TABLE personal_records
                DROP COLUMN proof_url,
                DROP COLUMN proof_file_name
            ''',
        ),
    ]
