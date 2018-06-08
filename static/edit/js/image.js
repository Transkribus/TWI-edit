// these vars must be initialized when importing this JavaScript
// initialWidth, initialHeight, initialScale
// previousInnerWidth
// zoomFactor
// accumExtraX
// accumExtraY
// contentArray
// these JavaScripts must also be imported
// TODO List

function fitWidth() {
	zoomFactor = 1;
	accumExtraX = 0
	accumExtraY = 0;// or should we leave this as left by the user?
	$(".transcript-map-div").css("transform",  "translate(0px, 0px) scale(1)"); // Note, the CSS is set to "transform-origin: 0px 0px"
    contentArray.forEach(function(obj, i) {
        accumExtra[obj[0]] = {"x": 0, "y": 0, "factor": 1};
        $("#canvas_" + obj[0]).css("transform", "translate(0px, 0px) scale(1)");
    });
    updateCanvas();
}
function fitHeight() {
	zoomFactor = $( ".transcript-div" ).innerHeight() / initialHeight;
	accumExtraY = 0;
	accumExtraX = -$( ".transcript-div" ).innerWidth() / 2 + zoomFactor * initialWidth / 2;
	$( ".transcript-map-div" ).css("transform", "translate(" + -accumExtraX +"px, " + -accumExtraY+ "px) scale(" + zoomFactor + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
    contentArray.forEach(function(obj, i) {
        var width = obj[2][2] - obj[2][0];
        var height = obj[2][5] - obj[2][1];
        var factor = $("#canvas_wrapper_" + obj[0]).innerHeight() / height;
        accumExtra[obj[0]] = {"x": -$("#canvas_wrapper_" + obj[0]).innerWidth() / 2 + factor * width / 2, "y": 0, "factor": factor};
        $("#canvas_" + obj[0]).css("transform", "translate(" + -accumExtra[obj[0]]["x"] +"px, " + -accumExtra[obj[0]]["y"]+ "px) scale(" + accumExtra[obj[0]]["factor"] + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
    });
    updateCanvas();
}
function setZoom(zoom, x, y) {
    if ( (ifc === "sbs" || ifc === "i") && (zoom > 0 || $( ".transcript-div" ).innerHeight() < initialHeight * zoomFactor) ) {// is the image still larger than the viewport? We allow one "step" of zooming out below that size, hence using the old zoomFactor
        var newZoomFactor = zoomFactor * (zoom/50 +1);
        if (1 == arguments.length) { // If no cursor position has been given, we use the center
            x = initialWidth / 2 + accumExtraX;
            y = $( ".transcript-div" ).innerHeight() / 2 + accumExtraY;
        }
        // Calculate the pixel delta and get the total offset to move in order to preserve the cursor position...
        accumExtraX += (newZoomFactor - zoomFactor) * x / zoomFactor;
        accumExtraY += (newZoomFactor - zoomFactor) * y / zoomFactor;
        // ...and move the image accordingly before scaling:
        $( ".transcript-map-div" ).css("transform",  "translate(" + -accumExtraX +"px, " + -accumExtraY+ "px) scale(" + newZoomFactor + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
        zoomFactor = newZoomFactor;// update this
    }
    else if ( ifc === "lbl" ) {
        contentArray.forEach(function(obj, i) {
            var width = obj[2][2] - obj[2][0];
            var height = obj[2][5] - obj[2][1];
            var newZoomFactor = accumExtra[obj[0]]["factor"] * (zoom / 50 + 1);
            if (newZoomFactor < 0.1 )
                newZoomFactor = 0.1;

            $("#canvas_" + obj[0]).css("transform", "scale(" + newZoomFactor + ")");
            accumExtra[obj[0]]["factor"] = newZoomFactor;
        });
    }
    updateCanvas();
}
function scrollToNextTop() { // This function scrolls the image up as if it were dragged with the mouse.
	var currentTop = accumExtraY / (initialScale * (zoomFactor)) + 1;// +1 to ensure that a new top is obtained for every click
	if (contentArray[contentArray.length - 1][2][1] < currentTop)
		return; // If the page has been moved so that the last line is above the top, we don't do anything.
	var newTop;
	for (var idx = 0; idx < contentArray.length; idx++) {
		newTop = contentArray[idx][2][1];
		if (newTop > currentTop)
			break;
	}
	accumExtraY = newTop * initialScale * (zoomFactor);
	$( ".transcript-map-div" ).css("transform",  "translate(" + -accumExtraX +"px, " + -accumExtraY+ "px) scale(" + (zoomFactor) + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
}
function scrollToPreviousTop() {
	var currentTop = accumExtraY / (initialScale * (zoomFactor)) - 1; // -1 to ensure that a new top is obtained for every click
	if (contentArray[0][2][1] > currentTop)
		return; // If the page has been moved so that the first line is below the top, we don't do anything.
	var newTop;
	for (idx = contentArray.length - 1; idx >= 0; idx--) {
		newTop = contentArray[idx][2][1];
		if (newTop < currentTop) {
			break;
		}
	}
	accumExtraY = newTop * initialScale * (zoomFactor);
	$( ".transcript-map-div" ).css("transform",  "translate(" + -accumExtraX +"px, " + -accumExtraY+ "px) scale(" + (zoomFactor) + ")"); // Note, the CSS is set to "transform-origin: 0px 0px"
}
function updateCanvas() {
    if ( $(".transcript-div").is(":visible") ) {
    	var c = document.getElementById("transcriptCanvas");
    	var ctx = c.getContext("2d");
    	ctx.canvas.width = $('#transcriptImage').width();
    	ctx.canvas.height = $('#transcriptImage').height();
    	ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    	ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    	ctx.save();
    	if (correctModal != null && correctModal.isOpen()) {
    		highlightLineList();
    	}
    }
    else if ( $(".interface-lbl").is(":visible") ) {
        contentArray.forEach(function(obj, i) {
            var c = document.getElementById("canvas_" + obj[0]);
            if ( c !== null && c !== undefined ) {
                var ctx = c.getContext("2d");
                ctx.canvas.width = $("#canvas_" + obj[0]).width();
                ctx.canvas.height = $("#canvas_" + obj[0]).height();
                ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.save();
                drawLineImage(obj[0], obj[2]);
            }
        });
    }
	// uncomment this for debugging, it highlights all:
	//for (var i = 1; i < contentArray.length; i++)
		//highlightLine(contentArray[i][0]);
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
function showLineImage(e) {
    if ( e.type.indexOf("mouse") >= 0 ) {
        if ( window.innerHeight - (e.clientY + 180) <= 0 )
            $("#canvas_text").css("top", e.clientY - 180);
        else
            $("#canvas_text").css("top", e.clientY + 10);
    }
    else if ( e.type.indexOf("key") >= 0 && currentLineId !== null && currentLineId !== undefined ) {
        var top = $("#text_" + currentLineId).offset().top - $(window).scrollTop();
        if ( window.innerHeight - (top + $("#text_" + currentLineId).height()) <= 0 )
            $(window).scrollTop($(window).scrollTop() + $("#text_" + currentLineId).height());
        else if ( top + $("#text_" + currentLineId).height() <= 80 )
            $(window).scrollTop($(window).scrollTop() - $("#text_" + currentLineId).height());

        top = $("#text_" + currentLineId).offset().top - $(window).scrollTop();
        if ( window.innerHeight - (top + $("#text_" + currentLineId).height() + 180) <= 0 )
            $("#canvas_text").css("top", top - 180);
        else
            $("#canvas_text").css("top", top + $("#text_" + currentLineId).height());
    }

    var c = document.getElementById("canvas_text")
    if ( c !== null && c !== undefined ) {
        var ctx = c.getContext("2d");
        var image = document.getElementById("transcriptImage");

        if ( currentLineId === null || currentLineId === undefined )
            var contentLine = contentArray[getIndexFromLineId(e.currentTarget.id.substring(5))];
        else
            var contentLine = contentArray[getIndexFromLineId(currentLineId)];

        var width = contentLine[2][2] - contentLine[2][0];
        var height = contentLine[2][5] - contentLine[2][1];
        ctx.drawImage(image, contentLine[2][0], contentLine[2][1], width, height, 0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.save();
    }
}
