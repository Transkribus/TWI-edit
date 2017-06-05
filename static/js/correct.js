var readyToZoom = false;// Zooming too soon breaks the page
var changed = false;
var savedZoom = 0;
var surroundingCount = 1;
var currentLineId;
var modalFromMouse = 50;// TODO Decide whether to calculate this or have a simple default. Note pages with text near the lower edge...
var modalHeight = 250;// TODO Consider whether to calculate this somehow, this value is just a rough guess...
var modalMinWidth, modalMinHeight, modalTextMaxHeight, dockedHeight = 250;// TODO Decide how to calculate this.
var ballRadius = 50;// TODO Decide how to set this. 
var ignoreLeave = false;
var zoomFactor = 0;
var accumExtraX = 0;
var accumExtraY = 0;
var initialWidth, initialHeight, initialScale, naturalWidth;
var pageNo, pathWithoutPage;
var previousInnerWidth = window.innerWidth;
var isDragged = false;
var resizeTimeout;
var THUMBS_TO_SHOW = 10; // "constant" for playing around with the no. of thumbs to show
var thumbCountOffset = 0;
var thumbWidth;
var toLoadCount;
var contentLineFontSize;
var correctModal;
var docked = false;
var dialogX, dialogY;
var dialogWidth, dialogHeight = 250; // This is 250 for no particular reason. TODO Calculate some appropriate value?
var activeLine;
var currentlyEditedLiPreviousLength;
var selectionData = [];
var undoArray = [];
var keyDownString = '';
var tagItems, tagColors;

// Tag functions
function toggleTag(toggleTag) { // sets/removes the tag depending on whether the selection already has it
	if (!removeTag(toggleTag)) // if the tag can be removed, we do that...
		applyTag(toggleTag);// ...but otherwise we apply it
}
function removeTag(removeTag) { // removes the given tag from the selection, returns true if removals were made, otherwise false
	var removals = false;
	var lastButOne = selectionData.length - 1;
	var lineIndex = getIndexFromLineId(selectionData[0][0]);
	var tagsOnLine = getSortedCustomTagArray(lineIndex, removeTag);
	var selStart = selectionData[0][1];
	var selEnd;
	if (selectionData.length == 1)
		selEnd = selectionData[0][2];
	else
		selEnd = contentArray[lineIndex][1].length;
	for (var i = 0; i < tagsOnLine.length; i++) {
		var tagOffset = tagsOnLine[i].offset;
		if ((tagOffset <= selStart && selStart < (tagOffset + tagsOnLine[i].length)) || (selStart < tagOffset && tagOffset <= selEnd)) {
			removals = true;
			contentArray[lineIndex][4] = String(contentArray[lineIndex][4]).replace(new RegExp("\\s" + removeTag + "\\s+{offset:" + tagOffset + ";[^}]*}"), "");
		} 
	}
	var j = 1;
	while (j < lastButOne) { 
		lineIndex++; // we don't check if this goes out of bounds since such a selection shouldn't be possible...
		if (getSortedCustomTagArray(lineIndex, removeTag).length > 0) {
			removals = true;
			contentArray[lineIndex][4] = String(contentArray[lineIndex][4]).replace(new RegExp("\\s" + removeTag + "[^}]*}"), "");			
		}
		j++;
	}
	if (selectionData.length > 1) {
		lineIndex++;
		tagsOnLine = getSortedCustomTagArray(lineIndex, removeTag);
		selEnd = selectionData[j][2];
		selStart = 0;
		for (var i = 0; i < tagsOnLine.length; i++) {
			var tagOffset = tagsOnLine[i].offset;
			if (tagOffset < selEnd) {
				removals = true;
				contentArray[lineIndex][4] = String(contentArray[lineIndex][4]).replace(new RegExp("\\s" + removeTag + "\\s+{offset:" + tagOffset + ";[^}]*}"), "");
			}
		}
	}
	buildLineList();
	return removals;
}
function tagMenu() { // returns the tag list with tags in the selection highlighted, if any
	var appliedTags = {}; // an array to be populated with all tags within the selection, may contain duplicates
	var lastButOne = selectionData.length - 1;
	var lineIndex = getIndexFromLineId(selectionData[0][0]);
	var tagsOnLine = getSortedCustomTagArray(lineIndex);
	var selStart = selectionData[0][1];
	var selEnd;
	if (selectionData.length == 1)
		selEnd = selectionData[0][2];
	else
		selEnd = contentArray[lineIndex][1].length;
	for (var i = 0; i < tagsOnLine.length; i++) {
		var tagOffset = tagsOnLine[i].offset;
		if ((tagOffset <= selStart && selStart < (tagOffset + tagsOnLine[i].length)) || (selStart < tagOffset && tagOffset <= selEnd)) {
			var tag = tagsOnLine[i].tag;
			appliedTags[tag] = {"name": "<span style=\"color: #" + tagColors[tag] + ";\">" + tag + "</span>", "type": "checkbox", "isHtmlName": true, "selected": true};
		}
	}
	var j = 1;
	while (j < lastButOne) { 
		lineIndex++; // we don't check if this goes out of bounds since such a selection shouldn't be possible...
		tagsOnLine = getSortedCustomTagArray(lineIndex);
		for (var k = 0; k < tagsOnLine.length; k++) {
			var tag = tagsOnLine[k].tag;
			appliedTags[tag] = {"name": "<span style=\"color: #" + tagColors[tag] + ";\">" + tag + "</span>", "type": "checkbox", "isHtmlName": true, "selected": true}; // the selection covers all tags on this line
		}
		j++;
	}
	if (selectionData.length > 1) {
		lineIndex++;
		tagsOnLine = getSortedCustomTagArray(lineIndex);
		selEnd = selectionData[j][2];
		selStart = 0;
		for (var i = 0; i < tagsOnLine.length; i++) {
			if (tagsOnLine[i].offset < selEnd) {
				var tag = tagsOnLine[i].tag;
				appliedTags[tag] = {"name": "<span style=\"color: #" + tagColors[tag] + ";\">" + tag + "</span>", "type": "checkbox", "isHtmlName": true, "selected": true};
			}
		}		
	}
	return {"items": $.extend({}, tagItems, appliedTags)};
}
function applyTagTo(applyTag, lineId, start, end, continued) { // applies the tag from start to end on the line the index of which is given, adds "continued:true", if given and true
	var lineIndex = getIndexFromLineId(lineId);
	var customTagArray = getSortedCustomTagArray(lineIndex);
	var isContinued = false;
	if (5 == arguments.length)
		continued = continued;
	
	var t = 0;
	while (t < customTagArray.length) // remove all tags from the array except those which are of the same type as the applied one
		if (customTagArray[t].tag != applyTag)
			customTagArray.splice(t, 1);
		else
			t++;
	
	var i = 0;	
	while (i < customTagArray.length) { // look for overlapping tags
		var existingOpenOffset = customTagArray[i].offset; 
		var existingCloseOffset = customTagArray[i + 1].offset; // TODO Remove redundant variables...
		if (start <= existingCloseOffset && existingOpenOffset <= end)  { // do we have overlap? If so, merge... 
			start = Math.min(start, existingOpenOffset);
			end = Math.max(end, existingCloseOffset);
			customTagArray.splice(i, 2); // ...and remove the old tag
		} else
			i += 2;
	}
	customTagArray.push({"offset": start, "tag": applyTag, "open": true, "length": (end - start)});
	customTagArray.push({"offset": end, "tag": applyTag, "open": false, "length": 0});
	
	// get everything in custom EXCEPT the applied tag
	var removalExp = new RegExp(applyTag + "\\s+(.(?!\}))*.{1}\}", "g");
	var custom = String(contentArray[lineIndex][4]).replace(removalExp, "");
	for (j = 0; j < customTagArray.length; j += 2) {
		var length = customTagArray[j].length;
		if (length > 0) {
			custom += " " + customTagArray[j].tag + " {offset:" + customTagArray[j].offset + "; length:" + length + ";";
			if (isContinued)
				custom += " continued:true;"
			custom += "}";
		}
	}
	contentArray[lineIndex][4] = custom;	
}
function applyTag(applyTag) {
	// use selectionData to apply the tag
	if (selectionData.length == 1) {
		if (selectionData[0][1] != selectionData[0][2]) // beginning and end must be different
			applyTagTo(applyTag, selectionData[0][0], selectionData[0][1], selectionData[0][2]);
	} else {
		var lastButOne = selectionData.length - 1;
		var i = 0;
		while (i < lastButOne)
			applyTagTo(applyTag, selectionData[i][0], selectionData[i][1], selectionData[i++][2], true);
		applyTagTo(applyTag, selectionData[i][0], selectionData[i][1], selectionData[i][2]); // this tag is not continued on the next line
	}		
	buildLineList();	
}
function getSortedCustomTagArray(tagLineIndex, filterTag) { // returns an array with Transkribus "custom" tags in the format below, if a filterTag is given, only tags of that type are included
	var filter = false;
	if (2 == arguments.length) {
		filter = filterTag;
	}
	var custom = (contentArray[tagLineIndex][4] + ' ').replace(/\s+/g, '').split('}');
	var customTagArray = [];
	if ("None" != custom) {
		custom.forEach(function(attribute) { // turn "tags" into something closer to actual tags (=spans)
			attribute = attribute.split('{');
			if ("" != attribute && "readingOrder" != attribute[0]) { // we have no use for readingOrder for now...
				var split = attribute[1].split("offset:")[1].split(";length:");
				var start = parseInt(split[0]);
				var length = parseInt(split[1]); // parseInt doesn't care about what comes after the first int
				var end = start + length;
				var tag = attribute[0];
				if (!filter || filter == tag) {
					customTagArray.push({"offset": start, "tag": attribute[0], "open": true, "length": length});
					customTagArray.push({"offset": end, "tag": attribute[0], "open": false, "length": 0});
				}
			}
		});
	}
	customTagArray.sort(function (tagA, tagB) {
		return tagA.offset - tagB.offset;
	});
	return customTagArray;
}
function getLineLiWithTags(tagLineId) { // generates a line with spans matching the tags and generates and applies the relevant CSS/SVG to show them
	// values for creating SVGs with the right height to be used as a background and a 1 px "long" line corresponding to each tag:
	var lineY = Math.round(1.5 * contentLineFontSize);
	var lineThickness = Math.round(lineY / 6);// TODO Test what looks good...
	var thicknessAndSpacing = lineThickness + Math.round(lineY / 8);// TODO Test what looks good...
	var svgRectsJSON = ''; // JSON-2-B with the rect for each line
	var backgroundHeight = lineY; // enough for the first tag graphic
	var tagGfxStack = [];
	// "tags"-2-tags:
	var tagLineIndex = getIndexFromLineId(tagLineId);	
	var lineUnicode = contentArray[tagLineIndex][1];
	var highlightCurrent = "";
	var lineNo = String(String(contentArray[tagLineIndex][4]).match(/readingOrder {index:\d+;}/)).match(/\d+/g);
	if (!lineNo)
		lineNo = tagLineIndex;
	else
		lineNo++; // readingOrder starts from 0, tagLineIndex is OK as is because of the "dummy line" in the beginning 
	
	if (tagLineId == currentLineId)
		 highlightCurrent = ' style="color: green;" '; // A quick and dirty solution for highlighting the current line in each case below
	if ("" == lineUnicode)
		return '<li value="' + lineNo + '" id="text_' + tagLineId + '" spellcheck="false"' + highlightCurrent + '><div style="min-height: ' + backgroundHeight + 'px;"><span tagLineId="' + tagLineId + '" spanOffset="-1">&#8203;</span></div></li>'; // spanOffset -1 ensures that &#8203; is ignored when new text is entered
	var customTagArray = getSortedCustomTagArray(tagLineIndex);
	if (customTagArray.length > 0) {
		customTagArray.forEach(function (tag) { // get a stack with all unique tags present
			var notYetIn = true; // set to false if the tag is already found in the stack
			for (var i = 0; notYetIn && i < tagGfxStack.length; i++) {
				if (tagGfxStack[i] == tag.tag)
					notYetIn = false;
			}
			if (notYetIn) 
				tagGfxStack.push(tag.tag);
		});
		// sort the stack and generate a graphical representation for each tag type (placement depends on order and total # of tags)
		tagGfxStack.sort()
		tagGfxStack.forEach(function (gfxTag) {
			svgRectsJSON += '"' + gfxTag + '":' + "\"<rect x=\\\\'0\\\\' y=\\\\'" + lineY + "\\\\' width=\\\\'1\\\\' height=\\\\'" + lineThickness + "\\\\' style=\\\\'fill: %23" + tagColors[gfxTag] + ";\\\\' />\""; // # must be %23 and yes \\\\ [sic!]
			lineY +=thicknessAndSpacing;
			svgRectsJSON += ',';			
		});
		svgRectsJSON = svgRectsJSON.substring(0, svgRectsJSON.length - 1); // remove the comma in the end
		svgRectsJSON = JSON.parse("{" +svgRectsJSON + "}");
		// more graphics variables
		var bottomPadding = (1 + tagGfxStack.length) * thicknessAndSpacing;
		var backgroundHeight = lineY + bottomPadding;
		// generate lines with spans showing the tags...
		var tagStack = [];
		var tagString = '<li value="' + lineNo + '" spanOffset="0" class="tag-menu" id="text_' + tagLineId + '" spellcheck="false"' + highlightCurrent 
									+ '><div style="padding-bottom: ' + bottomPadding + 'px;" ' 
									+ 'style="min-height: ' + backgroundHeight + 'px;">';
		var rangeBegin;
		var keepOpenStack = [];
		var previousTag;
		var firstTagOffset = customTagArray[0].offset;
		if (firstTagOffset > 0) {
			var tagContent = lineUnicode.substring(0, firstTagOffset);
			tagString += '<span tagLineId="' + tagLineId + '" spanOffset="0">' + tagContent + '</span>';
			rangeBegin = firstTagOffset;
		} else
			rangeBegin = 0;
		customTagArray.forEach(function (tag) {
			var currentTag = tag.tag;
			var offset = tag.offset;
			var length = tag.length; // set this when opening for the first time ONLY, not when reopening (this is from Transkribus custom and has nothing to do with the string lengths between spans...)
			if (offset != rangeBegin || currentTag != previousTag) { // has this tag already been temporarily closed when closing an outer tag? If so, we don't need to open it again, otherwise we must
				var tagContent = lineUnicode.substring(rangeBegin, offset);
				while (keepOpenStack.length > 0) {
					var keepTag = keepOpenStack.pop(); 
					tagString += "<span tagLineId='" + tagLineId + "' spanOffset=\"" + rangeBegin + "\" "
											+ "style=\"background-image: url('data:image/svg+xml; utf8, <svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'1\\' height=\\'" + backgroundHeight + "\\'>" + svgRectsJSON[keepTag] + "</svg>'); padding-bottom: " + bottomPadding + "px;\""
											+ ">";
					tagStack.push(keepTag);
				};
				tagString += '<span tagLineId="' + tagLineId + '" spanOffset="' + rangeBegin + '">' + tagContent + '</span>';// we always need the tagLineId
				if (tag.open) { // if the new tag opens, just insert it and push it onto the stack
					tagString += "<span offset=\"" + offset + "\" spanOffset=\"" + offset + "\" tagLength=\"" + length +  "\" tagLineId='" + tagLineId + "' tag='" + currentTag + "' " //" // a "tag" = span with a tag attribute
											+ "style=\"background-image: url('data:image/svg+xml; utf8, <svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'1\\' height=\\'" + backgroundHeight + "\\'>" + svgRectsJSON[currentTag] + "</svg>'); padding-bottom: " + bottomPadding + "px;\""
											+ ">";
					tagStack.push(currentTag);
				} else { // if the tag closes, we have to close all open tags until we reach the "original" opening tag
					var precedingTag = tagStack.pop();
					while (precedingTag && currentTag != precedingTag) {
						keepOpenStack.push(precedingTag);
						tagString += "</span>"; // easy to close since we don't need to care about what the opening tag type was...
						precedingTag = tagStack.pop();
					}
					tagString += "</span>";
				}
			}
			previousTag = currentTag;
			rangeBegin = offset;
		});
		var remainder = lineUnicode.substring(rangeBegin, lineUnicode.length);
		tagString += '<span tagLineId="' + tagLineId + '" spanOffset="' + rangeBegin + '">' + remainder + '</span></div></li>';
		return tagString;
	} else
		return '<li value="' + lineNo + '" class="tag-menu" id="text_' + tagLineId + '" spellcheck="false"' + highlightCurrent + '><div style="min-height: ' + backgroundHeight + 'px;"><span tagLineId="' + tagLineId + '" spanOffset="0">' + lineUnicode + '</span></div></li>';
}

// Various functions
function updateSelectionData() { // call after user inputs to put selection information into a more usable format in a 2D array [[lineId, selection start offset, selection end offset], [...]]
	var selection = window.getSelection();
	var anchorParentNode = selection.anchorNode.parentNode;
	var aPNtagLineId = anchorParentNode.getAttribute("tagLineId");
	if (!aPNtagLineId) // this function can be triggered by clicks elsewhere than in just the text
		return;
	var focusParentNode = selection.focusNode.parentNode;
	var anchorLineIndex = getIndexFromLineId(aPNtagLineId);
	var focusLineIndex = getIndexFromLineId(focusParentNode.getAttribute("tagLineId"));
	var totAnchorOffset = selection.anchorOffset + parseInt(anchorParentNode.getAttribute("spanOffset"));
	var totFocusOffset = selection.focusOffset + parseInt(focusParentNode.getAttribute("spanOffset"));	
	var startOffset, endOffset;
	
	if (anchorLineIndex == focusLineIndex) {
		startOffset = Math.min(totAnchorOffset, totFocusOffset);
		endOffset = Math.max(totAnchorOffset, totFocusOffset);
		selectionData = [[contentArray[anchorLineIndex][0], startOffset, endOffset]];
	} else {
		var startIndex = Math.min(anchorLineIndex, focusLineIndex);
		var endIndex = Math.max(anchorLineIndex, focusLineIndex);
		if (anchorLineIndex < focusLineIndex) {
			startOffset = totAnchorOffset;
			endOffset = totFocusOffset;
		} else {
			startOffset = totFocusOffset;
			endOffset = totAnchorOffset;
		}
		selectionData = [[contentArray[startIndex][0], startOffset, contentArray[startIndex++][1].length]];
		while (startIndex < endIndex)
			selectionData.push([contentArray[startIndex][0], 0, contentArray[startIndex++][1].length]);
		selectionData.push([contentArray[startIndex][0], 0, endOffset]);
	}
}
function contenteditableToArray(lineId, overwriteText) { // converts an editable line with tags as spans line into the original format, i.e. array with the text and custom attribute content. Optionally text content can be given.
	var lineIndex = getIndexFromLineId(lineId);
	var tagStack = []; // 2d array with tags:  [[tag, offset, length], ...]
	$("[tagLineId='" + lineId + "']").each(function () { // spans = tags
		var tag = $(this).attr("tag");
		if (tag)
			tagStack.push([tag, $(this).attr("offset"), $(this).attr("tagLength")]);
	});
	// regexp to preserve the part of custom which isn't tags (just readingorder for now and when/if that changes things will break)
	var custom = String(contentArray[getIndexFromLineId(lineId)][4]).match(/readingOrder {index:\d+;}/);
	for (var j = 0; j < tagStack.length; j++)
		custom += " " + tagStack[j][0] + " {offset:" + tagStack[j][1] + "; length:" + tagStack[j][2] + ";}";
	contentArray[lineIndex][4] = custom;
	if (2 == arguments.length) {
		contentArray[lineIndex][1] = overwriteText;
		//buildLineList(); // TODO Test more! This breaks deletions (and possibly other things) when executed here. Is it necessary in any scenario?
	} else
		contentArray[lineIndex][1] = $("#text_" + lineId).text().replace(/\u200B/g,''); // remove the zero width space!!!
}
function getContent() { //"JSON.stringifies" contentArray and also strips out content which does not need to be submitted.
	var lengthMinusOne = contentArray.length - 1;
	content = '{';
	for (var cI = 1; cI <= lengthMinusOne; cI++) {// cI = 1 because we skip the "line" which isn't real since it's the top of the page
		content += '"' + contentArray[cI][0] + '": {"Unicode":"' + contentArray[cI][1] + '","custom":"' + contentArray[cI][4] + '"}';
		if (cI < lengthMinusOne)
			content += ',';
	}
	content += '}';
	return content;
}
function checkPageNumberInput() { // Tries to parse input to see if it's a valid page number to go to. If not, resets the contents to show the current page.
	var value = parseInt($("#pageNumber").val());
	if (value > 0 && value < thumbArray.length - 1)
		gotoPage(value);
	else // Reset to what it was
		$("#pageNumber").val(pageNo + "/" + (thumbArray.length - 1));
}
function setMessage(message) {
	$("#message").html(message);
}
function calculateAreas() {
	var i = 1;
	$("#transcriptMap").children().each(function (value) {
		var coordString = "";
		for (var j = 0; j < 7; j++) {
			coordString += initialScale*contentArray[i][2][j] + ',';
		}
		coordString += initialScale*contentArray[i][2][7];
		this.coords = coordString;
		i++;
	});
}
function resizeContents() { // Call to perform necessary updates of contents and variables whenever the GUI size is changed
   	var widthFactor = window.innerWidth/previousInnerWidth;
	var oldWidth = initialWidth;
    previousInnerWidth = window.innerWidth;
	initialWidth = $('#transcriptImage').width();
	initialHeight = $('#transcriptImage').height();
	naturalWidth = $('#transcriptImage').get(0).naturalWidth;
	initialScale = initialWidth / naturalWidth;	
	// We have to update these too in case the image has gotten resized by the browser along with the window:
	accumExtraX = initialWidth * accumExtraX / oldWidth;
	accumExtraY = initialWidth * accumExtraY / oldWidth;
	$(".transcript-map-div").css("transform",  "translate(" + -accumExtraX +"px, " + -accumExtraY+ "px) scale(" + (1 + zoomFactor) + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
	calculateAreas();
	generateThumbGrid();
	updateCanvas();
	if (correctModal.isOpen()) {
		updateDialog();
		updateDocking();
	}
}

// Thumbnail functions
function gotoPage(page) {
	page = Math.max(Math.min(page, thumbArray.length - 1), 1);
	window.location.assign(pathWithoutPage + page + '?tco=' + thumbCountOffset);// TODO Consider tco in situations in which the page to which we go isn't visible, set an appropriate value? If tco = NaN or outside...
}
function scrollThumbsLeft() {
	thumbCountOffset += THUMBS_TO_SHOW;
	thumbCountOffset = Math.min(thumbCountOffset, 0);
	$(".thumbs" ).css("transition", "1s");
	$(".thumbs" ).css("transform",  "translateX(" + thumbCountOffset * thumbWidth + "px)");
	updateArrows();
}
function scrollThumbsRight() {
	thumbCountOffset -= THUMBS_TO_SHOW;
	thumbCountOffset = Math.max(thumbCountOffset, -thumbArray.length + THUMBS_TO_SHOW + 1);
	$(".thumbs" ).css("transition", "1s");
	$(".thumbs" ).css("transform",  "translateX(" + thumbCountOffset * thumbWidth + "px)");
	updateArrows();
}
function updateArrows() { // call to show and hide arrows depending on whether they're clickable
	if (0 == thumbCountOffset)
		$("#leftArrow").hide();
	else
		$("#leftArrow").show();
	console.log("comparing tco: "+ thumbCountOffset + " with " +(-thumbArray.length + 11));
	if (thumbCountOffset <= (-thumbArray.length + 11)) // 11 because we're comparing offset and length, not indices
		$("#rightArrow").hide();
	else
		$("#rightArrow").show();
}
function loadThumbs() { // Loads all thumbs and shows the ones which are visible as soon as they've been loaded
	var to = Math.min(THUMBS_TO_SHOW - thumbCountOffset, thumbArray.length);
	toLoadCount = Math.min(THUMBS_TO_SHOW, to);
	var tempImg;
	for (var i = -thumbCountOffset; i <= to; i++) {
		tempImg = new Image(); 
		tempImg.src = thumbArray[i];
		tempImg.onload = function() {
			toLoadCount--; //  JavaScript is single-threaded...
			if (0 == toLoadCount) {
				generateThumbGrid();
			}
		};
	}
	console.log("thumbs loaded");
}
function generateThumbGrid() {
	thumbWidth = initialWidth / 11;// 11 because we show 10 thumbs and each arrow will be half as wide as a thumbnail
	var arrowWidth = thumbWidth / 2;
	var padding = 0.08 * thumbWidth; // This results in roughly 10 pixels with a maximized window on an HD screen if 10 thumbs are shown
	var thumbTDs = ''; // thumbTDs will become a string that's inserted into the <tr> with id thumbTR	
	
	if (thumbArray.length > 10) // do we need arrows?
		thumbTDs += '<td style="min-width: ' + arrowWidth + 'px;"><a id="leftArrow" href="#" onclick="scrollThumbsLeft();"><svg width="' + arrowWidth + '" height="' + thumbWidth + '"><polygon points="' + (arrowWidth - padding) + ',' + padding + ' ' + padding + ',' + (arrowWidth) + ' '  + ' ' + (arrowWidth - padding) + ',' + (thumbWidth - padding) + '" style="fill: blue; stroke-width: 0;" /></svg></a>';
	else // we don't need arrows but we need to "pad" the row from the left to center the thumbs we do show
		thumbTDs += '<td style="min-width: ' + arrowWidth * (12 - thumbArray.length) + 'px;">'; // arrowWidth = half a thumb...
	thumbTDs += '</td><td><div class="thumb-row" style="text-align: center;"><div class="thumbs"><table><tr>';
	
	var i = 1;
	// Before the current page:
	while(i < pageNo) {
		thumbTDs += '<td class="thumb" style="padding: ' + padding + 'px; min-width: ' + thumbWidth + 'px;"><a href="#" onclick="gotoPage(' + i + ')"><img style="max-width: "' + (thumbWidth - 2 * padding) + 'px;" class="thumb thumb-img" src="' + thumbArray[i - 1] + '"><br/><span style="color: white;">' + i +'</span></a></td>';
		i++;
	}
	// Highlight current page:
	thumbTDs += '<td class="thumb" style="padding: ' + padding + 'px; min-width: ' + thumbWidth + 'px;"><img style="max-width: "' + (thumbWidth - 2 * padding) + 'px;" class="thumb thumb-current" src="' + thumbArray[i - 1] + '"><br/><span style="color: white;">' + i +'</span></td>';
	i++;
	// After the current page:
	while(i < thumbArray.length) {
		thumbTDs += '<td class="thumb" style="padding: ' + padding + 'px;  min-width: ' + thumbWidth + 'px;"><a href="#" onclick="gotoPage(' + i + ')"><img style="max-width: "' + (thumbWidth - 2 * padding) + 'px;" class="thumb thumb-img" src="' + thumbArray[i - 1] + '"><br/><span style="color: white;">' + i +'</span></a></td>';
		i++;
	}
	thumbTDs += '</tr></table></div></div></td><td style="min-width: ' + arrowWidth + 'px;">';
	
	if (thumbArray.length > 10) // arrow?
		thumbTDs += '<a id="rightArrow" href="#" onclick="scrollThumbsRight();"><svg width="' + arrowWidth + '" height="' + thumbWidth + '"><polygon points="' + padding + ',' + padding + ' ' + (arrowWidth - padding) + ',' + (arrowWidth) + ' '  + ' ' + padding + ',' + (thumbWidth - padding) + '" style="fill: blue; stroke-width: 0;" /></svg></a>';
	thumbTDs += '</td>';
	$("#thumbTR").html(thumbTDs); // insert it
	
	// Then we alter the CSS:
	//$(".thumb").css("width", (thumbWidth - 2*padding) + "px"); 
	$(".thumb-row").css("width", (initialWidth - thumbWidth) + "px");//THUMBS_TO_SHOW * thumbWidth + "px");
	console.log("thus w: " + $(".thumb-img").css("width"));
	console.log("t w: " + thumbWidth);
	$(".thumb-img").css("width", (thumbWidth - 2 * padding)+ "px");
	$(".thumb-current").css("width", (thumbWidth - 2 * padding)+ "px");
	$(".thumbs" ).css("transition", "0s");
	$(".thumbs" ).css("transform",  "translateX(" + thumbCountOffset * thumbWidth + "px)");
	updateArrows();
}

// Dialog functions:
function updateDocking(dock) { // docks (true) / undocks (false) the dialog. When not specified, docking status remains unchanged and just the dialog position and size gets updated
	if (1 == arguments.length)
		docked = dock;
	if (docked) { 
		saveDialog();
		var leftOffset = $("#sidebar-wrapper").width();
		$("#correctModal").css("left", 0);
		$("#correctModal").css("width", document.body.clientWidth);
		$("#correctModal").css("height", dockedHeight);
		$("#correctModal").css("position", "fixed");
		$("#correctModal").css("top", $(window).height() - dockedHeight + "px");// using "bottom" is problematic
		$("#correctModal").on("mousedown touchdwon", function (e) { // TODO Test touchdown when an appropriate device is available...
			$("#correctModal").css("position", "fixed"); // gijgo dialog messes with this undesirably...
		});
	} else {
    	$("#correctModal").css("left",  dialogX);
    	$("#correctModal").css("top",  dialogY);
    	$("#correctModal").css("width",  dialogWidth);
    	$("#correctModal").css("height",  dialogHeight);		
	}
	updateDockingStatus(docked);
	calculateLineListDimensions();
}
function updateDockingStatus(dock) { // Toggles the docking status and the docking button
	docked = dock;
	if (docked)
		$("#dockButton").html('<button type="button" class="dock-toggle close" onclick="updateDocking(false);"><small><span class="glyphicon glyphicon-resize-small" aria-hidden="true"></span></small></button>');
	else
		$("#dockButton").html('<button type="button" class="dock-toggle close" onclick="updateDocking(true);"><small><span class="glyphicon glyphicon-resize-full" aria-hidden="true"></span></small></button>');
}
function saveDialog() { // Saves the undocked dialog properties...
	$("#correctModal").css("position", "absolute");
	dialogX = $("#correctModal").offset().left;
	dialogY = $("#correctModal").offset().top;
	dialogWidth = $("#correctModal").width(); // TODO Search width vs. outerWidth
	dialogHeight = $("#correctModal").height();	
}
function updateDialog(lineId) {
	if (1 == arguments.length) // This function can be called without a line ID to reset the dialog after resizing the window
		setCurrentLineId(lineId);
	var lineIdx = getIndexFromLineId(currentLineId);
	if (!correctModal.isOpen()) { // Do we have to open the dialog first? 
		correctModal.open(); // We have to open the dialog already here in order to calculate its minimum width
		if (null == dialogWidth) { // Unless the size has already been calculated and possibly manually modified, we use the region width to set it...
			modalMinWidth = 2 - 2*parseInt($(".tool-row").css("margin-left"), 10);// equal and negative margins (sic!)
			$(".editbutton-group").each(function (i) { // We ensure that the minimum size is sufficient for all the buttons to remain in a row. This works but could be more accurate.
				modalMinWidth += $(this).outerWidth(true);
			});
			dialogWidth = Math.max(contentArray[lineIdx][3] * initialScale, modalMinWidth); // We don't let it become too narrow...
			modalMinHeight = $(".modal-header").outerHeight() + $(".tool-row").outerHeight() + $(".editbutton-group").outerHeight();
        	correctModal.css("min-width",  modalMinWidth + "px");
        	correctModal.css("min-height",  modalMinHeight + "px");
		}
		dialogX =  Math.max(Math.min(initialScale*contentArray[lineIdx][2][0] + $(".transcript-div").offset().left - accumExtraX, window.innerWidth - dialogWidth - 20), $(".transcript-div").offset().left);
		// If possible, the dialog top should match the top of the second line below the current one:
		if (contentArray.length - 1 == lineIdx) // Is it the last line? If so...
			dialogY = (2 * contentArray[lineIdx][2][7] - contentArray[lineIdx][2][1]) * initialScale + $(".transcript-div" ).offset().top - accumExtraY; // ...place the dialog the current line height below it 
		else if (contentArray.length - 2 == lineIdx) // If it's the last but one...
			dialogY = contentArray[lineIdx + 1][2][7] * initialScale + $(".transcript-div" ).offset().top - accumExtraY; // ...place it at the bottom of the line below the current one
		else // And usually place it...
			dialogY = contentArray[lineIdx + 2][2][1] * initialScale + $(".transcript-div" ).offset().top - accumExtraY; // ...at the top of the second line below the current one
		// Make sure that the header is inside the div
		dialogY = Math.min(dialogY, $(".transcript-div" ).height() + $(".transcript-div" ).offset().top - modalMinHeight*initialScale);
 		$("#correctModal").css("left",  dialogX + "px");
		$("#correctModal").css("top",  dialogY + "px");
		$("#correctModal").css("width",  dialogWidth);
		$("#correctModal").css("height",  dialogHeight);
		updateDocking(); // We restore the dialog to a docked state, if it was docked when closed
	}
	calculateLineListDimensions();
	buildLineList();	
}
function calculateLineListDimensions() {
	modalTextMaxHeight = $("#correctModal").height() - modalMinHeight;// TODO Which height? outer? true? Also: -5 to give the "fake text area" border some margin below it as well
	$(".line-list-div").css("height", modalTextMaxHeight);
}
function buildLineList() {
	var currentIdx = getIndexFromLineId(currentLineId);
	var showTo = Math.min(currentIdx + surroundingCount, contentArray.length - 1);
	var index = Math.max(1, currentIdx - surroundingCount); // 1 because the first line is not real
	$("#lineList").html("");
	while (index <= showTo)
		$("#lineList").append(getLineLiWithTags(contentArray[index++][0]));
	highlightLineList();
	restoreSelection(); // TODO Make this optional?
}
function restoreSelection() {
	if (selectionData.length === 0)
		return;
	var charCount = 0;
	var begCharCount = selectionData[0][1];
	var endCharCount = selectionData[selectionData.length - 1][2];
	var bElement, eElement;
	$("[tagLineId='" + selectionData[0][0] + "']").each(function () { // line where the selection begins
		if ($(this).attr("spanoffset") > begCharCount)
			return false; // bElement now = the span before the intended caret position
		bElement = $(this);
	});
	$("[tagLineId='" + selectionData[selectionData.length - 1][0] + "']").each(function () { // line where the selection ends
		if ($(this).attr("spanoffset") > endCharCount)
			return false; // eElement now = the span before the intended caret position
		eElement = $(this);
	});
	var range = document.createRange();
	range.setStart(bElement[0].firstChild, begCharCount - bElement.attr("spanoffset"));
	range.setEnd(eElement[0].firstChild, endCharCount - eElement.attr("spanoffset"));
	//TODO Make sure that this indeed is redundant: range.collapse(true);
	var sel = window.getSelection();
	sel.removeAllRanges();
	sel.addRange(range);
}
function resizeText(delta) {
	var newFontSize = contentLineFontSize + delta;
	if (newFontSize < 14 || newFontSize > 40)
		return;
	contentLineFontSize = newFontSize;
	$('.line-list').css("font-size", contentLineFontSize+ 'px');
	buildLineList();
}
// Line functions:
function getIndexFromLineId(lineId) {
	var length = contentArray.length;
	var index;
	for (index = 0; index < length; index++) {
		if (contentArray[index][0] == lineId)
			return index;
	}
	return null;
}
function getNextLineId(lineId) {
	index = getIndexFromLineId(lineId); 
	if (contentArray.length == (index + 1))
		return null;// If it's the last line, we don't have a next id.
	else
		return contentArray[index + 1][0];
}
function getPreviousLineId(lineId) {
	index = getIndexFromLineId(lineId);
	if (1 == index)
		return null;// If it's the first line, we don't have a previous id. Note: The first real line is [1] because the very first "line" in the array is "", i.e. not a line but the top of the page.
	else
		return contentArray[index - 1][0];
}
// TODO Replace this since we've begun to set the content after each edit instead...
function setCurrentLineId(newId) { // We're not happy with just "=" to set the new id because we want to detect changes, if any, to the lines in the dialog so we have this function. TODO Rename? Its purpose is so different now...
	if (null != currentLineId) {
		var currentIdx = getIndexFromLineId(currentLineId);
		var i = Math.max(1, currentIdx - surroundingCount); // 1 because the first line is not real
		var to = Math.min(currentIdx + surroundingCount, contentArray.length - 1);
		while (i <= to) {
			var currentContent = $("#text_" + contentArray[i][0]).text();
			var savedContent = contentArray[i][1];
			if (currentContent != savedContent) {
				// TODO Redo, the message breaks the layout...
				//if (!changed)
				//	setMessage("<div class='alert alert-warning'>" + transUnsavedChanges + "</div>");
				contentArray[i][1] = currentContent;
				changed = true;
			}
			i++;
		}
	}
	currentLineId = newId;
}

// UX Actions
function resetImage() {
	savedZoom = 0;
	zoomFactor = 0;
	accumExtraX = 0;
	accumExtraY = 0;
	$(".transcript-map-div").css("transform",  "translate(0px, 0px) scale(1)");// Note, the CSS is set to "transform-origin: 0px 0px"
	/*initialWidth = $('#transcriptImage').width();
	initialHeight = $('#transcriptImage').height();
	naturalWidth = $('#transcriptImage').get(0).naturalWidth;
	initialScale = initialWidth / naturalWidth;	*/
}
function setZoom(zoom, x, y) {
	if (!readyToZoom)
		return;// Zooming before the page has fully loaded breaks it.
	var newZoom = savedZoom + zoom;
	if (newZoom >= -60) 
		savedZoom = newZoom;
	else
		return;// We have a limit on zooming
	if (1 == arguments.length) {// If no cursor position has been given, we use the center
		x = initialWidth/2 + accumExtraX;
		y = initialHeight/2 + accumExtraY;
	}
	// x and y are in relation to the current (scaled) image size. We wish to obtain the relative position of the pointer:
	var xRatio = x / ((1 + zoomFactor) * parseInt($( ".transcript-map-div" ).css("width"), 10));
	var yRatio = y / ((1 + zoomFactor) * parseInt($( ".transcript-map-div" ).css("height"), 10));
	// Calculate the absolute no. of pixels added and get the total offset to move in order to preserve the cursor position...
	var oldZoomFactor = zoomFactor;	
	zoomFactor = savedZoom / 100;
	accumExtraX += initialWidth * (zoomFactor - oldZoomFactor) * xRatio;
	accumExtraY += initialHeight * (zoomFactor - oldZoomFactor) * yRatio;
	// ...and move the image accordingly before scaling:
	$( ".transcript-map-div" ).css("transform",  "translate(" + -accumExtraX +"px, " + -accumExtraY+ "px) scale(" + (1 + zoomFactor) + ")");// Note, the CSS is set to "transform-origin: 0px 0px" 
	updateCanvas();
}
function scrollToNextTop() { // This function scrolls the image up as if it were dragged with the mouse.
	resizeModal(10);
	var currentTop = accumExtraY / (initialScale * (1 + zoomFactor)) + 1;// +1 to ensure that a new top is obtained for every click
	if (contentArray[contentArray.length - 1][2][1] < currentTop)
		return; // If the page has been moved so that the last line is above the top, we don't do anything.
	var newTop;
	for (var idx = 0; idx < contentArray.length; idx++) {
		newTop = contentArray[idx][2][1];
		if (newTop > currentTop)
			break;
	}
	accumExtraY = newTop * initialScale * (1 + zoomFactor);
	$( ".transcript-map-div" ).css("transform",  "translate(" + -accumExtraX +"px, " + -accumExtraY+ "px) scale(" + (1 + zoomFactor) + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
}
function scrollToPreviousTop() {
	var currentTop = accumExtraY / (initialScale * (1 + zoomFactor)) - 1;// -1 to ensure that a new top is obtained for every click
	if (contentArray[0][2][1] > currentTop)
		return; // If the page has been moved so that the first line is below the top, we don't do anything.
	var newTop;
	for (idx = contentArray.length - 1; idx >= 0; idx--) {
		newTop = contentArray[idx][2][1];
		if (newTop < currentTop) {
			break;
		}
	}
	accumExtraY = newTop * initialScale * (1 + zoomFactor);
	$( ".transcript-map-div" ).css("transform",  "translate(" + -accumExtraX +"px, " + -accumExtraY+ "px) scale(" + (1 + zoomFactor) + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
}
/* TODO Remove this and all references to it. restoreSelection does the same thing and more
function placeCaret() {
	var offset = selectionData[0][1];
	var range = document.createRange();
	var sel = window.getSelection();
	var spanNodes = $("[tagLineId='" + selectionData[0][0] + "']");
	var i = 0;
	while (i < spanNodes.length && offset > spanNodes[i].getAttribute("spanoffset"))
		i++;
	i = Math.max(0, i - 1);
	var offsetFromSpan = offset - spanNodes[i].getAttribute("spanoffset");
	if (spanNodes[i].hasChildNodes())
		range.setStart(spanNodes[i].firstChild, offsetFromSpan);
	else
		range.setStart(spanNodes[i], offsetFromSpan);
	range.collapse(true);
	sel.removeAllRanges();
	sel.addRange(range);
}*/
function lineEditAction(editedLineId, startOffset, endOffset, textInjection) { // if no text injection is given, we just update the tags and assume that the input went straight to the "contenteditable", if startOffset > endOffset the action is a deletion (possibly followed by an injection into the same offset) 
	var contentDelta;
	var injectionDelta = 0;
	if (arguments.length == 4) // this could set endOffset so that any given value is ignored because it makes no sense to consider that parameter in this case
		injectionDelta = textInjection.length;
	contentDelta = endOffset - startOffset + injectionDelta;
	$("[tagLineId='" + editedLineId + "']").each(function () {
		var tagLength = parseInt($(this).attr("tagLength"));
		if (tagLength) { // spans with set tagLengths are Transkribus tags
			var tagOffset = parseInt($(this).attr("offset"));
			if (startOffset <= tagOffset) { // tags after the edit
				$(this).attr("offset", tagOffset + contentDelta);
			} else if (tagOffset > endOffset && (tagOffset + tagLength) > startOffset) {
				$(this).attr("offset", endOffset);
				$(this).attr("tagLength", tagLength - startOffset + tagOffset);
			} else if ((tagOffset + tagLength) > endOffset) {
				$(this).attr("tagLength", Math.max(tagLength + contentDelta, endOffset - tagOffset));
			}
		}
	});
	if (arguments.length == 4) { // injected, possibly with deletion?
		var previousContent = contentArray[getIndexFromLineId(editedLineId)][1];
		if (endOffset < startOffset)
			contenteditableToArray(editedLineId, previousContent.substring(0, endOffset) + textInjection + previousContent.substring(startOffset, previousContent.length));
		else
			contenteditableToArray(editedLineId, previousContent.substring(0, endOffset) + textInjection + previousContent.substring(endOffset, previousContent.length));
	} else if (contentDelta < 0) {
		var previousContent = contentArray[getIndexFromLineId(editedLineId)][1];
		contenteditableToArray(editedLineId, previousContent.substring(0, endOffset) + previousContent.substring(startOffset, previousContent.length)); // deletions require overwrites 
	} else
		contenteditableToArray(editedLineId);
}
function eraseSelection() {
	var editedLineId = selectionData[0][0];
	undoArray = [];
	undoArray.push(contentArray[getIndexFromLineId(editedLineId)].slice());
	if (selectionData.length == 1) {
		lineEditAction(editedLineId, selectionData[0][1], selectionData[0][2]);
		return;
	}
	var i = 1;
	var lastButOne = selectionData.length - 1; 
	lineEditAction(editedLineId, contentArray[getIndexFromLineId(editedLineId)][1].length, selectionData[0][1]);
	var deleteFromId = getNextLineId(editedLineId);
	while (i < lastButOne) {	
		undoArray.push(contentArray[getIndexFromLineId(deleteFromId)].slice());
		lineEditAction(deleteFromId, contentArray[getIndexFromLineId(deleteFromId)][1].length, 0);
		deleteFromId = getNextLineId(deleteFromId);
		i++;
	}
	undoArray.push(contentArray[getIndexFromLineId(deleteFromId)].slice());
	lineEditAction(deleteFromId, selectionData[i][2], 0);
	selectionData = [[editedLineId, selectionData[0][1], selectionData[0][1]]];
	buildLineList();
}
// TODO Include pasteAction's multi-line handling here instead, this handles multiple lines in other situations as well...
function editAction(event) { // trigger: keypress
	if (event.ctrlKey || event.altKey || event.metaKey) { // we must prevent any printable from being input in these cases....
		if (event.key == "z" || event.key == "Z")
			undo();
		return;
	}
    var editedLineId = selectionData[0][0];
	var startOffset = selectionData[0][2];
	var endOffset = selectionData[0][1]; // TODO Some cleanup? This is just for one line edits, changed in the else below...
	undoArray = [];
	undoArray.push(contentArray[getIndexFromLineId(editedLineId)].slice());
	// TODO Rename the vars? start and end are not intuitive names when removing text end = the caret position at the END OF THE ACTION (i.e. a smaller offset than start = the caret position AT THE START OF THE ACTION)
	if (selectionData.length ==1) { // does everything happen on just one line? 
		if (event.key.length == 1) { // a regular character?
			event.preventDefault();
			lineEditAction(editedLineId, startOffset, endOffset, event.key);
			endOffset++; // we've moved one character and have to set the selection
	    } else if (event.keyCode == 8) { // backspace?
	    	event.preventDefault();
	    	if (endOffset != startOffset) { // a selection to remove?
	    		lineEditAction(editedLineId, startOffset, endOffset);
	    	} else if (endOffset > 0) { // we create a one character selection (but don't remove linebreaks)
	    		endOffset--;
				lineEditAction(editedLineId, startOffset, endOffset);
			}
		} else if (event.keyCode == 46) { // delete?
			event.preventDefault();
			if (endOffset == startOffset && endOffset < contentArray[getIndexFromLineId(editedLineId)][1].length) // can we allow a deletion without removing a linebreak? 
	    		startOffset++; // pretend that the character in front of the caret was selected
    		lineEditAction(editedLineId, startOffset, endOffset);
	    } else if (event.keyCode == 13) { // return? 
	    	event.preventDefault(); // we don't allow linebreaks 
	        typewriterNext();
	    } else { 
	    	if (event.key == "ArrowUp" && getIndexFromLineId(editedLineId) == (getIndexFromLineId(currentLineId) - surroundingCount)) {
    			 typewriterPrevious();
    			 //placeCaret();
    			 restoreSelection();
	    	} else if (event.key == "ArrowDown" && getIndexFromLineId(editedLineId) == (getIndexFromLineId(currentLineId) + surroundingCount)) {
	    		typewriterNext();
	    		//placeCaret();
	    		restoreSelection();
	    	}
	    	return;
	    }
		selectionData[0][1] = endOffset;
		selectionData[0][2] = endOffset;
	} else if (event.key.length == 1 || event.keyCode == 8 || event.keyCode == 46) { // multiple lines selected, character input, backspace or delete requires a deletion
			event.preventDefault();
			var inject;
			if (event.key.length == 1)
				inject = event.key;
			else
				inject = "";
			var i = 1;
			var lastButOne = selectionData.length - 1; 
			lineEditAction(editedLineId, contentArray[getIndexFromLineId(editedLineId)][1].length, endOffset, inject);
			var deleteFromId = getNextLineId(editedLineId);
			while (i < lastButOne) {	
				undoArray.push(contentArray[getIndexFromLineId(deleteFromId)].slice());
				lineEditAction(deleteFromId, contentArray[getIndexFromLineId(deleteFromId)][1].length, 0);
				deleteFromId = getNextLineId(deleteFromId);
				i++;
			}
			undoArray.push(contentArray[getIndexFromLineId(deleteFromId)].slice());
			lineEditAction(deleteFromId, selectionData[i][2], 0);
			selectionData = [[editedLineId, endOffset, endOffset]];
	}
	buildLineList();
	//placeCaret();
}
function undo() {
	for (var i = 0; i < undoArray.length; i++) {
		var undoId = undoArray[i][0];
		contentArray[getIndexFromLineId(undoArray[i][0])] = undoArray[i];
	}
	buildLineList();
}
// TODO Add undo to this when undo works.
function pasteAction(text) { // TODO This can be sped up but it's not used much...
	var lines = text.split("\n");
	var editedLineId = selectionData[0][0];
	var startOffset = selectionData[0][2];
	var endOffset = selectionData[0][1];
	// TODO Remove selected content first
	if (selectionData.length > 1 && selectionData[0][1] != selectionData[0][2]) {
		var i = 1;
		var lastButOne = selectionData.length - 1; 
		lineEditAction(editedLineId, contentArray[getIndexFromLineId(editedLineId)][1].length, endOffset);
		var deleteFromId = getNextLineId(editedLineId);
		while (i < lastButOne) {	
			lineEditAction(deleteFromId, contentArray[getIndexFromLineId(deleteFromId)][1].length, 0);
			deleteFromId = getNextLineId(deleteFromId);
			i++;
		}
		lineEditAction(deleteFromId, selectionData[i][2], 0);
	}
	buildLineList();// TODO Better way? The issue is the line length comparison with the offset below....
	if (contentArray[getIndexFromLineId(editedLineId)][1].length == endOffset) { // don't even consider multi-line pasting unless we start doing it at the end of the line
		var pasteText = lines[0];
		lineEditAction(editedLineId, startOffset, endOffset, pasteText);
		nextLineId = getNextLineId(editedLineId);
		endOffset += pasteText.length;
		for (var i = 1; i < lines.length; i++) { // write to subsequent lines, if they're empty but otherwise append to one line without breaks
			pasteText = lines[i];
			if ("" == contentArray[getIndexFromLineId(nextLineId)][1].replace(/\s+/g, '')) {
				endOffset = 0;
				lineEditAction(nextLineId, 0, 0, pasteText);
				nextLineId = getNextLineId(nextLineId);
			} else {
				endOffset += pasteText.length;
				lineEditAction(editedLineId, endOffset, endOffset, pasteText);
			}
		}
	} else {
		var oneLine = lines.join(" ");
		lineEditAction(editedLineId, startOffset, endOffset, oneLine);
	}
	// TODO Place the caret!
}

// UX action helpers
function typewriterNext() { // Aka. "press typewriter enter scroll". Changes the selected lines and the modal content.
	newLineId = getNextLineId(currentLineId);
	if (newLineId != null)
		typewriterStep(newLineId, (contentArray[Math.min(getIndexFromLineId(newLineId), contentArray.length - 1)][2][5]) - Math.round(contentArray[Math.min(getIndexFromLineId(currentLineId), contentArray.length - 1)][2][5]))
}
function typewriterPrevious() {
	newLineId = getPreviousLineId(currentLineId);
	if (newLineId != null)
		typewriterStep(newLineId, Math.round(contentArray[Math.min(getIndexFromLineId(newLineId), contentArray.length - 1)][2][5]) - Math.round(contentArray[Math.min(getIndexFromLineId(currentLineId), contentArray.length - 1)][2][5]));
}
function typewriterStep(newLineId, delta) {
	accumExtraY += delta * initialScale * (1 + zoomFactor);
	$( ".transcript-map-div" ).css("transform",  "translate(" + -accumExtraX +"px, " + -accumExtraY+ "px) scale(" + (1 + zoomFactor) + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
	setCurrentLineId(newLineId);
	updateCanvas();
	buildLineList();
}

// Drawing functions:
function updateCanvas() {        
	var c = document.getElementById("transcriptCanvas");
	var ctx = c.getContext("2d");
	ctx.canvas.width = $('#transcriptImage').width();
	ctx.canvas.height = $('#transcriptImage').height();
	ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
	ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
	ctx.save();
	if (correctModal != null && correctModal.isOpen()) {
		highlightLineList();
	}
	// debugging, highlight all:
	//for (var i = 1; i < contentArray.length; i++)
		//highlightLine(contentArray[i][0]);
	console.log("updating canvas");
}
function placeBalls(lineId) {
	var length = contentArray.length;
	var coords = Array(8);// TODO Four coordinate pairs are not needed...
	for (j = 0; j < length; j++) {// TODO Stop the loop sooner!
		if (contentArray[j][0] == lineId) {
			for (k = 0; k < coords.length; k++) {
				coords[k] = Math.round(initialScale*contentArray[j][2][k]);
			}
		}
	}
	var lineHeight = (coords[5] - coords[1]); // We use this to get an "appropriate" place for the ball in relation to the line size...
	var c=document.getElementById("transcriptCanvas");
	var ctx=c.getContext("2d");
	ctx.beginPath(); 
	ctx.arc(coords[0] -0.5 * lineHeight, coords[1] + lineHeight / 2, 10, 0, 2*Math.PI);
	ctx.fillStyle = "rgba(0, 255, 0, 1)";
	ctx.fill();	
}
function highLightArea(coords) {
	var c=document.getElementById("transcriptCanvas");
	var ctx=c.getContext("2d");
	ctx.clearRect(coords[0], coords[1], coords[4] - coords[0], coords[5] - coords[1]);	// TODO Four coordinate pairs are not needed for a rectangle...
}
function highlightLineList() { // highlights the lines being shown in the dialog and places balls in front of them
	var currentIdx = getIndexFromLineId(currentLineId);
	var showTo = Math.min(currentIdx + surroundingCount, contentArray.length - 1);
	var index = Math.max(1, currentIdx - surroundingCount); // 1 because the first line is not real
	var lineCoords =  Array(8);// TODO Four coordinate pairs are not needed for a rectangle...
	while (index <= showTo) {
		for (var k = 0; k < lineCoords.length; k++)
			lineCoords[k] = Math.round(initialScale*contentArray[index][2][k]);
		highLightArea(lineCoords);
		var lineHeight = (lineCoords[5] - lineCoords[1]); // We use this to get "appropriate" places for the balls in relation to the line size...
		var c=document.getElementById("transcriptCanvas");
		var ctx=c.getContext("2d");
		ctx.beginPath(); 
		ctx.arc(lineCoords[0] -0.5 * lineHeight, lineCoords[1] + lineHeight / 2, 10, 0, 2*Math.PI);
		if (contentArray[index][1].length == 0 || (contentArray[index][1].length <= 1 && contentArray[index][1].match(/(\s+|\u200B)/))) { // empty or a zero width space
			ctx.fillStyle = "rgba(255, 140, 0, 1)";
			ctx.strokeStyle = "rgba(255, 140, 0, 1)";
		} else { // otherwise green
			ctx.fillStyle = "rgba(0, 255, 0, 1)";
			ctx.strokeStyle = "rgba(0, 255, 0, 1)";
		}
		ctx.lineWidth = 3;
		if (index == currentIdx) { // Show a filled ball?
			ctx.fill();
			ctx.stroke(); // simply increase the radius instead?
		} else
			ctx.stroke();
		index++;
	}
}
function highlightLine(lineId) { // highlights a single line (use when moving the mouse cursor)
	var length = contentArray.length;
	var coords =  Array(8);// TODO Four coordinate pairs are not needed for a rectangle...
	for (var j = 0; j < length; j++) {// TODO Stop the loop sooner!
		if (contentArray[j][0] == lineId) {						
			for (var k = 0; k < coords.length; k++)
				coords[k] = Math.round(initialScale*contentArray[j][2][k]);
		}
	}
	highLightArea(coords);
}
