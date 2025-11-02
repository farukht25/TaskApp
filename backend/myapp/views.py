from datetime import datetime
import logging
import json
import time

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.http import StreamingHttpResponse
from django.db.models import Q
from django.core.cache import cache

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from django.conf import settings
from myproject.decorators import log_api, cache_response

from .models import Task
from .serializers import UserSerializer, TaskSerializer


def _tasks_cache_version(user_id: int) -> int:
    key = f"tasks:v:{user_id}"
    v = cache.get(key)
    if v is None:
        cache.set(key, 1, None)
        return 1
    try:
        return int(v)
    except Exception:
        return 1


def _bump_tasks_version(user_id: int) -> None:
    key = f"tasks:v:{user_id}"
    try:
        v = cache.get(key) or 1
        v = 1 if int(v) >= 1_000_000_000 else int(v) + 1
        cache.set(key, v, None)
    except Exception:
        pass


# ---------- AUTH ----------

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


@log_api("signup")
@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    logger.info("signup attempt username=%s email=%s", request.data.get('username'), request.data.get('email'))
    data = request.data
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    password2 = data.get('password2')

    if password != password2:
        logger.warning("signup failed: password mismatch username=%s", username)
        return Response({'error': 'Passwords do not match'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        logger.warning("signup failed: username exists username=%s", username)
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists():
        logger.warning("signup failed: email exists email=%s", email)
        return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=username, email=email, password=password)
    tokens = get_tokens_for_user(user)
    logger.info("signup success user_id=%s username=%s", user.id, user.username)
    return Response({
        'message': 'User created successfully',
        'user': UserSerializer(user).data,
        'tokens': tokens
    }, status=status.HTTP_201_CREATED)


@log_api("signin_legacy")
@api_view(['POST'])
@permission_classes([AllowAny])
def signin(request):
    logger.info("legacy signin attempt username=%s", request.data.get('username'))
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(username=username, password=password)

    if user:
        tokens = get_tokens_for_user(user)
        user_data = UserSerializer(user).data
        user_data["is_superuser"] = user.is_superuser
        user_data["is_staff"] = user.is_staff

        return Response({
            'message': 'Login successful',
            'user': user_data,
            'tokens': tokens
        })
    logger.warning("legacy signin failed username=%s", request.data.get('username'))
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


@log_api("signout")
@api_view(['POST'])
@permission_classes([AllowAny])
def signout(request):
    logger.info("signout called has_access=%s has_refresh=%s user=%s", bool(request.COOKIES.get('access')), bool(request.COOKIES.get('refresh')), getattr(request.user, 'id', None))
    resp = Response({'message': 'Logout successful'})
    resp.delete_cookie('access')
    resp.delete_cookie('refresh')
    logger.info("signout cleared cookies")
    return resp


# 
@log_api("auth_register")
@api_view(['POST'])
@permission_classes([AllowAny])
def auth_register(request):
    logger.info("auth_register attempt username=%s email=%s", request.data.get('username'), request.data.get('email'))
    data = request.data
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    password2 = data.get('password2')

    if password != password2:
        logger.warning("auth_register failed: password mismatch username=%s", username)
        return Response({'error': 'Passwords do not match'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        logger.warning("auth_register failed: username exists username=%s", username)
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists():
        logger.warning("auth_register failed: email exists email=%s", email)
        return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=username, email=email, password=password)
    tokens = get_tokens_for_user(user)
    resp = Response({
        'message': 'User created successfully',
        'user': UserSerializer(user).data,
    }, status=status.HTTP_201_CREATED)
    _set_auth_cookies(resp, tokens['access'], tokens['refresh'])
    logger.info("auth_register success user_id=%s username=%s", user.id, user.username)
    return resp


@log_api("auth_login")
@api_view(['POST'])
@permission_classes([AllowAny])
def auth_login(request):
    logger.info("auth_login attempt ident=%s", (request.data.get('username') or '').strip())
    raw_ident = (request.data.get('username') or "").strip()
    password = request.data.get('password')
    # Try username first
    user = authenticate(username=raw_ident, password=password)
    # Fallback: allow email as identifier
    if not user:
        try:
            candidate = User.objects.filter(email__iexact=raw_ident).first()
            if candidate:
                user = authenticate(username=candidate.username, password=password)
        except Exception:
            user = None

    if user:
        tokens = get_tokens_for_user(user)
        user_data = UserSerializer(user).data
        user_data["is_superuser"] = user.is_superuser
        user_data["is_staff"] = user.is_staff

        resp = Response({
            'message': 'Login successful',
            'user': user_data,
        })
        _set_auth_cookies(resp, tokens['access'], tokens['refresh'])
        logger.info("auth_login success user_id=%s", user.id)
        return resp
    logger.warning("auth_login failed ident=%s", raw_ident)
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


# Current user endpoint
@log_api("current_user")
@cache_response(seconds=5, key_prefix="user_me", vary_by_user=True)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    user = request.user
    logger.info("current_user called authenticated=%s user=%s", getattr(user, 'is_authenticated', False), getattr(user, 'id', None))
    return Response({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_superuser": user.is_superuser,
        "is_staff": user.is_staff,
    })


def _set_auth_cookies(resp, access_token: str, refresh_token: str):
    # In production (DEBUG=False), use Secure cookies and allow cross-site
    if settings.DEBUG:
        cookie_kwargs = {
            'httponly': True,
            'samesite': 'Lax',
            'secure': False,
        }
    else:
        cookie_kwargs = {
            'httponly': True,
            'samesite': 'None',
            'secure': True,
        }
    logger = logging.getLogger(__name__)
    resp.set_cookie('access', access_token, max_age=60 * 60, **cookie_kwargs)
    resp.set_cookie('refresh', refresh_token, max_age=14 * 24 * 60 * 60, **cookie_kwargs)
    logger.debug("set auth cookies secure=%s samesite=%s", cookie_kwargs.get('secure'), cookie_kwargs.get('samesite'))


@log_api("auth_refresh")
@api_view(['POST'])
@permission_classes([AllowAny])
def auth_refresh(request):
    refresh_cookie = request.COOKIES.get('refresh')
    logger.info("auth_refresh called has_refresh=%s", bool(refresh_cookie))
    if not refresh_cookie:
        return Response({'error': 'No refresh token'}, status=status.HTTP_401_UNAUTHORIZED)
    try:
        refresh = RefreshToken(refresh_cookie)
        new_access = str(refresh.access_token)
        resp = Response({'message': 'refreshed'})
        _set_auth_cookies(resp, new_access, refresh_cookie)
        logger.info("auth_refresh success")
        return resp
    except Exception as exc:
        logger.warning("auth_refresh failed err=%s", exc.__class__.__name__)
        return Response({'error': 'Invalid refresh token'}, status=status.HTTP_401_UNAUTHORIZED)


# ---------- TASKS (CRUD + filter/search) ----------

@log_api("tasks")
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def tasks(request):
    user = request.user
    logger.info("tasks %s by user=%s params=%s", request.method, getattr(user, 'id', None), dict(request.GET))

    if request.method == 'GET':
        # Cache lookup keyed by user/admin and filters
        is_admin = bool(user.is_superuser or user.is_staff)
        cache_uid = 0 if is_admin else user.id
        normalized = []
        for k in sorted(request.GET.keys()):
            for v in sorted(request.GET.getlist(k)):
                normalized.append(f"{k}={v}")
        filt_str = "&".join(normalized)
        version = _tasks_cache_version(cache_uid)
        cache_key = f"tasks:list:{cache_uid}:{version}:{filt_str}"

        cached = cache.get(cache_key)
        if cached is not None:
            logger.debug("tasks GET cache_hit uid=%s key=%s", cache_uid, cache_key)
            return Response(cached)
        # Admins can see all tasks; others only their own
        if user.is_superuser or user.is_staff:
            qs = Task.objects.all().select_related('owner').order_by('-updated_at')
        else:
            qs = Task.objects.filter(owner=user).select_related('owner').order_by('-updated_at')

        status_param = request.GET.get('status')
        priority_param = request.GET.get('priority')
        due_before = request.GET.get('due_before')
        due_after = request.GET.get('due_after')
        search = request.GET.get('search')

        if status_param:
            qs = qs.filter(status=status_param)
        if priority_param:
            qs = qs.filter(priority=priority_param)
        if due_before:
            try:
                dt = datetime.strptime(due_before, '%Y-%m-%d').date()
                qs = qs.filter(due_date__lte=dt)
            except ValueError:
                pass
        if due_after:
            try:
                dt = datetime.strptime(due_after, '%Y-%m-%d').date()
                qs = qs.filter(due_date__gte=dt)
            except ValueError:
                pass
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))

        # Optional limiting to reduce payload size for large lists
        try:
            limit = int(request.GET.get('limit', '0'))
            if limit and limit > 0:
                limit = min(limit, 200)
                qs = qs[:limit]
        except Exception:
            pass

        serializer = TaskSerializer(qs, many=True)
        data = serializer.data
        try:
            cache.set(cache_key, data, 15)
        except Exception:
            pass
        logger.debug("tasks GET returned %s items", len(data))
        return Response(data)

    if request.method == 'POST':
        serializer = TaskSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(owner=user)
            logger.info("tasks POST created id=%s owner=%s", serializer.data.get('id'), getattr(user, 'id', None))
            try:
                _bump_tasks_version(user.id)
                _bump_tasks_version(0)
            except Exception:
                pass
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        logger.warning("tasks POST invalid user=%s errors=%s", getattr(user, 'id', None), serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@log_api("task_detail")
@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def task_detail(request, pk):
    try:
        if request.user.is_superuser or request.user.is_staff:
            task = Task.objects.get(pk=pk)
        else:
            task = Task.objects.get(pk=pk, owner=request.user)
    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TaskSerializer(task)
        return Response(serializer.data)

    if request.method == 'PUT':
        serializer = TaskSerializer(task, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            try:
                _bump_tasks_version(task.owner_id)
                _bump_tasks_version(0)
            except Exception:
                pass
            return Response(serializer.data)
        logger.warning("task PUT invalid id=%s user=%s errors=%s", pk, getattr(request, 'user', None).id if hasattr(request, 'user') else None, serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        task.delete()
        logger.info("task deleted id=%s by user=%s", pk, getattr(request.user, 'id', None))
        try:
            _bump_tasks_version(task.owner_id)
            _bump_tasks_version(0)
        except Exception:
            pass
        return Response({'message': 'Task deleted'}, status=status.HTTP_200_OK)


# ---------- TASKS SSE (Server-Sent Events) ----------

def _user_from_token(request):
    token = request.GET.get('token')
    if not token:
        auth = request.META.get('HTTP_AUTHORIZATION', '')
        if auth.lower().startswith('bearer '):
            token = auth.split(' ', 1)[1]
    if not token:
        token = request.COOKIES.get('access')
    try:
        access = AccessToken(token)
        user_id = access.get('user_id')
        return User.objects.filter(id=user_id).first()
    except Exception:
        return None


@log_api("tasks_stream")
def tasks_stream(request):
    # Authenticate via JWT from query param or header
    user = _user_from_token(request)
    logger.info("tasks_stream connect user=%s", getattr(user, 'id', None))
    if not user:
        return StreamingHttpResponse((line for line in ["event: error\n", "data: unauthorized\n\n"]),
                                     content_type='text/event-stream', status=401)

    def event_stream():
        yield "retry: 3000\n\n"
        base_qs = Task.objects.all() if (user.is_superuser or user.is_staff) else Task.objects.filter(owner=user)
        current = base_qs.order_by('-updated_at')
        payload = json.dumps({
            'type': 'snapshot',
            'tasks': TaskSerializer(current, many=True).data,
        })
        yield f"data: {payload}\n\n"
        try:
            last_val = current.values_list('updated_at', flat=True).first()
            last_ts = last_val.isoformat() if last_val else None
        except Exception:
            last_ts = None

        deadline = time.time() + 300
        while time.time() < deadline:
            time.sleep(5)
            qs = (Task.objects.all() if (user.is_superuser or user.is_staff) else Task.objects.filter(owner=user)).order_by('-updated_at')
            latest_val = qs.values_list('updated_at', flat=True).first()
            latest = latest_val.isoformat() if latest_val else None
            if latest != last_ts:
                payload = json.dumps({
                    'type': 'update',
                    'tasks': TaskSerializer(qs, many=True).data,
                })
                yield f"data: {payload}\n\n"
                last_ts = latest
            else:
                yield ": keep-alive\n\n"

    resp = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    resp["Cache-Control"] = "no-cache"
    resp["X-Accel-Buffering"] = "no"
    return resp
logger = logging.getLogger(__name__)


# --------- CLIENT LOGGING (from frontend) ---------
@api_view(['POST'])
@permission_classes([AllowAny])
def client_log(request):
    try:
        payload = request.data or {}
    except Exception:
        payload = {"error": "non_json"}
    logging.getLogger("myapp.client").info("client_log %s", json.dumps(payload, ensure_ascii=False))
    return Response({"ok": True})
