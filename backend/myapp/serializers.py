from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Task



class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']




# -------------------- TASKS --------------------

class TaskSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'description',
            'status',
            'priority',
            'due_date',
            'created_at',
            'updated_at',
            'owner',
        ]
        read_only_fields = ['created_at', 'updated_at', 'owner']

    def validate_title(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Title is required.")
        return value
