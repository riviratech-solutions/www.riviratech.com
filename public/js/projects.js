new Krousel(".learnersexp", {
    slidesPerView: 1,
    spaceBetween: 20,
    loop: true,
    nav: true,
    dots: true,
    autoplay: {
        delay: 3300,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
    },
    breakpoints: {
        476: { slidesPerView: 1, spaceBetween: 20 },
        576: { slidesPerView: 2, spaceBetween: 20 },
        992: { slidesPerView: 4, spaceBetween: 24 },
    },
});
