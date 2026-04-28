import sys
import os
import django
sys.path.append('.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.resources.models import SousCategorie
from django.test import RequestFactory
from apps.resources.views import SousCategorieViewSet

factory = RequestFactory()
request = factory.get('/api/resources/sous-categories/', {'id_categorie': '1', 'roots_only': 'true'})
view = SousCategorieViewSet.as_view({'get': 'list'})
response = view(request)
print("count with true:", len(response.data.get('results', response.data)))

request2 = factory.get('/api/resources/sous-categories/', {'id_categorie': '1'})
response2 = view(request2)
print("count without true:", len(response2.data.get('results', response2.data)))
