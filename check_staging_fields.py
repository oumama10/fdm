import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()
from apps.procurement.models import StagingItem
print('Fields:')
for f in StagingItem._meta.fields:
    print(f'  {f.name}: {f.__class__.__name__} null={f.null} blank={f.blank}')