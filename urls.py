from django.conf.urls import include, url

from . import views

urlpatterns = [
    url(r'proofread/([0-9]+)/([0-9]+)/([0-9]+)/([0-9]+)$', views.proofread, name='proofread'),
    #allow edit of current transcript with no transcriptId
    url(r'correct/([0-9]+)/([0-9]+)/([0-9]+)$', views.correct, name='correct'),
    url(r'correct/([0-9]+)/([0-9]+)/([0-9]+)/([0-9]+)$', views.correct, name='correct'),
    #url(r'transcribe/([0-9]+)/([0-9]+)/([0-9]+)$', views.transcribe, name='transcribe'),
]
