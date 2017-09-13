$(".btn-toggle").click(function(e) {
    if ( $(this).closest(".btn-group").find(".btn-toggle.btn-primary").size() > 0 ) {
        $(this).closest(".btn-group").find(".btn-toggle.active").toggleClass("btn-primary");
        $(this).closest(".btn-group").find(".btn-toggle.active").toggleClass("btn-default");
        $(this).closest(".btn-group").find(e.target).toggleClass("btn-default");
        $(this).closest(".btn-group").find(e.target).toggleClass("btn-primary");
    }
    if ( $(this).closest(".btn-group").find(".btn-toggle.btn-danger").size() > 0 ) {
        $(this).closest(".btn-group").find(".btn-toggle.active").toggleClass("btn-danger");
        $(this).closest(".btn-group").find(".btn-toggle.active").toggleClass("btn-default");
        $(this).closest(".btn-group").find(e.target).toggleClass("btn-default");
        $(this).closest(".btn-group").find(e.target).toggleClass("btn-danger");
    }
    if ( $(this).closest(".btn-group").find(".btn-toggle.btn-success").size() > 0 ) {
        $(this).closest(".btn-group").find(".btn-toggle.active").toggleClass("btn-success");
        $(this).closest(".btn-group").find(".btn-toggle.active").toggleClass("btn-default");
        $(this).closest(".btn-group").find(e.target).toggleClass("btn-default");
        $(this).closest(".btn-group").find(e.target).toggleClass("btn-success");
    }
    if ( $(this).closest(".btn-group").find(".btn-toggle.btn-info").size() > 0 ) {
        $(this).closest(".btn-group").find(".btn-toggle.active").toggleClass("btn-info");
        $(this).closest(".btn-group").find(".btn-toggle.active").toggleClass("btn-default");
        $(this).closest(".btn-group").find(e.target).toggleClass("btn-default");
        $(this).closest(".btn-group").find(e.target).toggleClass("btn-info");
    }

    $(this).closest(".btn-group").find(".btn-toggle.active").toggleClass("active");
    $(this).closest(".btn-group").find(e.target).toggleClass("active");
});
