function drawLineImage(lineId, coordinates) {
	var c = document.getElementById("canvas_" + lineId)
	if ( c !== null && c !== undefined ) {
	    var ctx = c.getContext("2d");
	    var image = document.getElementById("transcriptImage");
	    var coords = coordinates.toString().split(',');
	    var width = coords[2] - coords[0];
	    var height = coords[5] - coords[1];
	    c.height = height;
	    c.width = width;
	    ctx.canvas.width = Math.min(window.innerWidth - 70, Math.max(width, 250));
	    $("#line_" + lineId).width(Math.min(window.innerWidth - 70, Math.max(width, 250)));
	    $("#options_" + lineId).width(Math.min(window.innerWidth - 70, Math.max(width, 250)));
	    $("#canvas_wrapper_" + lineId).height(height);
	    $("#canvas_wrapper_" + lineId).width(Math.min(window.innerWidth - 70, Math.max(width, 250)));
	    ctx.drawImage(image, coords[0], coords[1], width, height, 0, 0, Math.min(window.innerWidth - 70, Math.max(width, 250)), height);
	    ctx.save();
	}
}

