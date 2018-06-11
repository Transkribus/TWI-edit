import json

from xml.etree import ElementTree

from django.http import HttpResponse
from django.shortcuts import render
from django.http import HttpResponseRedirect
from django.contrib.auth.decorators import login_required
from django.utils.translation import ugettext_lazy as _
from django.utils.html import escape

from compat import navigation
from compat import utils
from compat import templatetags

from compat.services import *
from compat.utils import crop, t_log
from compat.views import error_view

def remove_prefix(data):
    keys = tuple(data.keys())
    for key in keys:
        if key.startswith('@'):
            data[key[1:]] = data[key]
    return data

@login_required
# TODO Decide whether to select which transcript to work with unless it
# should always be the newest?
def proofread(request, collId, docId, page, transcriptId=None):

    t = request.user.tsdata.t

    # RM default to page 1
#    if page is None :
#        page = 1

    current_transcript = t.current_transcript(request, collId, docId, page)
    if isinstance(current_transcript, HttpResponse):
        return error_view(request, current_transcript)
    transcript = t.transcript(request, current_transcript.get(
        "tsId"), current_transcript.get("url"))
    if isinstance(transcript, HttpResponse):
        return error_view(request, transcript)

    transcriptId = str(transcript.get("tsId"))
    if request.method == 'POST':  # This is by JQuery...
        content = json.loads(request.POST.get('content'))
        transcript_xml = t.transcript_xml(
            request, transcriptId, current_transcript.get("url"))
        if isinstance(transcript_xml, HttpResponse):
            return error_view(request, transcript_xml)
        transcript_root = ElementTree.fromstring(transcript_xml)
        # TODO Decide what to do about regionId... It's not necessary....
        # We have to have the namespace...
        for text_region in transcript_root.iter(
                '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextRegion'):
            regionTextEquiv = ""
            for line in text_region.iter(
                    '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextLine'):
                # Only lines which have changed are submitted...
                modified_text = content.get(line.get("id"))
                if None == modified_text:
                    modified_text = line.find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv').find(
                        '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode').text
                else:
                    line.find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv').find(
                        '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode').text = modified_text
                regionTextEquiv += modified_text + "\r\n"
            text_region.find('{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv').find(
                '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode').text = regionTextEquiv
        t.save_transcript(request, ElementTree.tostring(
            transcript_root), collId, docId, page, transcriptId)
        # We want the updated transcript now.
        current_transcript = t.current_transcript(request, collId, docId, page)
        if isinstance(current_transcript, HttpResponse):
            return error_view(request, current_transcript)
        return HttpResponse(str(_("Transcript saved!")),
                            content_type="text/plain")
    else:
        regions = transcript.get("PcGts").get("Page").get("TextRegion")

        if isinstance(regions, dict):
            regions = [regions]

        lineList = []
        if regions:
            for x in regions:
                lines = x.get("TextLine")
                if isinstance(lines, dict):
                    lineList.extend([lines])
                else:  # Assume that lines is a list of lines
                    for line in lines:
                        lineList.extend([line])

        # TODO Use "readingorder"?
        if lineList:
            for line in lineList:

                line = remove_prefix(line)

                line['crop'] = crop(line.get("Coords").get("points"))  # ,True)

                line['coords_for_imagemap'] = templatetags.coords_for_imagemap(
                    line['crop'])
                line['id'] = line['id']
                line['Unicode'] = line.get('TextEquiv').get('Unicode') or ''

    # RM need to test whether this has been successful
    document = t.document(request, collId, docId, -1)
    if isinstance(document, HttpResponse):
        return error_view(request, document)

    if len(lineList) > 0:
        first_line = line_list[0]
    else:
        first_line = None

    return render(
        request,
        'edit/proofread.html',
        {
            'imageUrl': document.get('pageList').get('pages')[
                int(page) -
                1].get("url"),
            'lines': lineList,
            'first_line': first_line})


@login_required
# TODO Decide whether to select which transcript to work with unless it
# should always be the newest?
def correct(request, collId, docId, page=None, transcriptId=None):
    # def correct(request, collId, docId, page, transcriptId=None):# TODO
    # Decide whether to select which transcript to work with unless it should
    # always be the newest?

    t = request.user.tsdata.t

    # RM default to page 1
    if page is None:
        page = 1

    # Use this to get the role of the current user untils such time as it is
    # available from t.collection
    role = utils.get_role(request, collId)
    if 'edit' in request.path and not (
            role == 'Editor' or role == 'Owner' or role ==
            'Admin' or role == 'CrowdTranscriber' or role == 'Transcriber'):
        t_log('Redirect user due to insufficient role access. [from: %s to: %s]' % (
            request.get_full_path(), request.get_full_path().replace('edit', 'view')))
        return HttpResponseRedirect(
            request.get_full_path().replace(
                'edit', 'view'))

    current_transcript = t.current_transcript(request, collId, docId, page)
    if isinstance(current_transcript, HttpResponse):
        return error_view(request, current_transcript)
    transcript = t.transcript(request, current_transcript.get(
        "tsId"), current_transcript.get("url"))
    if isinstance(transcript, HttpResponse):
        return error_view(request, transcript)

    # RM Add arrow-in-breadcrumb-bar navigation to sibling documents
    collection = t.collection(request, {'collId': collId})
#    nav = navigation.up_next_prev(request,"document",docId,collection,[collId])

    navdata = navigation.get_nav(collection, docId, 'docId', 'title')

    transcriptId = str(transcript.get("tsId"))
    if request.method == 'POST':  # This is by JQuery...
        if 'content' in request.POST:
            content = json.loads(request.POST.get('content'))
            transcript_xml = t.transcript_xml(
                request, transcriptId, current_transcript.get("url"))
            if isinstance(transcript_xml, HttpResponse):
                return error_view(request, transcript_xml)
            transcript_root = ElementTree.fromstring(transcript_xml)
            # TODO Decide what to do about regionId... It's not necessary....
            # We have to have the namespace...
            for text_region in transcript_root.iter(
                    '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextRegion'):
                regionTextEquiv = ""
                for line in text_region.iter(
                        '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextLine'):
                    modified_content = content.get(
                        text_region.get("id") + line.get("id"))
                    if "custom" in modified_content:
                        line.set("custom", modified_content.get("custom"))
                    if "Unicode" in modified_content:
                        modified_text = modified_content.get("Unicode")
                        regionTextEquiv += modified_text + "\r\n"
                        t_equiv = line.find(
                            '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv')
                        #######################################################
                        # RM in cases where the is no TextQuiv (or Unicde) tag already
                        # We must make one before attempting to add modified text
                        #######################################################
                        if t_equiv is None:
                            t_equiv = ElementTree.SubElement(
                                line, '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv')
                            ElementTree.SubElement(
                                t_equiv,
                                '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode')
                        t_equiv.find(
                            '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode').text = modified_text
                r_text_equiv = text_region.find(
                    '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv')
                ##############################################################
                # RM in cases where the is no TextQuiv (or Unicde) tag already
                # We must make one before attempting to add modified text
                #############################################################
                if r_text_equiv is None:
                    r_text_equiv = ElementTree.SubElement(
                        text_region,
                        '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}TextEquiv')
                    ElementTree.SubElement(
                        r_text_equiv,
                        '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode')

                r_text_equiv.find(
                    '{http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15}Unicode').text = regionTextEquiv
            t.save_transcript(request, ElementTree.tostring(
                transcript_root), collId, docId, page, transcriptId)
            # We want the updated transcript now.
            current_transcript = t.current_transcript(
                request, collId, docId, page)
            # RM add some error catching (though somewhat suboptimal)
            if isinstance(current_transcript, HttpResponse):
                t_log("current_transcript request has failed... %s" %
                      current_transcript)
                # For now this will do but there may be other reasons the
                # transckribus request fails...
                return error_view(request, current_transcript)

            success_message = str(_("Transcript saved!"))
            return HttpResponse(success_message, content_type="text/plain")
        elif 'status' in request.POST:
            t.save_page_status(request, request.POST.get(
                'status'), collId, docId, page, transcriptId)
            success_message = str(_("Page status changed!"))
            return HttpResponse(success_message, content_type="text/plain")
    else:
        regions = transcript.get("PcGts").get("Page").get("TextRegion")
        if isinstance(regions, dict):
            regions = [regions]
        lineList = []
        # regionData = [] # Let's leave this here for now, it might still be
        # needed.
        if regions:
            for x in regions:
                lines = x.get("TextLine")  # Region!
                region_width = crop(x.get("Coords").get("@points"), 1).get('w')
                if lines:
                    if isinstance(lines, dict):
                        lines['regionWidth'] = region_width
                        # TODO Figure out why this results in
                        # region_blah_region_blah_line instead of just
                        # region_blah_line_, the transcript already has the
                        # duplicate region_blah for each line
                        lines['@id'] = x.get("@id") + lines['@id']
                        lineList.extend([lines])
                        #regionData.extend([x.get("@id"), 1])
                    else:  # Assume that lines is a list of lines
                        for line in lines:
                            line['regionWidth'] = region_width
                            # TODO Figure out why this results in
                            # region_blah_region_blah_line instead of just
                            # region_blah_line_, the transcript already has the
                            # duplicate region_blah for each line
                            line['@id'] = x.get("@id") + line['@id']
                            lineList.extend([line])
                        #regionData.extend([x.get("@id"), len(lines)])
        content_dict = {}
        # TODO Unmessify this, the loop below might be better placed inside the
        # one above
        if lineList:
            for line in lineList:

                line = remove_prefix(line)

                # line_crop = crop(line.get("Coords").get("@points"))
                # line['crop'] = line_crop

                remove_prefix(line['Coords'])

                line['crop'] = crop(line.get("Coords").get("points"))  # ,True)

                line['coords_for_imagemap'] = templatetags.coords_for_imagemap(
                    line['crop'])
                line['id'] = line['id']
                line['Unicode'] = line.get('TextEquiv', {'Unicode': ''}).get('Unicode', '')

                textEquiv = line.get("TextEquiv")
                if textEquiv:
                    unicode = textEquiv.get("Unicode")
                    if unicode:
                        line['Unicode'] = unicode.replace(" ", "\u00A0")
                    else:
                        line['Unicode'] = ""
        else:
            if 'edit' in request.path:
                t_log(
                    'Redirect user back to view mode since no lines in on page. [from: %s to: %s]' %
                    (request.get_full_path(),
                     request.get_full_path().replace(
                        'edit',
                        'view')))
                return HttpResponseRedirect(
                    request.get_full_path().replace(
                        'edit', 'view'))

        # Get thumbnails
        # RM Make one document request here...
        # RM need to test whether this has been successful
        document = t.document(request, collId, docId, -1)
        if isinstance(document, HttpResponse):
            return error_view(request, document)
        # RM and get pages from the result... and also the url further down
        pages = document.get('pageList').get('pages')
        thumb_urls = []
        for thumb_page in pages:
            if 0 < thumb_page.get("tsList").get(
                    "transcripts")[0].get("nrOfLines"):
                if 0 < thumb_page.get("tsList").get("transcripts")[
                        0].get("nrOfTranscribedLines"):
                    # The JavaScript must get the strings like this.
                    thumb_urls.append(
                        "['" +
                        escape(
                            thumb_page.get("thumbUrl")).replace(
                            "&amp;",
                            "&") +
                        "', 'transcribed']")
                else:
                    # The JavaScript must get the strings like this.
                    thumb_urls.append(
                        "['" +
                        escape(
                            thumb_page.get("thumbUrl")).replace(
                            "&amp;",
                            "&") +
                        "', 'only-segmented']")
            else:
                # The JavaScript must get the strings like this.
                thumb_urls.append(
                    "['" +
                    escape(
                        thumb_page.get("thumbUrl")).replace(
                        "&amp;",
                        "&") +
                    "', 'no-segmentation']")

        pageStatus = document.get('pageList').get('pages')[int(
            page) - 1].get("tsList").get('transcripts')[0].get('status')
        if pageStatus == 'GT' and 'edit' in request.path:
            t_log(
                'Redirect user back to view mode since page status is GT. [from: %s to: %s]' %
                (request.get_full_path(),
                 request.get_full_path().replace(
                    'edit',
                    'view')))
            return HttpResponseRedirect(
                request.get_full_path().replace(
                    'edit', 'view'))
        i = request.GET.get('i') if request.GET.get('i') else 'i'
        if i == 'sbs' or i == 't' and 'edit' in request.path:
            t_log(
                'Redirect user back to view mode since interface "sbs" and "t" do not support edit. [from: %s to: %s]' %
                (request.get_full_path(),
                 request.get_full_path().replace(
                    'edit',
                    'view')))
            return HttpResponseRedirect(
                request.get_full_path().replace(
                    'edit', 'view'))

        tags = [
            {"name": "abbrev", "color": "FF0000"},
            {"name": "date", "color": "0000FF"},
            {"name": "gap", "color": "1CE6FF"},
            {"name": "person", "color": "00FF00"},
            {"name": "place", "color": "8A2BE2"},
            {"name": "unclear", "color": "FFCC66"},
            {"name": "organization", "color": "FF00FF"}
        ]
        # RM defined the dict for all the stuff going to the view so...
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
            'metadata': document.get('md'),
            # 'regionData': regionData,
        }
        # we can add the navdata to the end of it
        view_data.update(navdata)

        return render(request, 'edit/correct.html', view_data)
