function refreshOriginalVersion() {
	$("#originalVersion").html("");
	for (var index = 1; index <= contentArray.length - 1; index++)
		$("#originalVersion").append(getLineLiWithTags(index, "orig"));
}
function refreshYourVersion() { // call to highlight changes made to the original (regardless of which view they were made in)
	$("#yourVersion").html("");
	$(".original-line-list").children().each(function () {
		var lineId = $(this).attr("id").substr(5);
		var diff = JsDiff.diffWordsWithSpace($(this).text(), contentArray[getIndexFromLineId(lineId)][1]);
		var totChars = 0;
		diff.forEach(function(part){ // convert the diff into "changeFromOriginal" tags for rendering
			var length = part.value.length;
			if (part.added) {
				applyTagTo("changeFromOriginal", lineId, totChars, totChars + length);
			}
			if (!part.removed)
				totChars += length;
		});
	});
	buildLineList();
	removeTag("changeFromOriginal", true);
}
