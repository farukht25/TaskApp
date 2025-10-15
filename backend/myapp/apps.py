from django.apps import AppConfig

class MyappConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "myapp"
    # No signals in the simplified app; keep ready() empty
    # def ready(self):
    #     pass
