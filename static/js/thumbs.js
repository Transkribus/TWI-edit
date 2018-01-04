var pageNo, pathWithoutPage;
var THUMBS_TO_SHOW = 10; // "constant" for playing around with the no. of thumbs to show
var thumbCountOffset = 0;
var thumbWidth;
var toLoadCount;

function scrollThumbsLeft() {
	thumbCountOffset += THUMBS_TO_SHOW;
	thumbCountOffset = Math.min(thumbCountOffset, 0);
	$(".thumbs" ).css("transition", "1s");
	$(".thumbs" ).css("transform",  "translateX(" + thumbCountOffset * thumbWidth + "px)");
	updateArrows();
}
function scrollThumbsRight() {
	thumbCountOffset -= THUMBS_TO_SHOW;
	thumbCountOffset = Math.max(thumbCountOffset, -thumbArray.length + THUMBS_TO_SHOW);
	$(".thumbs" ).css("transition", "1s");
	$(".thumbs" ).css("transform",  "translateX(" + thumbCountOffset * thumbWidth + "px)");
	updateArrows();
}
function updateArrows() { // call to show and hide arrows depending on whether they're clickable
	if (0 == thumbCountOffset)
		$("#leftArrow").hide();
	else
		$("#leftArrow").show();
	if (thumbCountOffset <= (-thumbArray.length + 10))
		$("#rightArrow").hide();
	else
		$("#rightArrow").show();
}
function loadThumbs() { // Loads all thumbs and shows the ones which are visible as soon as they've been loaded
	var to = Math.min(THUMBS_TO_SHOW - thumbCountOffset, thumbArray.length);
	toLoadCount = Math.min(THUMBS_TO_SHOW, to);
	var tempImg;
	for (var i = -thumbCountOffset; i < to; i++) {
		if ( thumbArray[i] === undefined )
			continue;
		tempImg = new Image();
		tempImg.src = thumbArray[i][0];
		tempImg.onload = function() {
			toLoadCount--; //  JavaScript is single-threaded...
			if (0 == toLoadCount) {
				generateThumbGrid();
			}
		};
	}
}
function generateThumbGrid() {
	thumbWidth = (window.innerWidth - 50) / 11;// 11 because we show 10 thumbs and each arrow will be half as wide as a thumbnail
	var arrowWidth = thumbWidth / 2;
	var padding = 0.08 * thumbWidth; // This results in roughly 10 pixels with a maximized window on an HD screen if 10 thumbs are shown
	var thumbTDs = ''; // thumbTDs will become a string that's inserted into the <tr> with id thumbTR

	if (thumbArray.length > 10) // do we need arrows?
		thumbTDs += '<td style="min-width: ' + arrowWidth + 'px;"><a id="leftArrow" href="#" onclick="scrollThumbsLeft();"><svg width="' + arrowWidth + '" height="' + thumbWidth + '"><polygon points="' + (arrowWidth - padding) + ',' + padding + ' ' + padding + ',' + (arrowWidth) + ' '  + ' ' + (arrowWidth - padding) + ',' + (thumbWidth - padding) + '" style="fill: blue; stroke-width: 0;" /></svg></a>';
	else // we don't need arrows but we need to "pad" the row from the left to center the thumbs we do show
		thumbTDs += '<td style="min-width: ' + arrowWidth * (12 - thumbArray.length) + 'px;">'; // arrowWidth = half a thumb...
	thumbTDs += '</td><td><div class="thumb-row" style="text-align: center;"><div class="thumbs"><table><tr>';

	var i = 1;
	// Before the current page:
	while(i < pageNo) {
		thumbTDs += '<td class="thumb" style="padding: ' + padding + 'px; min-width: ' + thumbWidth + 'px;"><a href="#" onclick="gotoPage(' + i + ')"><img style="max-width: "' + (thumbWidth - 2 * padding) + 'px;" class="thumb thumb-img ' + thumbArray[i - 1][1] + '" src="' + thumbArray[i - 1][0] + '"><br/><span style="color: white;">' + i +'</span></a></td>';
		i++;
	}
	// Highlight current page:
	thumbTDs += '<td class="thumb" style="padding: ' + padding + 'px; min-width: ' + thumbWidth + 'px;"><img style="max-width: "' + (thumbWidth - 2 * padding) + 'px;" class="thumb thumb-current" src="' + thumbArray[i - 1][0] + '"><br/><span style="color: white;">' + i +'</span></td>';
	i++;
	// After the current page:
	while(i <= thumbArray.length) {
		thumbTDs += '<td class="thumb" style="padding: ' + padding + 'px;  min-width: ' + thumbWidth + 'px;"><a href="#" onclick="gotoPage(' + i + ')"><img style="max-width: "' + (thumbWidth - 2 * padding) + 'px;" class="thumb thumb-img ' + thumbArray[i - 1][1] + '" src="' + thumbArray[i - 1][0] + '"><br/><span style="color: white;">' + i +'</span></a></td>';
		i++;
	}
	thumbTDs += '</tr></table></div></div></td><td style="min-width: ' + arrowWidth + 'px;">';

	if (thumbArray.length > 10) // arrow?
		thumbTDs += '<a id="rightArrow" href="#" onclick="scrollThumbsRight();"><svg width="' + arrowWidth + '" height="' + thumbWidth + '"><polygon points="' + padding + ',' + padding + ' ' + (arrowWidth - padding) + ',' + (arrowWidth) + ' '  + ' ' + padding + ',' + (thumbWidth - padding) + '" style="fill: blue; stroke-width: 0;" /></svg></a>';
	thumbTDs += '</td>';
	$("#thumbTR").html(thumbTDs); // insert it

	// Then we alter the CSS:
	//$(".thumb").css("width", (thumbWidth - 2*padding) + "px");
	$(".thumb-row").css("width", ((window.innerWidth - 50) - thumbWidth) + "px"); // THUMBS_TO_SHOW * thumbWidth + "px");
	$(".thumb-img").css("width", (thumbWidth - 2 * padding)+ "px");
	$(".thumb-current").css("width", (thumbWidth - 2 * padding)+ "px");
	$(".thumbs" ).css("transition", "0s");
	$(".thumbs" ).css("transform",  "translateX(" + thumbCountOffset * thumbWidth + "px)");
	updateArrows();
}
function checkPageNumberInput() { // Tries to parse input to see if it's a valid page number to go to. If not, resets the contents to show the current page.
	var value = parseInt($("#pageNumber").val());
	if (value > 0 && value <= thumbArray.length)
		gotoPage(value);
	else // Reset to what it was
		$("#pageNumber").val(pageNo + "/" + thumbArray.length);
}
function gotoPage(page) {
	page = Math.max(Math.min(page, thumbArray.length), 1);
	var dL = "&dL=" + (currentLineId ? currentLineId : + restoreDialogLine);
	window.location.assign(pathWithoutPage + page + '?tco=' + thumbCountOffset + "&i=" + ifc + dL);// TODO Consider tco in situations in which the page to which we go isn't visible, set an appropriate value? If tco = NaN or outside...
}
