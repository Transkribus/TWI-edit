from django.conf.urls import include, url

from . import views

urlpatterns = [

    #These url rules are for when such time that we can acccess documnets with no care as to what collection they belong to
    url(r'd/(?P<docId>[0-9]+)/(?P<pageNr>[0-9]+)/(?P<tsid>[0-9]+)/$', views.document_view),
    url(r'd/(?P<docId>[0-9]+)/(?P<pageNr>[0-9]+)/$', views.document_view),
    url(r'd/(?P<docId>[0-9]+)/$', views.document_view), 
    #but in reality we will be using these for the forseeable
    url(r'(?P<collId>[0-9]+)/(?P<docId>[0-9]+)/(?P<pageNr>[0-9]+)/(?P<transcriptId>[0-9]+)/$', views.document_view),
    url(r'(?P<collId>[0-9]+)/(?P<docId>[0-9]+)/(?P<pageNr>[0-9]+)/$', views.document_view),
    url(r'(?P<collId>[0-9]+)/(?P<docId>[0-9]+)/$', views.document_view),

    # back comapat for refs to edit:correct (the irony is too much to bear) 
    # TODO update these various refs 
    # with the more descriptive document_view and remove the below
    url(r'^([0-9]+)/([0-9]+)$', views.document_view, name='correct'),
    #allow edit of current transcript with no transcriptId, also allow omission of the page number (needed at least to get the path for some JavaScript stuff)
    url(r'^([0-9]+)/([0-9]+)/([0-9]+)$', views.document_view, name='correct'),
    url(r'^([0-9]+)/([0-9]+)/([0-9]+)/([0-9]+)$', views.document_view, name='correct'),
    #url(r'transcribe/([0-9]+)/([0-9]+)/([0-9]+)$', views.transcribe, name='transcribe'),

]
