$(".btn-toggle").click(function(e) {
    if ( !$(this).hasClass("btn-primary") ) {
        if ( $(this).closest(".btn-group").find(".btn-primary").size() > 0 ) {
            $(this).closest(".btn-group").find(".active").toggleClass("btn-primary");
            $(this).closest(".btn-group").find(".active").toggleClass("btn-default");
            $(this).closest(".btn-group").find(e.target).toggleClass("btn-default");
            $(this).closest(".btn-group").find(e.target).toggleClass("btn-primary");
        }
        if ( $(this).closest(".btn-group").find(".btn-danger").size() > 0 ) {
            $(this).closest(".btn-group").find(".active").toggleClass("btn-danger");
            $(this).closest(".btn-group").find(".active").toggleClass("btn-default");
            $(this).closest(".btn-group").find(e.target).toggleClass("btn-default");
            $(this).closest(".btn-group").find(e.target).toggleClass("btn-danger");
        }
        if ( $(this).closest(".btn-group").find(".btn-success").size() > 0 ) {
            $(this).closest(".btn-group").find(".active").toggleClass("btn-success");
            $(this).closest(".btn-group").find(".active").toggleClass("btn-default");
            $(this).closest(".btn-group").find(e.target).toggleClass("btn-default");
            $(this).closest(".btn-group").find(e.target).toggleClass("btn-success");
        }
        if ( $(this).closest(".btn-group").find(".btn-info").size() > 0 ) {
            $(this).closest(".btn-group").find(".active").toggleClass("btn-info");
            $(this).closest(".btn-group").find(".active").toggleClass("btn-default");
            $(this).closest(".btn-group").find(e.target).toggleClass("btn-default");
            $(this).closest(".btn-group").find(e.target).toggleClass("btn-info");
        }

        $(this).closest(".btn-group").find(".active").toggleClass("active");
        $(this).closest(".btn-group").find(e.target).toggleClass("active");
    }
});
