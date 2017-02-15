var readyToZoom = false;// Zooming too zoon breaks the page
var changed = false;
var savedZoom = 0;
var surroundingCount = 1;
var currentLineId;
var modalFromMouse = 50;// TODO Decide whether to calculate this or have a simple default. Note pages with text near the lower edge...
var modalHeight = 250;// TODO Consider whether to calculate this somehow, this value is just a rough guess...
var modalWidth = null;
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
var newInputFontSize;
var newInputLineHeight;
var newLineFontSize;
var newLineLineHeight;
var correctModal;
var docked = false;
var dialogX, dialogY;
var dialogWidth, dialogHeight = 250; // This is 250 for no particular reason. TODO Calculate some appropriate value?

// Just for testing...
var tagColors = {// TODO tag colours from the view (array to the template?), also decide whether to use numbers or strings...
								"abbrev": "ff0000",
								"textStyle": "00ff00",
								"blackening": "0000ff",
								"place": "00f0ff"
							};

function processTags(tagLineId) {
	// create a "tag stack" with all tags in this line
	var tags = $("." + tagLineId + "_tag");
	var tagStack = new Array();
	tags.each(function () { 
		var tag = $(this).attr("tag");
		var notYetIn = true; // set to false if the tag is already found in the stack
		for (var i = 0; notYetIn && i < tagStack.length; i++) {
			if (tagStack[i] == tag)
				notYetIn = false;
		}
		if (notYetIn)
			tagStack.push(tag);
	});
	
	// generate SVGs with the right height to be used as a background and a 1 px "long" line corresponding to each tag
	var lineY = Math.round(1.5 * parseInt($('.content-line').css("font-size"), 10)); // TODO Store font size globally since it's used in many places?
	var lineThickness = Math.round(lineY / 6);// TODO Test what looks good...
	var thicknessAndSpacing = lineThickness + Math.round(lineY / 8);// TODO Test what looks good...
	var svgRectsJSON = '';// JSON-2-B with the rect for each line
	var backgroundHeight = lineY + tagStack.length * (thicknessAndSpacing);// spacing is added above each tag
	var i = 0
	for (; i < tagStack.length; i++) {
		svgRectsJSON += '"' + tagStack[i] + '":' + "\"<rect x='0' y='" + lineY + "' width='1' height='" + lineThickness + "' style='fill: %23" + tagColors[tagStack[i]] + ";' />\""; // # must be %23
		lineY +=thicknessAndSpacing;
		svgRectsJSON += ',';
	}
	svgRectsJSON = svgRectsJSON.substring(0, svgRectsJSON.length - 1); // remove the comma in the end
	svgRectsJSON = JSON.parse("{" +svgRectsJSON + "}");
	tags.each(function () {
		$(this).css("background",  "url(\"data:image/svg+xml;utf8, <svg xmlns='http://www.w3.org/2000/svg' width='1' height='" + backgroundHeight + "'>" + svgRectsJSON[$(this).attr("tag")] + "</svg>\") repeat-x");
		$(this).css("height", "50px");// TODO Calculate... (from the SVG!?)
		$(this).css("line-height", "70px");// TODO Calculate... (from the SVG!?) 
		$(this).css("padding-bottom", "30px");// TODO Calculate... (from the SVG!?)
	});
}

function getContent() { //"JSON.stringifies" contentArray and also strips out content which does not need to be submitted.
	var lengthMinusOne = contentArray.length - 1;
	content = '{';
	for (var cI = 1; cI <= lengthMinusOne; cI++) {// cI = 1 because we skip the "line" which isn't real since it's the top of the page
		content += '"' + contentArray[cI][0] + '":"' + contentArray[cI][1] + '"';
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
		$("#correctModal").css("left", leftOffset);
		$("#correctModal").css("width", document.body.clientWidth - leftOffset);
		$("#correctModal").css("height", dockedHeight);
		$("#correctModal").css("position", "fixed");
		$("#correctModal").css("top", $(window).height() - dockedHeight + "px");// using "bottom" is problematic
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
	modalTextMaxHeight = $("#correctModal").height() - modalMinHeight;// TODO Which height? outer? true?
	$(".line-list-div").css("height", modalTextMaxHeight);
}
function buildLineList() { // shows and hides lines to create the list in the dialog
	var currentIdx = getIndexFromLineId(currentLineId);
	var index = Math.max(1, currentIdx - surroundingCount);// 1 because the first line is not real
	var showTo = Math.min(currentIdx + surroundingCount, contentArray.length - 1);
	$(".content-line").css("display", "none");
	while (index <= showTo)
		$("#text_" + contentArray[index++][0]).css("display", "block"); // TODO Decide between list-item/block/inline... This will be affected by how tagging is implemented, I think.
}
function resizeText(delta) {
	var newFontSize = parseInt($('.content-line').css("font-size"), 10) + delta;
	if (newFontSize < 14 || newFontSize > 40)
		return;
	newLineFontSize = newFontSize;
	$('.content-line').css("font-size", newLineFontSize+ 'px'); 
	processTags(currentLineId);// TODO Something better, all tags need to be redrawn here...
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
function setCurrentLineId(newId) { // We're not happy with just "=" to set the new id because we want to detect changes, if any, so we have this function.
	// TODO Tags! Then we'll start saving again.
	/*currentContent = $("#currentLine").val();
	if (null != currentLineId && contentArray[getIndexFromLineId(currentLineId)][1] != currentContent) {		
		if (!changed)
			setMessage("<div class='alert alert-warning'>" + transUnsavedChanges + "</div>");
		changed = true;
		contentArray[getIndexFromLineId(currentLineId)][1] = currentContent;
	}*/	
	currentLineId = newId;
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

// UX actions:
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
	updateCanvas();
	setCurrentLineId(newLineId);
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
		highlightLine(currentLineId);
		placeBalls(currentLineId);
	}
	// debugging, highlight all:
	/*for (var i = 1; i < contentArray.length; i++)
		highlightLine(contentArray[i][0]);
	console.log("updating canvas");*/
}
function placeBalls(lineId) {
	var length = contentArray.length;
	var coords =  Array(8);// TODO Four coordinate pairs are not needed...
	for (j = 0; j < length; j++) {// TODO Stop the loop sooner!
		if (contentArray[j][0] == lineId) {
			for (k = 0; k < coords.length; k++) {
				coords[k] = Math.round(initialScale*contentArray[j][2][k]);
			}
		}
	}
	var lineHeight = (coords[5] - coords[1]); // We use this to get "appropriate" places for the balls in relation to the line size...
	var c=document.getElementById("transcriptCanvas");
	var ctx=c.getContext("2d");
	ctx.beginPath(); 
	ctx.arc(coords[0] -0.5 * lineHeight, coords[1] + lineHeight / 2, 10, 0, 2*Math.PI);
	// Restore, if our usability testers change their minds...
	//ctx.arc(coords[4] + 0.5 * lineHeight, coords[1] + lineHeight / 2, 10, 0, 2*Math.PI);
	ctx.fillStyle = "rgba(0, 255, 0, 1)";
	ctx.fill();
}
function highlightLine(lineId) {
	var length = contentArray.length;
	var coords =  Array(8);// TODO Four coordinate pairs are not needed for a rectangle...
	for (j = 0; j < length; j++) {// TODO Stop the loop sooner!
		if (contentArray[j][0] == lineId) {						
			for (k = 0; k < coords.length; k++)
				coords[k] = Math.round(initialScale*contentArray[j][2][k]);
		}
	}
	var c=document.getElementById("transcriptCanvas");
	var ctx=c.getContext("2d");
	ctx.clearRect(coords[0], coords[1], coords[4] - coords[0], coords[5] - coords[1]);
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
