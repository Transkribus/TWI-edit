#imports of python modules
import json
import sys
import re
import random
from  xml.etree import ElementTree

#Imports of django modules
from django.http import HttpResponse
from django.http import JsonResponse
from django.shortcuts import render
from django.http import HttpResponseRedirect
from django.utils import translation
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils.translation import ugettext_lazy as _
from django.template.loader import render_to_string
from django.utils.html import escape

#Imports pf <del>read</del> utils modules
from apps.utils.services import *
from apps.utils.utils import crop
import settings
import apps.edit.settings
from apps.navigation import navigation

#Imports from app (library)
#import library.settings
#import library.navigation# TODO Fix this import!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
#from library.forms import RegisterForm, IngestMetsUrlForm, MetsFileForm

#from profiler import profile #profile is a decorator, but things get circular if I include it in decorators.py so...

@login_required
def proofread(request, collId, docId, page=None, transcriptId=None):# TODO Decide whether to select which transcript to work with unless it should always be the newest?
    t = request.user.tsdata.t

    #RM default to page 1
    if page is None :
        page = 1

    current_transcript = t.current_transcript(request, collId, docId, page)
    if isinstance(current_transcript,HttpResponse):
        return apps.utils.views.error_view(request,current_transcript)
    transcript = t.transcript(request, current_transcript.get("tsId"), current_transcript.get("url"))
    if isinstance(transcript,HttpResponse):
        return apps.utils.views.error_view(request,transcript)

    transcriptId = str(transcript.get("tsId"))
    if request.method == 'POST':# This is by JQuery...
        content = json.loads(request.POST.get('content'))
        transcript_xml = t.transcript_xml(request, transcriptId, current_transcript.get("url"))
        if isinstance(transcript_xml,HttpResponse):
            return apps.utils.views.error_view(request,transcript_xml)
        transcript_root = ElementTree.fromstring(transcript_xml)
        # TODO Decide what to do about regionId... It's not necessary....
        for text_region in transcript_root.iter('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextRegion'):# We have to have the namespace...
            regionTextEquiv = ""
            for line in text_region.iter('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextLine'):
                modified_text = content.get(line.get("id")) # Only lines which have changed are submitted...
                if None == modified_text:
                    modified_text = line.find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv').find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode').text
                else:
                    line.find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv').find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode').text = modified_text
                regionTextEquiv += modified_text +"\r\n"
            text_region.find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv').find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode').text = regionTextEquiv
        t.save_transcript(request, ElementTree.tostring(transcript_root), collId, docId, page)
        current_transcript = t.current_transcript(request, collId, docId, page)# We want the updated transcript now.
        if isinstance(current_transcript,HttpResponse):
            return apps.utils.views.error_view(request,current_transcript)
        success_message = str(_("Transcript saved!"))
        return HttpResponse("<div class='alert alert-success'>" + success_message + "</div>", content_type="text/plain")
    else:
        regions=transcript.get("PcGts").get("Page").get("TextRegion");

        if isinstance(regions, dict):
            regions = [regions]

        lineList = []
        if regions:
            for x in regions:
                lines = x.get("TextLine")
                if isinstance(lines, dict):
                    lineList.extend([lines])
                else: # Assume that lines is a list of lines
                    for line in lines:
                        lineList.extend([line])

        # TODO Use "readingorder"?
        if lineList:
            for line in lineList:
                line['crop'] = crop(line.get("Coords").get("@points"))#,True)
                line['id'] = line.get("@id")
                line['Unicode'] = line.get('TextEquiv').get('Unicode')

    #RM need to test whether this has been successful
    document = t.document(request, collId, docId, -1)
    if isinstance(document,HttpResponse):
        return apps.utils.views.error_view(request,document)

    return render(request, 'edit/proofread.html', {
        'imageUrl': document.get('pageList').get('pages')[int(page) - 1].get("url"),
        'lines': lineList
        })

@login_required
def correct(request, collId, docId, page=None, transcriptId=None):# TODO Decide whether to select which transcript to work with unless it should always be the newest?
    t = request.user.tsdata.t

    #RM default to page 1
    if page is None :
        page = 1

    current_transcript = t.current_transcript(request, collId, docId, page)
    if isinstance(current_transcript,HttpResponse):
        return apps.utils.views.error_view(request,current_transcript)
    transcript = t.transcript(request, current_transcript.get("tsId"), current_transcript.get("url"))
    if isinstance(transcript,HttpResponse):
        return apps.utils.views.error_view(request,transcript)

    #RM Add arrow-in-breadcrumb-bar navigation to sibling documents
    collection = t.collection(request, {'collId': collId})
    nav = navigation.up_next_prev(request,"document",docId,collection,[collId])

    navdata = navigation.get_nav(collection,docId,'docId','title')

    transcriptId = str(transcript.get("tsId"))
    if request.method == 'POST':# This is by JQuery...
        if 'content' in request.POST:
            content = json.loads(request.POST.get('content'))
            transcript_xml = t.transcript_xml(request, transcriptId, current_transcript.get("url"))
            if isinstance(transcript_xml,HttpResponse):
                return apps.utils.views.error_view(request,transcript_xml)
            transcript_root = ElementTree.fromstring(transcript_xml)
            # TODO Decide what to do about regionId... It's not necessary....
            for text_region in transcript_root.iter('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextRegion'):# We have to have the namespace...
                regionTextEquiv = ""
                for line in text_region.iter('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextLine'):
                    modified_content = content.get(text_region.get("id") + line.get("id"))
                    line.set("custom", modified_content.get("custom"))
                    modified_text = modified_content.get("Unicode")
                    regionTextEquiv += modified_text +"\r\n"
                    line.find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv').find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode').text = modified_text
                text_region.find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv').find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode').text = regionTextEquiv
            t.save_transcript(request, ElementTree.tostring(transcript_root), collId, docId, page)
            current_transcript = t.current_transcript(request, collId, docId, page)# We want the updated transcript now.
            #RM add some error catching (though somewhat suboptimal)
            if isinstance(current_transcript,HttpResponse):
                t_log("current_transcript request has failed... %s" % current_transcript)
                #For now this will do but there may be other reasons the transckribus request fails...
                return apps.utils.views.error_view(request, current_transcript)

            success_message = str(_("Transcript saved!"))
            return HttpResponse("<div class='alert alert-success'>" + success_message + "</div>", content_type="text/plain")
        elif 'status' in request.POST:
            t.save_page_status(request, request.POST.get('status'), collId, docId, page, transcriptId)
            success_message = str(_("Page status changed!"))
            return HttpResponse("<div class='alert alert-success'>" + success_message + "</div>", content_type="text/plain")
    else:
        regions = transcript.get("PcGts").get("Page").get("TextRegion");
        if isinstance(regions, dict):
            regions = [regions]
        lineList = []
        #regionData = [] # Let's leave this here for now, it might still be needed.
        if regions:
            for x in regions:
                lines = x.get("TextLine") # Region!
                region_width = crop(x.get("Coords").get("@points"), 1).get('w')
                if lines:
                    if isinstance(lines, dict):
                        lines['regionWidth'] = region_width
                        lines['@id'] = x.get("@id") + lines['@id'] # TODO Figure out why this results in region_blah_region_blah_line instead of just region_blah_line_
                        lineList.extend([lines])
                        #regionData.extend([x.get("@id"), 1])
                    else: # Assume that lines is a list of lines
                        for line in lines:
                            line['regionWidth'] = region_width
                            line['@id'] = x.get("@id") + line['@id'] # TODO Figure out why this results in region_blah_region_blah_line instead of just region_blah_line_
                            lineList.extend([line])
                        #regionData.extend([x.get("@id"), len(lines)])
        content_dict = {}
        # TODO Unmessify this, the loop below might be better placed inside the one above
        if lineList:
            for line in lineList:
                line_crop = crop(line.get("Coords").get("@points"))
                line['crop'] = line_crop
                textEquiv = line.get("TextEquiv")
                if textEquiv:
                    line['Unicode'] = textEquiv.get("Unicode")
        # Get thumbnails
        # RM Make one document request here...
        # RM need to test whether this has been successful
        document = t.document(request, collId, docId, -1)
        if isinstance(document,HttpResponse):
            return apps.utils.views.error_view(request,document)
        # RM and get pages from the result... and also the url further down
        pages = document.get('pageList').get('pages')
        thumb_urls =[]
        for thumb_page in pages:
            thumb_urls.append(escape(thumb_page.get("thumbUrl")).replace("&amp;", "&"))# The JavaScript must get the strings like this.

        tags = [
            {"name": "abbrev", "color": "FF0000"},
            {"name": "date", "color": "0000FF"},
            {"name": "gap", "color": "1CE6FF"},
            {"name": "person", "color": "00FF00"},
            {"name": "place", "color": "8A2BE2"},
            {"name": "unclear", "color": "FFCC66"},
            {"name": "organization", "color": "FF00FF"}
        ]
        #RM defined the dict for all the stuff going to the view so...
        view_data = {
                 'imageUrl': document.get('pageList').get('pages')[int(page) - 1].get("url"),
                 'pageStatus': document.get('pageList').get('pages')[int(page) - 1].get("tsList").get('transcripts')[0].get('status'),
                 'lines': lineList,
                 'thumbArray': "['" + "', '".join(thumb_urls) + "']",
                 'collId': collId,
                 'collName': document.get('collection').get('colName'),
                 'docId': docId,
                 'title': document.get('md').get('title'),
                 'pageNo': page,
                 'tags': tags,
                 'view': request.GET.get('view') if request.GET.get('view') else "i",
		 'metadata' : document.get('md'),
                 #'regionData': regionData,
            }
        # we can add the navdata to the end of it
        view_data.update(navdata)

        return render(request, 'edit/correct.html', view_data)
