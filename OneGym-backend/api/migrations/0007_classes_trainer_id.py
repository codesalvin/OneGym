from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_trainerapplication'),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
                ALTER TABLE classes
                ADD COLUMN IF NOT EXISTS trainer_id INT NULL
            ''',
            reverse_sql='''
                ALTER TABLE classes
                DROP COLUMN IF EXISTS trainer_id
            ''',
        ),
        migrations.RunSQL(
            sql='''
                ALTER TABLE classes
                ADD CONSTRAINT classes_trainer_fk
                FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE SET NULL
            ''',
            reverse_sql='''
                ALTER TABLE classes
                DROP FOREIGN KEY classes_trainer_fk
            ''',
        ),
    ]
