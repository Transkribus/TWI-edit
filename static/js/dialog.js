var dialogWidth = Number.MAX_SAFE_INTEGER, dialogHeight = 0; // Math.min( and max( are involved in setting these when the dialog is first opened
var dialogX, dialogY;
var dialogAbsoluteMinWidth = null;
var dialogAbsoluteMinHeight = null;
var docked = false;
var dockedHeight = 250;// TODO Decide how to calculate this.
var restoreDialogLine;
var dialogHighlightDX, dialogHighlightDY;
var scrollbarHeight = null;
// these vars must be initialized when importing this JavaScript
// initialScale;
// previousInnerWidth = window.innerWidth;
// zoomFactor
// accumExtraX
// accumExtraY
// these JavaScripts must also be imported
// TODO Check which...?
function hideDialog() {
	if (!docked) // we're only interested in the user-modifiable properties since we have a docking variable
		saveDialogProperties();
	correctModal.close();
}
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
	dialogWidth = $("#correctModal").width(); // TODO Search width vs. outerWidth
	dialogHeight = $("#correctModal").height();
}

