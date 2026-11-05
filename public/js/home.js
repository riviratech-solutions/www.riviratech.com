
new Krousel(".clients", {
    slidesPerView: 6,
    spaceBetween: 30,
    autoplay: {
        delay: 3300,
    },
    loop: true,
    freeMode: true,
    initialSlide: 2,
    centeredSlides: true,
    breakpoints: {
        320: {
            slidesPerView: 2,
            spaceBetween: 20
        },
        480: {
            slidesPerView: 2,
            spaceBetween: 30
        },
        570: {
            slidesPerView: 3,
            spaceBetween: 30
        },
        640: {
            slidesPerView: 4,
            spaceBetween: 40
        },
        800: {
            slidesPerView: 5,
            spaceBetween: 40
        }
    }
});

$(".owl-carousel").owlCarousel({
    loop: true,
    nav: false,
    margin: 10,
    autoplay: true,
    autoplayHoverPause: true,
    responsiveClass: true,
    responsive: {
        0: {
            items: 1,
        },
        660: {
            items: 1,
        },
        990: {
            items: 1,
        },
        1050: {
            items: 1,
        },
        1200: {
            items: 1,
        }
    },
});
var learnersSwiper = new Krousel(".learnersexp", {
    slidesPerView: 6,
    spaceBetween: 30,
    autoplay: {
        delay: 3300,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
    },
    loop: true,
    freeMode: true,
    breakpoints: {
        320: {
            slidesPerView: 1,
            spaceBetween: 0
        },
        480: {
            slidesPerView: 1,
            spaceBetween: 0
        },
        640: {
            slidesPerView: 2,
            spaceBetween: 40
        },
        800: {
            slidesPerView: 2,
            spaceBetween: 40
        },
        1000: {
            slidesPerView: 3,
            spaceBetween: 40
        }
    }
});

// Pause the video slider while hovering (fallback for older Swiper builds)
(function () {
    var el = document.querySelector(".learnersexp");
    if (el && learnersSwiper && learnersSwiper.autoplay) {
        el.addEventListener("mouseenter", function () { learnersSwiper.autoplay.stop(); });
        el.addEventListener("mouseleave", function () { learnersSwiper.autoplay.start(); });
    }
})();

new Krousel(".testimonials", {
    effect: "flip",          // the section was already tagged .flipeffect
    nav: true,
    dots: true,
    speed: 600,
    autoplay: {
        delay: 5000,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
    },
});


$(document).ready(function () {

    let maxHeight = 0;

    $(".homep p.desc").each(function () {
        const h = $(this).outerHeight();
        if (h > maxHeight) {
            maxHeight = h;
        }
    });

    $(".projectswillship .ti_heading_wraper h1").css("min-width", "300px");
    // Apply max height as min-height to all
    $(".homep p.desc").css("min-height", maxHeight + "px");

});