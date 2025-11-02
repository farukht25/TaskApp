from pathlib import Path
import os
from datetime import timedelta
try:
    import dj_database_url  # type: ignore
except Exception:
    dj_database_url = None

# -------------------------------------------------
# BASE DIRECTORIES
# -------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from a .env file at project root (optional)
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv(os.path.join(BASE_DIR, ".env"))
except Exception:
    pass
TEMP_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")
MEDIA_DIR = os.path.join(BASE_DIR, "media")
VAR_DIR = os.path.join(BASE_DIR, "var")
try:
    os.makedirs(VAR_DIR, exist_ok=True)
except Exception:
    pass
LOG_DIR = os.environ.get("LOG_DIR", "/logs/backend")
try:
    os.makedirs(LOG_DIR, exist_ok=True)
except Exception:
    try:
        os.makedirs(os.path.join(VAR_DIR, "log"), exist_ok=True)
        LOG_DIR = os.path.join(VAR_DIR, "log")
    except Exception:
        LOG_DIR = VAR_DIR

# -------------------------------------------------
# SECURITY
# -------------------------------------------------
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-change-me")
DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

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
    # WhiteNoise added below only in production
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "myproject.middleware.JWTAuthCookieMiddleware",  # inject Authorization from access cookie
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "myproject.middleware.AccessLogMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Add WhiteNoise middleware only when DEBUG is False (e.g., production)
if not DEBUG:
    MIDDLEWARE.insert(2, "whitenoise.middleware.WhiteNoiseMiddleware")

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
# Database: prefer DATABASE_URL (Heroku/Postgres), else SQLite
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("SQLITE_PATH", BASE_DIR / "db.sqlite3"),
    }
}

_db_url = os.environ.get("DATABASE_URL")
if _db_url and dj_database_url is not None:
    DATABASES["default"] = dj_database_url.parse(
        _db_url,
        conn_max_age=600,
        ssl_require=not DEBUG,
    )

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
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

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

# SimpleJWT lifetimes (extend access so long-lived connections like SSE work better)
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=14),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': False,
}



# -------------------------------------------------
# CORS CONFIGURATION
# -------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True  # allows sending cookies from React

_cors_env = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]

# CSRF not needed with JWT
CSRF_TRUSTED_ORIGINS = []
CSRF_COOKIE_SECURE = False  # not needed for JWT in dev

# -------------------------------------------------
# DEFAULT PRIMARY KEY FIELD
# -------------------------------------------------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# WhiteNoise storage in production
if not DEBUG:
    STORAGES = {
        "staticfiles": {
            # Use manifest storage for cache-busting in production
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        }
    }
    # Keep non-strict in case third-party assets reference optional maps
    WHITENOISE_MANIFEST_STRICT = False

# -------------------------------------------------
# CACHING
# -------------------------------------------------
_cache_dir = os.environ.get("DJANGO_CACHE_DIR", os.path.join(VAR_DIR, "django_cache"))
try:
    os.makedirs(_cache_dir, exist_ok=True)
except Exception:
    pass

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": _cache_dir,
        "TIMEOUT": 300,
        "OPTIONS": {
            "MAX_ENTRIES": 10000,
        },
    }
}

# -------------------------------------------------
# LOGGING
# -------------------------------------------------
LOG_LEVEL = os.environ.get("DJANGO_LOG_LEVEL", "INFO").upper()

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "%(asctime)s %(levelname)s [%(name)s] %(message)s",
        },
        "brief": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": os.path.join(LOG_DIR, "app.log"),
            "maxBytes": 5 * 1024 * 1024,
            "backupCount": 3,
            "formatter": "brief",
        },
    },
    "root": {
        "handlers": ["console", "file"],
        "level": LOG_LEVEL,
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": LOG_LEVEL,
            "propagate": True,
        },
        "myproject": {
            "handlers": ["console", "file"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        "myapp": {
            "handlers": ["console", "file"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        "myapp.api": {
            "handlers": ["console", "file"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        "myapp.client": {
            "handlers": ["console", "file"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
    },
}
