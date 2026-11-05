/*
 * Phone country-code handling used to live here (intl-tel-input init + the
 * #fullphone / #country_code sync). It now lives in /js/phoneinput.js, a small
 * self-contained plugin that auto-initialises `form.enrol #phone`,
 * `form.contact #phone` and `form.decidecareer #phone` and keeps those hidden
 * fields in sync. Nothing phone-related is needed here anymore.
 */

$("#gender").val("");
$("#course").val("");
$(".txtbounce").each(function (e) {
    var a = $(this).text();
    if (a.length >= 1) {
        var d = "";
        var b = a.split("");
        for (var i = 0; i < a.length; i++) {
            var dd = a[i];
            if (dd.length == 0 || dd == "" || dd == " ") {
                dd = "&nbsp;";
            }
            d += "<span class='bounce a" + i + "' style='animation-delay:0." + i + "s'>" + dd + "</span>";
        }
        $(this).html(d);
    }
});
