from django.conf.urls import include, url

from . import views

urlpatterns = [
    url(r'^(\d+)/(\d+)/$', views.correct, name='correct'),
    # allow edit of current transcript with no transcriptId, also allow omission of the page number (needed at least to get the path for s
    url(r'^(\d+)/(\d+)/(\d+)/$', views.correct, name='correct'),
    # url(r'^(\d+)/(\d+)/(\d+)/(\d+)$', views.correct, name='correct'),
    #url(r'transcribe/(\d+)/(\d+)/(\d+)$', views.transcribe, name='transcribe'),
]
