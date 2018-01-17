// The javascript used in the edit view is rather complicated
// A singleton 'Class' as a function will help keep things 
// together and mildly coherent
var Edit = new function() {

	// The variables below had been initialised in a selection of 
	// locations, included scripts and inline script tags
	// obviously moving them all here will reandomly break many features
	// but I think it is worth biting the bullet on this one
	
	//These ones are from an inline script tag in the template
	// a "semaphore" to avoid false resize events (resizing the 
	// dialog triggers such events and we only want those 
	// triggered by the window)
	this.dialogBeingResized = false;
	this.canOpenContextMenu = false;
	this.ignoreLeave = false;
	this.isDragged = false;
	this.resizeTimeout;
	this.zoomFactor = 1;
	
	// These ones are from correct.js
	this.surroundingCount = 0;
	this.currentLineId = null;
	this.zoomFactor = 0;//TODO This one contradicts the zoomFactor previously set in the embedded script tag from the template
	this.accumExtraX = 0;
	this.accumExtraY = 0;
	this.accumExtra;
	this.initialWidth;
	this.initialHeight;
	this.initialScale;
	this.naturalWidth;
	this.previousInnerWidth = window.innerWidth;
	this.correctModal;
	this.changed = false;

	// These are from dialog.js
	this.dialogWidth = Number.MAX_SAFE_INTEGER, dialogHeight = 0; // Math.min( and max( are involved in setting these when the dialog is first opened
	this.dialogX;
	this.dialogY;
	this.dialogAbsoluteMinWidth = null;
	this.dialogAbsoluteMinHeight = null;
	this.docked = false;
	this.dockedHeight = 250;// TODO Decide how to calculate this.
	this.restoreDialogLine;
	this.dialogHighlightDX;
	this.dialogHighlightDY;
	this.scrollbarHeight = null;


	this.undoArray = [];
	this.ctrlKey = false;
	this.metaKey = false;
	this.altKey = false;
	this.caretOffsetInPixels = null;
	this.savedCaretOffsetInPixels = null;
	this.oldWidthForCaretCalc;
	this.selectionData = [];
	this.contentLineFontSize = parseInt($('.line-list').css("font-size"));
	this.message_timeout;
	
	//used by scroll event Handler
	this.fixmeTop;

    //Use self to reference this sortof-class instance
	self = this;

	//The data passed in at init are all set as properties
	this.init_config = function(data){
		//AN OBJECT WAS PASSED THEN INITIALISE PROPERTIES FROM THAT OBJECT
		for (var p in data) this[p] = data[p];
	};

	// get and set prob not use	d... or needed
	this.get = function(key) {
		return this[key];
	};
	this.set = function(key,value) {
		this[key]=value;
	};

	// This is the place that *all* the event handlers are defined
	// We call this when we create the instance of Edit (along with init_config above)
	this.setEventHandlers = function(){


		// This will always get called and will set the whole shabbang in motion
		// The rough workflow for all this code is: initPage > changeInterface > interface stuff
		$(window).on("load", function() {
			self.initPage();
		});

		/**************************/
		/* Control event handlers */
		/**************************/
 		// These ones are for things like saving the transcript, 
 		// changing page status, interface and mode
 		// These are either about all interfaces or can be used by all interfaes

		/* Toggle mode edit/view */
		$("a#editToggle").on("click", function(e) {
			self.changeMode(e);
		});
		/* Toggle interface */
		$("a[data-target='#toggleInterface']").on("click", function(e) {
    		e.preventDefault();
        	if( $(this).data("interface-id") === self.i ) //dont' bother if we've pressed the interface we are curretnly looking at
            	return;
        	self.changeInterface($(this).data("interface-id"));
		});

		// Save changes to transcript
		// (and set page_status to to IN_PROGRESS)
		$("a[data-target='#saveChanges']").click(function(e) {
			self.saveChanges(e);
       	 	self.setPageStatus("IN_PROGRESS", $(this).data("in-progress-label"));
		});


		/****************************************/
 		/* Event hadlers for image interface 	*/
 		/****************************************/
	
		//To turn off line highlighting when mouse moves away from area?
		$('area').mouseleave(function(e) {
			self.updateCanvas();
		});
		$('area').mouseenter(function(e) {
			if (window.location.href.indexOf('view') < 0)
				self.highlightLine(e.target.id);
		});
	
		// The window has been resized 
    	$(window).on("resize", function() {
    		if (!dialogBeingResized) { //{# If the dialog is being resized, it triggers this event and we must ignore it. #}
	    		clearTimeout(resizeTimeout); //{# We don't want to respond until the window has finished resizing. #}
	    		resizeTimeout = setTimeout(function() {
					self.resizeContents();
	    		}, 480);
	    	}
		});

		// The image has been loaded
		/*
		$("#transcriptImage").on("load", function(){
			//adjust the image so that it fits (whatever the interface)
			self.fitWidth();
		});
		*/
		// A user has clicked on the image map so we should trigger 
		// the transcript dialog  
		$( "#transcriptMap area" ).on('click', function(e) {
			console.log("#transcriptMap area click event");
	    	e.preventDefault();
			// We ignore clicks if the user has been dragging the image, we assume that that's what the user wants. #}
			if (self.isDragged || self.mode === "view" || self.i != "i") 
				return;
			// We don't want the original selection "unhighlighted" when the user moves the mouse to the modal.
			//ignoreLeave = true;
			self.updateDialog($(this).attr("line-key"));
			self.updateCanvas();
		});

		//scroll behaviour (not sure what or why)
		$(window).scroll(function() {
			var currentScroll = $(window).scrollTop();
	    	if (currentScroll >= self.fixmeTop) {
	    	    $(".fix_scroll_top").css({
	            	position: "fixed",
	            	top: "0",
	            	left: "0"
	            });
	    	} else {
	        	$(".fix_scroll_top").css({
	            		position: "static"
	        	});
	    	}
		});
		
		/**********************************/
		/* Event handlers for the dialog  */
		/**********************************/

		//key down event handler (for ctrl+s to save)
		$(window).on("keydown", function(e) {
        	if ( e.ctrlKey || e.metaKey ) {
            		if ( String.fromCharCode(e.which).toLowerCase() === "s" ) {
                		e.preventDefault();
                		self.saveChanges(e);
//TODO reinstate this with translated tet from DOM
 //    		           	setPageStatus("{{ role }}", "IN_PROGRESS", "{% trans "Page status: in progress" %}")
            		}
            	else if ( e.charCode === 0 )
                	self.ctrlKey = true;
        	}
    	});
		//unsetting ctrlKey flag when keyup 
    	$(window).on("keyup", function(e) {
        	if ( e.which == 17 || e.which == 112 || e.which == 111 )
            	self.ctrlKey = false;
    	});
		// The dialog buttons to move the image up and work on the next line down
		$( ".typewriter-previous" ).on('click', function(e) {
			self.typewriterPrevious();
		});
		$( ".typewriter-next" ).on('click', function(e) {
			self.typewriterNext();
		});
/*
//TODO what are these for?
		$( ".scroll-up" ).on('click', function(e) {
			self.scrollToPreviousTop();
		});
		$( ".scroll-down" ).on('click', function(e) {
			self.scrollToNextTop();
		});
*/
		//Zoom button event handlers	
		$( ".zoom-in" ).on('click', function(e) {
			self.setZoom(20);
		});
		$( ".zoom-out" ).on('click', function(e) {
			self.setZoom(-20);
		});
		$( ".fit-width" ).on('click', function(e) {
			self.fitWidth();
		});
		$( ".fit-height" ).on('click', function(e) {
			self.fitHeight();
		});

	};

	////////////////////////////////////////////////////////
	// initPage (called on load) Set up the page as much 
	// as we can before we load the interface (changeInterface 
	// called at end of this function)
	////////////////////////////////////////////////////////
	this.initPage = function(){
		console.log("initPage");

		//set fixmeTop (used by the scroll event handler
		self.fixmeTop = $(".fix_scroll_top").offset().top;

		//set the image to fit the width of the page
		self.fitWidth();

		// Show the current page number
		checkPageNumberInput();
//		self.updateCanvas();
		loadThumbs();

		self.correctModal = $("#correctModal").dialog({
			autoOpen: false,
		    uiLibrary: 'bootstrap',
            resizable: true,
		    closed: function(e) {
		    	self.currentLineId = null;
				self.updateCanvas();
				ignoreLeave = false;
		    },
    		resizeStart: function (e) {
    			self.dialogBeingResized = true;
    			self.updateDockingStatus(false);
    		},
    		dragStart: function (e) {
    			self.updateDockingStatus(false);
    		},
    		drag: function(e) {
    			if ($("#correctModal").offset().left <= 0)
    				$("#correctModal").css("left",  "0px");
    			if (($("#correctModal").offset().left + self.dialogWidth) >= window.innerWidth)
    				$("#correctModal").css("left",  (window.innerWidth - self.dialogWidth) + "px");
    			if ($("#correctModal").offset().top <= 0)
    				$("#correctModal").css("top",  "0px");
    			if (($("#correctModal").offset().top + dialogHeight) > document.body.clientHeight)
    				$("#correctModal").css("top",  (window.innerHeight - self.dialogHeight) + "px");
    		},
    		dragStop: function(e) {
    			if ($("#correctModal").offset().left < 0)
    				$("#correctModal").css("left",  "0px");
    			if (($("#correctModal").offset().left + self.dialogWidth) > window.innerWidth)
    				$("#correctModal").css("left",  (window.innerWidth - self.dialogWidth) + "px");
    			if ($("#correctModal").offset().top < 0)
    				$("#correctModal").css("top",  "0px");
    			if (($("#correctModal").offset().top + self.dialogHeight) > document.body.clientHeight)
    				$("#correctModal").css("top",  (window.innerHeight - self.dialogHeight) + "px");
    		},
    		resizeStop: function (e) {
    			self.dialogWidth = parseInt(this.style.width, 10); // saving this... TODO Ask if this is to be saved? User opinions vary...!?
    			self.dialogHeight = parseInt(this.style.height, 10);
    			self.dialogBeingResized = false;
				$("#lineList").css("min-height", (self.dialogHeight - self.dialogAbsoluteMinHeight) + "px"); // TODO Put this and the actions above in a separate function...?
    		}
        });

		//TODO I'm sure this can be done better
        $("#toggleInterface_i").removeClass("disabled");
		$("#toggleInterface_lbl").removeClass("disabled");
		$("#toggleInterface_sbs").removeClass("disabled");
		$("#toggleInterface_t").removeClass("disabled");
		$(".zoom-in").removeClass("disabled");
		$(".zoom-out").removeClass("disabled");
		$(".fit-width").removeClass("disabled");
		$(".fit-height").removeClass("disabled");
		$(".first-page").removeClass("disabled");
		$(".previous-page").removeClass("disabled");
		$("#pageNumber").removeClass("disabled");
		$(".next-page").removeClass("disabled");
		$(".last-page").removeClass("disabled");
		$("a[aria-controls='thumbDiv']").removeClass("disabled");
		refreshOriginalVersion();
//		$("#toggleInterface_" + self.i).click();// Change buttons
		

		// disable/enable interfaces based on config data and mode
		for(interface_id in self.interfaces){ //loop through config data, 
			if(self.interfaces[interface_id].length == 0){ //neither view nor edit = interface off
				$("#toggleInterface_"+interface_id).hide();
				continue;
			}
			// check if current mode is allowed by config
			if($.inArray(self.mode,self.interfaces[interface_id]) < 0) {
				//turn off interface toggle
				$("#toggleInterface_"+interface_id).addClass("disabled");
			}else{
				//turn on interface toggle
				$("#toggleInterface_"+interface_id).removeClass("disabled");
			}
		}

		//Use changeInterface within the onload to set up the initial interface
		self.changeInterface(self.i);
	};
	
	/************************/
	/* Change the interface */
	/************************/
	// This will do the very important job of making 
	// the interface actually appear target can be 
	// i : image
	// lbl: line by line
	// sbs: side by side
	// t: text

	this.changeInterface = function(target) {
		console.log("changeInterface");
		// Stash the current line id and null the current line var (not sure why at this point)
//		var oldLineId = self.currentLineId;
//		self.currentLineId = null;		

		// Here we have lookup for those elements that are associated with each interface
		// Taht way we know what to hide and show when we change interface (note some 
		// elements can be used by more than one interface, that's OK because we hide and then show
		var interface_elements = { "i" : [".transcript-div"],
							 	   "lbl" : [".interface-lbl"],
							 	   "sbs" : [".transcript-div", "#compareText"],
							 	   "t" : [".interface-t"]
			     				};
		
		// Hide the elements associated with the other interfaces
		for(var interface_id in interface_elements){
		    if(interface_id !== target){
		        for(var element in interface_elements[interface_id]){
				    $(interface_elements[interface_id][element]).hide();
				}
		    }
		}
		// Show the elements associated with this interface
		for(interface_id in interface_elements){
		    if(interface_id === target){
		        for(element in interface_elements[interface_id]){
				    $(interface_elements[interface_id][element]).show();
				}
				break;
		    }
		}

		// Now (and only now) that the elements associated with the interface 
		// are visible can we begin to calculate dimensions. Doing it before 
		// this stage will be pointless
		self.setDimensions();


		// Check permissions and enable/disable edit/save/status buttons
		// can_edit is derived direcly from the django config item settings.CAN_EDIT
		// It is not really dynamic so will not change whilst on this page
	    if ( self.can_edit ) {
		    $("#editToggle").removeClass("disabled");
		    $("a[data-target='#saveChanges']").removeClass("disabled");
		    $("#page_status").removeClass("disabled");
		}else{
		    $("#editToggle").addClass("disabled");
		    $("a[data-target='#saveChanges']").addClass("disabled");
		    $("#page_status").addClass("disabled");
		}
	
		//enable zoom controls by default
		$(".zoom-in").removeClass("disabled");
		$(".zoom-out").removeClass("disabled");
		$(".fit-width").removeClass("disabled");
		$(".fit-height").removeClass("disabled");
	
		//IF there are any tasks that are specific to a given interface they shold be done here
		switch(target){
			//image is the default interface
			default : { 	
				    	//the dialog height does not get calculated correctly unless we do this! #}
		   		    	$("").html(""); 
				    	// in case we've been to sbs and shrunk the image:
				    	$(".transcript-div").removeClass("col-lg-6");
				    	$(".transcript-div").addClass("col-lg-12");
				    	$(".transcript-div").height(window.innerHeight - 200);
						//If e are in edit mode then we fire up the dialog for the image interface
						if ( self.mode == "edit" ){
							if(self.currentLineId == null){
			    				self.updateDialog(self.contentArray[1][0]);
							}else{
								console.log("Using the currentLineId on interface change");
			    				self.updateDialog(self.currentLineId);
							}
						}

						//RM may need this again when really switching interfaces...
						//But now that setDimensions is actually setting dimensions we 
						//may not need this (unless we really are resizing contents
		//		    	self.resizeContents();
				    	break; 
				  }
			case "lbl" : { 
				    	$(".line-list").html("");
		    	    	hideDialog();
		 		    	self.resizeContents();
					   	break; 

				     }
			case "sbs" : {
				      	$(".line-list").html("");
			    	 	hideDialog();
						// in case we've been to i and grown the image:
		    			$(".transcript-div").removeClass("col-lg-12");
		    			$(".transcript-div").addClass("col-lg-6");
		    			refreshYourVersion();
		    			$(".transcript-div").height($("#compareText").innerHeight());
		    			self.resizeContents();
	 					break; 

				    }
			case "t" : { 
				    	$(".line-list").html("");
		    			hideDialog();
		    			self.resizeContents();
						//disable zoom controls as there is no image
		    			$(".zoom-in").addClass("disabled");
		    			$(".zoom-out").addClass("disabled");
		    			$(".fit-width").addClass("disabled");
		    			$(".fit-height").addClass("disabled");
						break; 

				  }
		}
		self.i = target;
	
		// TODO hidModal is not defined apparently, must investigate, though I 
		// should note I've not noticed any detrimental effecst since commenting this out
		
		/*
	  	if ( correctModal !== undefined && correctModal.isOpen() )
			hideModal();
		*/
		
		// Check config to see if interface is active to edit
		if($.inArray("edit",self.interfaces[target]) < 0) {
			//if not and we are in edit mode disable interface toggle for dissallowed interface
			$("#editToggle").addClass("disabled");
		}
		
	
		// Loop through the contentArray and draw the line image 
		// and then empty some stuff (line_@line_id) depending on the interface we are in?
		// TODO review this to see if it can be done more neatly
		
		self.contentArray.forEach(function(obj, i) {
//RM Think drawLineImage is lbl only
//		    self.drawLineImage(obj[0], obj[2]);
		    if ( $(".transcript-div").is(":visible") ) {
				$("line_" + obj[0]).html("");
		    }
			/*
		    if ( $(".interface-lbl").is(":visible") ) {
				self.currentLineId = obj[0];
				self.buildLineList();
		    }
		    if ( $(".interface-t").is(":visible") ) {
				$("line_" + obj[0]).html("");
		    }
			*/
		});
		
		// Now set the current lineId back to the oldLineID and if we are in edit 
		// and interface is image we update dialog to trigger the dialog box
		// this seems sensible. #TODO find  but why did we stash currentLinId for the duration of the above
		// MAybe there is something happening to it in whatever goes on up there??
/*
		//RM moved up into the switch as this is only relevant to image interface
		self.currentLineId = oldLineId;
		if ( self.mode == "edit" && self.i === "i" ){
			if(self.currentLineId == null){
			    self.updateDialog(self.contentArray[1][0]);
			}else{
				console.log("Using the currentLineId on interface change");
			    self.updateDialog(self.currentLineId);
			}
		}
*/
		self.updateCanvas();
		self.buildLineList();
	  	
	};

	/**********************************/
	/* Change the mode (edit or view) */
	/**********************************/
    // What needs to happen:
	// - url changes to new mode
	// - button text changes to the old mode
	// - check mode status for interfaces
	// - contenteditable is turned off/on
	// - load of other stuff...

	this.changeMode = function(e){
		var source = e.target;
		//We are switching from view to edit mode
		if(self.mode === "view"){
			// The button text
			var newButtonText = $(source).data("view-label")
			// set *all* contenteditable from false to true
			$('[contenteditable="false"]').attr("contenteditable", "true");
			//change self.mode to edit
			self.mode = 'edit';
			d.mode = 'edit' // TODO temporary back compat during transition
			// change the url
			var newURL = window.location.href.replace('view', 'edit');
			// similarly the pathWithoutPage
			self.pathWithoutPage = pathWithoutPage.replace('view', 'edit');
		}else{
			// The button text
			var newButtonText = $(source).data("edit-label")
			// set *all* contenteditable from true to false
			$('[contenteditable="true"]').attr("contenteditable", "false");
			//change self.mode to view
			self.mode = 'view';
			d.mode = 'view' // TODO temporary back compat during transition
			// change the url
			var newURL = window.location.href.replace('edit', 'view');
			// similarly the pathWithoutPage
			self.pathWithoutPage = pathWithoutPage.replace('edit', 'view');	
		}
	
		// disable/enable interfaces based on config data and mode
		for(interface_id in self.interfaces){ //loop through config data, 
			// check if current mode is allowed by config
			if($.inArray(self.mode,self.interfaces[interface_id]) < 0) {
				//turn off interface toggle
				$("#toggleInterface_"+interface_id).addClass("disabled");
			}else{
				//turn on interface toggle
				$("#toggleInterface_"+interface_id).removeClass("disabled");
			}
		}
	
		//update the window history to the new URL
		window.history.pushState(null, document.title, newURL);
		//Close any correctModals that are open (this could go in edit=>view condition above)
		if ( self.correctModal !== undefined && self.correctModal.isOpen() ){
			self.correctModal.close();
		}
	
		// toggle the editControls
		$(".editControls").toggle();
		// Update the button text
		$("#editToggle").html(newButtonText);
		//Change cursor for *all* areas to pointer (is this for edit or view? 
		// Currently this will happen either way. If intention is for both 
		// this can go in css
		$("area").css("cursor", "pointer");
		
		// This is where we open the dialog box when we switch to edit
		// If mode is not view and interface is image we 
		// updateDialog with data from the first line
		if( self.mode === "edit" && self.i === "i"){
//			self.updateDialog($(".interface-lbl .line-div:first").data("line-id"));
			self.updateDialog(self.contentArray[1][0]);
		}
		// update canvas
		self.updateCanvas();
		
		// Id we are in the line by line interface
		/*
		if ( $(".interface-lbl").is(":visible") ) {
		    // Loop through the contentArray and draw the image for each line
		    self.contentArray.forEach(function(obj, i) {
			self.drawLineImage(obj[0], obj[2]);
			// If lines-div is visible (which I think means we are in edit mode
			// Set hte currentLineId to the first lines id
			// and then buildLineList (whatever that does)
			if ( $(".lines-div").is(":visible") ) {
			    self.currentLineId = obj[0];
			    self.buildLineList();
			}
		    });
		}
		*/
		/*
		// If we are in the text interface we empty whatever is 
		// in #text and build the line list

		if ( $(".interface-t").is(":visible") ) {
		    $("#text").html("");
		    self.buildLineList();
		}
		*/
	};	

	this.saveChanges = function(e) {
		if (arguments.length == 1)
			e.preventDefault();
		self.setMessage(transSavingChanges);
		$.post(window.location.href, {content: getContent(), csrfmiddlewaretoken: csrf_token}, function( data ) {
			self.setMessage(data);
			self.changed = false;
		});
		// TODO Handle failures here or are we happy with the current solution?
	};
	

	this.setPageStatus = function(role, newStatus, newStatusTrans) {
		if(pageStatus === newStatus){
			return true;
		}
		if ( role === "CrowdTranscriber" || role === "Transcriber" ) {
   	     	$("#page_status").html(newStatusTrans);
   	     	pageStatus = newStatus;
   		}else if ( self.role === "Editor" || self.role === "Owner" || self.role === "Admin" ) {
        	$("#page_status").html(newStatusTrans + "<span class=\"caret\"></span>");
        	pageStatus = newStatus;
    	}else{
        	self.setMessage(pageStatusNotAllowedTrans, "danger");
		}
	};
	this.setMessage = function(message, type, timeout) {
			if(timeout==undefined) timeout = true;
			clearTimeout(self.message_timeout);
			type = type || "warning";
			$("#message").removeClass("btn-muted btn-primary btn-success btn-info btn-warning btn-danger");
			$("#message").html(message);
			$("#message").addClass("btn-" + type);
			$("#message").show();
			if ( timeout )
				self.message_timeout = setTimeout(function() {
					$("#message").html("");
					$("#message").hide();
				}, 5000);
	};


	/****************************************************************************************/
	/* The image interface Image (below here should only be things for the image interface) */
	/****************************************************************************************/
	
	// Get the page and image diemnsions that will be used by various interfaces
	this.setDimensions = function(){
		console.log("setDimensions");
		self.initialWidth = $('#transcriptImage').width() ? $('#transcriptImage').width() : window.innerWidth;
		self.initialHeight = $('#transcriptImage').height();
		self.naturalWidth = $('#transcriptImage').get(0).naturalWidth;
        $("#canvas_text").width(window.innerWidth - 50);
		self.initialScale = self.initialWidth / self.naturalWidth;
		
		var search = window.location.search + 'tco=0';// just to avoid NaN below	
		self.thumbCountOffset = parseInt(search.substring(search.indexOf('tco=') + 4)); // "tco=".length = 4

		// If the current page isn't among the thumbs first shown, we change the offset to make it so
		self.thumbCountOffset = Math.max(thumbCountOffset, -pageNo + 1);
		self.thumbCountOffset = Math.min(thumbCountOffset, -pageNo + THUMBS_TO_SHOW);

		// Getting this from the CSS file for now, set a variable instead?
		self.contentLineFontSize = parseInt($('.line-list').css("font-size"), 10);

		//calculate the coordinates for the area tags
		self.calculateAreas();

	};

	// Make transcript-map-div draggable
	// NB must be called from body embedded script tag (see templates/edit/edit.html)
	this.setImageDraggable = function(){
		// Avoid triggering click line selection (and dialog change) if a click 
		// event is triggered on a region/line during dragging
		// isDragged is checked by the click handler for the #transcriptMap area
		$('.transcript-map-div').draggable({
			start: function() {
				self.isDragged = true;
			},
			stop: function() {
				setTimeout(function() { 
					self.isDragged = false;
				}, 250);
			}
		});
	};
	
	// Update the scale so that it fits the width of the page
	this.fitWidth = function() {

		self.zoomFactor = 1;
		self.accumExtraX = 0
		self.accumExtraY = 0;// or should we leave this as left by the user?
		$(".transcript-map-div").css("transform",  "translate(0px, 0px) scale(1)"); // Note, the CSS is set to "transform-origin: 0px 0px"
   	 	self.contentArray.forEach(function(obj, i) {
   	    	 self.accumExtra[obj[0]] = {"x": 0, "y": 0, "factor": 1};
   	     	$("#canvas_" + obj[0]).css("transform", "translate(0px, 0px) scale(1)");
   	 	});
   	 	self.updateCanvas();
	};
	
	// Update the scale so that it fits the height available on the page
	this.fitHeight = function() {
		self.zoomFactor = $( ".transcript-div" ).innerHeight() / self.initialHeight;
		self.accumExtraY = 0;
		self.accumExtraX = -$( ".transcript-div" ).innerWidth() / 2 + self.zoomFactor * self.initialWidth / 2;
		$( ".transcript-map-div" ).css("transform", "translate(" + -self.accumExtraX +"px, " + -self.accumExtraY+ "px) scale(" + self.zoomFactor + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
    	self.contentArray.forEach(function(obj, i) {
        	var width = obj[2][2] - obj[2][0];
        	var height = obj[2][5] - obj[2][1];
        	var factor = $("#canvas_wrapper_" + obj[0]).innerHeight() / height;
        	self.accumExtra[obj[0]] = {"x": -$("#canvas_wrapper_" + obj[0]).innerWidth() / 2 + factor * width / 2, "y": 0, "factor": factor};
        	$("#canvas_" + obj[0]).css("transform", "translate(" + -self.accumExtra[obj[0]]["x"] +"px, " + -self.accumExtra[obj[0]]["y"]+ "px) scale(" + self.accumExtra[obj[0]]["factor"] + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
    	});
    	self.updateCanvas();
	};
	
	// Update the scale by whatever factor (and offsets) are passed in	
	//TODO make this easier to use with different interfaces (or make different zoom functions to cope with differences)
	this.setZoom = function(zoom, x, y) {

		// is the image still larger than the viewport? We allow one "step" 
		// of zooming out below that size, hence using the old zoomFactor
    	if( (self.i === 'i' || self.i === 'sbs') && (zoom > 0 || $( ".transcript-div" ).innerHeight() < self.initialHeight * self.zoomFactor) ) {        	
			var newZoomFactor = self.zoomFactor * (zoom/50 +1);
        	if (1 == arguments.length) { // If no cursor position has been given, we use the center
           		x = self.initialWidth / 2 + self.accumExtraX;
            	y = $( ".transcript-div" ).innerHeight() / 2 + self.accumExtraY;
        	}
        	// Calculate the pixel delta and get the total offset to move in order to preserve the cursor position...
        	self.accumExtraX += (newZoomFactor - self.zoomFactor) * x / self.zoomFactor;
        	self.accumExtraY += (newZoomFactor - self.zoomFactor) * y / self.zoomFactor;
        	// ...and move the image accordingly before scaling:
        	$( ".transcript-map-div" ).css("transform",  "translate(" + -self.accumExtraX +"px, " + -self.accumExtraY+ "px) scale(" + newZoomFactor + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
        	self.zoomFactor = newZoomFactor;// update this
    	}
    	else if ( self.i === "lbl" ) {
        	self.contentArray.forEach(function(obj, i) {
            	var width = obj[2][2] - obj[2][0];
            	var height = obj[2][5] - obj[2][1];
            	var newZoomFactor = self.accumExtra[obj[0]]["factor"] * (zoom / 50 + 1);
            	if (newZoomFactor < 0.1 )
                	newZoomFactor = 0.1;

            	$("#canvas_" + obj[0]).css("transform", "scale(" + newZoomFactor + ")");
            	self.accumExtra[obj[0]]["factor"] = newZoomFactor;
        	});
    	}
    	self.updateCanvas();
	};
	
	// This function scrolls the image up as if it were dragged with the mouse.
	this.scrollToNextTop = function() { 

		var currentTop = self.accumExtraY / (self.initialScale * (self.zoomFactor)) + 1;// +1 to ensure that a new top is obtained for every click
		if (self.contentArray[self.contentArray.length - 1][2][1] < currentTop)
			return; // If the page has been moved so that the last line is above the top, we don't do anything.
		var newTop;
		for (var idx = 0; idx < self.contentArray.length; idx++) {
			newTop = self.contentArray[idx][2][1];
			if (newTop > currentTop)
				break;
		}
		self.accumExtraY = newTop * self.initialScale * (self.zoomFactor);
		$( ".transcript-map-div" ).css("transform",  "translate(" + -self.accumExtraX +"px, " + -self.accumExtraY+ "px) scale(" + (self.zoomFactor) + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
	};
	// This function scrolls the image down as if it were dragged with the mouse.
	this.scrollToPreviousTop = function() {
		
		var currentTop = self.accumExtraY / (self.initialScale * (self.zoomFactor)) - 1; // -1 to ensure that a new top is obtained for every click
		if (self.contentArray[0][2][1] > currentTop)
			return; // If the page has been moved so that the first line is below the top, we don't do anything.
		var newTop;
		for (idx = self.contentArray.length - 1; idx >= 0; idx--) {
			newTop = self.contentArray[idx][2][1];
			if (newTop < currentTop) {
				break;
			}
		}
		self.accumExtraY = newTop * self.initialScale * (self.zoomFactor);
		$( ".transcript-map-div" ).css("transform",  "translate(" + -self.accumExtraX +"px, " + -self.accumExtraY+ "px) scale(" + (self.zoomFactor) + ")"); // Note, the CSS is set to "transform-origin: 0px 0px"
	};

	// updateCanvas updates the canvas? This gets called *alot*
	// set dimensions of canvas as per dimensions of transcriptImage
	// Also refresh the highlightighting
	this.updateCanvas = function() {
    	if ( self.i === 'i' || self.i === 'sbs' ) {
				var c = document.getElementById("transcriptCanvas");
				var ctx = c.getContext("2d");
				ctx.canvas.width = $('#transcriptImage').width();
				ctx.canvas.height = $('#transcriptImage').height();
				ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
				ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
				ctx.save();
				if (self.correctModal != null && self.correctModal.isOpen()) {
					self.highlightLineList();
				}
			}else if ( self.i === 'lbl' ) {
				self.contentArray.forEach(function(obj, i) {
					var c = document.getElementById("canvas_" + obj[0]);
					if ( c !== null && c !== undefined ) {
						var ctx = c.getContext("2d");
						ctx.canvas.width = $("#canvas_" + obj[0]).width();
						ctx.canvas.height = $("#canvas_" + obj[0]).height();
						ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
						ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
						ctx.save();
						self.drawLineImage(obj[0], obj[2]);
					}
				});
			}
			// uncomment this for debugging, it highlights all:
			//for (var i = 1; i < contentArray.length; i++)
				//highlightLine(contentArray[i][0]);
	};

	/*************************************************/
	/* Dialog related stuff for the image interface  */
	/*************************************************/

	//try and keep the dialog properties and then close it
	this.hideDialog = function() {
		self.saveDialogProperties();
		self.correctModal.close();
	
	};

	// updateDocking
	// docks (true) / undocks (false) the dialog.
	// When not specified, docking status remains 
	// unchanged and just the dialog position and size gets updated
	this.updateDocking = function(dock) { 
		if (1 == arguments.length)
			self.docked = dock;
		if (self.docked) {
			self.saveDialogProperties();
			var leftOffset = $("#sidebar-wrapper").width();
			$("#correctModal").css("left", 0);
			$("#correctModal").css("width", document.body.clientWidth);
			$("#correctModal").css("height", self.dockedHeight);
			$("#correctModal").css("position", "fixed");
			$("#correctModal").css("top", $(window).height() - self.dockedHeight + "px");// using "bottom" is problematic
			$("#correctModal").on("mousedown touchdown", function (e) { // TODO Test touchdown when an appropriate device is available...
				$("#correctModal").css("position", "fixed"); // gijgo dialog messes with this undesirably...
			});
		} else {
	    	$("#correctModal").css("left", self.dialogX);
	    	$("#correctModal").css("top",  self.dialogY);
	    	$("#correctModal").css("width",  self.dialogWidth);
	    	$("#correctModal").css("height",  self.dialogHeight);
	    	self.updateDialogSize();
		}
		self.updateDockingStatus(self.docked);
	};

	// Toggles the docking status and the docking button
	this.updateDockingStatus = function(dock) { 
		self.docked = dock;
		if (self.docked)
			$("#dockButton").html('<button type="button" class="dock-toggle close" onclick="updateDocking(false);"><small><span class="glyphicon glyphicon-resize-small" aria-hidden="true"></span></small></button>');
		else
			$("#dockButton").html('<button type="button" class="dock-toggle close" onclick="updateDocking(true);"><small><span class="glyphicon glyphicon-resize-full" aria-hidden="true"></span></small></button>');
	};
	
	 // Saves the undocked dialog properties...
	this.saveDialogProperties = function() {
		$("#correctModal").css("position", "absolute");
		self.dialogX = $("#correctModal").offset().left;
		self.dialogY = $("#correctModal").offset().top;
		self.dialogWidth = $("#correctModal").width(); // TODO Search width vs. outerWidth
		self.dialogHeight = $("#correctModal").height();
	};

	//////////////////////////////////////////////////////////////////////////////////////////
	// Update dialog will place the dilog and insert the appropriate existing transcript text
	//////////////////////////////////////////////////////////////////////////////////////////
	this.updateDialog = function(lineId) { 
		console.log("updateDialog");
		if (null == self.currentLineId) {
			if (1 == arguments.length) // can this happen anymore?
	   	         self.currentLineId = lineId;
		   	var lineIdx = getIndexFromLineId(self.currentLineId);
	        if ( self.contentArray[lineIdx] === undefined )
	            return;
	        var endOfLine = self.contentArray[lineIdx][1].length;
	        setSelectionData(self.currentLineId, endOfLine, endOfLine);
	        self.correctModal.open();
	        self.buildLineList();
	        self.accumExtraX = Math.min(self.initialScale * self.zoomFactor * self.contentArray[lineIdx][2][0]) - window.innerHeight / 5; // we move the image so that the dialog can be opened in a sensible place
	        $( ".transcript-map-div" ).css("transform",  "translate(" + -self.accumExtraX +"px, " + -self.accumExtraY+ "px) scale(" + (self.zoomFactor) + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
	        self.dialogX = window.innerHeight / 5;// this is a nice place for the dialog
	        // get the last shown line index
	        var lastShown = Math.min(lineIdx + self.surroundingCount, self.contentArray.length - 1);
	        // place the dialog one "last line height" below the last shown BELOW the clicked line (a higher index does not guarantee a lower position)
	        var lowest;
	        for (lowest = lineIdx; lowest < lastShown && self.contentArray[lowest][2][7] < self.contentArray[lowest + 1][2][7]; lowest++);
			self.dialogY = self.initialScale * self.zoomFactor * (2 * self.contentArray[lowest][2][7] - self.contentArray[lowest][2][1]) + $(".transcript-div" ).offset().top - self.accumExtraY;
        	if (self.dialogX <= 0)
	            self.dialogX = 0;
	        else if ((self.dialogX + self.dialogWidth) >= window.innerWidth)
		    	self.dialogX = window.innerWidth - self.dialogWidth;
       		if (self.dialogY <= 0)
            	self.dialogY = 0;
        	else if ((self.dialogY + dialogHeight) > document.body.clientHeight)
            	self.dialogY = window.innerHeight - self.dialogHeight;
        
			$("#correctModal").css("left",  self.dialogX + "px");
        	$("#correctModal").css("top",  self.dialogY + "px");
        	self.updateDocking(); // We restore the dialog to a docked state, if it was docked when closed
        	initializeCaretOffsetInPixels();
        	self.dialogHighlightDX = self.dialogX + self.accumExtraX - self.contentArray[getIndexFromLineId(self.currentLineId)][2][0] * self.initialScale * self.zoomFactor;
        	self.dialogHighlightDY = self.dialogY + self.accumExtraY - $(".transcript-div").offset().top -self. contentArray[getIndexFromLineId(self.currentLineId)][2][1] * self.initialScale * self.zoomFactor;// + $(".transcript-map-div").css("top");
        	if (null === self.scrollbarHeight) {
            	$(".line-list-div").css("overflow-x", "scroll");
            	self.scrollbarHeight = parseInt($(".content-row").css("height"));
            	$(".line-list-div").css("overflow-x", "hidden");
            	self.scrollbarHeight -= parseInt($(".content-row").css("height"));
        	}
		}else{
			self.correctModal.open(); // TODO Redundantify correctModal.open() here. It's here for restoring the dialog after "visits" to other views...
	        var oldDeltaX = self.contentArray[getIndexFromLineId(self.currentLineId)][2][0] * self.initialScale * self.zoomFactor - self.accumExtraX - $("#correctModal").offset().left;// TODO Replace with dialogX and dialogY?
	        var oldDeltaY = self.contentArray[getIndexFromLineId(self.currentLineId)][2][1] * self.initialScale * self.zoomFactor - self.accumExtraY - $("#correctModal").offset().top;
	        if (1 == arguments.length)
	            self.currentLineId = lineId;
	        var lineIdx = getIndexFromLineId(self.currentLineId);
	        self.accumExtraX = self.contentArray[getIndexFromLineId(self.currentLineId)][2][0] * self.initialScale * self.zoomFactor - $("#correctModal").offset().left - oldDeltaX;
	        self.accumExtraY = self.contentArray[getIndexFromLineId(self.currentLineId)][2][1] * self.initialScale * self.zoomFactor - $("#correctModal").offset().top - oldDeltaY;
	        $( ".transcript-map-div" ).css("transform",  "translate(" + -self.accumExtraX +"px, " + -self.accumExtraY+ "px) scale(" + self.zoomFactor + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
	        self.buildLineList();
	        self.updateDocking();

		}
	};
	
	this.updateDialogSize = function() {
		if (self.docked)
			return;
		if (null === self.dialogAbsoluteMinWidth) { // if we're doing this for the very first time, we calculate the absolute minimum, which means space for all buttons on a single row
			var buttonSum = 0;
			// get the delta between a button group and the span containing it when there's another button following it
			var spanPadding = $(".dialogbutton-group").first().parent().outerWidth(true) - $(".dialogbutton-group").first().outerWidth(true);
			$(".dialogbutton-group").each(function() {
				buttonSum += $(this).outerWidth(true) + spanPadding; // spanPadding must be added to avoid line breaks
			});
			self.dialogAbsoluteMinWidth =  buttonSum + 2 * ($(".dialogbutton-group").first().offset().left - $("#correctModal").offset().left); // we use the same width for the space surrounding the text on both sides...
			self.dialogWidth = self.dialogAbsoluteMinWidth; // we must set this when setting the absolute minimum for the first time
			self.dialogAbsoluteMinHeight = 2 * parseInt($(".modal-header").css("padding-top"))
					+ $(".modal-title").outerHeight(true)
					+ $(".dialogbutton-group").outerHeight(true)
					+ 2 * parseInt($(".modal-body").css("padding-top")); // the sum of these is the height of the dialog without any text
		}
		var currentMinH = self.dialogAbsoluteMinHeight;
		if ($(".transcript-div").is(":visible") && self.currentLineId !== undefined ) { // check if any line is longer than the absolute minimum
			var longestLine = 0;
			var currentIdx = getIndexFromLineId(self.currentLineId);
			var showTo = Math.min(currentIdx + surroundingCount,self.contentArray.length - 1);
			var index = Math.max(1, currentIdx - surroundingCount); // 1 because the first line is not real
			while (index <= showTo) {
				var lineId =self.contentArray[index++][0];
				longestLine = Math.max(longestLine, $("[tagLineId=" + lineId + "]").last().offset().left + $("[tagLineId=" + lineId + "]").last().outerWidth() - $("#correctModal").offset().left);//$("#text_" + lineId).offset().left);
				currentMinH += parseInt($("#text_" + lineId).children().first().css("min-height")); // get min-height from the div
			}
		}
		var currentMinW = Math.max(self.dialogAbsoluteMinWidth, longestLine + parseInt($(".line-list-div").css("padding-right")));
		self.dialogWidth = Math.max(self.dialogWidth, currentMinW); // we don't shrink the dialog automatically
		self.dialogHeight = Math.max(self.dialogHeight, currentMinH);
		$("#correctModal").css("width",  self.dialogWidth + "px");
		$("#correctModal").css("height",  self.dialogHeight + "px");
		$("#correctModal").css("min-width",  currentMinW + "px");
		$("#correctModal").css("min-height",  currentMinH + "px");
		$("#line-list").css("min-height", (self.dialogHeight - self.dialogAbsoluteMinHeight) + "px"); // the text contenteditable isn't updated automagically

	};
/*
//TODO this is for lbl
	this.drawLineImage = function(lineId, coordinates) {
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
	};
*/


	this.buildLineList = function() {
		console.log("buildLineList");
		var index;
		if ( $(".transcript-div").is(":visible") && self.currentLineId !== undefined && self.correctModal.isOpen()) { 
				var currentIdx = getIndexFromLineId(self.currentLineId);
				var showTo = Math.min(currentIdx + self.surroundingCount, self.contentArray.length - 1);
				index = Math.max(1, currentIdx - self.surroundingCount); // 1 because the first line is not real
				$("#lineList").html("");
				while (index <= showTo)
					$("#lineList").append(getLineLiWithTags(index++));
				self.highlightLineList();
				self.updateDialogSize();
		}
		//TODO check interface and/or call this with the element to which the lineLiTags need appended
		/*
		if ( $(".interface-lbl").is(":visible") ) {
			index = 1
			while (index <= contentArray.length - 1) {
				$("#line_" + contentArray[index][0]).html(getLineLiWithTags(index));
				index++;
			}
		}
		if ( $("#compareText").is(":visible") ) {
			if ($("#your").is(":visible"))
				for (index = 1; index <= contentArray.length - 1; index++)
					$("#yourVersion").append(getLineLiWithTags(index));
		}
		if ( $(".interface-t").is(":visible") ) {
			index = 1
			$("#text").html("");
			while (index <= contentArray.length - 1) {
				$("#text").append(getLineLiWithTags(index));
				index++;
			}
		}
		*/
		restoreSelection();
	};

	this.highLightArea = function(coords) {
		var c=document.getElementById("transcriptCanvas");
		var ctx=c.getContext("2d");
		ctx.clearRect(coords[0], coords[1], coords[4] - coords[0], coords[5] - coords[1]);	 // TODO Four coordinate pairs are not needed for a rectangle...
	};
	this.highlightLineList = function() { // highlights the lines being shown in the dialog and places balls in front of them
		var currentIdx = getIndexFromLineId(self.currentLineId);
		var showTo = Math.min(currentIdx + self.surroundingCount, self.contentArray.length - 1);
		var index = Math.max(1, currentIdx - self.surroundingCount); // 1 because the first line is not real
		var lineCoords =  Array(8); // TODO Four coordinate pairs are not needed for a rectangle...
		while (index <= showTo) {
			for (var k = 0; k < lineCoords.length; k++)
				lineCoords[k] = Math.round(self.initialScale*self.contentArray[index][2][k]);
			self.highLightArea(lineCoords);
			var lineHeight = (lineCoords[5] - lineCoords[1]); // We use this to get "appropriate" places for the balls in relation to the line size...
			var c=document.getElementById("transcriptCanvas");
			var ctx=c.getContext("2d");
			ctx.beginPath();
			ctx.arc(lineCoords[0] -0.5 * lineHeight, lineCoords[1] + lineHeight / 2, 10, 0, 2*Math.PI);
			if (self.contentArray[index][1].length == 0 || (self.contentArray[index][1].length <= 1 && self.contentArray[index][1].match(/(\s+|\u200B)/))) { // empty or a zero width space
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
	this.highlightLine = function(lineId) { // highlights a single line (use when moving the mouse cursor)
		var length = self.contentArray.length;
		var coords =  Array(8);// TODO Four coordinate pairs are not needed for a rectangle...
		for (var j = 0; j < length; j++) {// TODO Stop the loop sooner!
			if (self.contentArray[j][0] == lineId) {
				for (var k = 0; k < coords.length; k++)
					coords[k] = Math.round(self.initialScale*self.contentArray[j][2][k]);
			}
		}
		self.highLightArea(coords);
	}

	/*************************************************/
	/* typewriter move functions will move the image */ 
	/* up while keeping thedialog in the same place. */
	/*************************************************/
	this.typewriterMove = function(newLineId, caretLineId) {
		initializeCaretOffsetInPixels();
		if (newLineId != null && selectionData !== undefined && selectionData[0] !== undefined ) {
			if (null === savedCaretOffsetInPixels)
				savedCaretOffsetInPixels = caretOffsetInPixels;
			// TODO Move the caret down even when we cannot make the lines move anymore?
			self.updateDialog(newLineId);
			self.updateCanvas();
			// get the closest span offset on the new line
			var span, spanOffset;
			$("[tagLineId=" + caretLineId + "]:visible").each(function() {
				if (this.offsetLeft < savedCaretOffsetInPixels) {
					span = this;
					spanOffset = this.offsetLeft;
				}
				// we don't break, we want the closest span in case there are nested ones
			});
			// we have the span offset, get the character offset
			hiddenCopy = $(span).clone();
			testText = $(hiddenCopy).text();
			var cA = 0, cB, t;// pixel offsets of the previous and the current character (= [t])
			for (t = 0; t <= testText.length; t++) {
				$(hiddenCopy).text(testText.substr(0, t));
				$(hiddenCopy).appendTo(span);
				cB = $(hiddenCopy).outerWidth();
				$(hiddenCopy).remove();
				if ((cB + cA) / 2 > (savedCaretOffsetInPixels - spanOffset)) // we want the offset which is closest to this
					break;
				cA = cB;
			}
			var cLength = contentArray[getIndexFromLineId(caretLineId)][1].length;
			if (null == cLength)
				cLength = 0;
			var caretOffset = Math.min(t - 1 + parseInt($(span).attr("spanOffset")), cLength);
			selectionData = [[caretLineId, caretOffset, caretOffset]];
			restoreSelection();
		}
	};

	this.typewriterNext = function() { // Aka. "press typewriter enter scroll". Changes the selected lines and the modal content.
//		if ( ifc === "lbl" )
//			$("#options_" + currentLineId).hide();
		self.typewriterMove(getNextLineId(self.currentLineId), getNextLineId(selectionData[0][0])); // the caret will "remain in place" and the lines shifted around it
	};
	this.typewriterPrevious = function() {
//		if ( ifc === "lbl" )
//			$("#options_" + currentLineId).hide();
		self.typewriterMove(getPreviousLineId(self.currentLineId), getPreviousLineId(selectionData[0][0])); // the caret will "remain in place" and the lines shifted around it
	};


	this.calculateAreas = function() {
		var i = 1;
		$("#transcriptMap").children().each(function (value) {
			var coordString = "";
			for (var j = 0; j < 7; j++) {
				coordString += self.initialScale*self.contentArray[i][2][j] + ',';
			}
			coordString += self.initialScale*self.contentArray[i][2][7];
			this.coords = coordString;
			i++;
		});
	};

	// Call to perform necessary updates of contents and variables whenever the GUI size is changed
	this.resizeContents = function() { 		
		var oldWidth = self.initialWidth;
   		previousInnerWidth = window.innerWidth;
		self.initialWidth = $('#transcriptImage').width() ? $('#transcriptImage').width() : window.innerWidth;
		self.initialHeight = $('#transcriptImage').height();
		self.naturalWidth = $('#transcriptImage').get(0).naturalWidth;
		self.initialScale = self.initialWidth / self.naturalWidth;
		// We have to update these too in case the image has gotten resized by the browser along with the window:
		self.accumExtraX = self.initialWidth * self.accumExtraX / oldWidth;
		self.accumExtraY = self.initialWidth * self.accumExtraY / oldWidth;

		$(".transcript-map-div").css("transform",  "translate(" + -self.accumExtraX +"px, " + -self.accumExtraY+ "px) scale(" + self.zoomFactor + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
		self.calculateAreas();
		generateThumbGrid();
		self.updateCanvas();
		// If the dialog is open, position it as before in relation the highlighted area but according to the current window size = new scale...
		if ( self.correctModal !== undefined && self.correctModal.isOpen() ) {
			self.dialogHighlightDX *= self.initialWidth / oldWidth;
			self.dialogHighlightDY *= self.initialWidth / oldWidth;
			self.dialogX = -self.accumExtraX + self.contentArray[getIndexFromLineId(self.currentLineId)][2][0] * self.initialScale * self.zoomFactor + self.dialogHighlightDX;
			self.dialogY = -self.accumExtraY + $(".transcript-div").offset().top + self.contentArray[getIndexFromLineId(self.currentLineId)][2][1] * self.initialScale * self.zoomFactor + self.dialogHighlightDY;
			$("#correctModal").css("left",  self.dialogX + "px");
			$("#correctModal").css("top",  self.dialogY + "px");
//			self.updateDialog(); // TODO Remove. should be redundant.
		}
    	$(".transcript-div").height(window.innerHeight - 200);
		
	};


}//End declarion of Edit 'Class'
			
