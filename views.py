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
        regions = transcript.get("PcGts").get("Page").get("TextRegion");
        if isinstance(regions, dict):
            regions = [regions]
        lineList = []
        if regions:
            for x in regions:
                lines = x.get("TextLine")
                region_width = crop(x.get("Coords").get("@points"), 1).get('w')
                if lines:
                    if isinstance(lines, dict):
                        lines['regionWidth'] = region_width
                        lineList.extend([lines])
                    else: # Assume that lines is a list of lines
                        for line in lines:
                            line['regionWidth'] = region_width
                            lineList.extend([line])
        content_dict = {}
        # TODO Unmessify this, the loop below might be better placed inside the one above
        # TODO Use "readingorder"?
        if lineList:
            for line in lineList:
                line_crop = crop(line.get("Coords").get("@points"))#,True)
                line['crop'] = line_crop
                line_id = line.get("@id")
                line['id'] = line_id
                unicode_string = line.get('TextEquiv').get('Unicode')
                line_tags = []
                for custom in line.get("@custom").replace(' ', '').split('}'):
                    tag_data = custom.split('{')
                    if tag_data[0] and tag_data[0] != "readingOrder": # Skip readingOrder (anything else to skip?)
                        offset_and_length = tag_data[1].lstrip("offset:").split(";length:")
                        start = int(offset_and_length[0])
                        end = start + int(offset_and_length[1].split(';')[0])
                        line_tags.extend([{'offset': start, 'tag': tag_data[0], 'open': True}, {'offset': end, 'tag': tag_data[0], 'open': False}]) # opening and closing tag
                if line_tags:
                    line_tags.sort(key = lambda tag: tag['offset'])
                    tag_stack = [] # TODO Some other data structure?
                    # Copy text and insert tags
                    tag_string = ""
                    range_begin = -1
                    # TODO Make safe safe in the template...
                    keep_open_stack = [] # stack for tags we "close temporarily"
                    for tag in line_tags:
                        offset = tag["offset"]
                        current_tag = tag["tag"]                        
                        # TODO Issues with different tags having the same offsets? Probably works because </span> = </span> but....
                        if offset != range_begin: # has this tag already been closed when closing an outer tag? If so, we don't need to open it again
                            for keep_tag in keep_open_stack:
                                # tag_string += "<" + keep_tag + ">" # The simple XML
                                tag_string += "<span class='" + line_id + "_tag' tag='" + keep_tag + "'>" # What we actually need
                                tag_stack.append(keep_tag)   
                            for i in range(range_begin, offset): # copy characters until we get to the tag
                                tag_string += unicode_string[i]
                            if tag["open"]: # if the tag opens, just add it
                                tag_stack.append(current_tag)
                                # tag_string += "<" + current_tag + ">" # If we could use XML just like this
                                tag_string += "<span class='" + line_id + "_tag' tag='" + current_tag + "'>" # What we actually need
                            else: # if the tag closes, we need to close all open tags until we reach the "original" opening tag
                                previous_tag = tag_stack.pop()
                                while current_tag != previous_tag:
                                    keep_open_stack.append(previous_tag)
                                    #tag_string += "</" + previous_tag + ">" # We miss this information
                                    tag_string += "</span>" # At least closing is easier in this sense
                                    previous_tag = tag_stack.pop()
                                # tag_string += "</" + current_tag + ">" # If it were XML...
                                tag_string += "</span>" # At least closing is easier in this sense
                            # TODO Solve the issue with tags like <blah></blah> after other tags as a consequence of them being closed above....
                        range_begin = offset
                    # copy the rest
                    tag_string += unicode_string[range_begin:]
                    line['Unicode'] = tag_string
                else: # There were no tags in this line
                    line['Unicode'] = unicode_string
        # Get thumbnails
        pages = t_document(request, collId, docId, -1).get('pageList').get('pages')
        thumb_urls =[]
        for thumb_page in pages:
            thumb_urls.append(escape(thumb_page.get("thumbUrl")).replace("&amp;", "&"))# The JavaScript must get the strings like this.
        return render(request, 'edit/correct.html', {
                 'imageUrl': t_document(request, collId, docId, -1).get('pageList').get('pages')[int(page) - 1].get("url"),
                 'lines': lineList,
                 'content': json.dumps(content_dict),
                 'thumbArray': "['" + "', '".join(thumb_urls) + "']",
            })
