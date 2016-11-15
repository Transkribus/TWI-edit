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

#Imports pf read modules
from read.decorators import t_login_required
from read.services import *
from read.utils import crop
#t_collection, t_register,

#Imports from app (library)
import library.settings
import library.navigation# TODO Fix this import!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
from library.forms import RegisterForm, IngestMetsUrlForm, MetsFileForm

#from profiler import profile #profile is a decorator, but things get circular if I include it in decorators.py so...

@t_login_required
def proofread(request, collId, docId, page, transcriptId):# TODO Decide whether to select which transcript to work with unless it should always be the newest?
    current_transcript = t_current_transcript(request, collId, docId, page)
    transcript = t_transcript(request, current_transcript.get("tsId"), current_transcript.get("url"))
    transcriptId = str(transcript.get("tsId"))
    if request.method == 'POST':# This is by JQuery...
        content = json.loads(request.POST.get('content'))
        transcript_xml = t_transcript_xml(request, transcriptId, current_transcript.get("url"))
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
        t_save_transcript(request, ElementTree.tostring(transcript_root), collId, docId, page)
        current_transcript = t_current_transcript(request, collId, docId, page)# We want the updated transcript now.
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
        
        content_dict = {}
        # TODO Use "readingorder"?
        if lineList:
            for line in lineList:
                line_crop = crop(line.get("Coords").get("@points"))#,True)
                line['crop'] = line_crop
                line_id = line.get("@id")
                line['id'] = line_id
                line['Unicode'] = line.get('TextEquiv').get('Unicode')
        
    return render(request, 'edit/proofread.html', {
        'imageUrl': t_document(request, collId, docId, -1).get('pageList').get('pages')[int(page) - 1].get("url"),
        'lines': lineList
        })

@t_login_required
def correct(request, collId, docId, page, transcriptId=None):# TODO Decide whether to select which transcript to work with unless it should always be the newest?
    current_transcript = t_current_transcript(request, collId, docId, page)
    transcript = t_transcript(request, current_transcript.get("tsId"), current_transcript.get("url"))
    transcriptId = str(transcript.get("tsId"))
    if request.method == 'POST':# This is by JQuery...
        content = json.loads(request.POST.get('content'))
        transcript_xml = t_transcript_xml(request, transcriptId, current_transcript.get("url"))
        transcript_root = ElementTree.fromstring(transcript_xml)
        # TODO Decide what to do about regionId... It's not necessary....
        for text_region in transcript_root.iter('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextRegion'):# We have to have the namespace...
            regionTextEquiv = ""
            for line in text_region.iter('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextLine'):
                modified_text = content.get(line.get("id"))
                regionTextEquiv += modified_text +"\r\n"
                line.find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv').find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode').text = modified_text
            text_region.find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv').find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode').text = regionTextEquiv
        t_save_transcript(request, ElementTree.tostring(transcript_root), collId, docId, page)
        current_transcript = t_current_transcript(request, collId, docId, page)# We want the updated transcript now.
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

        content_dict = {}
        # TODO Use "readingorder"?
        if lineList:
            for line in lineList:
                line_crop = crop(line.get("Coords").get("@points"))#,True)
                line['crop'] = line_crop
                line_id = line.get("@id")
                line['id'] = line_id
                line['Unicode'] = line.get('TextEquiv').get('Unicode')
        return render(request, 'edit/correct.html', {
             'imageUrl': t_document(request, collId, docId, -1).get('pageList').get('pages')[int(page) - 1].get("url"),
             'lines': lineList,
             'content': json.dumps(content_dict)
            })
