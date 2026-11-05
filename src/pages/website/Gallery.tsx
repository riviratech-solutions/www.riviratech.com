import { useEffect, useState } from "react";
import { Head, AWS_UPLOADS } from "../../components/Includes";
import { getSeoByPath } from "../../utils/seo";

import { siteFetch } from "../../utils/siteCache";

import LightGallery from "lightgallery/react";
// import plugins if you need
import lgThumbnail from "lightgallery/plugins/thumbnail";
import lgZoom from "lightgallery/plugins/zoom";
import lgVideo from "lightgallery/plugins/video";

// import styles
import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-zoom.css";
import "lightgallery/css/lg-thumbnail.css";
import "lightgallery/css/lg-video.css";
import { VIDEO_THUMB, videoSlide } from "../../utils/galleryMedia";
import { PageHero } from "../../components/site/PageKit";

const seo = getSeoByPath("gallery");

export default function Page() {
  const [alllists, setAllLists] = useState<any[]>([]);

  const limit = 10;
  const [listtotal, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [lastPage, setLastPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadDetails = async (page = 1, search = "", sort = "") => {
    setLoading(true);
    setAllLists([]);
    setSearch(search);
    setSort(sort);
    try {
      // kept for 10 minutes per page / search / sort (utils/siteCache.ts)
      const res = await siteFetch("api/gallery/images", {
        method: "post",
        params: { q: search, s: sort, n: page },
      });

      if (res.data.success) {
        setLoading(false);
        setAllLists(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.lastPage);
      }
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails(page, search, sort);

    return () => {};
  }, []);

  const onInit = () => {
    console.log("lightGallery has been initialized");
  };

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />

      <style>{GALLERY_CSS}</style>

      <div className="enroll-page biz-page">
        {/* ── Hero ── */}
        <PageHero
          crumb="Gallery"
          eyebrow="Moments"
          title="Our"
          accent="gallery"
          text={<>Hands-on AI workshops and bootcamps, corporate training sessions, events and expo booths, and the projects our learners build — every photo a real moment from our journey.{listtotal > 0 && <> <strong style={{ color: "#fff" }}>{listtotal} moments captured.</strong></>}</>}
          image="/images/pages/gallery.webp"
          imageAlt="A collage of photo frames from workshops and events"
          actions={[{ label: "Join a Free Workshop", to: "/workshop" }, { label: "Upcoming Events", to: "/events", ghost: true }]}
        />

        <section className="enroll-section-gray gl-section">
          {loading ? (
            <div className="pageloader">
              <div className="loader-facebook">
                <div className="lds-facebook">
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
              </div>
            </div>
          ) : alllists.length === 0 ? (
            <div className="gl-state">
              <h4>No Gallery Images</h4>
              <p>We couldn’t find any gallery images</p>
            </div>
          ) : (
            <div className="LightGallery">
              <div className="enroll-container gl-container">
                <LightGallery
                  onInit={onInit}
                  speed={500}
                  plugins={[lgThumbnail, lgZoom, lgVideo]}
                  // thumbnails come from data-thumb (video tiles have no <img> to read)
                  exThumbImage="data-thumb"
                  elementClassNames="gallery-masonry"
                >
                  {alllists.map((list, index) => {
                    const url = AWS_UPLOADS + list.img;
                    if (list.type === "video") {
                      return (
                        <a
                          key={index}
                          className="gallery-item gallery-video"
                          data-aos="fade-in"
                          data-lg-size="1280-720"
                          data-thumb={VIDEO_THUMB}
                          data-video={videoSlide(url, list.img)}
                        >
                          <video
                            src={url}
                            muted
                            preload="metadata"
                            playsInline
                          />
                          <span className="gallery-play">▶</span>
                        </a>
                      );
                    }
                    return (
                      <a
                        href={url}
                        key={index}
                        className="gallery-item"
                        data-aos="fade-in"
                        data-thumb={url}
                      >
                        <img src={url} alt={`img${index}`} loading="lazy" />
                      </a>
                    );
                  })}
                </LightGallery>
              </div>

              <Pagination
                page={page}
                total={listtotal}
                limit={limit}
                lastPage={lastPage}
                onPageChange={(p: any) => {
                  setPage(p);
                  loadDetails(p, search, sort);
                }}
              />
            </div>
          )}
        </section>
      </div>
    </>
  );

  function Pagination({ page, total, limit, lastPage, onPageChange }: any) {
    if (total === 0 || lastPage <= 1) return null;

    // Calculate Showing X to Y
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    // Pagination range logic (same as PHP)
    let pagstart = 1;
    let pagend = 10;

    if (page >= 6) {
      pagstart = page - 3;
      pagend = page + 7;
    }

    if (pagend >= lastPage) {
      pagstart = lastPage - 9;
      pagend = lastPage + 1;
    }

    if (pagstart <= 0) pagstart = 1;

    const pages = [];

    for (let i = pagstart; i < pagend && i <= lastPage; i++) {
      pages.push(i);
    }

    return (
      <div className="gl-pager">
        <div className="gl-pager-info" role="status">
          Showing {start} to {end} of {total}
        </div>

        <div className="gl-pager-btns">
          {/* Previous */}
          {page >= 2 && (
            <button
              className="dt-paging-button first"
              onClick={() => onPageChange(page - 1)}
            >
              «
            </button>
          )}

          {/* Page Numbers */}
          {pages.map((p) => (
            <button
              key={p}
              className={`dt-paging-button ${p === page ? "current" : ""}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ))}

          {/* Next */}
          {page >= 1 && page < lastPage && (
            <button
              className="dt-paging-button last"
              onClick={() => onPageChange(page + 1)}
            >
              »
            </button>
          )}
        </div>
      </div>
    );
  }
}

const GALLERY_CSS = `
.gl-section { padding-top: 56px; }
.gl-container { max-width: 1320px; }
.gl-state { text-align: center; color: #64748b; padding: 60px 0; margin: 0; }
.gl-state h4 { color: #0a0f1e; font-family: var(--font-display); }

/* Masonry columns — neat aligned columns, natural aspect ratios kept. */
.gallery-masonry { column-count: 4; column-gap: 16px; margin: 0 0 30px; }
@media (max-width: 1199px) { .gallery-masonry { column-count: 3; } }
@media (max-width: 767px)  { .gallery-masonry { column-count: 2; column-gap: 12px; } }
@media (max-width: 420px)  { .gallery-masonry { column-count: 1; } }

.gallery-item {
  display: block; position: relative; break-inside: avoid; -webkit-column-break-inside: avoid;
  margin: 0 0 16px; border-radius: 14px; overflow: hidden; background: #e2e8f0;
  box-shadow: 0 6px 18px rgba(10,15,30,.10); cursor: pointer; line-height: 0;
}
.gallery-item img, .gallery-item video { width: 100%; height: auto; display: block; transition: transform .45s ease; }
.gallery-item:hover img, .gallery-item:hover video { transform: scale(1.06); }
.gallery-item::after {
  content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .3s ease;
  background: linear-gradient(to top, rgba(10,15,30,.32), rgba(10,15,30,0) 45%);
}
.gallery-item:hover::after { opacity: 1; }

/* Play badge for video tiles. */
.gallery-video .gallery-play {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 1.7rem; color: #fff; pointer-events: none; z-index: 2; text-shadow: 0 2px 10px rgba(0,0,0,.6);
}
.gallery-video .gallery-play::before {
  content: ""; position: absolute; width: 58px; height: 58px; border-radius: 50%;
  background: rgba(0,0,0,.5); z-index: -1; transition: background .3s ease, transform .3s ease;
}
.gallery-video:hover .gallery-play::before { background: rgba(31, 95, 175,.9); transform: scale(1.08); }

/* Pagination */
.gl-pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; max-width: 1320px; margin: 0 auto; padding: 0 24px 10px; }
.gl-pager-info { color: #64748b; font-size: .9rem; }
.gl-pager-btns { display: flex; flex-wrap: wrap; gap: 6px; }
.gl-pager .dt-paging-button {
  min-width: 38px; height: 38px; padding: 0 10px; border-radius: 999px; border: 1px solid #e2e8f0;
  background: #fff; color: #0a0f1e; font-weight: 600; cursor: pointer; transition: all .2s;
}
.gl-pager .dt-paging-button:hover { border-color: #1F5FAF; color: #0B3D7A; }
.gl-pager .dt-paging-button.current { background: linear-gradient(135deg,#1F5FAF,#5AA9F0); border-color: transparent; color: #fff; }
`;
