from django.contrib import admin
from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "owner", "status", "priority", "due_date", "updated_at")
    list_filter = ("status", "priority")
    search_fields = ("title", "description", "owner__username")
    readonly_fields = ("created_at", "updated_at")

    def save_model(self, request, obj, form, change):
        # If owner not provided, default to the current user creating the task
        if not obj.owner_id:
            obj.owner = request.user
        super().save_model(request, obj, form, change)

admin.site.site_header = 'Task Manager | ADMIN PANEL'
admin.site.site_title = 'Task Manager'
admin.site.index_title = 'Task Manager Administration'
