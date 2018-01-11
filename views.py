import settings
import logging
import json
from  xml.etree import ElementTree

from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.utils.translation import ugettext_lazy as _
from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.utils.html import escape

from apps.utils.utils import get_ts_session, crop, t_log, crop_as_imagemap
from apps.utils.views import error_view


#Tags config... maybe css classes would be more appropriate?
tags = [
    {"name": "abbrev", "color": "FF0000"},
    {"name": "date", "color": "0000FF"},
    {"name": "gap", "color": "1CE6FF"},
    {"name": "person", "color": "00FF00"},
    {"name": "place", "color": "8A2BE2"},
    {"name": "unclear", "color": "FFCC66"},
    {"name": "organization", "color": "FF00FF"}
]


#########################################################
# This is the view that will desplay a document as pages
# This view has a mode which can be either view or edit
# There are interfaces which determin how the view is rendered
###########################################################

@login_required
def document_view(request, collId=None, docId=None, pageNr=None, transcriptId=None):

    ############################
    # First let's get stuff straight
    ############################
    # Would be nice if we didn't need the collId but "Transkribus says no"
    if collId is None :
        return render(request, 'error.html', {'msg' : _("No collection ID") })

    #we will definitely need to what doc we are accessing
    if docId is None :
        return render(request, 'error.html', {'msg' : _("No document ID") })

    # If we have'nt been told whcih page to access we assume it will be the first
    if pageNr is None :
        pageNr = 1

    # Explicitly set the mode (view/edit) 
    mode = 'view'
    if 'edit' in request.path :
        mode = 'edit'

    # We have some GET parameters, good to know the values for these reasonably early on
    i = request.GET.get('i') if request.GET.get('i') else 'i'

    # Get the role of the current user untils such time as it is available from t.collection
    role = get_role(request,collId)

    # Now check to see if no-one is try to sneak an edit when they shouldn't
    if mode == 'edit' and role not in settings.CAN_EDIT :
        t_log('Redirect user due to insufficient role access. [from: %s to: %s]' % (request.get_full_path(), request.get_full_path().replace('edit', 'view')))
        return HttpResponseRedirect(request.get_full_path().replace('edit', 'view'))
    
    # We get the document data for this document which will give us lots of vital contectual information
    # We should get this data now so we can test whether we need to continue with processing
    dd = document_data(request,collId,docId,pageNr)

    # We don not allow the editing of *any* page that has been set as Ground Truth (we dont' care who you are!!)
    if dd.get("pageStatus") == 'GT' and mode == 'edit' :
        t_log('Redirect user back to view mode since page status is GT. [from: %s to: %s]' % (request.get_full_path(), request.get_full_path().replace('edit', 'view')))
        #TODO display messgae??
        return HttpResponseRedirect(request.get_full_path().replace('edit', 'view'))
    
    # We check to see if the requetsed interface is available for the request mode
    if mode not in settings.INTERFACES[i] :
        #The elephant in the room here being that we are assuming one way
        t_log('Unsupported intrerface/mode combo... [from: %s to: %s]' % (request.get_full_path(), request.get_full_path().replace('edit', 'view')))
        return HttpResponseRedirect(request.get_full_path().replace('edit', 'view'))

    ############################################################################
    # OK, stuff's straight, now we can get busy with the transkribus data....
    ############################################################################
    # Get the transkribus session instance
    t = get_ts_session(request) 
    if isinstance(t,HttpResponse) :
        return error_view(request,t)

    #First we use this call to get a bit of metadata on what the "curent" transcript is for this page (inc. the transcript id)
    curr_ts_md = t.current_ts_md_for_page(request, collId, docId, pageNr)
    if isinstance(curr_ts_md,HttpResponse):
        return error_view(request,curr_ts_md)

    # Now set some vars bae on the metadata for the curent transcript for this page
    transcriptId = curr_ts_md.get("tsId")
    transcript_url = curr_ts_md.get("url")
    
    ###############################################################################
    # Right then this is a POST request, lets do that processing in another method
    ###############################################################################
    if request.method == 'POST':# This is by JQuery...
        return save(request, transcriptId, transcript_url, collId, docId, pageNr)
 
    #############################################################################
    # If it is a GET request then we can do that processing... right here!
    #############################################################################
 
    ###################################################################
    # Fetch the actul transcript data, this is all the fun stuff 
    # polygons and words and the like. t.trnscirpt will return this 
    # data as a python dict
    ###################################################################
    transcript = t.transcript(request, transcriptId, transcript_url)
    if isinstance(transcript,HttpResponse):
        return error_view(request,transcript)
    
    # Get the text regions   
    regions = transcript.get("PcGts").get("Page").get("TextRegion");
    #If there is only one text region we need to put that in an array
    if isinstance(regions, dict):
        regions = [regions]

    # Eh oh, we don't have any regions so we can't edit
    if regions is None and mode == 'edit':
        t_log('Redirect user back to view mode since no regiond on page. [from: %s to: %s]' % (request.get_full_path(), request.get_full_path().replace('edit', 'view')))
        #TODO display a message??
        return HttpResponseRedirect(request.get_full_path().replace('edit', 'view'))

    lineList = regions_to_lines(regions)

    # Eh oh, we don't have any lines so we can't edit
    if len(lineList) == 0 and mode == 'edit':
        t_log('Redirect user back to view mode since no lines in on page. [from: %s to: %s]' % (request.get_full_path(), request.get_full_path().replace('edit', 'view')))
        #TODO display a message??
        return HttpResponseRedirect(request.get_full_path().replace('edit', 'view'))
    
    #The contentArray provides the javascript with a simple strucutre that represents the transcript (perhaps the only one we need?)
    #Let's do the contentArray donkey work here rather than the template
    contentArray = [[0, '', [0,0,0,0,0,0,0,0], 0, '']]
    contentArray.extend([[line.get('@id'), line.get("Unicode"), crop_as_imagemap(line.get("crop")), line.get("regionWidth"), line.get("@custom")] for line in lineList])
    
    # accumExtra I'll be honest I have no idea what it is for... but we can make 
    # it here and pass it in rather than constructing json strings in the template
    accumExtra = dict([(line.get("@id"),{"x": 0, "y": 0, "factor": 1}) for line in lineList])
    
    return render(request, 'edit/edit.html', {
             'imageUrl': dd.get("imageUrl"),
             'pageStatus': dd.get("pageStatus"),
	     'role' : role,
	     'mode' : mode,
             'lines': lineList,
	     'thumbArray': json.dumps(dd.get("thumbArray")),
             'collId': collId,
             'collName': dd.get("collName"),
             'docId': docId,
             'title': dd.get("md").get("title"),
             'pageNo': pageNr,
             'tags': tags,
             'i': i,
             'metadata' : dd.get("md"),
             # Below is the single json structure with all the data.
             # This way we can give this to the javascript with a single 
             # line in the template, I have retained the old method above
             # to provide some backward compat during the transition, we
             # when it become clear thet are only required by the JS  
	     'json_from_view' : json.dumps({
		     'imageUrl': dd.get("imageUrl"),
		     'pageStatus': dd.get("pageStatus"),
		     'role' : role,
		     'mode' : mode,
		     'lines': lineList,
		     'thumbArray': dd.get("thumbArray"),
		     'contentArray' : contentArray,
		     'accumExtra' : accumExtra,
		     'collId': collId,
		     'collName': dd.get("collName"),
		     'docId': docId,
		     'title': dd.get("md").get("title"),
		     'pageNo': pageNr,
		     'i': i,
		     'metadata' : dd.get("md"),
			 'interfaces' : settings.INTERFACES
		})
        })
 
   
##############################################################
# The purpose of regions_to_lines is to return a list of lines :)
# specifically a list of dicts that have all that good line 
# level metadata with some enhancements along the way
##############################################################

def regions_to_lines(regions) :

    #so we have a list (in to which will go the lines
    lineList = []
    if regions is None : return lineList
    # We loop through each region 
    for region in regions:

        #get the lines in a region
        lines = region.get("TextLine")

        #No lines? then we move on to the next region
        if lines is None : continue

        # The lines for a region are a dict rather than a list, oh phooey what can this mean?
        # I guess this region only has one line... lets stick it in a list and carry on like nothing happened
        if isinstance(lines, dict):
            lines = [lines]

        # Loop through the lines and enhance the metadata available
        for line in lines:
            # Tell the line the width of the region
            line['regionWidth'] = crop(region.get("Coords").get("@points"), 1).get('w')

            # Make and @id for the line by gluing together the region id and the line id... 
            # now we have a unique line id (unique for the page anyway)
            line['@id'] = region.get("@id") + line['@id'] 
            
            # store rectangle from polygon coords using apps.utils.utils.crop
            line['crop'] = crop(line.get("Coords").get("@points"))

            #If there exists line.textEquive.Unicode, replace white space NBSP (for some reason that I'm sure will become apparent
            if "TextEquiv" in line and line.get("TextEquiv") is not None and "Unicode" in line.get("TextEquiv") and line.get("TextEquiv").get("Unicode") is not None : 
                line['Unicode'] = line.get("TextEquiv").get("Unicode").replace(" ", "\u00A0")
            else :
                line['Unicode'] = ""
 
            # I'm 99% sure that append is what is needed here rather than extend([list]) 
            # https://stackoverflow.com/questions/252703/difference-between-append-vs-extend-list-methods-in-python 
            lineList.append(line)

    return lineList

#####################################################
# We will need some contectual data from the document 
# so lets get that here
####################################################
def document_data(request, collId, docId, pageNr) : 
    
    t = get_ts_session(request) 
    if isinstance(t,HttpResponse) :
        return error_view(request,t)

    document = t.document(request, collId, docId, -1,ignore_cache=True)
    if isinstance(document,HttpResponse):
        return error_view(request,document)

    # Get all the pages for the document (this will be used for the thumbnail ribbon
    pages = document.get('pageList').get('pages')
    # Extract (and escape the string and then unescape the ampersands in) the thumb urls to a list
    thumb_urls = [escape(thumb_page.get("thumbUrl")).replace("&amp;", "&") for thumb_page in pages]

    # Get the page from dat afrom the document by turing the page number into an index (ALARM BELLS!)
    page = document.get('pageList').get('pages')[int(pageNr) - 1]
    # Now we get the first transcript from the page (which we are hoping is teh correct one) and checking the status of that... really??
    pageStatus = page.get("tsList").get('transcripts')[0].get('status')
    
    # This I understand (leaving aside the derivation of page)
    image_url = page.get("url")
    
    return {'imageUrl' : image_url,
             'pageStatus': pageStatus,
             'thumbArray': thumb_urls, #we json.dumps this later with a load of other stuff
             'collId': collId,
             'collName': document.get('collection').get('colName'),
             'docId': docId,
             'pageNr' : pageNr,
             'md': document.get('md') }

############################### 
# Get the role for current user 
# for the current collection
##############################
def get_role(request,collId) :
    
    t = get_ts_session(request) 
    if isinstance(t,HttpResponse) :
        return error_view(request,t)
    
    collections = t.collections(request)
    if isinstance(collections,HttpResponse):
        return error_view(request,collections)

    for collection in collections:
        if collection.get('colId') == int(collId) :
             return collection.get('role')
 
###############################################
# save the transcript (or report on status).
# The assumption here is that we have a POST 
# request from an ajax call
###############################################
def save(request, transcriptId, transcript_url, collId, docId, pageNr) : 

    t = get_ts_session(request) 
    if isinstance(t,HttpResponse) :
        return error_view(request,t)

    if 'content' in request.POST:

        # The content posted from the save action
        content = json.loads(request.POST.get('content'))

        # The page XML (As xml not transformed into a dict)
        transcript_xml = t.transcript_xml(request, transcriptId, transcript_url)
        if isinstance(transcript_xml,HttpResponse):
            return error_view(request,transcript_xml)

        # Get the document root for the transcirpt
        transcript_root = ElementTree.fromstring(transcript_xml)
        
        # Set Namespace
        namespace = "http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15"

        # Loop through the regions
        for text_region in transcript_root.iter('{'+namespace+'}TextRegion'):# We have to have the namespace...
            regionTextEquiv = ""
            # Loop through the lines
            for line in text_region.iter('{'+namespace+'}TextLine'):
                # Get the parallel line from the posted content
                modified_content = content.get(text_region.get("id") + line.get("id"))
                # Update the custom tag
                line.set("custom", modified_content.get("custom"))
                # Get the Unicode from the posted content
                modified_text = modified_content.get("Unicode")
                # And a newline
                regionTextEquiv += modified_text +"\r\n"
                # Update the XML
                line.find('{'+namespace+'}TextEquiv').find('{'+namespace+'}Unicode').text = modified_text
            # Get the textEquiv and update with Unicode from the posted content (if the textEquiv can be found)
            text_equiv = text_region.find('{'+namespace+'}TextEquiv')
            if text_equiv:
                text_equiv.find('{'+namespace+'}Unicode').text = regionTextEquiv
        
        # Loop done we can send the new XML to transkribus
        t_log("SAVING : %s" % ElementTree.tostring(transcript_root), logging.WARN)
        status_code = t.save_transcript(request, ElementTree.tostring(transcript_root), collId, docId, pageNr, transcriptId)
        # save_transcript now returns a status code, TODO react appropriately to status_code

        # Reload the updated content from transkribus (this is umportant to bring in the tsId)
        current_transcript = t.current_transcript(request, collId, docId, pageNr)
        if isinstance(current_transcript,HttpResponse):
            # We have an error message!
            t_log("current_transcript request has failed... %s" % current_transcript)
            return HttpResponse(str(_("Transcript NOT saved")), content_type="text/plain")
        
        # Report success?!?
        success_message = str(_("Transcript saved!"))
        return HttpResponse(success_message, content_type="text/plain")

    ######################################
    # We are just updating the status here
    ###################################### 
    elif 'status' in request.POST:
        t.save_page_status(request, request.POST.get('status'), collId, docId, pageNr, transcriptId)
        #TODO save_page_status should retun any errors like almost all the other calls 
        success_message = str(_("Page status changed!"))
        return HttpResponse(success_message, content_type="text/plain")
    else :
        # Nothing doing...
        return render(request, 'error.html', {'msg' : _("No content or status in post") })









########################################################
# Legacy code temporarily stored here for reference
########################################################

@login_required
#def proofread(request, collId, docId, page=None, transcriptId=None):# TODO Decide whether to select which transcript to work with unless it should always be the newest?
def proofread(request, collId, docId, page, transcriptId=None):# TODO Decide whether to select which transcript to work with unless it should always be the newest?

    t = request.user.tsdata.t

    #RM default to page 1
#    if page is None :
#        page = 1

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
        t.save_transcript(request, ElementTree.tostring(transcript_root), collId, docId, page, transcriptId)
        current_transcript = t.current_transcript(request, collId, docId, page)# We want the updated transcript now.
        if isinstance(current_transcript,HttpResponse):
            return apps.utils.views.error_view(request,current_transcript)
        return HttpResponse(str(_("Transcript saved!")), content_type="text/plain")
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
#def correct(request, collId, docId, page, transcriptId=None):# TODO Decide whether to select which transcript to work with unless it should always be the newest?

    t = request.user.tsdata.t

    #RM default to page 1
    if page is None :
        page = 1

    #Use this to get the role of the current user untils such time as it is available from t.collection
    role = apps.utils.utils.get_role(request,collId)
    if 'edit' in request.path and not (role == 'Editor' or role == 'Owner' or role == 'Admin' or role == 'CrowdTranscriber' or role == 'Transcriber'):
        t_log('Redirect user due to insufficient role access. [from: %s to: %s]' % (request.get_full_path(), request.get_full_path().replace('edit', 'view')))
        return HttpResponseRedirect(request.get_full_path().replace('edit', 'view'))

    current_transcript = t.current_transcript(request, collId, docId, page)
    if isinstance(current_transcript,HttpResponse):
        return apps.utils.views.error_view(request,current_transcript)
    transcript = t.transcript(request, current_transcript.get("tsId"), current_transcript.get("url"))
    if isinstance(transcript,HttpResponse):
        return apps.utils.views.error_view(request,transcript)

    #RM Add arrow-in-breadcrumb-bar navigation to sibling documents
    collection = t.collection(request, {'collId': collId})
#    nav = navigation.up_next_prev(request,"document",docId,collection,[collId])

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
                    if "custom" in modified_content :
                        line.set("custom", modified_content.get("custom"))
                    if "Unicode" in modified_content :
                        modified_text = modified_content.get("Unicode")
                        regionTextEquiv += modified_text +"\r\n"
                        t_equiv = line.find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv')
                        ##############################################################
                        # RM in cases where the is no TextQuiv (or Unicde) tag already
                        # We must make one before attempting to add modified text
                        #############################################################
                        if t_equiv is None :
                            t_equiv = ElementTree.SubElement(line,'{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv')
                            ElementTree.SubElement(t_equiv,'{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode')
                        t_equiv.find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode').text = modified_text
                r_text_equiv = text_region.find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv')
                ##############################################################
                # RM in cases where the is no TextQuiv (or Unicde) tag already
                # We must make one before attempting to add modified text
                #############################################################
                if r_text_equiv is None:
                    r_text_equiv = ElementTree.SubElement(text_region,'{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv')
                    ElementTree.SubElement(r_text_equiv,'{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode')
    
                r_text_equiv.find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode').text = regionTextEquiv
            t.save_transcript(request, ElementTree.tostring(transcript_root), collId, docId, page, transcriptId)
            current_transcript = t.current_transcript(request, collId, docId, page)# We want the updated transcript now.
            #RM add some error catching (though somewhat suboptimal)
            if isinstance(current_transcript,HttpResponse):
                t_log("current_transcript request has failed... %s" % current_transcript)
                #For now this will do but there may be other reasons the transckribus request fails...
                return apps.utils.views.error_view(request, current_transcript)

            success_message = str(_("Transcript saved!"))
            return HttpResponse(success_message, content_type="text/plain")
        elif 'status' in request.POST:
            t.save_page_status(request, request.POST.get('status'), collId, docId, page, transcriptId)
            success_message = str(_("Page status changed!"))
            return HttpResponse(success_message, content_type="text/plain")
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
                    unicode = textEquiv.get("Unicode")
                    if unicode:
                        line['Unicode'] = unicode.replace(" ", "\u00A0")
                    else:
                        line['Unicode'] = ""
        else:
            if 'edit' in request.path:
                t_log('Redirect user back to view mode since no lines in on page. [from: %s to: %s]' % (request.get_full_path(), request.get_full_path().replace('edit', 'view')))
                return HttpResponseRedirect(request.get_full_path().replace('edit', 'view'))

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
            if  0 < thumb_page.get("tsList").get("transcripts")[0].get("nrOfLines"):
                if 0 < thumb_page.get("tsList").get("transcripts")[0].get("nrOfTranscribedLines"):
                    thumb_urls.append("['" + escape(thumb_page.get("thumbUrl")).replace("&amp;", "&") + "', 'transcribed']")# The JavaScript must get the strings like this.
                else:
                    thumb_urls.append("['" + escape(thumb_page.get("thumbUrl")).replace("&amp;", "&") + "', 'only-segmented']")# The JavaScript must get the strings like this.
            else:
                thumb_urls.append("['" + escape(thumb_page.get("thumbUrl")).replace("&amp;", "&") + "', 'no-segmentation']")# The JavaScript must get the strings like this.
                
        pageStatus = document.get('pageList').get('pages')[int(page) - 1].get("tsList").get('transcripts')[0].get('status')
        if pageStatus == 'GT' and 'edit' in request.path:
            t_log('Redirect user back to view mode since page status is GT. [from: %s to: %s]' % (request.get_full_path(), request.get_full_path().replace('edit', 'view')))
            return HttpResponseRedirect(request.get_full_path().replace('edit', 'view'))
        i = request.GET.get('i') if request.GET.get('i') else 'i'
        if i == 'sbs' or i == 't' and 'edit' in request.path:
            t_log('Redirect user back to view mode since interface "sbs" and "t" do not support edit. [from: %s to: %s]' % (request.get_full_path(), request.get_full_path().replace('edit', 'view')))
            return HttpResponseRedirect(request.get_full_path().replace('edit', 'view'))

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
                 'pageStatus': pageStatus,
                 'lines': lineList,
                 'thumbArray': "[" + ", ".join(thumb_urls) + "]",
                 'collId': collId,
                 'collName': document.get('collection').get('colName'),
                 'docId': docId,
                 'title': document.get('md').get('title'),
                 'pageNo': page,
                 'tags': tags,
                 'i': i,
                 'role': role,
		         'metadata' : document.get('md'),
                 #'regionData': regionData,
            }
        # we can add the navdata to the end of it
        view_data.update(navdata)

        return render(request, 'edit/correct.html', view_data)
