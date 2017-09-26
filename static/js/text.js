var undoArray = [];
var keyDownString = '';
var keyDownCount = 0;
var ctrlKey = false, metaKey = false, altKey = false;
var caretOffsetInPixels = null;
var saveCaretPixelOffset = false;
var selectionData = [];
var contentLineFontSize = parseInt($('.line-list').css("font-size"));
// these vars must be initialized when importing this JavaScript
// surroundingCount, currentLineId, view, changed
// these JavaScripts must also be imported
// TODO Check

// text editing
function keydown(e) {
	console.log("key DOWN key: " + e.key);
	if (e.which == 17 || e.which == 112 || e.which == 111) { // we handle CTRL like this because of one of the weirdest things I've ever come across. Any one of these (i.e. also F1 and divide) can be triggered when pressing CTRL.
		ctrlKey = true;
	} else if (!ctrlKey) {
		if (e.key.length == 1) { // only characters are input
			e.preventDefault();
			updateSelectionData();
			inputAction(e.key);
		} else {
			updateSelectionData();
			editAction(e);
		}
	}
}
function keyup(e) { // TODO Refactor this. This now does more than before because we don't have keyPress and a different split between this and editAction might be better....
	console.log("key UP key: " + e.key);
	if (ctrlKey) { // see above why we do this
		e.preventDefault(); // TODO what about cut and copy?
		if (e.which == 17 || e.which == 112 || e.which == 111) // the weird behaviour
			ctrlKey = false;
		if (e.key == "z" || e.key == "Z") // we respond to this
			undoAction();
		if ( (e.key == "v" || e.key == "V") && e.originalEvent.clipboardData !== undefined ) // and this
			inputAction(e.originalEvent.clipboardData.getData('text'));
		return;
	}
}
function mouseup(e) {
	updateSelectionData();
}
function paste(e) {
	e.preventDefault();
	updateSelectionData();
	inputAction(e.originalEvent.clipboardData.getData('text'));
}
function drop(e) {
	// Nobody needs to do this and this breaks things.
	e.preventDefault();
}
function cut(e) {
	eraseSelection(); // TODO This!
}

function lineEditAction(editedLineId, startOffset, endOffset, textInjection) { // if no text injection is given, we just update the tags and assume that the input went straight to the "contenteditable", if startOffset > endOffset the action is a deletion (possibly followed by an injection into the same offset)
	var contentDelta;
	var injectionDelta = 0;
	if (arguments.length == 4) // this could set endOffset so that any given value is ignored because it makes no sense to consider that parameter in this case
		injectionDelta = textInjection.length;
	contentDelta = endOffset - startOffset + injectionDelta;
	$("[tagLineId='" + editedLineId + "']").each(function () {
		var tagLength = parseInt($(this).attr("tagLength"));
		if (tagLength) { // spans with set tagLengths are Transkribus tags
			var tagOffset = parseInt($(this).attr("offset"));
			if (startOffset <= tagOffset) { // tags after the edit
				$(this).attr("offset", tagOffset + contentDelta);
			} else if (tagOffset > endOffset && (tagOffset + tagLength) > startOffset) {
				$(this).attr("offset", endOffset);
				$(this).attr("tagLength", tagLength - startOffset + tagOffset);
			} else if ((tagOffset + tagLength) > endOffset) {
				$(this).attr("tagLength", Math.max(tagLength + contentDelta, endOffset - tagOffset));
			}
		}
	});
	if (arguments.length == 4) { // injected, possibly with deletion?
		var previousContent = contentArray[getIndexFromLineId(editedLineId)][1];
		if (endOffset < startOffset)
			contenteditableToArray(editedLineId, previousContent.substring(0, endOffset) + textInjection + previousContent.substring(startOffset, previousContent.length));
		else
			contenteditableToArray(editedLineId, previousContent.substring(0, endOffset) + textInjection + previousContent.substring(endOffset, previousContent.length));
	} else if (contentDelta < 0) {
		var previousContent = contentArray[getIndexFromLineId(editedLineId)][1];
		contenteditableToArray(editedLineId, previousContent.substring(0, endOffset) + previousContent.substring(startOffset, previousContent.length)); // deletions require overwrites
	} else
		contenteditableToArray(editedLineId);
}
// TODO Include pasteAction's multi-line handling here instead, this handles multiple lines in other situations as well...
function editAction(event) {
	if (event.ctrlKey || event.altKey || event.metaKey) { // we must prevent any printable from being input in these cases....
		if (event.key == "z" || event.key == "Z")
			undoAction();
		return;
	}
	if ( selectionData == undefined || selectionData[0] === undefined )
		return;
    var editedLineId = selectionData[0][0];
	var startOffset = selectionData[0][2];
	var endOffset = selectionData[0][1]; // TODO Some cleanup? This is just for one line edits, changed in the else below...
	undoArray = [];
	undoArray.push(contentArray[getIndexFromLineId(editedLineId)].slice());
	// TODO Rename the vars? start and end are not intuitive names when removing text end = the caret position at the END OF THE ACTION (i.e. a smaller offset than start = the caret position AT THE START OF THE ACTION)
	if (selectionData.length ==1) { // does everything happen on just one line?
		if (event.key.length == 1) { // a regular character?
			event.preventDefault();
			lineEditAction(editedLineId, startOffset, endOffset, event.key);
			endOffset++; // we've moved one character and have to set the selection
	    } else if (event.keyCode == 8) { // backspace?
	    	event.preventDefault();
	    	if (endOffset != startOffset) { // a selection to remove?
	    		lineEditAction(editedLineId, startOffset, endOffset);
	    	} else if (endOffset > 0) { // we create a one character selection (but don't remove linebreaks)
	    		endOffset--;
				lineEditAction(editedLineId, startOffset, endOffset);
			}
		} else if (event.keyCode == 46) { // delete?
			event.preventDefault();
			if (endOffset == startOffset && endOffset < contentArray[getIndexFromLineId(editedLineId)][1].length) // can we allow a deletion without removing a linebreak?
	    		startOffset++; // pretend that the character in front of the caret was selected
    		lineEditAction(editedLineId, startOffset, endOffset);
	    } else if (event.keyCode == 13 || event.keyCode == 9) { // return key?
	    	event.preventDefault();
	        typewriterNext();
	        return;
	    } else {
			if (event.key == "ArrowUp" && ("i" === ifc || "t" === ifc)) {
	    		if (getIndexFromLineId(editedLineId) == (getIndexFromLineId(currentLineId) - surroundingCount)) { // if there's no line left in the dialog to go to...
		    		event.preventDefault();
	    			typewriterPrevious(); // ...the expected behaviour is identical to this
	    		} // otherwise we can let the caret simply move as normal
			} else if (event.key == "ArrowDown" && ("i" === ifc || "t" === ifc)) {
	    		if (getIndexFromLineId(editedLineId) == (getIndexFromLineId(currentLineId) + surroundingCount)) { // if there's no line left in the dialog to go to...
	    			event.preventDefault();
	    			typewriterNext(); // ...the expected behaviour is identical to this
	    		} // otherwise we can let the caret simply move as normal
	    	} else if (event.key == "Home") // In some cases the "parent" is the LI which doesn't yield the right offset in updateSelection
	    		selectionData = [[selectionData[0][0], 0, 0]];
	    	else if (event.key == "End") { // same thing
	    		var lineLength = contentArray[getIndexFromLineId(editedLineId)][1].length;
	    		selectionData = [[selectionData[0][0], lineLength, lineLength]];
	    	}
	    	return;
	    }
		selectionData[0][1] = endOffset;
		selectionData[0][2] = endOffset;
	} else if (event.key.length == 1 || event.keyCode == 8 || event.keyCode == 46) { // multiple lines selected, character input, backspace or delete requires a deletion
			event.preventDefault();
			var inject;
			if (event.key.length == 1)
				inject = event.key;
			else
				inject = "";
			var c = 1;
			var lastButOne = selectionData.length - 1;
			lineEditAction(editedLineId, contentArray[getIndexFromLineId(editedLineId)][1].length, endOffset, inject);
			var deleteFromId = getNextLineId(editedLineId);
			while (c < lastButOne) {
				undoArray.push(contentArray[getIndexFromLineId(deleteFromId)].slice());
				lineEditAction(deleteFromId, contentArray[getIndexFromLineId(deleteFromId)][1].length, 0);
				deleteFromId = getNextLineId(deleteFromId);
				c++;
			}
			undoArray.push(contentArray[getIndexFromLineId(deleteFromId)].slice());
			lineEditAction(deleteFromId, selectionData[i][2], 0);
			selectionData = [[editedLineId, endOffset, endOffset]];
	}
	buildLineList();
}
function undoAction() {
	for (var i = 0; i < undoArray.length; i++) {
		var undoId = undoArray[i][0];
		contentArray[getIndexFromLineId(undoArray[i][0])] = undoArray[i];
	}
	buildLineList();
}
// TODO Add undo to this when undo works.
function inputAction(text) { // TODO This can and should be sped up now that it's used a lot. And renamed.
	text = text.replace(" ", "\u00A0");
	if (!changed)
		setMessage(transUnsavedChanges);
	changed = true;
	var lines = text.split("\n");
	if ( selectionData === undefined || selectionData[0] === undefined )
		return;
	var editedLineId = selectionData[0][0];
	var startOffset = selectionData[0][2];
	var endOffset = selectionData[0][1];
	// TODO Remove selected content first. Uh, still applicable?
	if (selectionData.length > 1 && selectionData[0][1] != selectionData[0][2]) {
		var i = 1;
		var lastButOne = selectionData.length - 1;
		lineEditAction(editedLineId, contentArray[getIndexFromLineId(editedLineId)][1].length, endOffset);
		var deleteFromId = getNextLineId(editedLineId);
		while (i < lastButOne) {
			lineEditAction(deleteFromId, contentArray[getIndexFromLineId(deleteFromId)][1].length, 0);
			deleteFromId = getNextLineId(deleteFromId);
			i++;
		}
		lineEditAction(deleteFromId, selectionData[i][2], 0);
	}
	if (contentArray[getIndexFromLineId(editedLineId)][1].length == endOffset) { // don't even consider multi-line pasting unless we start doing it at the end of the line
		var pasteText = lines[0];
		lineEditAction(editedLineId, startOffset, endOffset, pasteText);
		nextLineId = getNextLineId(editedLineId);
		endOffset += pasteText.length;
		for (var i = 1; i < lines.length; i++) { // write to subsequent lines, if they're empty but otherwise append to one line without breaks
			pasteText = lines[i];
			if ("" == contentArray[getIndexFromLineId(nextLineId)][1].replace(/\s+/g, '')) {
				endOffset = 0;
				lineEditAction(nextLineId, 0, 0, pasteText);
				nextLineId = getNextLineId(nextLineId);
			} else {
				endOffset += pasteText.length;
				lineEditAction(editedLineId, endOffset, endOffset, pasteText);
			}
		}
	} else {
		var oneLine = lines.join(" ");
		lineEditAction(editedLineId, startOffset, endOffset, oneLine);
		endOffset += oneLine.length; // to update selectionData below...
	}
	// set the caret to where the pasting ended
	selectionData = [[selectionData[selectionData.length - 1][0], endOffset, endOffset]]; // the lineId must be the same as the last line affected
	buildLineList();
}

// helpers
function getIndexFromLineId(lineId) {
	var length = contentArray.length;
	var index;
	for (index = 0; index < length; index++) {
		if (contentArray[index][0] == lineId)
			return index;
	}
	return null;
}
function getNextLineId(lineId) {
	index = getIndexFromLineId(lineId);
	if (contentArray.length == (index + 1))
		return null;// If it's the last line, we don't have a next id.
	else
		return contentArray[index + 1][0];
}
function getPreviousLineId(lineId) {
	index = getIndexFromLineId(lineId);
	if (1 == index)
		return null; // If it's the first line, we don't have a previous id. Note: The first real line is [1] because the very first "line" in the array is "", i.e. not a line but the top of the page.
	else
		return contentArray[index - 1][0];
}

// selections
function setSelectionData(lineId, startOffset, endOffset) { // set the selectiondata, endOffset is optional and if not given, it is set to startOffset
	if (2 == arguments.length) {
		endOffset  = startOffset;
	}
	selectionData = [[lineId, startOffset, endOffset]];
}
function updateSelectionData() { // call after user inputs to put selection information into a more usable format in a 2D array [[lineId, selection start offset, selection end offset], [...]]
	if (!saveCaretPixelOffset) // unless the previous call was a "typewriter step"...
		caretOffsetInPixels = null; // ...we forget the old offset
	else
		saveCaretPixelOffset = false; // we don't reset the offset this time (but will do next time unless told otherwise)
	var selection = window.getSelection();
	if ( selection.anchorNode === null || selection.anchorNode.parentNode === null )
		return;
	var anchorParentNode = selection.anchorNode.parentNode;
	var aPNtagLineId = anchorParentNode.getAttribute("tagLineId");
	if (!aPNtagLineId) // this function can be triggered by clicks elsewhere than in just the text
		return;
	var focusParentNode = selection.focusNode.parentNode;
	var anchorLineIndex = getIndexFromLineId(aPNtagLineId);
	var focusLineIndex = getIndexFromLineId(focusParentNode.getAttribute("tagLineId"));
	var totAnchorOffset = selection.anchorOffset + parseInt(anchorParentNode.getAttribute("spanOffset"));
	var totFocusOffset = selection.focusOffset + parseInt(focusParentNode.getAttribute("spanOffset"));
	var startOffset, endOffset;

	if (anchorLineIndex == focusLineIndex) {
		startOffset = Math.min(totAnchorOffset, totFocusOffset);
		endOffset = Math.max(totAnchorOffset, totFocusOffset);
		selectionData = [[contentArray[anchorLineIndex][0], startOffset, endOffset]];
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
		selectionData = [[contentArray[startIndex][0], startOffset, contentArray[startIndex++][1].length]];
		while (startIndex < endIndex)
			selectionData.push([contentArray[startIndex][0], 0, contentArray[startIndex++][1].length]);
		selectionData.push([contentArray[startIndex][0], 0, endOffset]);
	}
}
function restoreSelection() {
	if (selectionData.length === 0) { // the stuff below is necessary to restore the caret
		var range = document.createRange();
		var sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
		return;
	}
	var charCount = 0;
	var begCharCount = selectionData[0][1];
	var endCharCount = selectionData[selectionData.length - 1][2];
	var bElement, eElement;
	$("[tagLineId='" + selectionData[0][0] + "']").each(function () { // line where the selection begins
		if ($(this).attr("spanoffset") > begCharCount)
			return false; // bElement now = the span before the intended caret position
		bElement = $(this);
	});
	$("[tagLineId='" + selectionData[selectionData.length - 1][0] + "']").each(function () { // line where the selection ends
		if ($(this).attr("spanoffset") > endCharCount)
			return false; // eElement now = the span before the intended caret position
		eElement = $(this);
	});
	if ( bElement === undefined || eElement === undefined )
		return;
	var range = document.createRange();
	range.setStart(bElement[0].firstChild === null ? bElement[0] : bElement[0].firstChild, begCharCount - bElement.attr("spanoffset"));
	range.setEnd(eElement[0].firstChild === null ? eElement[0] : eElement[0].firstChild, endCharCount - eElement.attr("spanoffset"));
	var sel = window.getSelection();
	sel.removeAllRanges();
	sel.addRange(range);
}
function pixelsToCharOffset(element, pixels) { // returns the character index within the element which best corresponds to the no. of pixels given
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
	return testText.length - 1 + (pixels > ((width + previousWidth) / 2)); // also checking whether the click was closer to the left or to the right of the character
}

// text rendering
function getLineLiWithTags(tagLineId) { // generates a line with spans matching the tags and generates and applies the relevant CSS/SVG to show them
	// values for creating SVGs with the right height to be used as a background and a 1 px "long" line corresponding to each tag:
	var lineY = Math.round(1.5 * contentLineFontSize);
	var lineThickness = Math.round(lineY / 6);// TODO Test what looks good...
	var thicknessAndSpacing = lineThickness + Math.round(lineY / 8);// TODO Test what looks good...
	var svgRectsJSON = ''; // JSON-2-B with the rect for each line
	var backgroundHeight = lineY; // enough for the first tag graphic
	var tagGfxStack = [];
	// "tags"-2-tags:
	var tagLineIndex = getIndexFromLineId(tagLineId);
	var lineUnicode = contentArray[tagLineIndex][1];
	var highlightCurrent = "";
	var lineNo = String(String(contentArray[tagLineIndex][4]).match(/readingOrder {index:\d+;}/)).match(/\d+/g);
	if (!lineNo)
		lineNo = tagLineIndex;
	else
		lineNo++; // readingOrder starts from 0, tagLineIndex is OK as is because of the "dummy line" in the beginning
	if (tagLineId == currentLineId)
		 highlightCurrent = ' style="color: green;" '; // A quick and dirty solution for highlighting the current line in each case below
	if ("" == lineUnicode)
		return '<li value="' + lineNo + '" id="text_' + tagLineId + '" spellcheck="false"' + highlightCurrent + '><div style="min-height: ' + backgroundHeight + 'px;"><span tagLineId="' + tagLineId + '" spanOffset="-1">&#8203;</span></div></li>'; // spanOffset -1 ensures that &#8203; is ignored when new text is entered
	var customTagArray = getSortedCustomTagArray(tagLineIndex);
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
		tagGfxStack.sort()
		var gapTag = false;
		tagGfxStack.forEach(function (gfxTag) { // we use initialWidth here and below since it's definitely long enough, except for the "gap" tag
			if (gfxTag != "gap") { // we exclude this special case
				svgRectsJSON += '"' + gfxTag + '":' + "\"<rect x=\\\\'0\\\\' y=\\\\'" + lineY + "\\\\' width=\\\\'" + initialWidth + "\\\\' height=\\\\'" + lineThickness + "\\\\' style=\\\\'fill: %23" + tagColors[gfxTag] + ";\\\\' />\""; // # must be %23 and yes \\\\ [sic!]
				lineY +=thicknessAndSpacing;
				svgRectsJSON += ',';
			} else
				gapTag = true;
		});
		if (gapTag) // insert the "gap" tag, if necessary. This also ensures that we don't have a comma in the end before conversion...
			svgRectsJSON += '"gap":' + "\"<line x1=\\\\'0\\\\' y1=\\\\'0\\\\' x2=\\\\'0\\\\' y2=\\\\'" + lineY + "\\\\' style=\\\\'stroke-width: " + lineThickness + "; stroke: %23" +  (tagColors["gap"]) + ";\\\\' />\""; // # must be %23 and yes \\\\ [sic!]
		else
			svgRectsJSON = svgRectsJSON.substring(0, svgRectsJSON.length - 1); // remove the comma in the end
		svgRectsJSON = JSON.parse("{" +svgRectsJSON + "}");
		// more graphics variables
		var bottomPadding = (1 + (tagGfxStack.length - gapTag)) * thicknessAndSpacing; // gapTag must be subtracted from the count since it shouldn't affect the height
		var backgroundHeight = lineY + bottomPadding;
		// generate lines with spans showing the tags...
		var tagStack = [];
		var tagString = '<li value="' + lineNo + '" spanOffset="0" class="tag-menu" id="text_' + tagLineId + '" spellcheck="false"' + highlightCurrent
									+ '><div style="padding-bottom: ' + bottomPadding + 'px;" '
									+ 'style="min-height: ' + backgroundHeight + 'px;">';
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
		var remainder = lineUnicode.substring(rangeBegin, lineUnicode.length);
		tagString += '<span tagLineId="' + tagLineId + '" spanOffset="' + rangeBegin + '">' + remainder + '</span></div></li>';
		return tagString;
	} else
		return '<li value="' + lineNo + '" class="tag-menu" id="text_' + tagLineId + '" spellcheck="false"' + highlightCurrent + '><div style="min-height: ' + backgroundHeight + 'px;"><span tagLineId="' + tagLineId + '" spanOffset="0">' + lineUnicode + '</span></div></li>';
}

// utils
function contenteditableToArray(lineId, overwriteText) { // converts an editable line with tags as spans line into the original format, i.e. array with the text and custom attribute content. Optionally text content can be given.
	var lineIndex = getIndexFromLineId(lineId);
	var tagStack = []; // 2d array with tags:  [[tag, offset, length], ...]
	$("[tagLineId='" + lineId + "']").each(function () { // spans = tags
		var tag = $(this).attr("tag");
		if (tag)
			tagStack.push([tag, $(this).attr("offset"), $(this).attr("tagLength")]);
	});
	// regexp to preserve the part of custom which isn't tags (just readingorder for now and when/if that changes things will break)
	var custom = String(contentArray[getIndexFromLineId(lineId)][4]).match(/readingOrder {index:\d+;}/);
	for (var j = 0; j < tagStack.length; j++)
		custom += " " + tagStack[j][0] + " {offset:" + tagStack[j][1] + "; length:" + tagStack[j][2] + ";}";
	contentArray[lineIndex][4] = custom;
	if (2 == arguments.length) {
		contentArray[lineIndex][1] = overwriteText;
		//buildLineList(); // TODO Test more! This breaks deletions (and possibly other things) when executed here. Is it necessary in any scenario?
	} else
		contentArray[lineIndex][1] = $("#text_" + lineId).text().replace(/\u200B/g,''); // remove the zero width space!!!
}
function buildLineList() {
	var index;
	if ( $(".transcript-div").is(":visible") && currentLineId !== undefined && correctModal.isOpen()) {
		var currentIdx = getIndexFromLineId(currentLineId);
		var showTo = Math.min(currentIdx + surroundingCount, contentArray.length - 1);
		index = Math.max(1, currentIdx - surroundingCount); // 1 because the first line is not real
		$("#lineList").html("");
		while (index <= showTo)
			$("#lineList").append(getLineLiWithTags(contentArray[index++][0]));
		highlightLineList();
		updateDialogSize();
	}
	if ( $(".interface-lbl").is(":visible") ) {
		index = 1
		while (index <= contentArray.length - 1) {
			$("#line_" + contentArray[index][0]).html(getLineLiWithTags(contentArray[index][0]));
			index++;
		}
	}
	if ( $(".interface-sbs").is(":visible") ) {
		console.log("interface sbs");
		if ($("#your").is(":visible"))
			for (index = 1; index <= contentArray.length - 1; index++)
				$("#yourVersion").append(getLineLiWithTags(contentArray[index][0]));
		if ($("#original").is(":visible"))
			for (index = 1; index <= contentArray.length - 1; index++)
				$("#originalVersion").append(getLineLiWithTags(contentArray[index][0]));
	}
	if ( $(".interface-t").is(":visible") ) {
		index = 1
		$("#text").html("");
		while (index <= contentArray.length - 1) {
			$("#text").append(getLineLiWithTags(contentArray[index][0]));
			index++;
		}
	}
	restoreSelection();
}

// UX actions
function resizeText(delta) {
	var newFontSize = contentLineFontSize + delta;
	if (newFontSize < 14 || newFontSize > 40)
		return;
	contentLineFontSize = newFontSize;
	$('.line-list').css("font-size", contentLineFontSize+ 'px');
	buildLineList();
}
function typewriterMove(newLineId, caretLineId) {
	if (newLineId != null && selectionData !== undefined && selectionData[0] !== undefined ) {
		if (null === caretOffsetInPixels) { // if we don't have a stored offset in pixels, we calculate it, otherwise we use it
			// get the relative caret offset in pixels...
			var selection = window.getSelection();
			if ( selection.anchorNode === null || selection.anchorNode.parentNode === null )
				return;
			var parentElement = selection.anchorNode.parentElement;
			var hiddenCopy = $(parentElement).clone();
			$(hiddenCopy).text($(hiddenCopy).text().substr(0, selection.anchorOffset));
			$(hiddenCopy).appendTo(parentElement);
			caretOffsetInPixels = parentElement.offsetLeft + $(hiddenCopy).outerWidth();
			$(hiddenCopy).remove();
		}
		saveCaretPixelOffset = true; // set this since if the very first user action after this is also a "typewriter step" we will use the same offset
		// TODO Move the caret down even when we cannot make the lines move anymore?
		// TODO Remove this if our users approve of the new behaviour.
		//typewriterStep(newLineId, (contentArray[Math.min(getIndexFromLineId(newLineId), contentArray.length - 1)][2][5]) - Math.round(contentArray[Math.min(getIndexFromLineId(currentLineId), contentArray.length - 1)][2][5]));
		updateDialog(newLineId);
		updateCanvas();
		// get the closest span offset on the new line
		var span, spanOffset;
		$("[tagLineId=" + caretLineId + "]").each(function() {
			if (this.offsetLeft < caretOffsetInPixels) {
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
			if ((cB + cA) / 2 > (caretOffsetInPixels - spanOffset)) // we want the offset which is closest to this
				break;
			cA = cB;
		}
		var caretOffset = Math.min(t - 1 + parseInt($(span).attr("spanOffset")), contentArray[getIndexFromLineId(caretLineId)][1].length);
		selectionData = [[caretLineId, caretOffset, caretOffset]];
		restoreSelection();
	}
}
function typewriterNext() { // Aka. "press typewriter enter scroll". Changes the selected lines and the modal content.
	typewriterMove(getNextLineId(currentLineId), getNextLineId(selectionData[0][0])); // the caret will "remain in place" and the lines shifted around it
}
function typewriterPrevious() {
	$("#options_" + currentLineId).hide();
	typewriterMove(getPreviousLineId(currentLineId), getPreviousLineId(selectionData[0][0])); // the caret will "remain in place" and the lines shifted around it
	/* TODO Remove this old stuff when the new behaviour is ok.
	if (newLineId != null)
		typewriterStep(newLineId, Math.round(contentArray[Math.min(getIndexFromLineId(newLineId), contentArray.length - 1)][2][5]) - Math.round(contentArray[Math.min(getIndexFromLineId(currentLineId), contentArray.length - 1)][2][5]));
	*/
}
function typewriterStep(newLineId, delta) { // TODO Remove this function unless the line by line interface still needs it. If our users prefer the new image moving behaviour, this is redundant.
	accumExtraY += delta * initialScale * zoomFactor;
	$( ".transcript-map-div" ).css("transform",  "translate(" + -accumExtraX +"px, " + -accumExtraY+ "px) scale(" + zoomFactor + ")");// Note, the CSS is set to "transform-origin: 0px 0px"
	currentLineId = newLineId;
	updateCanvas();
	buildLineList();

	// Line by line interface
	$("#line_" + newLineId).focus();
	var prev = getPreviousLineId(newLineId);
	if ( prev )
		$("#options_" + prev).hide();
}
function setMessage(message, type) {
	type = type || "warning";
	$("#message").removeClass("btn-muted btn-primary btn-success btn-info btn-warning btn-danger");
	$("#message").html(message);
	$("#message").addClass("btn-" + type);
	$("#message").show();
}
