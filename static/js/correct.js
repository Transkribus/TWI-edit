var surroundingCount = 0;
var currentLineId;
var zoomFactor = 0;
var accumExtraX = 0;
var accumExtraY = 0;
var accumExtra;
var initialWidth, initialHeight, initialScale, naturalWidth;
var previousInnerWidth = window.innerWidth;
var correctModal;
var changed = false;

// i18n vars needed: transUnsavedChanges, transSavingChanges

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
	var oldWidth = initialWidth;
    previousInnerWidth = window.innerWidth;
	initialWidth = $('#transcriptImage').width() ? $('#transcriptImage').width() : window.innerWidth;
	initialHeight = $('#transcriptImage').height();
	naturalWidth = $('#transcriptImage').get(0).naturalWidth;
	initialScale = initialWidth / naturalWidth;
	// We have to update these too in case the image has gotten resized by the browser along with the window:
	accumExtraX = initialWidth * accumExtraX / oldWidth;
	accumExtraY = initialWidth * accumExtraY / oldWidth;
	$(".transcript-map-div").css("transform",  "translate(" + -accumExtraX +"px, " + -accumExtraY+ "px) scale(" + zoomFactor + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
	calculateAreas();
	generateThumbGrid();
	updateCanvas();
	// If the dialog is open, position it as before in relation the highlighted area but according to the current window size = new scale...
	if ( correctModal !== undefined && correctModal.isOpen() ) {
		dialogHighlightDX *= initialWidth / oldWidth;
		dialogHighlightDY *= initialWidth / oldWidth;
		dialogX = -accumExtraX + contentArray[getIndexFromLineId(currentLineId)][2][0] * initialScale * zoomFactor + dialogHighlightDX;
		dialogY = -accumExtraY + $(".transcript-div").offset().top + contentArray[getIndexFromLineId(currentLineId)][2][1] * initialScale * zoomFactor + dialogHighlightDY;
		$("#correctModal").css("left",  dialogX + "px");
		$("#correctModal").css("top",  dialogY + "px");
		updateDialog(); // TODO Remove. should be redundant.
	}
    $(".transcript-div").height(window.innerHeight - 200);
}
function getContent() { // "JSON.stringifies" (verbing a noun) contentArray and also strips out content which does not need to be submitted.
	var lengthMinusOne = contentArray.length - 1;
	var content = '{';
	for (var cI = 1; cI <= lengthMinusOne; cI++) {// cI = 1 because we skip the "line" which isn't real since it's the top of the page
		var unicode = contentArray[cI][1].replace('"', '\\"');
		content += '"' + contentArray[cI][0] + '": {"Unicode":"' + unicode + '","custom":"' + contentArray[cI][4] + '"}';
		if (cI < lengthMinusOne)
			content += ',';
	}
	content += '}';
	return content;
}
function saveChanges(e) {
	if(!changed){
		setMessage(noChangesToSave);
		return false;
	}
	if (arguments.length == 1)
		e.preventDefault();
	setMessage(transSavingChanges,"warning",false);
	$.post(window.location.href, {content: getContent(), csrfmiddlewaretoken: csrf_token}, function( data ) {
		setMessage(data,"success");
		changed = false;
		$("a[data-target='#saveChanges']").addClass("disabled");
	}).fail(function() {
		setMessage(transErrorSavingChanges, "danger");
  	});
	// TODO Handle failures here or are we happy with the current solution?
}
function hasEditPermission(role) {
	return role === "Editor" || role === "Owner" || role === "Admin" || role === "CrowdTranscriber" || role === "Transcriber"
}
function setPageStatus(role, newStatus, newStatusTrans) {
	if(pageStatus === newStatus){
		return true;
	}
	if ( role === "CrowdTranscriber" || role === "Transcriber" ) {
        $("#page_status").html(newStatusTrans);
        pageStatus = newStatus;
    }
    else if ( "{{ role }}" === "Editor" || "{{ role }}" === "Owner" || "{{ role }}" === "Admin" ) {
        $("#page_status").html(newStatusTrans + "<span class=\"caret\"></span>");
        pageStatus = newStatus;
    }
    else
        setMessage(pageStatusNotAllowedTrans, "danger");
}
