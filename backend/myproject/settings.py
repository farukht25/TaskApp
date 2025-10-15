from pathlib import Path
import os

# -------------------------------------------------
# BASE DIRECTORIES
# -------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")
MEDIA_DIR = os.path.join(BASE_DIR, "media")

# -------------------------------------------------
# SECURITY
# -------------------------------------------------
SECRET_KEY = "django-insecure-s0eg9q5^i%wy4n5m78yvbpwkb3j3j)w8nx=pr&c6+ag8ltvs5t"
DEBUG = True
ALLOWED_HOSTS = ['*']

# -------------------------------------------------
# APPLICATIONS
# -------------------------------------------------
INSTALLED_APPS = [
    # Django default apps
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party apps
    "rest_framework",
    "corsheaders",

    # Local apps
    "myapp",
]

# -------------------------------------------------
# MIDDLEWARE
# -------------------------------------------------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # CORS must come first
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "myproject.middleware.JWTAuthCookieMiddleware",  # inject Authorization from access cookie
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# -------------------------------------------------
# URLS / TEMPLATES / WSGI
# -------------------------------------------------
ROOT_URLCONF = "myproject.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [TEMP_DIR],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "myproject.wsgi.application"

# -------------------------------------------------
# DATABASE
# -------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# -------------------------------------------------
# PASSWORD VALIDATION
# -------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# -------------------------------------------------
# INTERNATIONALIZATION
# -------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# -------------------------------------------------
# STATIC / MEDIA FILES
# -------------------------------------------------
STATIC_URL = "/static/"
STATICFILES_DIRS = [STATIC_DIR]

MEDIA_URL = "/media/"
MEDIA_ROOT = MEDIA_DIR

# -------------------------------------------------
# DJANGO REST FRAMEWORK (JWT)
# -------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',  # override per view
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}



# -------------------------------------------------
# CORS CONFIGURATION
# -------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True  # allows sending cookies from React

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# CSRF not needed with JWT
CSRF_TRUSTED_ORIGINS = []
CSRF_COOKIE_SECURE = False  # not needed for JWT in dev

# -------------------------------------------------
# DEFAULT PRIMARY KEY FIELD
# -------------------------------------------------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
