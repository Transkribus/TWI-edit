var tagItems, tagColors;
// these vars must be initialized when using this JavaScript
// selectionData, changed
// these JavaScripts must also be imported
// TODO List

function tagMenu() { // returns the tag list with tags in the selection highlighted, if any
	var appliedTags = {}; // an array to be populated with all tags within the selection, may contain duplicates
	var lastButOne = selectionData.length - 1;
	var lineIndex = getIndexFromLineId(selectionData[0][0]);
	var tagsOnLine = getSortedCustomTagArray(lineIndex);
	var selStart = selectionData[0][1];
	var selEnd;
	if (selectionData.length == 1)
		selEnd = selectionData[0][2];
	else
		selEnd = contentArray[lineIndex][1].length;
	for (var i = 0; i < tagsOnLine.length; i++) {
		var tagOffset = tagsOnLine[i].offset;
		if ((tagOffset <= selStart && selStart < (tagOffset + tagsOnLine[i].length)) || (selStart < tagOffset && tagOffset <= selEnd)) {
			var tag = tagsOnLine[i].tag;
			if ( tag !== "bold" && tag !== "italic" && tag !== "strikethrough" && tag !== "underlined" && tag !== "subscript" && tag !== "superscript" )
				appliedTags[tag] = {"name": "<span style=\"color: #" + tagColors[tag] + ";\">" + tag + "</span>", "type": "checkbox", "isHtmlName": true, "selected": true};
		}
	}
	var j = 1;
	while (j < lastButOne) {
		lineIndex++; // we don't check if this goes out of bounds since such a selection shouldn't be possible...
		tagsOnLine = getSortedCustomTagArray(lineIndex);
		for (var k = 0; k < tagsOnLine.length; k++) {
			var tag = tagsOnLine[k].tag;
			if ( tag !== "bold" && tag !== "italic" && tag !== "strikethrough" && tag !== "underlined" && tag !== "subscript" && tag !== "superscript" )
				appliedTags[tag] = {"name": "<span style=\"color: #" + tagColors[tag] + ";\">" + tag + "</span>", "type": "checkbox", "isHtmlName": true, "selected": true}; // the selection covers all tags on this line
		}
		j++;
	}
	if (selectionData.length > 1) {
		lineIndex++;
		tagsOnLine = getSortedCustomTagArray(lineIndex);
		selEnd = selectionData[j][2];
		selStart = 0;
		for (var i = 0; i < tagsOnLine.length; i++) {
			if (tagsOnLine[i].offset < selEnd) {
				var tag = tagsOnLine[i].tag;
				if ( tag !== "bold" && tag !== "italic" && tag !== "strikethrough" && tag !== "underlined" && tag !== "subscript" && tag !== "superscript" )
					appliedTags[tag] = {"name": "<span style=\"color: #" + tagColors[tag] + ";\">" + tag + "</span>", "type": "checkbox", "isHtmlName": true, "selected": true};
			}
		}
	}
	return {"items": $.extend({}, tagItems, appliedTags)};
}
function toggleTag(toggleTag) { // sets/removes the tag depending on whether the selection already has it
	if (!removeTag(toggleTag)) // if the tag can be removed, we do that...
		applyTag(toggleTag);// ...but otherwise we apply it
	if (!changed)
		setMessage(transUnsavedChanges, 'warning', false);
	changed = true;
	$("a[data-target='#saveChanges']").removeClass("disabled");
}
function removeTag(removeTag, everywhere) { // Removes the given tag from the selection and everywhere, if the second parameter is true. Returns true if removals were made, otherwise false.
	var tag = removeTag;
	var removals = false;
	if ( removeTag === "bold" || removeTag === "italic" || removeTag === "strikethrough" || removeTag === "underlined" || removeTag === "subscript" || removeTag === "superscript" )
		tag = "textStyle";
	if (2 == arguments.length && everywhere) {
		for (var k = 1; k < contentArray.length; k++)
			contentArray[k][4] = String(contentArray[k][4]).replace(new RegExp("\\s" + tag + "[^}]*}", "g"), "");
		return; // TODO Return true/false depending on result? Not needed at the moment but technically this is a bug.
	}
	var lastButOne = selectionData.length - 1;
	var lineIndex = getIndexFromLineId(selectionData[0][0]);
	var tagsOnLine = getSortedCustomTagArray(lineIndex, removeTag);
	var selStart = selectionData[0][1];
	var selEnd;
	if (selectionData.length == 1)
		selEnd = selectionData[0][2];
	else
		selEnd = contentArray[lineIndex][1].length;
	for (var i = 0; i < tagsOnLine.length; i++) {
		var tagOffset = tagsOnLine[i].offset;
		if ((tagOffset <= selStart && selStart < (tagOffset + tagsOnLine[i].length)) || (selStart < tagOffset && tagOffset <= selEnd)) {
			removals = true;
			contentArray[lineIndex][4] = String(contentArray[lineIndex][4]).replace(new RegExp("\\s" + tag + "\\s+{offset:" + tagOffset + ";[^}]*}"), "");
		}
	}
	var j = 1;
	while (j < lastButOne) {
		lineIndex++; // we don't check if this goes out of bounds since such a selection shouldn't be possible...
		if (getSortedCustomTagArray(lineIndex, removeTag).length > 0) {
			removals = true;
			contentArray[lineIndex][4] = String(contentArray[lineIndex][4]).replace(new RegExp("\\s" + tag + "[^}]*}"), "");
		}
		j++;
	}
	if (selectionData.length > 1) {
		lineIndex++;
		tagsOnLine = getSortedCustomTagArray(lineIndex, removeTag);
		selEnd = selectionData[j][2];
		selStart = 0;
		for (var i = 0; i < tagsOnLine.length; i++) {
			var tagOffset = tagsOnLine[i].offset;
			if (tagOffset < selEnd) {
				removals = true;
				contentArray[lineIndex][4] = String(contentArray[lineIndex][4]).replace(new RegExp("\\s" + tag + "\\s+{offset:" + tagOffset + ";[^}]*}"), "");
			}
		}
	}
	buildLineList();
	return removals;
}
function applyTagTo(applyTag, lineId, start, end, continued) { // applies the tag from start to end on the line the index of which is given, adds "continued:true", if given and true
	var lineIndex = getIndexFromLineId(lineId);
	var customTagArray = getSortedCustomTagArray(lineIndex);
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
			if ( tag === "bold" || tag === "italic" || tag === "strikethrough" || tag === "underlined" || tag === "subscript" || tag === "superscript" ) {
				textStyle = ";" + tag + ":true";
				tag = "textStyle";
			}
			custom += " " + tag + " {offset:" + customTagArray[j].offset + "; length:" + length + textStyle + ";";
			if (isContinued)
				custom += " continued:true;";
			custom += "}";
		}
	}
	contentArray[lineIndex][4] = custom;
}
function applyTag(applyTag) {
	if ( selectionData === undefined || selectionData[0] === undefined )
		return;
	// use selectionData to apply the tag
	if ("gap" == applyTag) // this tag is an exception
		applyTagTo(applyTag, selectionData[0][0], selectionData[0][1], selectionData[0][1] + 1);
	else if (selectionData.length == 1) {
		if (selectionData[0][1] != selectionData[0][2]) // beginning and end must be different
			applyTagTo(applyTag, selectionData[0][0], selectionData[0][1], selectionData[0][2]);
	} else {
		var lastButOne = selectionData.length - 1;
		var i = 0;
		while (i < lastButOne)
			applyTagTo(applyTag, selectionData[i][0], selectionData[i][1], selectionData[i++][2], true);
		applyTagTo(applyTag, selectionData[i][0], selectionData[i][1], selectionData[i][2]); // this tag is not continued on the next line
	}
	buildLineList();
}
function getSortedCustomTagArray(tagLineIndex, filterTag) { // returns an array with Transkribus "custom" tags in the format below, if a filterTag is given, only tags of that type are included
	var filter = false;
	if (2 == arguments.length) {
		filter = filterTag;
	}
	var custom = (contentArray[tagLineIndex][4] + ' ').replace(/\s+/g, '').split('}');
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
function contextMenuOpenable(contextMenuEvent) { // ensures that the caret is also moved when the user clicks the right mouse button unless the tag menu should be opened to set tags to a new selection, sets the contextMenuOk flag
	if ("" != selectionData && (selectionData.length > 1 || (selectionData[0][1] != selectionData[0][2]))) // have we got a non-zero length selection? if so, the user wants to set tags to the selection and we thus don't move the caret
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
			setSelectionData(lineId, parseInt(span.getAttribute("spanOffset")) + pixelsToCharOffset(span, contextMenuEvent.pageX - spanOffset));
			restoreSelection();
			return true;
		} else { // set the caret to the end/beginning of the line for consistent behaviour compared with left clicks
			if (toTheLeft)
				setSelectionData(lineId, 0); // beginning
			else // only remaining possibility if we have a line but no span
				setSelectionData(lineId, contentArray[getIndexFromLineId(lineId)][1].length);
			restoreSelection();
			return false;
		}
    }
	return false;
}
