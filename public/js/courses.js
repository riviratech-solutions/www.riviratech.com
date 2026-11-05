$(document).ready(function () {

    const $searchInput = $("#searchInput");
    const $filters = $(".courseFilter");
    const $courses = $(".list-card");
    const $noResults = $("#noResults");
    const $coursebox = $(".coursebox .grid-2");

    function updateFilters() {
        const text = $searchInput.val().toLowerCase();
        const selected = $filters
            .filter(":checked")
            .map(function () { return $(this).val(); })
            .get();

        var visibleCount = 0;

        $courses.each(function () {
            const $card = $(this);
            const stitle = $card.find("span").text().toLowerCase();
            const title = $card.find("h5").text().toLowerCase();
            const desc = $card.find("p").text().toLowerCase();
            const category = $card.data("category");

            const textMatch = title.includes(text) || stitle.includes(text) || desc.includes(text);
            const categoryMatch = selected.length === 0 || selected.includes(category);

            if (textMatch && categoryMatch) {
                $card.show();
                visibleCount++;
            } else {
                $card.hide();
            }
        });

        // Show or hide "No Results" message
        if (visibleCount === 0) {
            $noResults.show();
            $coursebox.css({ "display": "block" });
        } else {
            $noResults.hide();
            $coursebox.removeAttr("style");
        }
    }

    // Events
    $searchInput.on("input", updateFilters);
    $filters.on("change", updateFilters);

});