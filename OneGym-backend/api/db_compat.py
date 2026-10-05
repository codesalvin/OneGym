from django.db import connection


def get_last_insert_id(cursor):
    """Return the generated primary key for MySQL or PostgreSQL inserts."""
    if connection.vendor == 'postgresql':
        cursor.execute('SELECT LASTVAL()')
        return cursor.fetchone()[0]
    return cursor.lastrowid
