from datetime import datetime
import json
import time

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.http import StreamingHttpResponse
from django.db.models import Q

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken

from .models import Task
from .serializers import UserSerializer, TaskSerializer


# ---------- AUTH ----------

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    data = request.data
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    password2 = data.get('password2')

    if password != password2:
        return Response({'error': 'Passwords do not match'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=username, email=email, password=password)
    tokens = get_tokens_for_user(user)
    return Response({
        'message': 'User created successfully',
        'user': UserSerializer(user).data,
        'tokens': tokens
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def signin(request):
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
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def signout(request):
    resp = Response({'message': 'Logout successful'})
    resp.delete_cookie('access')
    resp.delete_cookie('refresh')
    return resp


# 
@api_view(['POST'])
@permission_classes([AllowAny])
def auth_register(request):
    data = request.data
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    password2 = data.get('password2')

    if password != password2:
        return Response({'error': 'Passwords do not match'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=username, email=email, password=password)
    tokens = get_tokens_for_user(user)
    resp = Response({
        'message': 'User created successfully',
        'user': UserSerializer(user).data,
    }, status=status.HTTP_201_CREATED)
    _set_auth_cookies(resp, tokens['access'], tokens['refresh'])
    return resp


@api_view(['POST'])
@permission_classes([AllowAny])
def auth_login(request):
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
        return resp
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


# Current user endpoint
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    user = request.user
    return Response({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_superuser": user.is_superuser,
        "is_staff": user.is_staff,
    })


def _set_auth_cookies(resp, access_token: str, refresh_token: str):

    cookie_kwargs = {
        'httponly': True,
        'samesite': 'None',
        'secure': True,
    }
    resp.set_cookie('access', access_token, max_age=60 * 60, **cookie_kwargs)
    resp.set_cookie('refresh', refresh_token, max_age=14 * 24 * 60 * 60, **cookie_kwargs)


@api_view(['POST'])
@permission_classes([AllowAny])
def auth_refresh(request):
    refresh_cookie = request.COOKIES.get('refresh')
    if not refresh_cookie:
        return Response({'error': 'No refresh token'}, status=status.HTTP_401_UNAUTHORIZED)
    try:
        refresh = RefreshToken(refresh_cookie)
        new_access = str(refresh.access_token)
        resp = Response({'message': 'refreshed'})
        _set_auth_cookies(resp, new_access, refresh_cookie)
        return resp
    except Exception:
        return Response({'error': 'Invalid refresh token'}, status=status.HTTP_401_UNAUTHORIZED)


# ---------- TASKS (CRUD + filter/search) ----------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def tasks(request):
    user = request.user

    if request.method == 'GET':
        # Admins can see all tasks; others only their own
        if user.is_superuser or user.is_staff:
            qs = Task.objects.all().order_by('-updated_at')
        else:
            qs = Task.objects.filter(owner=user).order_by('-updated_at')

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

        serializer = TaskSerializer(qs, many=True)
        return Response(serializer.data)

    if request.method == 'POST':
        serializer = TaskSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(owner=user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        task.delete()
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


def tasks_stream(request):
    # Authenticate via JWT from query param or header
    user = _user_from_token(request)
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
        last_ts = current.first().updated_at.isoformat() if current.exists() else None

        deadline = time.time() + 300
        while time.time() < deadline:
            time.sleep(2)
            qs = (Task.objects.all() if (user.is_superuser or user.is_staff) else Task.objects.filter(owner=user)).order_by('-updated_at')
            latest = qs.first().updated_at.isoformat() if qs.exists() else None
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
