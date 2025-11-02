web: cd backend && gunicorn myproject.wsgi --workers=1 --threads=4 --timeout 120 --log-file -
release: cd backend && python manage.py migrate && python manage.py collectstatic --noinput

