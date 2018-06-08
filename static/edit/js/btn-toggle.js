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
