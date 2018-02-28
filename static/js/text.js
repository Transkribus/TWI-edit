var UNDO_ARRAY_MAX_LENGTH = 10;
var undoArray = [];
var ctrlKey = false, metaKey = false, altKey = false;
var caretOffsetInPixels = null;
var savedCaretOffsetInPixels = null;
var oldWidthForCaretCalc;
var selectionData = [];
var contentLineFontSize = parseInt($('.line-list').css("font-size"));
var message_timeout;
// these vars must be initialized when importing this JavaScript
// surroundingCount, currentLineId, view, changed
// these JavaScripts must also be imported
// TODO Check which.
// TODO Optimize by removing some unnecessary calls to getIndexFromLineId...

function keydown(e) {
	if (ctrlMeta) { // are we getting a keyboard shortcut?
		if (e.key == "z" || e.key == "Z") // if it's undo we have to handle it but otherwise we let the browser handle it
			undoAction();
		return;
	}
	if (e.key.length > 1) {
		if (e.ctrlKey || e.metaKey || e.altKey)
			ctrlMeta = true;
		e.preventDefault();
		editAction(e);
	} 	else if (checkForComposite) {
		$("#capture").focus(); // we want composite characters to go here since we can't get them from the key
	} else {
		e.preventDefault();
		inputChar(e.key);
	}
}
function keyup(e) {
	if (e.key === "Control" || e.key === "Alt" || e.key === "Meta") // TODO Multiple meta keys at the same time will cause problems. Also note that "Meta" has NOT BEEN TESTED.
		ctrlMeta = false;
	if (e.key === "Dead") // we get ready to use the hidden from view input to get composite characters
		checkForComposite = true;
}

function initializeCaretOffsetInPixels() {
	var selection = window.getSelection();
	if ( selection.anchorNode === null || selection.anchorNode.parentNode === null )
		return;
	var parentElement = selection.anchorNode.parentElement;
	var hiddenCopy = $(parentElement).clone();
	oldWidthForCaretCalc = $(parentElement).outerWidth();
	$(hiddenCopy).text($(hiddenCopy).text().substr(0, selection.anchorOffset));
	$(hiddenCopy).appendTo(parentElement);
	caretOffsetInPixels = parentElement.offsetLeft + $(hiddenCopy).outerWidth();
	$(hiddenCopy).remove();
}
function mouseup(e) {
	updateSelectionData();
	initializeCaretOffsetInPixels() ;
}
function drop(e) {
	// Nobody needs to do this and this breaks things.
	e.preventDefault();
}
function cut(event) {
	console.log("calling cut");
	// TODO This! Maybe with zeroclipboard?
	eraseSelected();
}
function paste(event) {
	var text = event.originalEvent.clipboardData.getData('text');
	if (null === text || text.length == 0 || selectionData === undefined || selectionData[0] === undefined ) // is it necessary to check selectionData?
		return; // TODO Place the caret at the end of the current line in this situation!?
	if ( !changed )
		setMessage(transUnsavedChanges);
	changed = true;
	$("a[data-target='#saveChanges']").removeClass("disabled");
	if (selectionData.length > 1 || (selectionData[0][1] != selectionData[0][2])) // do we have to erase a selection first?
		eraseSelected();
	text = text.replace(" ", "\u00A0");
	var lineIndex = getIndexFromLineId(selectionData[0][0])
	var charOffset;
	if (contentArray[lineIndex][1].length ==  selectionData[0][1]) { // we only attempt a multi-line paste, if we can do it to the end of the line and we ignore tags in that case
		var textArray = text.split("\n");
		for (var i = 0; i < textArray.length; i++) {
			pushToUndoArray(contentArray[lineIndex].slice());
			contentArray[lineIndex][1] += textArray[i];
			if (++lineIndex >= contentArray.length || contentArray[lineIndex][1] != "") {
				lineIndex--;
				while (i < textArray.length) {
					contentArray[lineIndex][1] += textArray[i];
					i++;
				}
				charOffset = contentArray[lineIndex][1].length;
			}
		}
	} else {
		pushToUndoArray(contentArray[lineIndex].slice());
		text = text.replace("\n", "\u00A0");
		// update tags
		var customString = contentArray[lineIndex][4] + ' ';
		var custom = customString.replace(/\s+/g, '').split('}');
		var newCustom = customString.match(/readingOrder {index:\d+;}/);
		var contentDelta = text.length;
		contentArray[lineIndex][4] = newCustom;
		if ("None" != custom) {
			custom.forEach(function(attribute) {
				attribute = attribute.split('{');
				if ("" != attribute && "readingOrder" != attribute[0] && attribute[1].indexOf("offset:") != -1 && attribute[1].indexOf(";length:") != -1) { // we have no use for readingOrder for now...
					var split = attribute[1].split("offset:")[1].split(";length:");
					var tagOffset = parseInt(split[0]);
					var tagLength = parseInt(split[1]); // parseInt doesn't care about what comes after the first int (but we do and hence append it below to preserve whatever it is)
					if (selectionData[0][1] <= tagOffset) { // this tag is after the pasted input
						contentArray[lineIndex][4] += ' ' + attribute[0] + ' ' + '{offset: ' + (tagOffset + contentDelta) + ';length: ' + tagLength + split[1].substring(split[1].indexOf(";")) + '}';
					} else if (selectionData[0][1] < (tagOffset + tagLength)) { // the input is within this tag
						contentArray[lineIndex][4] += ' ' + attribute[0] + ' ' + '{offset: ' + tagOffset + ';length: ' + (tagLength + contentDelta) + split[1].substring(split[1].indexOf(";")) + '}';
					} else { // tags before the edit
						contentArray[lineIndex][4] += ' ' + attribute[0] + ' ' + ' {offset: ' + tagOffset + ';length: ' + tagLength + split[1].substring(split[1].indexOf(";")) + '}';
					}
				}
			});
		}
		var lineUnicode = contentArray[lineIndex][1];
		contentArray[lineIndex][1] = lineUnicode.substring(0, selectionData[0][1]) + text + lineUnicode.substring(selectionData[0][1]);
		charOffset = selectionData[0][1] + text.length;
	}
	selectionData = [[contentArray[lineIndex][0], charOffset, charOffset]];
	buildLineList();
}
function inputChar(char) {
	if ( selectionData === undefined || selectionData[0] === undefined )
		return; // TODO Place the caret at the end of the current line in this situation!?
	if ( !changed )
		setMessage(transUnsavedChanges);
	changed = true;
	$("a[data-target='#saveChanges']").removeClass("disabled");
	var renderAll = false; // TODO Remove this flag and duplicate lots of code?
	if (selectionData.length > 1) {// do we have to erase a selection first?
		eraseSelected();
		renderAll = true;
	} else if (selectionData[0][1] != selectionData[0][2])
		eraseSelected();
	if (" " === char)
		char = "\u00A0";
	// update tags
	var editedLineId = selectionData[0][0];
	var charOffset = selectionData[0][1];
	var lineIndex = getIndexFromLineId(editedLineId);
	var customString = contentArray[lineIndex][4] + ' ';
	var custom = customString.replace(/\s+/g, '').split('}');
	var newCustom = customString.match(/readingOrder {index:\d+;}/);
	pushToUndoArray(contentArray[lineIndex].slice());
	contentArray[lineIndex][4] = newCustom;
	if ("None" != custom) {
		custom.forEach(function(attribute) {
			attribute = attribute.split('{');
			if ("" != attribute && "readingOrder" != attribute[0] && attribute[1].indexOf("offset:") != -1 && attribute[1].indexOf(";length:") != -1) { // we have no use for readingOrder for now...
				var split = attribute[1].split("offset:")[1].split(";length:");
				var tagOffset = parseInt(split[0]);
				var tagLength = parseInt(split[1]); // parseInt doesn't care about what comes after the first int (but we do and hence append it below to preserve whatever it is)
				if (charOffset <= tagOffset) { // this tag is after the character input
					contentArray[lineIndex][4] += ' ' + attribute[0] + ' ' + '{offset: ' + (tagOffset + 1) + ';length: ' + tagLength + split[1].substring(split[1].indexOf(";")) + '}';
				} else if (charOffset < (tagOffset + tagLength)) { // the input is within this tag
					contentArray[lineIndex][4] += ' ' + attribute[0] + ' ' + '{offset: ' + tagOffset + ';length: ' + (tagLength + 1) + split[1].substring(split[1].indexOf(";")) + '}';
				} else { // tags before the edit
					contentArray[lineIndex][4] += ' ' + attribute[0] + ' ' + ' {offset: ' + tagOffset + ';length: ' + tagLength + split[1].substring(split[1].indexOf(";")) + '}';
				}
			}
		});
	}
	// update text
	var lineUnicode = contentArray[lineIndex][1];
	contentArray[lineIndex][1] = lineUnicode.substring(0, charOffset) + char + lineUnicode.substring(charOffset);
	selectionData = [[editedLineId, ++charOffset, charOffset]];
	if (renderAll)
		buildLineList();
	else
		updateLine(editedLineId);
}
function eraseFrom(lineIndex, startOffset, endOffset) {
	var contentDelta = startOffset - endOffset;
	var customString = contentArray[lineIndex][4] + ' ';
	var custom = customString.replace(/\s+/g, '').split('}');
	contentArray[lineIndex][4] = customString.match(/readingOrder {index:\d+;}/);
	pushToUndoArray(contentArray[lineIndex].slice());
	if ("None" != custom) {
		custom.forEach(function(attribute) {
			attribute = attribute.split('{');
			if ("" != attribute && "readingOrder" != attribute[0] && attribute[1].indexOf("offset:") != -1 && attribute[1].indexOf(";length:") != -1) { // we have no use for readingOrder for now...
				var split = attribute[1].split("offset:")[1].split(";length:");
				var tagOffset = parseInt(split[0]);
				var tagLength = parseInt(split[1]); // parseInt doesn't care about what comes after the first int (but we do and hence append it below to preserve whatever it is)
				if (endOffset <= tagOffset) { // tags after the edit
					contentArray[lineIndex][4] += ' ' + attribute[0] + ' ' + ' {offset: ' + (tagOffset + contentDelta) + ';length: ' + tagLength + split[1].substring(split[1].indexOf(";")) + '}';
				} else if (tagOffset > startOffset && (tagOffset + tagLength) > endOffset) {
					contentArray[lineIndex][4] += ' ' + attribute[0] + ' ' + ' {offset: ' + startOffset + ';length: ' + (tagLength - endOffset + tagOffset) + split[1].substring(split[1].indexOf(";")) + '}';
				} else if ((tagOffset + tagLength) > startOffset) {
					var tL = Math.max(tagLength + contentDelta, startOffset - tagOffset);
					if (tL > 0) // part of the tag is still left?
						contentArray[lineIndex][4] += ' ' + attribute[0] + ' ' + ' {offset: ' + tagOffset + ';length: ' + Math.max(tagLength + contentDelta, startOffset - tagOffset) + split[1].substring(split[1].indexOf(";")) + '}';
				} else { // tags before the edit
					contentArray[lineIndex][4] += ' ' + attribute[0] + ' ' + ' {offset: ' + tagOffset + ';length: ' + tagLength + split[1].substring(split[1].indexOf(";")) + '}';
				}
			}
		});
	}
	// update text
	var lineUnicode = contentArray[lineIndex][1];
	contentArray[lineIndex][1] = lineUnicode.substring(0, startOffset) + lineUnicode.substring(endOffset);
}
function eraseSelected() {
	var sdLength = selectionData.length;
	var lineIndex = getIndexFromLineId(selectionData[0][0]);
	if (sdLength == 1) {
		eraseFrom(lineIndex, selectionData[0][1], selectionData[0][2]);
	} else {
		eraseFrom(lineIndex, selectionData[0][1], contentArray[lineIndex][1].length);
		sdLength--;
		for (var i = 1; i < sdLength; i++) {
			lineIndex = getIndexFromLineId(selectionData[i][0]);
			eraseFrom(lineIndex, selectionData[i][1], contentArray[lineIndex][1].length);
		}
		lineIndex = getIndexFromLineId(selectionData[sdLength][0]);
		eraseFrom(lineIndex, 0, selectionData[sdLength][2]);
	}
	selectionData = [[selectionData[0][0], selectionData[0][1], selectionData[0][1]]];
}
function editAction(event) {
	if ( selectionData == undefined || selectionData[0] === undefined )
		return;
	if (event.keyCode == 8) { // backspace?
		if (selectionData.length == 1 && (selectionData[0][1] == selectionData[0][2])) // just a caret, no selection?
			selectionData[0] = [selectionData[0][0], Math.max(0, selectionData[0][1] - 1), selectionData[0][2]]; // select the preceding character, if any
		eraseSelected();
		buildLineList();
		initializeCaretOffsetInPixels();
		//RM If we press backspace then we should assume that there has been a achange to the transcript
		// (these globals must go)
		if ( !changed )
			setMessage(transUnsavedChanges);
		changed = true;
		$("a[data-target='#saveChanges']").removeClass("disabled");
	} else if (event.keyCode == 46) { // delete?
		if (selectionData.length == 1 && (selectionData[0][1] == selectionData[0][2])) // just a caret, no selection?
			selectionData[0] = [selectionData[0][0], selectionData[0][1], Math.min(selectionData[0][2] + 1, contentArray[getIndexFromLineId(selectionData[0][0])][1].length)]; // select the next character, if any
		eraseSelected();
		buildLineList();
		initializeCaretOffsetInPixels();
		//RM If we press delete then we should assume that there has been a achange to the transcript
		// (these globals must go)
		if ( !changed )
			setMessage(transUnsavedChanges);
		changed = true;
		$("a[data-target='#saveChanges']").removeClass("disabled");
	} else if (event.key == "ArrowUp" && ("i" === ifc  || "lbl" === ifc || "t" === ifc)) {
		// TODO Move caret instead, if there's a line visible?
		typewriterPrevious();
	} else if ((event.key == "ArrowDown" || event.key == "Enter") && ("i" === ifc || "lbl" === ifc || "t" === ifc)) {
		// TODO Move caret instead, if there's a line visible?
		typewriterNext();
	} else if (event.key == "Home") {// In some cases the "parent" is the LI which doesn't yield the right offset in updateSelection
		selectionData = [[selectionData[0][0], 0, 0]];
		savedCaretOffsetInPixels = null;
		restoreSelection();
		initializeCaretOffsetInPixels();
	} else if (event.key == "End") { // same thing
		var lineLength = contentArray[getIndexFromLineId(selectionData[0][0])][1].length;
		selectionData = [[selectionData[0][0], lineLength, lineLength]];
		savedCaretOffsetInPixels = null;
		restoreSelection();
		initializeCaretOffsetInPixels();
	} else if (event.key == "ArrowLeft"){
		var newIndex = Math.max(selectionData[0][1] - 1, 0);
		selectionData = [[selectionData[0][0], newIndex, newIndex]];
		savedCaretOffsetInPixels = null;
		restoreSelection();
		initializeCaretOffsetInPixels();
	} else if (event.key == "ArrowRight"){
		var newIndex = Math.min(selectionData[0][1] + 1, contentArray[getIndexFromLineId(selectionData[0][0])][1].length);
		selectionData = [[selectionData[0][0], newIndex, newIndex]];
		savedCaretOffsetInPixels = null;
		restoreSelection();
		initializeCaretOffsetInPixels();
	}
}
function pushToUndoArray(contentArraySlice) {
	if (undoArray.length > UNDO_ARRAY_MAX_LENGTH)
		undoArray.shift();
	undoArray.push([contentArraySlice, selectionData[0][1]]);
}
function undoAction() {
	// TODO Remove unsaved changes notification, if applicable?
	var restore = undoArray.pop();
	if (restore != undefined) {
		var lineId = restore[0][0];
		contentArray[getIndexFromLineId(lineId)] = restore[0];
		setSelectionData(lineId, restore[1]);
		buildLineList();
	}
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
	$("[tagLineId='" + selectionData[0][0] + "']:visible").each(function () { // line where the selection begins
		if ($(this).attr("spanoffset") > begCharCount)
			return false; // bElement now = the span before the intended caret position
		bElement = $(this);
	});
	$("[tagLineId='" + selectionData[selectionData.length - 1][0] + "']:visible").each(function () { // line where the selection ends
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
function getLineLiWithTags(tagLineIndex, idPrefix) { // generates a line with spans matching the tags and generates and applies the relevant CSS/SVG to show them,  idPrefix is an optional prefix added to each the ID of each LI, defaults to "text" for compatibility reasons
	var prefix = "text";
	var tagLineId = contentArray[tagLineIndex][0];
	if (arguments.length == 2)
		prefix = idPrefix;
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
		return '<li value="' + lineNo + '" id="' + prefix + '_' + tagLineId + '" spellcheck="false"' + highlightCurrent + '><div style="min-height: ' + backgroundHeight + 'px;" tagLineId="' + tagLineId + '"><span tagLineId="' + tagLineId + '" spanOffset="-1">&#8203;</span></div></li>'; // spanOffset -1 ensures that &#8203; is ignored when new text is entered
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
				svgRectsJSON += '"' + gfxTag + '":' + "\"<rect x=\\\\'0\\\\' y=\\\\'" + lineY + "\\\\' width=\\\\'" + initialWidth + "\\\\' height=\\\\'" + lineThickness + "\\\\' style=\\\\'fill: %23" + tagColors[gfxTag] + ";\\\\' />\""; // # must be %23 and yes \\\\ [sic!]
				lineY +=thicknessAndSpacing;
				svgRectsJSON += ',';
			}
		});
		if (gapTag) // insert the "gap" tag, if necessary. This also ensures that we don't have a comma in the end before conversion...
			svgRectsJSON += '"gap":' + "\"<line x1=\\\\'0\\\\' y1=\\\\'0\\\\' x2=\\\\'0\\\\' y2=\\\\'" + lineY + "\\\\' style=\\\\'stroke-width: " + lineThickness + "; stroke: %23" +  (tagColors["gap"]) + ";\\\\' />\""; // # must be %23 and yes \\\\ [sic!]
		else
			svgRectsJSON = svgRectsJSON.substring(0, svgRectsJSON.length - 1); // remove the comma in the end
		svgRectsJSON = JSON.parse("{" +svgRectsJSON + "}");
		// more graphics variables
		var bottomPadding = (1 + (tagGfxStack.length - nonHeightTags)) * thicknessAndSpacing; // nonHeightTags must be subtracted from the count since it shouldn't affect the height
		var backgroundHeight = lineY + bottomPadding;
		// generate lines with spans showing the tags...
		var tagStack = [];
		var tagString = '<li value="' + lineNo + '" spanOffset="0" class="tag-menu ' + (window.location.href.indexOf("view") >= 0 ? 'context-menu-disabled' : '') + '" id="' + prefix + '_' + tagLineId + '" spellcheck="false"' + highlightCurrent
									+ '><div style="padding-bottom: ' + bottomPadding + 'px; ' + 'min-height: ' + backgroundHeight + 'px;" tagLineId="' + tagLineId + '">';
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
		return '<li value="' + lineNo + '" class="tag-menu ' + (window.location.href.indexOf("view") >= 0 ? 'context-menu-disabled' : '') + '" id="' + prefix + '_' + tagLineId + '" spellcheck="false"' + highlightCurrent + '><div style="min-height: ' + backgroundHeight + 'px;" tagLineId="' + tagLineId + '"><span tagLineId="' + tagLineId + '" spanOffset="0">' + lineUnicode + '</span></div></li>';
}

// utils
function contenteditableToArray(lineId, overwriteText) { // converts an editable line with tags as spans line into the original format, i.e. array with the text and custom attribute content. Optionally text content can be given.
	var lineIndex = getIndexFromLineId(lineId);
	var tagStack = []; // 2d array with tags:  [[tag, offset, length], ...]
	$("[tagLineId='" + lineId + "']:visible").each(function () { // spans = tags
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
function updateLine(updatedLineId) { // TODO  Make this faster by skipping the if below?
	if ( $(".transcript-div").is(":visible") && currentLineId !== undefined && correctModal.isOpen()) { // TODO A better test? This works but sbs below also has transcript-div :visible...
		$("#text_" + updatedLineId).html(getLineLiWithTags(getIndexFromLineId(updatedLineId)));
		updateDialogSize();
	}
	if ( $(".interface-lbl").is(":visible") )
		$("#line_" + updatedLineId).html(getLineLiWithTags(getIndexFromLineId(updatedLineId)));
	restoreSelection();
}
function buildLineList() {
	console.log("building line list!");
	var index;
	if ( $(".transcript-div").is(":visible") && currentLineId !== undefined && correctModal.isOpen()) { // TODO A better test? This works but sbs below also has transcript-div :visible...
		var currentIdx = getIndexFromLineId(currentLineId);
		var showTo = Math.min(currentIdx + surroundingCount, contentArray.length - 1);
		index = Math.max(1, currentIdx - surroundingCount); // 1 because the first line is not real
		$("#lineList").html("");
		while (index <= showTo)
			$("#lineList").append(getLineLiWithTags(index++));
		highlightLineList();
		updateDialogSize();
	}
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
	initializeCaretOffsetInPixels();
	if (newLineId != null && selectionData !== undefined && selectionData[0] !== undefined ) {
		if (null === savedCaretOffsetInPixels)
			savedCaretOffsetInPixels = caretOffsetInPixels;
		// TODO Move the caret down even when we cannot make the lines move anymore?
		if ( ifc === "i" )
		    updateDialog(newLineId);
		updateCanvas();
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
		if ( contentArray[getIndexFromLineId(caretLineId)] !== undefined ) {
			var cLength = contentArray[getIndexFromLineId(caretLineId)][1].length;
			if (null == cLength)
				cLength = 0;
			var caretOffset = Math.min(t - 1 + parseInt($(span).attr("spanOffset")), cLength);
		}
		else
			caretOffset = 0;
		selectionData = [[caretLineId, caretOffset, caretOffset]];
		currentLineId = newLineId;
		restoreSelection();
		if ( ifc === "lbl" ) {
			buildLineList();
			updateCanvas();
			console.log($("div[lineId='" + currentLineId + "']").offset().top);
			$("html, body").animate({
			    scrollTop: ($("div[lineId='" + currentLineId + "']").offset().top - 100)
			}, 500);
		}
	}
}
function typewriterNext() { // Aka. "press typewriter enter scroll". Changes the selected lines and the modal content.
	typewriterMove(getNextLineId(currentLineId), getNextLineId(selectionData[0][0])); // the caret will "remain in place" and the lines shifted around it
}
function typewriterPrevious() {
	typewriterMove(getPreviousLineId(currentLineId), getPreviousLineId(selectionData[0][0])); // the caret will "remain in place" and the lines shifted around it
}
function setMessage(message, type, timeout) {
	if(timeout==undefined) timeout = true;
	clearTimeout(message_timeout);
	type = type || "warning";
	$("#message").removeClass("btn-muted btn-primary btn-success btn-info btn-warning btn-danger");
	$("#message").html(message);
	$("#message").addClass("btn-" + type);
	$("#message").show();
	if ( timeout )
		message_timeout = setTimeout(function() {
			$("#message").html("");
			$("#message").hide();
		}, 5000);
}
