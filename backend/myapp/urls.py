from django.urls import path
from . import views

urlpatterns = [
    # ---------- AUTH ----------
    path('auth/register/', views.auth_register, name='auth_register'),
    path('auth/login/', views.auth_login, name='auth_login'),
    path('auth/refresh/', views.auth_refresh, name='auth_refresh'),
    path('signout/', views.signout, name='signout'),  # optional client-side only
    path('user/me/', views.current_user, name='current_user'),

    # ---------- TASKS ----------
    path('tasks/', views.tasks, name='tasks'),
    path('tasks/<int:pk>/', views.task_detail, name='task_detail'),
    path('tasks/stream/', views.tasks_stream, name='tasks_stream'),
]
