from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("myapp", "0022_remove_comment_page_remove_comment_user_and_more"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="task",
            index=models.Index(fields=["owner", "updated_at"], name="task_owner_updated_idx"),
        ),
        migrations.AddIndex(
            model_name="task",
            index=models.Index(fields=["status"], name="task_status_idx"),
        ),
        migrations.AddIndex(
            model_name="task",
            index=models.Index(fields=["priority"], name="task_priority_idx"),
        ),
        migrations.AddIndex(
            model_name="task",
            index=models.Index(fields=["due_date"], name="task_due_idx"),
        ),
        migrations.AddIndex(
            model_name="task",
            index=models.Index(fields=["updated_at"], name="task_updated_idx"),
        ),
    ]

