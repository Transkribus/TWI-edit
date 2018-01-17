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
