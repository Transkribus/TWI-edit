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
	
	//from thumbs.js
	this.pageNo;
	this.pathWithoutPage;
	this.THUMBS_TO_SHOW = 10; // "constant" for playing around with the no. of thumbs to show
	this.thumbCountOffset = 0;
	this.thumbWidth;
	this.toLoadCount;

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
	this.dialogIsDragged = false; // gijgo triggers false dragStops


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
		///////////////////////////////////////
		// Event handlers for the paging stuff
		///////////////////////////////////////
		$( ".previous-page" ).on('click', function(e) {
			self.gotoPage(self.pageNo - 1);
		});
		$( ".next-page" ).on('click', function(e) {
			self.gotoPage(self.pageNo * 1 + 1);
		});
		$( ".first-page" ).on('click', function(e) {
			self.gotoPage(1);
		});
		$( ".last-page" ).on('click', function(e) {
			self.gotoPage(Number.MAX_SAFE_INTEGER);
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
    		if (!self.dialogBeingResized) { //{# If the dialog is being resized, it triggers this event and we must ignore it. #}
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
		$( ".add-line" ).on('click', function(e) {
			self.surroundingCount++;
			self.buildLineList();
		});
		$( ".remove-line" ).on('click', function(e) {
			self.surroundingCount--; //{# TODO A function instead? #}
			if (self.surroundingCount >= 0)
				self.buildLineList();
			else
				self.surroundingCount = 0;
		});


		$( ".enlarge-text" ).on('click', function(e) {
			self.resizeText(1);
		});
		$( ".shrink-text" ).on('click', function(e) {
			self.resizeText(-1);
		});
		$(".bold-text").on("click", function(e) {
			self.toggleTag("bold");
		});
		$(".italic-text").on("click", function(e) {
			self.toggleTag("italic");
		});
		$(".strikethrough-text").on("click", function(e) {
			self.toggleTag("strikethrough");
		});
		$(".underline-text").on("click", function(e) {
			self.toggleTag("underlined");
		});
		$(".subscript-text").on("click", function(e) {
			self.toggleTag("subscript");
		});
		$(".superscript-text").on("click", function(e) {
			self.toggleTag("superscript");
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
		self.checkPageNumberInput();
//		self.updateCanvas();
		self.loadThumbs();

		self.correctModal = $("#correctModal").dialog({
			autoOpen: false,
		    uiLibrary: 'bootstrap',
            resizable: true,
		    closed: function(e) {
		        self.currentLineId = null;
				self.updateCanvas();
				self.ignoreLeave = false;
		    },
    		resizeStart: function (e) {
    			self.dialogBeingResized = true;
    			self.updateDockingStatus(false);
    		},
    		dragStart: function (e) {
    			this.dialogIsDragged = true;
    			self.updateDockingStatus(false);
    		},
    		dragStop: function(e) { // this is triggered falsely when clicking the dock/undock button
    			if (true === this.dialogIsDragged) {
					self.dialogX = parseInt($("#correctModal").css("left"));
					self.dialogY = parseInt($("#correctModal").css("top"));
					this.dialogIsDragged = false;
    			}
    		},
    		resizeStop: function (e) {
    			self.dialogWidth = parseInt(this.style.width, 10); // saving this... TODO Ask if this is to be saved? User opinions vary...!?
    			self.dialogHeight = parseInt(this.style.height, 10);
    			self.dialogBeingResized = false;
				$("#lineList").css("min-height", (self.dialogHeight - self.dialogAbsoluteMinHeight) + "px"); // TODO Put this and the actions above in a separate function...?
    		}
        });

        $.contextMenu({
            selector: '.tag-menu',
            zIndex: 2000,
            build: function($trigger, e) {
            	if (canOpenContextMenu) {
	            	self.updateSelectionData(); // TODO What do we do in this case if we also want to have the feature below? #}
	            	self.restoreSelection(); // TODO Request feedback. This solution has the advantage of allowing a selection to be made and the menu opened elsewhere in order not to cover the relevant text. #}
					return tagMenu();
				} else
					return null;
        	},
       	    events: {
				hide : function(){
					self.selectionData = ""; // the old selection must be forgotten to avoid strange behaviour
				}
	       },
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
		//why here?
//		self.refreshOriginalVersion();
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

	this.scrollThumbsLeft = function() {
		self.thumbCountOffset += self.THUMBS_TO_SHOW;
		self.thumbCountOffset = Math.min(self.thumbCountOffset, 0);
		$(".thumbs" ).css("transition", "1s");
		$(".thumbs" ).css("transform",  "translateX(" + self.thumbCountOffset * self.thumbWidth + "px)");
		self.updateArrows();
	};

	this.scrollThumbsRight = function() {
		self.thumbCountOffset -= self.THUMBS_TO_SHOW;
		self.thumbCountOffset = Math.max(self.thumbCountOffset, -self.thumbArray.length + self.THUMBS_TO_SHOW);
		$(".thumbs" ).css("transition", "1s");
		$(".thumbs" ).css("transform",  "translateX(" + self.thumbCountOffset * self.thumbWidth + "px)");
		self.updateArrows();
	};
	this.updateArrows = function() { // call to show and hide arrows depending on whether they're clickable
		if (0 == self.thumbCountOffset)
			$("#leftArrow").hide();
		else
			$("#leftArrow").show();
		if (self.thumbCountOffset <= (-self.thumbArray.length + 10))
			$("#rightArrow").hide();
		else
			$("#rightArrow").show();
	};
	this.loadThumbs = function() { // Loads all thumbs and shows the ones which are visible as soon as they've been loaded
		var to = Math.min(self.THUMBS_TO_SHOW - self.thumbCountOffset, self.thumbArray.length);
		self.toLoadCount = Math.min(self.THUMBS_TO_SHOW, to);
		var tempImg;
		for (var i = -self.thumbCountOffset; i < to; i++) {
			if ( self.thumbArray[i] === undefined )
				continue;
			tempImg = new Image();
			tempImg.src = thumbArray[i][0];
			tempImg.onload = function() {
				toLoadCount--; //  JavaScript is single-threaded...
				if (0 == self.toLoadCount) {
					self.generateThumbGrid();
				}
			};
		}
	};

	this.generateThumbGrid = function() {
		// 11 because we show 10 thumbs and each arrow will be half as wide as a thumbnail
		self.thumbWidth = (window.innerWidth - 50) / 11;
		var arrowWidth = self.thumbWidth / 2;
		// This results in roughly 10 pixels with a maximized window on an HD screen if 10 thumbs are shown
		var padding = 0.08 * self.thumbWidth; 
		var thumbTDs = ''; // thumbTDs will become a string that's inserted into the <tr> with id thumbTR

		if (self.thumbArray.length > 10) // do we need arrows?
			thumbTDs += '<td style="min-width: ' + arrowWidth + 'px;"><a id="leftArrow" href="#" onclick="scrollThumbsLeft();"><svg width="' + arrowWidth + '" height="' + self.thumbWidth + '"><polygon points="' + (arrowWidth - padding) + ',' + padding + ' ' + padding + ',' + (arrowWidth) + ' '  + ' ' + (arrowWidth - padding) + ',' + (self.thumbWidth - padding) + '" style="fill: blue; stroke-width: 0;" /></svg></a>';
		else // we don't need arrows but we need to "pad" the row from the left to center the thumbs we do show
			thumbTDs += '<td style="min-width: ' + arrowWidth * (12 - self.thumbArray.length) + 'px;">'; // arrowWidth = half a thumb...
		thumbTDs += '</td><td><div class="thumb-row" style="text-align: center;"><div class="thumbs"><table><tr>';

		var i = 1;
		// Before the current page:
		while(i < self.pageNo) {
			thumbTDs += '<td class="thumb" style="padding: ' + padding + 'px; min-width: ' + self.thumbWidth + 'px;"><a href="#" onclick="gotoPage(' + i + ')"><img style="max-width: "' + (self.thumbWidth - 2 * padding) + 'px;" class="thumb thumb-img ' + self.thumbArray[i - 1][1] + '" src="' + self.thumbArray[i - 1][0] + '"><br/><span style="color: white;">' + i +'</span></a></td>';
			i++;
		}
		// Highlight current page:
		thumbTDs += '<td class="thumb" style="padding: ' + padding + 'px; min-width: ' + self.thumbWidth + 'px;"><img style="max-width: "' + (self.thumbWidth - 2 * padding) + 'px;" class="thumb thumb-current" src="' + self.thumbArray[i - 1][0] + '"><br/><span style="color: white;">' + i +'</span></td>';
		i++;
		// After the current page:
		while(i <= self.thumbArray.length) {
			thumbTDs += '<td class="thumb" style="padding: ' + padding + 'px;  min-width: ' + self.thumbWidth + 'px;"><a href="#" onclick="gotoPage(' + i + ')"><img style="max-width: "' + (self.thumbWidth - 2 * padding) + 'px;" class="thumb thumb-img ' + self.thumbArray[i - 1][1] + '" src="' + self.thumbArray[i - 1][0] + '"><br/><span style="color: white;">' + i +'</span></a></td>';
			i++;
		}
		thumbTDs += '</tr></table></div></div></td><td style="min-width: ' + arrowWidth + 'px;">';
	
		if (self.thumbArray.length > 10) // arrow?
			thumbTDs += '<a id="rightArrow" href="#" onclick="scrollThumbsRight();"><svg width="' + arrowWidth + '" height="' + self.thumbWidth + '"><polygon points="' + padding + ',' + padding + ' ' + (arrowWidth - padding) + ',' + (arrowWidth) + ' '  + ' ' + padding + ',' + (self.thumbWidth - padding) + '" style="fill: blue; stroke-width: 0;" /></svg></a>';
		thumbTDs += '</td>';
		$("#thumbTR").html(thumbTDs); // insert it
	
		// Then we alter the CSS:
		//$(".thumb").css("width", (self.thumbWidth - 2*padding) + "px");
		$(".thumb-row").css("width", ((window.innerWidth - 50) - self.thumbWidth) + "px"); // THUMBS_TO_SHOW * self.thumbWidth + "px");
		$(".thumb-img").css("width", (self.thumbWidth - 2 * padding)+ "px");
		$(".thumb-current").css("width", (self.thumbWidth - 2 * padding)+ "px");
		$(".thumbs" ).css("transition", "0s");
		$(".thumbs" ).css("transform",  "translateX(" + self.thumbCountOffset * self.thumbWidth + "px)");
		updateArrows();
	};
	
	this.checkPageNumberInput = function() { // Tries to parse input to see if it's a valid page number to go to. If not, resets the contents to show the current page.
		var value = parseInt($("#pageNumber").val());
		if (value > 0 && value <= self.thumbArray.length)
			gotoPage(value);
		else // Reset to what it was
			$("#pageNumber").val(self.pageNo + "/" + self.thumbArray.length);
	};
	this.gotoPage = function(page) {
		page = Math.max(Math.min(page, self.thumbArray.length), 1);
		var dL = "&dL=" + (self.currentLineId ? self.currentLineId : + self.restoreDialogLine);
		window.location.assign(self.pathWithoutPage + page + '?tco=' + self.thumbCountOffset + "&i=" + self.i + dL);// TODO Consider tco in situations in which the page to which we go isn't visible, set an appropriate value? If tco = NaN or outside...
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
		self.thumbCountOffset = Math.max(self.thumbCountOffset, -self.pageNo + 1);
		self.thumbCountOffset = Math.min(self.thumbCountOffset, -self.pageNo + self.THUMBS_TO_SHOW);

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
	/*
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
	*/
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
			$("#dockButton").html('<button type="button" class="dock-toggle close" onclick="Edit.updateDocking(false);"><small><span class="glyphicon glyphicon-resize-small" aria-hidden="true"></span></small></button>');
		else
			$("#dockButton").html('<button type="button" class="dock-toggle close" onclick="Edit.updateDocking(true);"><small><span class="glyphicon glyphicon-resize-full" aria-hidden="true"></span></small></button>');
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
	        self.setSelectionData(self.currentLineId, endOfLine, endOfLine);
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
        	self.initializeCaretOffsetInPixels();
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
			// if we're doing this for the very first time, we calculate 
			// the absolute minimum, which means space for all buttons on a single row
		if (null === self.dialogAbsoluteMinWidth) { 
			var buttonSum = 0;
			// get the delta between a button group and the span 
			// containing it when there's another button following it
			var spanPadding = $(".dialogbutton-group").first().parent().outerWidth(true) - $(".dialogbutton-group").first().outerWidth(true);
			$(".dialogbutton-group").each(function() {
				// spanPadding must be added to avoid line breaks
				buttonSum += $(this).outerWidth(true) + spanPadding; 
			});
			// we use the same width for the space surrounding the text on both sides...
			self.dialogAbsoluteMinWidth =  buttonSum + 2 * ($(".dialogbutton-group").first().offset().left - $("#correctModal").offset().left); 
			// we must set this when setting the absolute minimum for the first time
			self.dialogWidth = self.dialogAbsoluteMinWidth; 
			// the sum of these is the height of the dialog without any text
			self.dialogAbsoluteMinHeight = 2 * parseInt($(".modal-header").css("padding-top"))
					+ $(".modal-title").outerHeight(true)
					+ $(".dialogbutton-group").outerHeight(true)
					+ 2 * parseInt($(".modal-body").css("padding-top")); 
		}
		var currentMinH = self.dialogAbsoluteMinHeight;
		if ($(".transcript-div").is(":visible") && self.currentLineId !== undefined ) { // check if any line is longer than the absolute minimum
			var longestLine = 0;
			var currentIdx = getIndexFromLineId(self.currentLineId);
			var showTo = Math.min(currentIdx + self.surroundingCount, self.contentArray.length - 1);
			var index = Math.max(1, currentIdx - self.surroundingCount); // 1 because the first line is not real
			//loop through lines to calculate the longest line and set dialogWidth accordingly
			while (index <= showTo) {
				var lineId = self.contentArray[index++][0];
				longestLine = Math.max(longestLine, $("[tagLineId=" + lineId + "]").last().offset().left + $("[tagLineId=" + lineId + "]").last().outerWidth() - $("#correctModal").offset().left);
				// get min-height from the div
				currentMinH += parseInt($("#text_" + lineId).children().first().css("min-height")); 
			}
		}
		var currentMinW = Math.max(self.dialogAbsoluteMinWidth, longestLine + parseInt($(".line-list-div").css("padding-right")));
		var currentScrollbarH = 0;
		// we don't let the dialog become wider than the window and thus 
		// add a scrollbar, if the line length requires it
		if (currentMinW > window.innerWidth) { 
			$(".line-list").css("overflow-x", "scroll");
			currentMinW = window.innerWidth;
			currentScrollbarH = self.scrollbarHeight;
			$(".line-list").css("width",  (currentMinW - 2 * parseInt($(".line-list-div").css("padding-right"))));
		} else {
			$(".line-list").css("overflow-x", "hidden");
		}
		if (self.docked) {
			if (currentMinH > self.dockedHeight) {
				$(".line-list").css("overflow-y", "scroll");
				$(".line-list").css("height", (self.dockedHeight - currentScrollbarH - self.dialogAbsoluteMinHeight));
			} else {
				$(".line-list").css("overflow-y", "hidden");
			}
		} else {	
			self.dialogWidth = Math.max(self.dialogWidth, currentMinW); // we don't shrink the dialog automatically
			self.dialogHeight = Math.max(self.dialogHeight, currentMinH);
			$("#correctModal").css("width",  self.dialogWidth + "px");
			$("#correctModal").css("height",  (currentScrollbarH + self.dialogHeight) + "px");
			$("#correctModal").css("min-width",  currentMinW + "px");
			$("#correctModal").css("min-height",  currentMinH + "px");
			// the text contenteditable isn't updated automagically
			$("#line-list").css("min-height", (self.dialogHeight - self.dialogAbsoluteMinHeight) + "px"); 
		}
	};
	this.resizeText = function(delta) {
		var newFontSize = self.contentLineFontSize + delta;
		if (newFontSize < 14 || newFontSize > 40)
			return;
		self.contentLineFontSize = newFontSize;
		$('.line-list').css("font-size", self.contentLineFontSize+ 'px');
		self.buildLineList();
	};

	this.undoAction = function() {
		for (var i = 0; i < self.undoArray.length; i++) {
			var undoId = self.undoArray[i][0];
			self.contentArray[self.getIndexFromLineId(self.undoArray[i][0])] = self.undoArray[i];
		}
		self.buildLineList();
	}

	// When passed a lineId return the index of that line in the contentArray
	this.getIndexFromLineId = function(lineId) {
		var length = self.contentArray.length;
		var index;
		for (index = 0; index < length; index++) {
			if (self.contentArray[index][0] == lineId)
				return index;
		}
		return null;
	};

	this.getNextLineId = function(lineId) {
		index = self.getIndexFromLineId(lineId);
		if (self.contentArray.length == (index + 1))
			return null;// If it's the last line, we don't have a next id.
		else
			return self.contentArray[index + 1][0];
	};

	this.getPreviousLineId = function(lineId) {
		index = self.getIndexFromLineId(lineId);
		if (1 == index)
			return null; // If it's the first line, we don't have a previous id. Note: The first real line is [1] because the very first "line" in the array is "", i.e. not a line but the top of the page.
		else
			return self.contentArray[index - 1][0];
	}
	
	//////////////////////////////////////////
	// Code to manage the selection of text
	//////////////////////////////////////////
	
	// set the selectiondata, endOffset is optional and if not given, it is set to startOffset
	this.setSelectionData = function(lineId, startOffset, endOffset) { 
		if (2 == arguments.length) {
			endOffset  = startOffset;
		}
		self.selectionData = [[lineId, startOffset, endOffset]];
	}

	// call after user inputs to put selection information into a more usable format in a 
	// 2D array [[lineId, selection start offset, selection end offset], [...]]
	this.updateSelectionData = function() { 
		var selection = window.getSelection();
		if ( selection.anchorNode === null || selection.anchorNode.parentNode === null )
			return;
		var anchorParentNode = selection.anchorNode.parentNode;
		var aPNtagLineId = anchorParentNode.getAttribute("tagLineId");
		if (!aPNtagLineId) // this function can be triggered by clicks elsewhere than in just the text
			return;
		var focusParentNode = selection.focusNode.parentNode;
		var anchorLineIndex = self.getIndexFromLineId(aPNtagLineId);
		var focusLineIndex = self.getIndexFromLineId(focusParentNode.getAttribute("tagLineId"));
		var totAnchorOffset = selection.anchorOffset + parseInt(anchorParentNode.getAttribute("spanOffset"));
		var totFocusOffset = selection.focusOffset + parseInt(focusParentNode.getAttribute("spanOffset"));
		var startOffset, endOffset;
	
		if (anchorLineIndex == focusLineIndex) {
			startOffset = Math.min(totAnchorOffset, totFocusOffset);
			endOffset = Math.max(totAnchorOffset, totFocusOffset);
			self.selectionData = [[self.contentArray[anchorLineIndex][0], startOffset, endOffset]];
		} else {
			var startIndex = Math.min(anchorLineIndex, focusLineIndex);
			var endIndex = Math.max(anchorLineIndex, focusLineIndex);
			if (anchorLineIndex < focusLineIndex) {
				startOffset = totAnchorOffset;
				endOffset = totFocusOffset;
			} else {
				startOffset = totFocusOffset;
				endOffset = totAnchorOffset;
			}
			self.selectionData = [[self.contentArray[startIndex][0], startOffset, self.contentArray[startIndex++][1].length]];
			while (startIndex < endIndex)
				self.selectionData.push([self.contentArray[startIndex][0], 0, self.contentArray[startIndex++][1].length]);
			self.selectionData.push([sel.contentArray[startIndex][0], 0, endOffset]);
		}
	};

	this.restoreSelection = function() {
		if (self.selectionData.length === 0) { // the stuff below is necessary to restore the caret
			var range = document.createRange();
			var sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange(range);
			return;
		}
		var charCount = 0;
		var begCharCount = self.selectionData[0][1];
		var endCharCount = self.selectionData[self.selectionData.length - 1][2];

		var bElement, eElement;
		$("[tagLineId='" + self.selectionData[0][0] + "']:visible").each(function () { // line where the selection begins
			if ($(this).attr("spanoffset") > begCharCount)
				return false; // bElement now = the span before the intended caret position
			bElement = $(this);
		});
		$("[tagLineId='" + self.selectionData[self.selectionData.length - 1][0] + "']:visible").each(function () { // line where the selection ends
			if ($(this).attr("spanoffset") > endCharCount)
				return false; // eElement now = the span before the intended caret position
			eElement = $(this);
		});
		if ( bElement === undefined || eElement === undefined )
			return;
		var range = document.createRange();
		var test = bElement[0].firstChild === null ? bElement[0] : bElement[0].firstChild;
		range.setStart(bElement[0].firstChild === null ? bElement[0] : bElement[0].firstChild, begCharCount - bElement.attr("spanoffset"));
		range.setEnd(eElement[0].firstChild === null ? eElement[0] : eElement[0].firstChild, endCharCount - eElement.attr("spanoffset"));
		var sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
		eElement.focus(); // TODO Remove unless this solves the problem with loss of focus.
	};

	// returns the character index within the element 
	// which best corresponds to the no. of pixels given
	this.pixelsToCharOffset = function(element, pixels) { 
		var hiddenCopy = $(element).clone();
		var testText, previousWidth;
		var width = $(element).outerWidth();
		do {
			previousWidth = width;
			testText = $(hiddenCopy).text();
			$(hiddenCopy).text(testText.substr(0, testText.length - 1));
			$(hiddenCopy).appendTo(element);
			width = $(hiddenCopy).outerWidth();
			$(hiddenCopy).remove();
		} while (pixels < width);
		// also checking whether the click was closer to the left or to the right of the character
		return testText.length - 1 + (pixels > ((width + previousWidth) / 2)); 
	}

	this.initializeCaretOffsetInPixels = function() {
		var selection = window.getSelection();
		if ( selection.anchorNode === null || selection.anchorNode.parentNode === null )
			return;
		var parentElement = selection.anchorNode.parentElement;
		var hiddenCopy = $(parentElement).clone();
		oldWidthForCaretCalc = $(parentElement).outerWidth();
		$(hiddenCopy).text($(hiddenCopy).text().substr(0, selection.anchorOffset));
		$(hiddenCopy).appendTo(parentElement);
		self.caretOffsetInPixels = parentElement.offsetLeft + $(hiddenCopy).outerWidth();
		$(hiddenCopy).remove();
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

	// generates a line with spans matching the tags and generates 
	// and applies the relevant CSS/SVG to show them,  idPrefix is 
	// an optional prefix added to each the ID of each LI, defaults 
	// to "text" for compatibility reasons

	this.getLineLiWithTags = function(tagLineIndex, idPrefix) { 	var prefix = "text";
		var tagLineId = self.contentArray[tagLineIndex][0];
		if (arguments.length == 2)
			prefix = idPrefix;
		// values for creating SVGs with the right height to be used as a background and a 1 px "long" line corresponding to each tag:
		var lineY = Math.round(1.5 * self.contentLineFontSize);
		var lineThickness = Math.round(lineY / 6);// TODO Test what looks good...
		var thicknessAndSpacing = lineThickness + Math.round(lineY / 8);// TODO Test what looks good...
		var svgRectsJSON = ''; // JSON-2-B with the rect for each line
		var backgroundHeight = lineY; // enough for the first tag graphic
		var tagGfxStack = [];
		// "tags"-2-tags:
		var tagLineIndex = self.getIndexFromLineId(tagLineId);
		var lineUnicode = self.contentArray[tagLineIndex][1];
		var highlightCurrent = "";
		var lineNo = String(String(self.contentArray[tagLineIndex][4]).match(/readingOrder {index:\d+;}/)).match(/\d+/g);
		if (!lineNo)
			lineNo = tagLineIndex;
		else
			lineNo++; // readingOrder starts from 0, tagLineIndex is OK as is because of the "dummy line" in the beginning
		if (tagLineId == self.currentLineId)
			 highlightCurrent = ' style="color: green;" '; // A quick and dirty solution for highlighting the current line in each case below
		if ("" == lineUnicode)
			return '<li value="' + lineNo + '" id="' + prefix + '_' + tagLineId + '" spellcheck="false"' + highlightCurrent + '><div style="min-height: ' + backgroundHeight + 'px;"><span tagLineId="' + tagLineId + '" spanOffset="-1">&#8203;</span></div></li>'; // spanOffset -1 ensures that &#8203; is ignored when new text is entered
		var customTagArray = self.getSortedCustomTagArray(tagLineIndex);
		if (customTagArray.length > 0) {
			customTagArray.forEach(function (tag) { // get a stack with all unique tags present
				var notYetIn = true; // set to false if the tag is already found in the stack
				for (var i = 0; notYetIn && i < tagGfxStack.length; i++) {
					if (tagGfxStack[i] == tag.tag)
						notYetIn = false;
				}
				if (notYetIn)
					tagGfxStack.push(tag.tag);
			});
			// sort the stack and generate a graphical representation for each tag type (placement depends on order and total # of tags)
			tagGfxStack.sort();
			var gapTag = false;
			nonHeightTags = 0;
			tagGfxStack.forEach(function (gfxTag) { // we use initialWidth here and below since it's definitely long enough, except for the "gap" tag
				if ( gfxTag === "gap" ) {// we exclude this special case
					gapTag = true;
					nonHeightTags++;
				}
				else if ( gfxTag === "bold" || gfxTag === "italic" || gfxTag === "strikethrough" || gfxTag === "underlined" || gfxTag === "changeFromOriginal" || gfxTag === "subscript" || gfxTag === "superscript" )
					nonHeightTags++;
				else {
					svgRectsJSON += '"' + gfxTag + '":' + "\"<rect x=\\\\'0\\\\' y=\\\\'" + lineY + "\\\\' width=\\\\'" + self.initialWidth + "\\\\' height=\\\\'" + lineThickness + "\\\\' style=\\\\'fill: %23" + self.tagColors[gfxTag] + ";\\\\' />\""; // # must be %23 and yes \\\\ [sic!]
					lineY +=thicknessAndSpacing;
					svgRectsJSON += ',';
				}
			});
			if (gapTag) // insert the "gap" tag, if necessary. This also ensures that we don't have a comma in the end before conversion...
				svgRectsJSON += '"gap":' + "\"<line x1=\\\\'0\\\\' y1=\\\\'0\\\\' x2=\\\\'0\\\\' y2=\\\\'" + lineY + "\\\\' style=\\\\'stroke-width: " + lineThickness + "; stroke: %23" +  (self.tagColors["gap"]) + ";\\\\' />\""; // # must be %23 and yes \\\\ [sic!]
			else
				svgRectsJSON = svgRectsJSON.substring(0, svgRectsJSON.length - 1); // remove the comma in the end
			svgRectsJSON = JSON.parse("{" +svgRectsJSON + "}");
			// more graphics variables
			var bottomPadding = (1 + (tagGfxStack.length - nonHeightTags)) * thicknessAndSpacing; // nonHeightTags must be subtracted from the count since it shouldn't affect the height
			var backgroundHeight = lineY + bottomPadding;
			// generate lines with spans showing the tags...
			var tagStack = [];
			var tagString = '<li value="' + lineNo + '" spanOffset="0" class="tag-menu ' + (window.location.href.indexOf("view") >= 0 ? 'context-menu-disabled' : '') + '" id="' + prefix + '_' + tagLineId + '" spellcheck="false"' + highlightCurrent
										+ '><div style="padding-bottom: ' + bottomPadding + 'px; ' + 'min-height: ' + backgroundHeight + 'px;">';
			var rangeBegin;
			var keepOpenStack = [];
			var previousTag;
			var firstTagOffset = customTagArray[0].offset;
			if (firstTagOffset > 0) {
				var tagContent = lineUnicode.substring(0, firstTagOffset);
				tagString += '<span tagLineId="' + tagLineId + '" spanOffset="0">' + tagContent + '</span>';
				rangeBegin = firstTagOffset;
			} else
				rangeBegin = 0;
			customTagArray.forEach(function (tag) {
				var currentTag = tag.tag;
				var offset = tag.offset;
				var length = tag.length; // set this when opening for the first time ONLY, not when reopening (this is from Transkribus custom and has nothing to do with the string lengths between spans...)
				if (offset != rangeBegin || currentTag != previousTag) { // has this tag already been temporarily closed when closing an outer tag? If so, we don't need to open it again, otherwise we must
					var tagContent = lineUnicode.substring(rangeBegin, offset);
					while (keepOpenStack.length > 0) {
						var keepTag = keepOpenStack.pop();
						var tagDecoration = "background-image: url('data:image/svg+xml; utf8, <svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'" + initialWidth + "\\' height=\\'" + backgroundHeight + "\\'>" + svgRectsJSON[keepTag] + "</svg>');";
						if ( keepTag.tag === "bold" )
							tagDecoration = "font-weight: bold;";
						else if ( keepTag.tag === "italic" )
							tagDecoration = "font-style: italic;";
						else if ( keepTag.tag === "strikethrough" )
							tagDecoration = "text-decoration: line-through;";
						else if ( keepTag.tag === "underlined" )
							tagDecoration = "text-decoration: underline;";
						else if (keepTag.tag === "changeFromOriginal")
							tagDecoration = "color: blue;";
						tagString += "<span tagLineId='" + tagLineId + "' spanOffset=\"" + rangeBegin + "\" "
												+ "style=\"padding-bottom: " + bottomPadding + "px; " + tagDecoration + "\""
												+ ">";// we use initialWidth here and below because it's guaranteed to be enough
						if ( keepTag.tag === "subscript" )
							tagString += "<sub>";
						else if ( keepTag.tag === "superscript" )
							tagString += "<sup>";
						tagStack.push(keepTag);
					};
					tagString += '<span tagLineId="' + tagLineId + '" spanOffset="' + rangeBegin + '">' + tagContent + '</span>';// we always need the tagLineId
					if (tag.open) { // if the new tag opens, just insert it and push it onto the stack
						var tagDecoration = "background-image: url('data:image/svg+xml; utf8, <svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'" + initialWidth + "\\' height=\\'" + backgroundHeight + "\\'>" + svgRectsJSON[currentTag] + "</svg>');";
						if ( tag.tag === "bold" )
							tagDecoration = "font-weight: bold;";
						else if ( tag.tag === "italic" )
							tagDecoration = "font-style: italic;";
						else if ( tag.tag === "strikethrough" )
							tagDecoration = "text-decoration: line-through;";
						else if ( tag.tag === "underlined" )
							tagDecoration = "text-decoration: underline;";
						else if (tag.tag === "changeFromOriginal")
							tagDecoration = "color: blue;";
						tagString += "<span offset=\"" + offset + "\" spanOffset=\"" + offset + "\" tagLength=\"" + length +  "\" tagLineId='" + tagLineId + "' tag='" + currentTag + "' " //" // a "tag" = span with a tag attribute
												+ "style=\"padding-bottom: " + bottomPadding + "px; " + tagDecoration + "\""
												+ ">";
						if ( tag.tag === "subscript" )
							tagString += "<sub>";
						else if ( tag.tag === "superscript" )
							tagString += "<sup>";
						tagStack.push(currentTag);
					} else { // if the tag closes, we have to close all open tags until we reach the "original" opening tag
						var precedingTag = tagStack.pop();
						while (precedingTag && currentTag != precedingTag) {
							keepOpenStack.push(precedingTag);
							if ( precedingTag.tag === "subscript" )
								tagString += "</sub></span>";
							else if ( precedingTag.tag === "superscript" )
								tagString += "</sup></span>";
							else
								tagString += "</span>"; // easy to close since we don't need to care about what the opening tag type was...
							precedingTag = tagStack.pop();
						}
						if ( tag.tag === "subscript" )
							tagString += "</sub></span>";
						else if ( tag.tag === "superscript" )
							tagString += "</sup></span>";
						else
							tagString += "</span>";
					}
				}
				previousTag = currentTag;
				rangeBegin = offset;
			});
			var remainder = lineUnicode.substring(rangeBegin);
			tagString += '<span tagLineId="' + tagLineId + '" spanOffset="' + rangeBegin + '">' + remainder + '</span></div></li>';
			return tagString;
		} else
			return '<li value="' + lineNo + '" class="tag-menu ' + (window.location.href.indexOf("view") >= 0 ? 'context-menu-disabled' : '') + '" id="' + prefix + '_' + tagLineId + '" spellcheck="false"' + highlightCurrent + '><div style="min-height: ' + backgroundHeight + 'px;"><span tagLineId="' + tagLineId + '" spanOffset="0">' + lineUnicode + '</span></div></li>';
	};
	
// 	utils
	this.contenteditableToArray = function(lineId, overwriteText) { // converts an editable line with tags as spans line into the original format, i.e. array with the text and custom attribute content. Optionally text content can be given.
		var lineIndex = self.getIndexFromLineId(lineId);
		var tagStack = []; // 2d array with tags:  [[tag, offset, length], ...]
		$("[tagLineId='" + lineId + "']:visible").each(function () { // spans = tags
			var tag = $(this).attr("tag");
			if (tag)
				tagStack.push([tag, $(this).attr("offset"), $(this).attr("tagLength")]);
		});
		// regexp to preserve the part of custom which isn't tags (just readingorder for now and when/if that changes things will break)
		var custom = String(self.contentArray[self.getIndexFromLineId(lineId)][4]).match(/readingOrder {index:\d+;}/);
		for (var j = 0; j < tagStack.length; j++)
			custom += " " + tagStack[j][0] + " {offset:" + tagStack[j][1] + "; length:" + tagStack[j][2] + ";}";
		self.contentArray[lineIndex][4] = custom;
		if (2 == arguments.length) {
			self.contentArray[lineIndex][1] = overwriteText;
			//buildLineList(); // TODO Test more! This breaks deletions (and possibly other things) when executed here. Is it necessary in any scenario?
		} else
			self.contentArray[lineIndex][1] = $("#text_" + lineId).text().replace(/\u200B/g,''); // remove the zero width space!!!
	}

	function updateLine(updatedLineId) { // TODO  Make this faster by skipping the if below?
		if ( $(".transcript-div").is(":visible") && self.currentLineId !== undefined && self.correctModal.isOpen()) { // TODO A better test? This works but sbs below also has transcript-div :visible...
			$("#text_" + updatedLineId).html(self.getLineLiWithTags(self.getIndexFromLineId(updatedLineId)));
			self.updateDialogSize();
		}
		if ( $(".interface-lbl").is(":visible") )
			$("#line_" + updatedLineId).html(self.getLineLiWithTags(self.getIndexFromLineId(updatedLineId)));
		self.restoreSelection();
	}	
	
	this.buildLineList = function() {
		console.log("buildLineList");
		var index;
		if ( $(".transcript-div").is(":visible") && self.currentLineId !== undefined && self.correctModal.isOpen()) { 
				var currentIdx = getIndexFromLineId(self.currentLineId);
				var showTo = Math.min(currentIdx + self.surroundingCount, self.contentArray.length - 1);
				index = Math.max(1, currentIdx - self.surroundingCount); // 1 because the first line is not real
				$("#lineList").html("");
				while (index <= showTo)
					$("#lineList").append(self.getLineLiWithTags(index++));
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
		self.restoreSelection();
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
		self.initializeCaretOffsetInPixels();
		if (newLineId != null && self.selectionData !== undefined && self.selectionData[0] !== undefined ) {
			if (null === self.savedCaretOffsetInPixels)
				self.savedCaretOffsetInPixels = self.caretOffsetInPixels;
			// TODO Move the caret down even when we cannot make the lines move anymore?
			self.updateDialog(newLineId);
			self.updateCanvas();
			// get the closest span offset on the new line
			var span, spanOffset;
			$("[tagLineId=" + caretLineId + "]:visible").each(function() {
				if (this.offsetLeft < self.savedCaretOffsetInPixels) {
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
				if ((cB + cA) / 2 > (self.savedCaretOffsetInPixels - spanOffset)) // we want the offset which is closest to this
					break;
				cA = cB;
			}
			var cLength = contentArray[getIndexFromLineId(caretLineId)][1].length;
			if (null == cLength)
				cLength = 0;
			var caretOffset = Math.min(t - 1 + parseInt($(span).attr("spanOffset")), cLength);
			self.selectionData = [[caretLineId, caretOffset, caretOffset]];
			self.restoreSelection();
		}
	};

	this.typewriterNext = function() { // Aka. "press typewriter enter scroll". Changes the selected lines and the modal content.
//		if ( ifc === "lbl" )
//			$("#options_" + currentLineId).hide();
		self.typewriterMove(self.getNextLineId(self.currentLineId), self.getNextLineId(self.selectionData[0][0])); // the caret will "remain in place" and the lines shifted around it
	};
	this.typewriterPrevious = function() {
//		if ( ifc === "lbl" )
//			$("#options_" + currentLineId).hide();
		self.typewriterMove(self.getPreviousLineId(self.currentLineId), self.getPreviousLineId(self.selectionData[0][0])); // the caret will "remain in place" and the lines shifted around it
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
		self.generateThumbGrid();
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

	/*************************/
	/* Tag related functions */
	/*************************/

	this.tagMenu = function() { // returns the tag list with tags in the selection highlighted, if any
		var appliedTags = {}; // an array to be populated with all tags within the selection, may contain duplicates
		var lastButOne = self.selectionData.length - 1;
		var lineIndex = self.getIndexFromLineId(self.selectionData[0][0]);
		var tagsOnLine = self.getSortedCustomTagArray(lineIndex);
		var selStart = self.selectionData[0][1];
		var selEnd;
		if (self.selectionData.length == 1)
			selEnd = self.selectionData[0][2];
		else
			selEnd = self.contentArray[lineIndex][1].length;
		for (var i = 0; i < tagsOnLine.length; i++) {
			var tagOffset = tagsOnLine[i].offset;
			if ((tagOffset <= selStart && selStart < (tagOffset + tagsOnLine[i].length)) || (selStart < tagOffset && tagOffset <= selEnd)) {
				var tag = tagsOnLine[i].tag;
				if ( tag !== "bold" && tag !== "italic" && tag !== "strikethrough" && tag !== "underlined" && tag !== "subscript" && tag !== "superscript" )
					appliedTags[tag] = {"name": "<span style=\"color: #" + self.tagColors[tag] + ";\">" + tag + "</span>", "type": "checkbox", "isHtmlName": true, "selected": true};
			}
		}
		var j = 1;
		while (j < lastButOne) {
			lineIndex++; // we don't check if this goes out of bounds since such a selection shouldn't be possible...
			tagsOnLine = self.getSortedCustomTagArray(lineIndex);
			for (var k = 0; k < tagsOnLine.length; k++) {
				var tag = tagsOnLine[k].tag;
				if ( tag !== "bold" && tag !== "italic" && tag !== "strikethrough" && tag !== "underlined" && tag !== "subscript" && tag !== "superscript" )
					appliedTags[tag] = {"name": "<span style=\"color: #" + self.tagColors[tag] + ";\">" + tag + "</span>", "type": "checkbox", "isHtmlName": true, "selected": true}; // the selection covers all tags on this line
			}
			j++;
		}
		if (self.selectionData.length > 1) {
			lineIndex++;
			tagsOnLine = self.getSortedCustomTagArray(lineIndex);
			selEnd = self.selectionData[j][2];
			selStart = 0;
			for (var i = 0; i < tagsOnLine.length; i++) {
				if (tagsOnLine[i].offset < selEnd) {
					var tag = tagsOnLine[i].tag;
					if ( tag !== "bold" && tag !== "italic" && tag !== "strikethrough" && tag !== "underlined" && tag !== "subscript" && tag !== "superscript" )
						appliedTags[tag] = {"name": "<span style=\"color: #" + self.tagColors[tag] + ";\">" + tag + "</span>", "type": "checkbox", "isHtmlName": true, "selected": true};
				}
			}
		}
		return {"items": $.extend({}, tagItems, appliedTags)};
	};

	this.toggleTag = function(toggleTag) { // sets/removes the tag depending on whether the selection already has it
		if (!self.removeTag(toggleTag)) // if the tag can be removed, we do that...
			self.applyTag(toggleTag);// ...but otherwise we apply it
		if (!changed)
			self.setMessage(transUnsavedChanges, 'warning', false);
		self.changed = true;
	};

	this.removeTag = function(removeTag, everywhere) { // Removes the given tag from the selection and everywhere, if the second parameter is true. Returns true if removals were made, otherwise false.
		var tag = removeTag;
		var removals = false;
//		if ( removeTag === "bold" || removeTag === "italic" || removeTag === "strikethrough" || removeTag === "underlined" || removeTag === "subscript" || removeTag === "superscript" )
		// Tags that don't draw anything under the line and have their rendering in HTML (aka textStyle)
		if($.inArray(removeTag,["bold","italic","strikethrough","underlined","subscript","superscript"]) >= 0)
			tag = "textStyle";
		if (2 == arguments.length && everywhere) {
			for (var k = 1; k < contentArray.length; k++)
				self.contentArray[k][4] = String(self.contentArray[k][4]).replace(new RegExp("\\s" + tag + "[^}]*}", "g"), "");
			return; // TODO Return true/false depending on result? Not needed at the moment but technically this is a bug.
		}
		var lastButOne = self.selectionData.length - 1;
		var lineIndex = self.getIndexFromLineId(self.selectionData[0][0]);
		var tagsOnLine = self.getSortedCustomTagArray(lineIndex, removeTag);
		var selStart = self.selectionData[0][1];
		var selEnd;
		if (self.selectionData.length == 1)
			selEnd = self.selectionData[0][2];
		else
			selEnd = self.contentArray[lineIndex][1].length;
		for (var i = 0; i < tagsOnLine.length; i++) {
			var tagOffset = tagsOnLine[i].offset;
			if ((tagOffset <= selStart && selStart < (tagOffset + tagsOnLine[i].length)) || (selStart < tagOffset && tagOffset <= selEnd)) {
				removals = true;
				self.contentArray[lineIndex][4] = String(self.contentArray[lineIndex][4]).replace(new RegExp("\\s" + tag + "\\s+{offset:" + tagOffset + ";[^}]*}"), "");
			}
		}
		var j = 1;
		while (j < lastButOne) {
			lineIndex++; // we don't check if this goes out of bounds since such a selection shouldn't be possible...
				if (self.getSortedCustomTagArray(lineIndex, removeTag).length > 0) {
					removals = true;
					self.contentArray[lineIndex][4] = String(self.contentArray[lineIndex][4]).replace(new RegExp("\\s" + tag + "[^}]*}"), "");
				}
			j++;
		}
		if (self.selectionData.length > 1) {
			lineIndex++;
			tagsOnLine = self.getSortedCustomTagArray(lineIndex, removeTag);
			selEnd = self.selectionData[j][2];
			selStart = 0;
			for (var i = 0; i < tagsOnLine.length; i++) {
				var tagOffset = tagsOnLine[i].offset;
				if (tagOffset < selEnd) {
					removals = true;
					self.contentArray[lineIndex][4] = String(self.contentArray[lineIndex][4]).replace(new RegExp("\\s" + tag + "\\s+{offset:" + tagOffset + ";[^}]*}"), "");
				}
			}
		}
		self.buildLineList();
		return removals;
	};
	// applies the tag from start to end on the line the index of 
	// which is given, adds "continued:true", if given and true
	this.applyTagTo = function(applyTag, lineId, start, end, continued) { 
		var lineIndex = self.getIndexFromLineId(lineId);
		var customTagArray = self.getSortedCustomTagArray(lineIndex);
		var isContinued = false;
		if (5 == arguments.length)
			continued = continued;

		var t = 0;
		while (t < customTagArray.length) // remove all tags from the array except those which are of the same type as the applied one
			if (customTagArray[t].tag != applyTag)
				customTagArray.splice(t, 1);
			else
				t++;

		var i = 0;
		while (i < customTagArray.length) { // look for overlapping tags
			var existingOpenOffset = customTagArray[i].offset;
			var existingCloseOffset = customTagArray[i + 1].offset; // TODO Remove redundant variables...
			if (start <= existingCloseOffset && existingOpenOffset <= end)  { // do we have overlap? If so, merge...
				start = Math.min(start, existingOpenOffset);
				end = Math.max(end, existingCloseOffset);
				customTagArray.splice(i, 2); // ...and remove the old tag
			} else
				i += 2;
		}
		customTagArray.push({"offset": start, "tag": applyTag, "open": true, "length": (end - start)});
		customTagArray.push({"offset": end, "tag": applyTag, "open": false, "length": 0});

		// get everything in custom EXCEPT the applied tag
		if ( applyTag === "bold" || applyTag === "italic" || applyTag === "strikethrough" || applyTag === "underlined" || applyTag === "subscript" || applyTag === "superscript" )
			var removalExp = new RegExp("textStyle\s+[^\}]*" + applyTag + ":true(.(?!\}))*.{1}\}", "g");
		else
			var removalExp = new RegExp(applyTag + "\\s+(.(?!\}))*.{1}\}", "g");
		var custom = String(contentArray[lineIndex][4]).replace(removalExp, "");
		for (j = 0; j < customTagArray.length; j += 2) {
			var length = customTagArray[j].length;
			if (length > 0) {
				var tag = customTagArray[j].tag;
				var textStyle = "";
				if($.inArray(removeTag,["bold","italic","strikethrough","underlined","subscript","superscript"]) >= 0){
	//			if ( tag === "bold" || tag === "italic" || tag === "strikethrough" || tag === "underlined" || tag === "subscript" || tag === "superscript" ) {
					textStyle = ";" + tag + ":true";
					tag = "textStyle";
				}
				custom += " " + tag + " {offset:" + customTagArray[j].offset + "; length:" + length + textStyle + ";";
				if (isContinued)
					custom += " continued:true;";
				custom += "}";
			}
		}
		self.contentArray[lineIndex][4] = custom;
	};
	this.applyTag = function(applyTag) {
		if ( self.selectionData === undefined || self.selectionData[0] === undefined )
			return;
		// use selectionData to apply the tag
		if ("gap" == applyTag) // this tag is an exception
			self.applyTagTo(applyTag, self.selectionData[0][0], self.selectionData[0][1], self.selectionData[0][1] + 1);
		else if (self.selectionData.length == 1) {
			if (self.selectionData[0][1] != self.selectionData[0][2]) // beginning and end must be different
				self.applyTagTo(applyTag, self.selectionData[0][0], self.selectionData[0][1], self.selectionData[0][2]);
		} else {
			var lastButOne = self.selectionData.length - 1;
			var i = 0;
			while (i < lastButOne)
				self.applyTagTo(applyTag, self.selectionData[i][0], self.selectionData[i][1], self.selectionData[i++][2], true);
			self.applyTagTo(applyTag, self.selectionData[i][0], self.selectionData[i][1], self.selectionData[i][2]); // this tag is not continued on the next line
		}
		self.buildLineList();
	};
	// returns an array with Transkribus "custom" tags in the format 
	// below, if a filterTag is given, only tags of that type are included
	this.getSortedCustomTagArray = function(tagLineIndex, filterTag) { 
		var filter = false;
		if (2 == arguments.length) {
			filter = filterTag;
		}
		var custom = (self.contentArray[tagLineIndex][4] + ' ').replace(/\s+/g, '').split('}');
		var customTagArray = [];
		if ("None" != custom) {
			custom.forEach(function(attribute) { // turn "tags" into something closer to actual tags (=spans)
				attribute = attribute.split('{');
				if ("" != attribute && "readingOrder" != attribute[0] && attribute[1].indexOf("offset:") != -1 && attribute[1].indexOf(";length:") != -1) { // we have no use for readingOrder for now...
					var split = attribute[1].split("offset:")[1].split(";length:");
					var start = parseInt(split[0]);
					var length = parseInt(split[1]); // parseInt doesn't care about what comes after the first int
					var end = start + length;
					var tag = attribute[0];
					if ( split[1].indexOf("bold:true") !== -1 )
						tag = "bold";
						else if ( split[1].indexOf("italic:true") !== -1 )
						tag = "italic";
					else if ( split[1].indexOf("strikethrough:true") !== -1 )
						tag = "strikethrough";
					else if ( split[1].indexOf("underlined:true") !== -1 )
						tag = "underlined";
					else if ( split[1].indexOf("subscript:true") !== -1 )
						tag = "subscript";
					else if ( split[1].indexOf("superscript:true") !== -1 )
						tag = "superscript";
						if (!filter || filter == tag) {
						customTagArray.push({"offset": start, "tag": tag, "open": true, "length": length});
						customTagArray.push({"offset": end, "tag": tag, "open": false, "length": 0});
					}
				}
			});
		}
		customTagArray.sort(function (tagA, tagB) {
			return tagA.offset - tagB.offset;
		});
		return customTagArray;
	}

	this.contextMenuOpenable = function(contextMenuEvent) { // ensures that the caret is also moved when the user clicks the right mouse button unless the tag menu should be opened to set tags to a new selection, sets the contextMenuOk flag
		if ("" != self.selectionData && (self.selectionData.length > 1 || (self.selectionData[0][1] != self.selectionData[0][2]))) // have we got a non-zero length selection? if so, the user wants to set tags to the selection and we thus don't move the caret
			return true;
		if ( window.location.href.indexOf("view") >= 0 )
			return false;
		var line;
		$("[id^='text_']").each(function() { // first find the line on which the click was
			var y = 0, testElement = this;
			do {
				y += testElement.offsetTop;
				testElement = testElement.offsetParent;
			} while (testElement != null);
			if (y < contextMenuEvent.pageY && contextMenuEvent.pageY < (y + this.offsetHeight)) {
				line = this;
				return false;
			}
		});
		if (line) { // if we have a line, find the correct span, if any
			var span, spanOffset, toTheLeft = false;
			var lineId = line.getAttribute("id").substr(5); // "text_".length is 5...
			$("[tagLineId=" + lineId + "]").each(function() {
				var x = 0, testElement = this;
				do {
					x += testElement.offsetLeft;
					testElement = testElement.offsetParent;
				} while (testElement != null);
				if (contextMenuEvent.pageX < x) { // if the click is outside the first span, we quit and set the caret to the beginning of that line
					toTheLeft = true;
					return false;
				}
				if (x < contextMenuEvent.pageX && contextMenuEvent.pageX < (x + this.offsetWidth)) {
					span = this;
					spanOffset = x;
				}
				// we don't break because in case there are nested spans, we want the innermost one TODO Check if this is correct? It could be completely wrong even if it works....
			});
			if (span) {
				self.setSelectionData(lineId, parseInt(span.getAttribute("spanOffset")) +self. pixelsToCharOffset(span, contextMenuEvent.pageX - spanOffset));
				self.restoreSelection();
				return true;
			} else { // set the caret to the end/beginning of the line for consistent behaviour compared with left clicks
				if (toTheLeft)
					self.setSelectionData(lineId, 0); // beginning
				else // only remaining possibility if we have a line but no span
					self.setSelectionData(lineId, self.contentArray[getIndexFromLineId(lineId)][1].length);
				self.restoreSelection();
				return false;
			}
   	 	}	
		return false;
	};
	
}//End declarion of Edit 'Class'
			
