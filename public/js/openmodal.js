$(document).ready(function () {
    if (localStorage.getItem("decidecareer") !== "yes") {
        window.setTimeout(function () {
            $('#decidecareer').modal('show');
            localStorage.setItem("decidecareer", "yes");
        }, 2000);
    }
});