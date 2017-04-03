var readyToZoom = false;// Zooming too zoon breaks the page
var changed = false;
var savedZoom = 0;
var surroundingCount = 1;
var currentLineId;
var modalFromMouse = 50;// TODO Decide whether to calculate this or have a simple default. Note pages with text near the lower edge...
var modalHeight = 250;// TODO Consider whether to calculate this somehow, this value is just a rough guess...
var modalMinWidth, modalMinHeight, modalTextMaxHeight, dockedHeight = 250;// TODO Decide how to calculate this.
var ballRadius = 50;// TODO Decide how to set this. 
var ignoreLeave = false;
var topLineId = null;
var zoomFactor = 0;
var accumExtraX = 0;
var accumExtraY = 0;
var initialWidth, initialHeight, initialScale, naturalWidth;
var pageNo, pathWithoutPage;
var previousInnerWidth = window.innerWidth;
var isDragged = false;
var triggerTime;
var THUMBS_TO_SHOW = 10; // "static" variable for playing around with the no. of thumbs to show
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

// Just for testing...
var tagColors = {// TODO tag colours from the view (array to the template?), also decide whether to use numbers or strings...
								"Address": "FF34FF",
								"abbrev": "FF0000",
								"add": "33FFCC",
								"blackening": "000000",
								"date": "0000FF",
								"gap": "1CE6FF",
								"organization": "FF00FF",
								"person": "00FF00",
								"place": "8A2BE2",
								"sic": "FFEB00",
								"speech": "A30059",
								"supplied": "CD5C5C",
								"textStyle": "808080",
								"unclear": "FFCC66",
								"work": "008000"
							};

function contenteditableToArray(lineId) { // converts an editable line with tags as spans line into the original format, i.e. array with the text and custom attribute content
	var unicode = $("#text_" + lineId).text(); // text content
	var tagStack = []; // 2d array with tags:  [[tag, offset, length], ...]
	$("[tagLineId='" + lineId + "']").each(function () { // spans = tags
		var tag = $(this).attr("tag");
		if (tag) { // TODO Check what happens in substrings without tags but which are preceeded and or succeeded by substrings with tags...
			if ($(this).attr("reopen")) { // Is this a continuation of a tag from an earlier span? If so, we look for the last occurrence of the tag and add to its length
				var i = tagStack.length - 1;
				while (i >= 0) {
					if (tag == tagStack[i][0]) {
						var incompleteLength = parseInt(tagStack[i][2]); 
						tagStack[i][2] = incompleteLength + parseInt($(this).attr("length")); 
						i = 0; // exit the while loop
					}
					i--;
				}
			} else // it's a new (Transkribus) tag
				tagStack.push([tag, $(this).attr("offset"), $(this).attr("length")]);
		}
	});
	// regexp to preserve the part of custom which isn't tags (just readingorder for now and when/if that changes things will break)
	var custom = String(contentArray[getIndexFromLineId(lineId)][4]).match(/readingOrder {index:\d+;}/);
	for (var j = 0; j < tagStack.length; j++)
		custom += " " + tagStack[j][0] + " {offset:" + tagStack[j][1] + "; length:" + tagStack[j][2] + ";}";
	contentArray[getIndexFromLineId(lineId)][4] = custom;
}
// we use these to get the character count delta within a span and update the attribute when the user enters or deletes text TODO Would it work even better if we also use this to check for backspace where we can't allow it?
function beginEditAction() { // trigger: keydown
	currentlyEditedLiPreviousLength = $("#text_" + window.getSelection().anchorNode.parentNode.getAttribute("tagLineId")).text().length;
}
// TODO Add backspace prevention with an optional event parameter? Slightly fewer calls needed when it's enough to find the span only once... 
function endEditAction() { // trigger: keyup
	var selection = window.getSelection();
	var anchorNode = selection.anchorNode;
	var parentNode =  selection.anchorNode.parentNode;
	// get the line id 
	var editedLineId = parentNode.getAttribute("tagLineId");
	var contentDelta = $("#text_" + editedLineId).text().length - currentlyEditedLiPreviousLength;
	if (0 == contentDelta) // has this been triggered without any actual input (i.e. arrow keys possibly moving the caret from one span to another)
		return;
	// get the preceding tag's offset 
	var editedTagOffset = parseInt(parentNode.getAttribute("offset"));
	// increase/decrease the offsets and lengths of subsequent tags
	$("[tagLineId='" + editedLineId + "']").each(function () {
		var tagOffset = parseInt($(this).attr("offset"));
		if (tagOffset == editedTagOffset) {
			var contentLength = parseInt($(this).attr("length"));
			$(this).attr("length", (contentLength + contentDelta));
		} else if (tagOffset > editedTagOffset)
			$(this).attr("offset", (tagOffset + contentDelta));
	});	
	contenteditableToArray(editedLineId);
}
function activateSpanFromLineId(span) { // TODO Delete? Not needed anymore.
	console.log("activated: " + span);
}
// TODO The last chunk of characters (and probably the first as well) must be within a span as well due to length= and offset=...? Or... no tags apply if it's the last chunk and there aren't any -> np! First: nothing to update...
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
	var custom = contentArray[getIndexFromLineId(tagLineId)][4].replace(/\s+/g, '').split('}');
	var customTagArray = [];
	var lineUnicode = contentArray[tagLineIndex][1];
	
	var highlightCurrent = "";
	if (tagLineId == currentLineId)
		 highlightCurrent = ' style="color: green;" '; // A quick and dirty solution for highlighting the current line in each case below
	if ("" == lineUnicode)
		return '<li id="text_' + tagLineId + '" spellcheck="false"' + highlightCurrent + '><div style="min-height: ' + backgroundHeight + 'px;"><span tagLineId="' + tagLineId + ' offset="0" length="0"></span></div></li>';
		//lineUnicode = "&nbsp;";	// TODO Some better solution for empty lines. This results in a selectable empty space.
	if ("None" != custom) {
		custom.forEach(function(attribute) { // turn "tags" into something closer to actual tags (=spans)
			attribute = attribute.split('{');
			if ("" != attribute && "readingOrder" != attribute[0]) { // we have no use for readingOrder for now...
				var split = attribute[1].split("offset:")[1].split(";length:");
				var start = parseInt(split[0]);
				var end = start + parseInt(split[1]); // parseInt doesn't care about what comes after the first int
				customTagArray.push({"offset": start, "tag": attribute[0], "open": true});
				customTagArray.push({"offset": end, "tag": attribute[0], "open": false});
			}
		});
	}
	if (customTagArray.length > 0) { // sort the tags, if any
		customTagArray.sort(function (tagA, tagB) {
			return tagA.offset - tagB.offset;
		});
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
		var tagString = '<li id="text_' + tagLineId + '" spellcheck="false"' + highlightCurrent 
									+ '><div style="padding-bottom: ' + bottomPadding + 'px;" ' 
									+ 'style="min-height: ' + backgroundHeight + 'px;">';
		var rangeBegin;
		var keepOpenStack = [];
		var previousTag;
		var firstTagOffset = customTagArray[0].offset;
		if (firstTagOffset > 0) {
			tagString += '<span tagLineId="' + tagLineId + '" offset="0" length>' + lineUnicode.substring(0, firstTagOffset) + '</span>';
			rangeBegin = firstTagOffset;
		} else
			rangeBegin = 0;
		customTagArray.forEach(function (tag) {
			var currentTag = tag.tag;
			var offset = tag.offset;
			if (offset != rangeBegin || currentTag != previousTag) { // has this tag already been temporarily closed when closing an outer tag? If so, we don't need to open it again, otherwise we must
				while (keepOpenStack.length > 0) {
					var keepTag = keepOpenStack.pop(); 
					tagString += "<span offset=" + offset + " length reopen=1 " + " contenteditable='true' onclick='activateSpanFromLineId(\"" + tagLineId + "\");' tagLineId='" + tagLineId + "' tag='" + keepTag + "' " // a "tag" = span with a tag attribute
											+ "style=\"background-image: url('data:image/svg+xml; utf8, <svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'1\\' height=\\'" + backgroundHeight + "\\'>" + svgRectsJSON[keepTag] + "</svg>'); padding-bottom: " + bottomPadding + "px;\""
											+ ">";
					tagStack.push(keepTag);
				};
				tagString += lineUnicode.substring(rangeBegin, offset);
				if (tag.open) { // if the new tag opens, just insert it and push it onto the stack
					tagString += "<span offset=" + offset + " length contenteditable='true' onclick='activateSpanFromLineId(\"" + tagLineId + "\");' tagLineId='" + tagLineId + "' tag='" + currentTag + "' " //" // a "tag" = span with a tag attribute
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
		// TODO Calc offset below!
		tagString += "<span offset=" + rangeBegin + " length>" + lineUnicode.substring(rangeBegin, lineUnicode.length) + "</span></div></li>";
		return tagString;
	} else
		return '<li id="text_' + tagLineId + '" spellcheck="false"' + highlightCurrent + '><div style="min-height: ' + backgroundHeight + 'px;"><span tagLineId="' + tagLineId + '" offset="0">' + lineUnicode + '</span></div></li>';
}

// Various functions
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
	updateDialog();
	updateDocking();
}

// Thumbnail functions
function gotoPage(page) {
	page = Math.max(Math.min(page, thumbArray.length - 1), 1);
	window.location.assign(pathWithoutPage + page + '?tco=' + thumbCountOffset);// TODO Consider tco in situations in which the page to which we go isn't visible, set an appropriate value? If tco = NaN or outside...
}
function scrollThumbsLeft() {
	thumbCountOffset += THUMBS_TO_SHOW;
	thumbCountOffset = Math.min(thumbCountOffset, 0);
	$(".thumbs" ).css("transform",  "translateX(" + thumbCountOffset * thumbWidth + "px)");	
}
function scrollThumbsRight() {
	thumbCountOffset -= THUMBS_TO_SHOW;
	thumbCountOffset = Math.max(thumbCountOffset, -thumbArray.length + THUMBS_TO_SHOW + 1);
	$(".thumbs" ).css("transform",  "translateX(" + thumbCountOffset * thumbWidth + "px)");
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
}
function generateThumbGrid() {
	// Calculate appropriate arrow and thumbnail sizes according to initialWidth:
	var showCount = Math.min(thumbArray.length, THUMBS_TO_SHOW);
	thumbWidth = Math.round(initialWidth/(showCount + 1)); // + 1 because each arrow will be roughly half as wide as a thumbnail
	var padding = 0.08 * thumbWidth; // This results in roughly 10 pixels with a maximized window on an HD screen if 10 thumbs are shown
	var arrowWidth =Math.floor((initialWidth - THUMBS_TO_SHOW * thumbWidth)/2);// We use the arrow width (= ~thumbWidth /2)  to compensate when the rounded thumb width might become problematic when multiplied
	var thumbTDs = '';
	// Generate the markup for navigation arrows and thumbnails and thumbnail placeholders
	thumbTDs += '<td style="max-width: ' + arrowWidth + 'px;"><a href="#" onclick="scrollThumbsLeft();"><svg width="' + arrowWidth + '" height="' + thumbWidth + '"><polygon points="' + (arrowWidth - padding) + ',' + padding + ' ' + padding + ',' + (arrowWidth) + ' '  + ' ' + (arrowWidth - padding) + ',' + (thumbWidth - padding) + '" style="fill: blue; stroke-width: 0;" /></svg></a></td><td><div class="thumb-row"><div class="thumbs" style="text-align: center;"><table><tr>';
	var i = 1;
	// Before the current page:
	while(i < pageNo) {
		thumbTDs += '<td class="thumb" style="padding: ' + padding + 'px;"><a href="#" onclick="gotoPage(' + i + ')"><img class="thumb thumb-img" src="' + thumbArray[i - 1] + '"><br/><span style="color: white;">' + i +'</span></a></td>';
		i++;
	}
	// Highlight current page:
	thumbTDs += '<td class="thumb" style="padding: ' + padding + 'px;"><img class="thumb thumb-current" src="' + thumbArray[i - 1] + '"><br/><span style="color: white;">' + i +'</span></td>';
	i++;
	// After the current page:
	while(i < thumbArray.length) {
		thumbTDs += '<td class="thumb" style="padding: ' + padding + 'px;"><a href="#" onclick="gotoPage(' + i + ')"><img class="thumb thumb-img" src="' + thumbArray[i - 1] + '"><br/><span style="color: white;">' + i +'</span></a></td>';
		i++;
	}
	thumbTDs += '</tr></table></div></div></td><td style="max-width: ' + arrowWidth + 'px;"><a href="#" onclick="scrollThumbsRight();"><svg width="' + arrowWidth + '" height="' + thumbWidth + '"><polygon points="' + padding + ',' + padding + ' ' + (arrowWidth - padding) + ',' + (arrowWidth) + ' '  + ' ' + padding + ',' + (thumbWidth - padding) + '" style="fill: blue; stroke-width: 0;" /></svg></a></td>';
	$("#thumbTR").html(thumbTDs);// Show it
	// Then we alter the CSS:
	$(".thumb").css("width", (thumbWidth - 2*padding) + "px"); 
	$(".thumb-row").css("width", THUMBS_TO_SHOW * thumbWidth + "px");
	$(".thumbs" ).css("transform",  "translateX(" + thumbCountOffset * thumbWidth + "px)");
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
		console.log("dialog top: " + $("#correctModal").css("top"));
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
function updateLineLengths() { // updates the length attribute of spans in lines
	$("[length]").each(function () {
		var span = $(this);
		span.attr("length", span.text().length);
	});
}
function buildLineList() {
	var currentIdx = getIndexFromLineId(currentLineId);
	var showTo = Math.min(currentIdx + surroundingCount, contentArray.length - 1);
	var index = Math.max(1, currentIdx - surroundingCount); // 1 because the first line is not real
	$("#lineList").html("");
	while (index <= showTo)
		$("#lineList").append(getLineLiWithTags(contentArray[index++][0]));
	updateLineLengths();
	highlightLineList();
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
function setCurrentLineId(newId) { // We're not happy with just "=" to set the new id because we want to detect changes, if any, to the lines in the dialog so we have this function. TODO Rename? Its purpose is so different now...
	// TODO Tags! Then we'll start saving again.
	if (null != currentLineId) {
		var currentIdx = getIndexFromLineId(currentLineId);
		var i = Math.max(1, currentIdx - surroundingCount); // 1 because the first line is not real
		var to = Math.min(currentIdx + surroundingCount, contentArray.length - 1);
		while (i <= to) {
			console.log("dialog: "+ contentArray[i][1]);
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
function setZoom(zoom, x, y) {
	if (!readyToZoom)
		return;// Zooming before the page has fully loaded breaks it.
	var newZoom = savedZoom + zoom;
	if (newZoom >= 0) 
		savedZoom = newZoom;
	else
		return;// We don't allow zooming out more than what the size originally was.
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
function stopBackspace(node) { // Get the cursor position relative to the <DIV>. Regardless of <SPAN> tags.
	var selection = window.getSelection();
	var anchorNode =  selection.anchorNode;
	var offset = selection.anchorOffset;
	var childNode = node.firstChild;

	if ("" != selection)
		return false;
	else
		return (parseInt(selection.anchorNode.parentNode.getAttribute("offset")) + window.getSelection().anchorOffset) < 1;
	
	if (childNode.isSameNode(anchorNode)) {// Is the offset relative to the <DIV>?
		console.log("off: " + offset);
		return true;
		return offset < 1;
	}

	while (!anchorNode.isSameNode(childNode.firstChild)) { // The child node was not the <DIV> so we start from the first <SPAN> within the <DIV>.
		offset += childNode.textContent.length;
		childNode = childNode.nextSibling;
	}
	// Just testing, the entire function might soon disappear.
	return true;
	return offset < 1;
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
	var c=document.getElementById("transcriptCanvas");
	var ctx=c.getContext("2d");
	ctx.canvas.width = $('#transcriptImage').width();
	ctx.canvas.height = $('#transcriptImage').height();
	ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
	ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
	ctx.save();
	if (correctModal != null && correctModal.isOpen()) {
		highlightLineList();
	}
	// debugging, highlight all:
	/*for (var i = 1; i < contentArray.length; i++)
		highlightLine(contentArray[i][0]);
	console.log("updating canvas");*/
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
		if (contentArray[index][1].length == 0 || (contentArray[index][1].length <= 1 && contentArray[index][1].match(/\s+/))) { // empty = orange
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
