function setMessage(message) {
	$("#message").html(message);
}
function getRelativeCursorPosition(node) { // Get the cursor position relative to the <DIV>. Regardless of <SPAN> tags.
	var selection = window.getSelection();
	var anchorNode =  selection.anchorNode;
	var offset = selection.anchorOffset;
	var childNode = node.firstChild;
	if (childNode.isSameNode(anchorNode)) // Is the offset relative to the <DIV>?
		return offset;
	while (!anchorNode.isSameNode(childNode.firstChild)) { // The child node was not the <DIV> so we start from the first <SPAN> within the <DIV>.
		offset += childNode.textContent.length;
		childNode = childNode.nextSibling;
	}
	return offset;
}

$( ".editable-line" ).on('keyup', function(e) {// TODO Add other events?
	var cursorPosition = getRelativeCursorPosition(e.target);
	var initialOffset = window.getSelection().getRangeAt(0).startOffset;
	
	// Generate string with changes highlighted:
	var editedString = "";	
	var diff = JsDiff.diffWordsWithSpace(lines[e.target.id], $("#" + e.target.id).text());
	diff.forEach(function(part){
		var color = '<SPAN style="color: black;">';
		if (part.added)
			color = '<SPAN style="color: green;">';
		if (!part.removed) {
			editedString += color;
			editedString += part.value;
			editedString += '</SPAN>';
		}
	});
	
	$("#" + e.target.id).html(editedString);
	changedLines[e.target.id] = $(editedString).text();
	
	var sel = window.getSelection();
	var anchorNode = sel.anchorNode;
	var startOffset = sel.getRangeAt(0).startOffset;
	var range = document.createRange();
	var countNode = e.target.firstChild;
	var charCount = countNode.textContent.length;
	var previousNode = countNode;
	var previousCharCount = 0;
	
	while (charCount <= cursorPosition) {
		if (null == countNode.nextSibling)
			break;
		previousNode = countNode;
		previousCharCount = charCount;
		countNode = countNode.nextSibling;
		charCount += countNode.textContent.length;
	}
	
	range.setStart(countNode.firstChild, cursorPosition - previousCharCount);
	range.setEnd(countNode.firstChild, cursorPosition - previousCharCount);
	//TODO Make sure that this indeed is redundant: range.collapse(true);
	sel.removeAllRanges();
	sel.addRange(range);
});
