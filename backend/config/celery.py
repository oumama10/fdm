import os

from celery import Celery
from kombu import Queue


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

app = Celery("fmpdf")
app.config_from_object("django.conf:settings", namespace="CELERY")

app.conf.beat_scheduler = "django_celery_beat.schedulers:DatabaseScheduler"
app.conf.task_default_queue = "default"
app.conf.task_queues = (
    Queue("default"),
    Queue("ocr"),
    Queue("pdf"),
    Queue("alerts"),
)

app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")