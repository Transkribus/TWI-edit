from django.conf.urls import include, url

from . import views

urlpatterns = [
    url(r'^([0-9]+)/([0-9]+)$', views.correct, name='correct'),
    #allow edit of current transcript with no transcriptId, also allow omission of the page number (needed at least to get the path for some JavaScript stuff)
    url(r'^([0-9]+)/([0-9]+)/([0-9]+)$', views.correct, name='correct'),
    url(r'^([0-9]+)/([0-9]+)/([0-9]+)/([0-9]+)$', views.correct, name='correct'),
    #url(r'transcribe/([0-9]+)/([0-9]+)/([0-9]+)$', views.transcribe, name='transcribe'),

    url(r'^([0-9]+)/([0-9]+)$', views.correct, name='document-view'),
    #allow edit of current transcript with no transcriptId, also allow omission of the page number (needed at least to get the path for some JavaScript stuff)
    url(r'^([0-9]+)/([0-9]+)/([0-9]+)$', views.correct, name='document-view'),
    url(r'^([0-9]+)/([0-9]+)/([0-9]+)/([0-9]+)$', views.correct, name='document-view'),
 
]
