var dialogWidth = Number.MAX_SAFE_INTEGER, dialogHeight = 0; // Math.min( and max( are involved in setting these when the dialog is first opened
var dialogX, dialogY;
var dialogAbsoluteMinWidth = null;
var dialogAbsoluteMinHeight = null;
var docked = false;
var dockedHeight = 250;// TODO Decide how to calculate this.

// these vars must be initialized when importing this JavaScript
// initialScale;
// previousInnerWidth = window.innerWidth;
// zoomFactor
// accumExtraX
// accumExtraY
// these JavaScripts must also be imported
// TODO Check which...?

function updateDocking(dock) { // docks (true) / undocks (false) the dialog. When not specified, docking status remains unchanged and just the dialog position and size gets updated
	if (1 == arguments.length)
		docked = dock;
	if (docked) {
		saveDialogProperties();
		var leftOffset = $("#sidebar-wrapper").width();
		$("#correctModal").css("left", 0);
		$("#correctModal").css("width", document.body.clientWidth);
		$("#correctModal").css("height", dockedHeight);
		$("#correctModal").css("position", "fixed");
		$("#correctModal").css("top", $(window).height() - dockedHeight + "px");// using "bottom" is problematic
		$("#correctModal").on("mousedown touchdown", function (e) { // TODO Test touchdown when an appropriate device is available...
		$("#correctModal").css("position", "fixed"); // gijgo dialog messes with this undesirably...
		});
	} else {
    	$("#correctModal").css("left",  dialogX);
    	$("#correctModal").css("top",  dialogY);
    	$("#correctModal").css("width",  dialogWidth);
    	$("#correctModal").css("height",  dialogHeight);
    	updateDialogSize();
	}
	updateDockingStatus(docked);
}
function updateDockingStatus(dock) { // Toggles the docking status and the docking button
	docked = dock;
	if (docked)
		$("#dockButton").html('<button type="button" class="dock-toggle close" onclick="updateDocking(false);"><small><span class="glyphicon glyphicon-resize-small" aria-hidden="true"></span></small></button>');
	else
		$("#dockButton").html('<button type="button" class="dock-toggle close" onclick="updateDocking(true);"><small><span class="glyphicon glyphicon-resize-full" aria-hidden="true"></span></small></button>');
}
function saveDialogProperties() { // Saves the undocked dialog properties...
	$("#correctModal").css("position", "absolute");
	dialogX = $("#correctModal").offset().left;
	dialogY = $("#correctModal").offset().top;
	dialogWidth = $("#correctModal").width(); // TODO Search width vs. outerWidth
	dialogHeight = $("#correctModal").height();
}
function updateDialog(lineId) { // This function can be called without a line ID to reset the dialog after resizing the window
	if (null == currentLineId) {
		if (1 == arguments.length) // can this happen anymore?
			currentLineId = lineId;
		var lineIdx = getIndexFromLineId(currentLineId);
		var endOfLine = contentArray[lineIdx][1].length;
		setSelectionData(currentLineId, endOfLine, endOfLine);
		correctModal.open();
		buildLineList();
		dialogX =  Math.max(Math.min(initialScale * zoomFactor * contentArray[lineIdx][2][0] + $(".transcript-div").offset().left - accumExtraX, window.innerWidth - dialogWidth - 20), $(".transcript-div").offset().left);
		// get the last shown line index
		var lastShown = Math.min(lineIdx + surroundingCount, contentArray.length - 1);
		// place the dialog one "last line height" below the last shown BELOW the clicked line (a higher index does not guarantee a lower position)
		var lowest;
		for (lowest = lineIdx; lowest < lastShown && contentArray[lowest][2][7] < contentArray[lowest + 1][2][7]; lowest++);
		dialogY = initialScale * zoomFactor * (2 * contentArray[lowest][2][7] - contentArray[lowest][2][1]) + $(".transcript-div" ).offset().top - accumExtraY;
		if (dialogX <= 0)
			dialogX = 0;
		else if ((dialogX + dialogWidth) >= window.innerWidth)
			dialogX = window.innerWidth - dialogWidth;
		if (dialogY <= 0)
			dialogY = 0;
		else if ((dialogY + dialogHeight) > document.body.clientHeight)
			dialogY = window.innerHeight - dialogHeight;
		$("#correctModal").css("left",  dialogX + "px");
		$("#correctModal").css("top",  dialogY + "px");
		updateDocking(); // We restore the dialog to a docked state, if it was docked when closed
	} else {
		var oldDeltaX = contentArray[getIndexFromLineId(currentLineId)][2][0] * initialScale * zoomFactor - accumExtraX - $("#correctModal").offset().left;
		var oldDeltaY = contentArray[getIndexFromLineId(currentLineId)][2][1] * initialScale * zoomFactor - accumExtraY - $("#correctModal").offset().top;
		if (1 == arguments.length)
			currentLineId = lineId;
		var lineIdx = getIndexFromLineId(currentLineId);
		accumExtraX = contentArray[getIndexFromLineId(currentLineId)][2][0] * initialScale * zoomFactor - $("#correctModal").offset().left - oldDeltaX;
		accumExtraY = contentArray[getIndexFromLineId(currentLineId)][2][1] * initialScale * zoomFactor - $("#correctModal").offset().top - oldDeltaY;
		$( ".transcript-map-div" ).css("transform",  "translate(" + -accumExtraX +"px, " + -accumExtraY+ "px) scale(" + zoomFactor + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
		buildLineList();
	}
}
function updateDialogSize() {
	if (docked)
		return;
	if (null === dialogAbsoluteMinWidth) { // if we're doing this for the very first time, we calculate the absolute minimum, which means space for all buttons on a single row
		var buttonSum = 0;
		// get the delta between a button group and the span containing it when there's another button following it
		var spanPadding = $(".dialogbutton-group").first().parent().outerWidth(true) - $(".dialogbutton-group").first().outerWidth(true);
		$(".dialogbutton-group").each(function() {
			buttonSum += $(this).outerWidth(true) + spanPadding; // spanPadding must be added to avoid line breaks
		});
		dialogAbsoluteMinWidth =  buttonSum + 2 * ($(".dialogbutton-group").first().offset().left - $("#correctModal").offset().left); // we use the same width for the space surrounding the text on both sides...
		dialogWidth = dialogAbsoluteMinWidth; // we must set this when setting the absolute minimum for the first time
		dialogAbsoluteMinHeight = 2 * parseInt($(".modal-header").css("padding-top"))
				+ $(".modal-title").outerHeight(true)
				+ $(".dialogbutton-group").outerHeight(true)
				+ 2 * parseInt($(".modal-body").css("padding-top")); // the sum of these is the height of the dialog without any text
	}
	var currentMinH = dialogAbsoluteMinHeight;
	if ($(".transcript-div").is(":visible") && currentLineId !== undefined ) { // check if any line is longer than the absolute minimum
		var longestLine = 0;
		var currentIdx = getIndexFromLineId(currentLineId);
		var showTo = Math.min(currentIdx + surroundingCount, contentArray.length - 1);
		var index = Math.max(1, currentIdx - surroundingCount); // 1 because the first line is not real
		while (index <= showTo) {
			var lineId = contentArray[index++][0];
			longestLine = Math.max(longestLine, $("[tagLineId=" + lineId + "]").last().offset().left + $("[tagLineId=" + lineId + "]").last().outerWidth() - $("#text_" + lineId).offset().left);
			currentMinH += $("#text_" + lineId).outerHeight(true);
		}
	}
	var currentMinW = Math.max(dialogAbsoluteMinWidth, longestLine + 2 * ($("[tagLineId]").first().offset().left - $("#correctModal").offset().left));
	dialogWidth = Math.max(dialogWidth, currentMinW); // we don't shrink the dialog automatically
	dialogHeight = Math.max(dialogHeight, currentMinH);
	$("#correctModal").css("width",  dialogWidth + "px");
	$("#correctModal").css("height",  dialogHeight + "px");
	$("#correctModal").css("min-width",  currentMinW + "px");
	$("#correctModal").css("min-height",  currentMinH + "px");
	$("#line-list").css("min-height", (dialogHeight - dialogAbsoluteMinHeight) + "px"); // the text contenteditable isn't updated automagically
}
