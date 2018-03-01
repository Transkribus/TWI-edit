$(document).ready(function(){

	//Manage classes for buttons when toggled
	//someone will have to annotate the below a bit more
	$(".btn-toggle").click(function(e) {
	    if ( e.target != this ) {
		if ( $(this).find(".btn-primary").size() > 0 ) {
		    $(this).find(".active").toggleClass("btn-primary");
		    $(this).find(".active").toggleClass("btn-default");
		    $(this).find(e.target).toggleClass("btn-default");
		    $(this).find(e.target).toggleClass("btn-primary");
		}
		if ( $(this).find(".btn-danger").size() > 0 ) {
		    $(this).find(".active").toggleClass("btn-danger");
		    $(this).find(".active").toggleClass("btn-default");
		    $(this).find(e.target).toggleClass("btn-default");
		    $(this).find(e.target).toggleClass("btn-danger");
		}
		if ( $(this).find(".btn-success").size() > 0 ) {
		    $(this).find(".active").toggleClass("btn-success");
		    $(this).find(".active").toggleClass("btn-default");
		    $(this).find(e.target).toggleClass("btn-default");
		    $(this).find(e.target).toggleClass("btn-success");
		}
		if ( $(this).find(".btn-info").size() > 0 ) {
		    $(this).find(".active").toggleClass("btn-info");
		    $(this).find(".active").toggleClass("btn-default");
		    $(this).find(e.target).toggleClass("btn-default");
		    $(this).find(e.target).toggleClass("btn-info");
		}

		$(this).find(".active").toggleClass("active");
		$(this).find(e.target).toggleClass("active");
	    }
	});


	/* We have two modes of pageStatus depending on how many statuses 
 	* are on offer to the given role. If there are two we only need a 
 	* toggle buttons, if there are more a select is required */
	/* Toggle page status */
/*
	$("button#page_status").on("click", function(e) {
		newStatus = $(this).data("status-0");
		newStatusLabel = $(this).data("status-label-0");
		if($(this).data("value") === $(this).data("status-0")){
			newStatus = $(this).data("status-1")
			newStatusLabel = $(this).data("status-label-1")
		}
		setPageStatus(newStatus,newStatusLabel);
       	});
*/
	/* Select page status */
/*
	$("a[data-target='#page_status']").on("click", function(e) {
		newStatus = e.currentTarget.name;
		newStatusLabel = $(e.currentTarget).data("value");
		setPageStatus(newStatus,newStatusLabel);
       	});
*/
	// .transcript-div suggests image or sbs interface
	// Here we are managing the scrolly-zoom
	// TODO this code looks familiar I think there may be some 
	// replication in line-by-line. We should define a single function 
	// we can call from where there is a zoomable image
    	$('.transcript-div').on('mousewheel DOMMouseScroll', function(e) {
    		e.preventDefault();
    		var mouseZoom;
    		if (e.originalEvent.detail > 0 || e.originalEvent.wheelDelta < 0)
			mouseZoom = -20;
		else
			mouseZoom = 20;
    		setZoom(mouseZoom, e.originalEvent.pageX - $( ".transcript-map-div" ).offset().left, e.originalEvent.pageY - $( ".transcript-map-div" ).offset().top);
    	});


/*
	$(function() { //{# TODO Solution for people using broken computers that don't have more than one mouse button. Issues: z-index (or overflow?) and selections getting deselected... #}
        	$.contextMenu({
		    selector: '.tag-menu',
		    zIndex: 2000,
		    build: function($trigger, e) {
			if (canOpenContextMenu) {
				updateSelectionData(); //{# TODO What do we do in this case if we also want to have the feature below? #}
				restoreSelection(); //{# TODO Request feedback. This solution has the advantage of allowing a selection to be made and the menu opened elsewhere in order not to cover the relevant text. #}
				return tagMenu();
			} else {
				return null;
			}
		    },
		    events: {
			hide : function(){
				selectionData = ""; // the old selection must be forgotten to avoid strange behaviour
		    	}
		    },
		});
   	});
	
	$(".line-list").bind('contextmenu', function(e) {	// if we get a right click within the line list, we have to place the caret where the click was unless we already have a non-zero length selection
		canOpenContextMenu = contextMenuOpenable(e);
	});
    
	$(document.body).on("click", ".context-menu-input", function(e) { // TODO Place this somewhere else....
    		if (e.target.nodeName != "INPUT") // multiple clicks can be triggered, some of which are label or span...
    			return;
		toggleTag($(e.target).prop("name").substr(19)); // "context-menu-input-".length is 19
	});
*/
	$(window).on('beforeunload', function(){
		//TODO put this message in the template and access it from the DOM
	//	if (changed)
	//		return '{% trans "You have unsaved changes. Are you sure you want to leave?" %}'; // custom messages aren't supported by all browsers now, this is for those that do show them
	});
/*
	$( ".previous-page" ).on('click', function(e) {
		gotoPage(pageNo - 1);
	});
	$( ".next-page" ).on('click', function(e) {
		gotoPage(pageNo * 1 + 1);
	});
	$( ".first-page" ).on('click', function(e) {
		gotoPage(1);
	});
	$( ".last-page" ).on('click', function(e) {
		gotoPage(Number.MAX_SAFE_INTEGER);
	});
*/
/*
	$('#correctModal').on('keydown', function(e) {
		keydown(e);
	});
	$('#correctModal').on('keyup', function(e) {
		keyup(e);
	});
	$('#correctModal').on('mouseup', function(e) {
		mouseup(e);
	});
	$("#correctModal").on("paste", function(e) {
		paste(e);
	});
	$("#correctModal").on("drop", function(e) {
		drop(e);
	});
	$("#correctModal").on("cut", function(e) {
		cut(e);
	});
*/
/*
	$( ".add-line" ).on('click', function(e) {
		surroundingCount++;
		buildLineList();
	});

	$( ".enlarge-text" ).on('click', function(e) {
		resizeText(1);
	});
	$( ".shrink-text" ).on('click', function(e) {
		resizeText(-1);
	});
	$(".bold-text").on("click", function(e) {
		toggleTag("bold");
	});
	$(".italic-text").on("click", function(e) {
		toggleTag("italic");
	});
	$(".strikethrough-text").on("click", function(e) {
		toggleTag("strikethrough");
	});
	$(".underline-text").on("click", function(e) {
		toggleTag("underlined");
	});
	$(".subscript-text").on("click", function(e) {
		toggleTag("subscript");
	});
	$(".superscript-text").on("click", function(e) {
		toggleTag("superscript");
	});
	$( ".remove-line" ).on('click', function(e) {
		surroundingCount--; //{# TODO A function instead? #}
		if (surroundingCount >= 0)
			buildLineList();
		else
			surroundingCount = 0;
	});
*/
	$( ".thumbs-left" ).on('click', function(e) {
		scrollThumbsLeft();
	});
	$( ".thumbs-right" ).on('click', function(e) {
		scrollThumbsRight();
	});

}); //end $(document).ready()

/* Set page Status */
/*
function setPageStatus(newStatus, newStatusLabel){
	$.post(window.location.href, {status : newStatus, csrfmiddlewaretoken: csrf_token }, function(response){
		$("#page_status_label").html(newStatusLabel);
		$("#page_status").data("value",newStatus);
		d.pageStatus = newStatus;
		setMessage(response, "success");
	}).fail(function(jqXHR, textStatus, error){
		setMessage(error, "warning");
		console.log( "Fail: ",jqXHR, textStatus, error);
	});
}

*/
