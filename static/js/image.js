// these vars must be initialized when importing this JavaScript
// initialWidth, initialHeight, initialScale
// previousInnerWidth
// zoomFactor
// accumExtraX
// accumExtraY
// contentArray
// these JavaScripts must also be imported
// TODO List

function showLineImage(e) {
    if ( e.type.indexOf("mouse") >= 0 ) {
        if ( window.innerHeight - (e.clientY + 180) <= 0 )
            $("#canvas_text").css("top", e.clientY - 180);
        else
            $("#canvas_text").css("top", e.clientY + 10);
    }
    else if ( e.type.indexOf("key") >= 0 && currentLineId !== null && currentLineId !== undefined ) {
        var top = $("#text_" + currentLineId).offset().top - $(window).scrollTop();
        if ( window.innerHeight - (top + $("#text_" + currentLineId).height()) <= 0 )
            $(window).scrollTop($(window).scrollTop() + $("#text_" + currentLineId).height());
        else if ( top + $("#text_" + currentLineId).height() <= 80 )
            $(window).scrollTop($(window).scrollTop() - $("#text_" + currentLineId).height());

        top = $("#text_" + currentLineId).offset().top - $(window).scrollTop();
        if ( window.innerHeight - (top + $("#text_" + currentLineId).height() + 180) <= 0 )
            $("#canvas_text").css("top", top - 180);
        else
            $("#canvas_text").css("top", top + $("#text_" + currentLineId).height());
    }

    var c = document.getElementById("canvas_text")
    if ( c !== null && c !== undefined ) {
        var ctx = c.getContext("2d");
        var image = document.getElementById("transcriptImage");

        if ( currentLineId === null || currentLineId === undefined )
            var contentLine = contentArray[getIndexFromLineId(e.currentTarget.id.substring(5))];
        else
            var contentLine = contentArray[getIndexFromLineId(currentLineId)];

        var width = contentLine[2][2] - contentLine[2][0];
        var height = contentLine[2][5] - contentLine[2][1];
        ctx.drawImage(image, contentLine[2][0], contentLine[2][1], width, height, 0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.save();
    }
}
