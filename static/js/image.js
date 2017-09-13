var readyToZoom = false;// Zooming too soon breaks the page
var savedZoom = 0;

// these vars must be initialized when importing this JavaScript
// initialWidth, initialHeight, initialScale
// previousInnerWidth
// zoomFactor
// accumExtraX
// accumExtraY
// contentArray
// these JavaScripts must also be imported
// TODO List

function resetImage() {
	savedZoom = 0;
	zoomFactor = 0;
	accumExtraX = 0;
	accumExtraY = 0;
	$(".transcript-map-div").css("transform",  "translate(0px, 0px) scale(1)"); // Note, the CSS is set to "transform-origin: 0px 0px"
}
function setZoom(zoom, x, y) {
	if (!readyToZoom)
		return; // Zooming before the page has fully loaded breaks it.
	var newZoom = savedZoom + zoom;
	if (newZoom >= -60)
		savedZoom = newZoom;
	else
		return; // We have a limit on zooming
	if (1 == arguments.length) { // If no cursor position has been given, we use the center
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
	var currentTop = accumExtraY / (initialScale * (1 + zoomFactor)) - 1; // -1 to ensure that a new top is obtained for every click
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
	$( ".transcript-map-div" ).css("transform",  "translate(" + -accumExtraX +"px, " + -accumExtraY+ "px) scale(" + (1 + zoomFactor) + ")"); // Note, the CSS is set to "transform-origin: 0px 0px"
}
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
	// uncomment this for debugging, it highlights all:
	//for (var i = 1; i < contentArray.length; i++)
		//highlightLine(contentArray[i][0]);
}
function placeBalls(lineId) {
	var length = contentArray.length;
	var coords = Array(8); // TODO Four coordinate pairs are not needed...
	for (j = 0; j < length; j++) { // TODO Stop the loop sooner!
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
	ctx.clearRect(coords[0], coords[1], coords[4] - coords[0], coords[5] - coords[1]);	 // TODO Four coordinate pairs are not needed for a rectangle...
}
function highlightLineList() { // highlights the lines being shown in the dialog and places balls in front of them
	var currentIdx = getIndexFromLineId(currentLineId);
	var showTo = Math.min(currentIdx + surroundingCount, contentArray.length - 1);
	var index = Math.max(1, currentIdx - surroundingCount); // 1 because the first line is not real
	var lineCoords =  Array(8); // TODO Four coordinate pairs are not needed for a rectangle...
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
