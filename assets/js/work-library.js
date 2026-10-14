// Shared lightbox: window.openVideoModal(embedUrl, openUrl, title, vertical)
// (Drive blocks direct mp4 hotlinking with 403, so its preview player is the only option)
(function () {
    var modal = document.getElementById("wlModal");
    if (!modal) return;
    var frame = modal.querySelector("iframe"), mTitle = modal.querySelector(".wl-modal-title"),
        mOpen = modal.querySelector(".wl-modal-open"), box = modal.querySelector(".wl-modal-box");
    window.openVideoModal = function (src, href, title, vertical) {
        frame.src = src;
        mOpen.href = href || src;
        mOpen.textContent = /drive\.google/.test(href) ? "Open in Drive ↗" : "Open original ↗";
        mTitle.textContent = title || "";
        box.classList.toggle("vertical", !!vertical);
        modal.classList.add("open"); document.body.style.overflow = "hidden";
    };
    function close() { modal.classList.remove("open"); frame.src = "about:blank"; document.body.style.overflow = ""; }
    modal.addEventListener("click", function (e) { if (e.target === modal || e.target.closest(".wl-close")) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.classList.contains("open")) close(); });
})();

// Local poster frames live in assets/images/posters/<driveId>.jpg; fall back to Drive's own thumbnail, then to the empty card.
window.thumbFallback = function (img) {
    var f = img.getAttribute("data-fallback");
    if (f) { img.removeAttribute("data-fallback"); img.src = f; } else img.remove();
};

// Work library + showreel: both render from Google Drive data.
// First paint uses the hourly snapshot in window.WORK_DATA; then /api/drive-work (live Drive listing)
// replaces it, so videos added to or deleted from Drive show up / disappear without a redeploy.
(function () {
    var ROOT_FOLDER = "1fooEe5ArRjdA7RegVuvokmxkLJLbi41o", LIVE_URL = "/api/drive-work";
    var lib = document.getElementById("workLibrary"), reel = document.getElementById("videoReel");
    if (!lib && !reel) return;

    var NOTES = {
        "Best Work": "Hand-picked highlights across AI films, CGI, motion graphics and shoot-to-edit projects.",
        "AI Work": "Generative AI films, CGI ads, AI avatars, festival campaigns and episodic short films for India, UAE & US clients.",
        "Motion Graphics": "Kinetic typography and animated brand reels for Glocal, Digicots and Head Field hiring campaigns.",
        "3D Work": "3D product renders, commercials and an international gold-winning short film.",
        "Video Editing": "Event films, corporate videos and brand edits for RK Steel, Aadhiti Industries, Soho Club and more.",
        "Shoot + Edit": "Shot on location and edited end-to-end: realtor reels, hiring events and action pieces.",
        "New Uploads": "Fresh work, straight from the Drive folder.",
        "Latest": "The newest uploads. This list updates automatically whenever new work lands in Google Drive."
    };
    var NEW_DAYS = 30, REEL_COUNT = 9, PAGE = 12, today = Date.now();
    var PLAY = '<span class="wl-play"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>';
    function isNew(it) { return it[3] && (today - Date.parse(it[3])) / 864e5 <= NEW_DAYS; }
    function esc(s) { return String(s || "").replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); }
    function byDate(a, b) { return b[3] < a[3] ? -1 : b[3] > a[3] ? 1 : 0; }
    function thumb(it, size) {
        return '<img loading="lazy" alt="' + esc(it[0]) + '" src="assets/images/posters/' + it[1] + '.jpg" data-fallback="https://drive.google.com/thumbnail?id=' + it[1] + "&sz=" + size + '" onerror="thumbFallback(this)">';
    }
    function play(id, title) {
        window.openVideoModal("https://drive.google.com/file/d/" + id + "/preview", "https://drive.google.com/file/d/" + id + "/view", title);
    }

    // Newest videos across every folder (same title in several folders counts once)
    function newest(src, n) {
        var seen = {};
        return src.reduce(function (a, c) { return a.concat(c.items); }, [])
            .filter(function (i) { return i[3]; }).sort(byDate)
            .filter(function (i) { var k = i[0].toLowerCase(); return seen[k] ? false : (seen[k] = 1); })
            .slice(0, n);
    }

    // ---- Work library ----
    var renderLibrary = function () {};
    if (lib) (function () {
        var data = [], cat = 0, shown = PAGE;
        var grid = lib.querySelector(".wl-grid"), tabs = lib.querySelector(".wl-tabs"),
            note = lib.querySelector(".wl-note"), more = lib.querySelector(".wl-more"),
            folder = lib.querySelector(".wl-folder"), stats = lib.querySelector(".wl-stats");

        var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
            es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
        }, { rootMargin: "0px 0px -40px 0px" }) : null;
        function observe() { grid.querySelectorAll(".wl-card:not(.in)").forEach(function (el) { io ? io.observe(el) : el.classList.add("in"); }); }

        function card(it, n) {
            return '<button type="button" class="wl-card" data-id="' + it[1] + '" data-title="' + esc(it[0]) + '" style="--d:' + (n % PAGE) * 50 + 'ms">' +
                '<span class="wl-thumb">' + thumb(it, "w640") + (isNew(it) ? '<span class="wl-new">NEW</span>' : "") + PLAY + "</span>" +
                '<span class="wl-meta"><span class="wl-title">' + esc(it[0]) + "</span>" +
                (it[2] ? '<span class="wl-tag">' + esc(it[2]) + "</span>" : "") + "</span></button>";
        }

        function renderGrid() {
            var c = data[cat];
            if (!c) { grid.innerHTML = ""; note.textContent = ""; more.hidden = true; return; }
            note.textContent = NOTES[c.name] || "";
            folder.href = "https://drive.google.com/drive/folders/" + c.folder;
            grid.innerHTML = c.items.slice(0, shown).map(card).join("");
            more.hidden = shown >= c.items.length;
            more.textContent = "Load more (" + (c.items.length - shown) + ")";
            observe();
        }

        // keepPlace: stay on the open tab (and "Load more" depth) when live data replaces the snapshot
        renderLibrary = function (src, keepPlace) {
            var prevName = data[cat] && data[cat].name;

            // Stats: unique videos (same file name appears in several folders)
            var uniq = {}, ai = {};
            src.forEach(function (c) { c.items.forEach(function (i) { uniq[i[0].toLowerCase()] = 1; if (c.name === "AI Work") ai[i[0].toLowerCase()] = 1; }); });
            stats.innerHTML = [
                [Object.keys(uniq).length + "+", "Projects in the library"],
                [src.length, "Creative disciplines"],
                [Object.keys(ai).length + "+", "AI-generated films"],
                ["3", "Countries served"]
            ].map(function (s) { return '<div class="wl-stat"><span class="wl-stat-num">' + s[0] + '</span><span class="wl-stat-label">' + s[1] + "</span></div>"; }).join("");

            var latest = newest(src, 24);
            data = (latest.length ? [{ name: "Latest", folder: ROOT_FOLDER, items: latest }] : []).concat(src);
            cat = 0;
            if (keepPlace) data.forEach(function (c, i) { if (c.name === prevName) cat = i; });
            else shown = PAGE;

            tabs.innerHTML = data.map(function (c, i) {
                return '<button type="button" class="wl-tab' + (i === cat ? " active" : "") + '" data-i="' + i + '">' + esc(c.name) + "<sup>" + c.items.length + "</sup></button>";
            }).join("");
            renderGrid();
        };

        tabs.addEventListener("click", function (e) {
            var b = e.target.closest(".wl-tab"); if (!b) return;
            tabs.querySelector(".active").classList.remove("active"); b.classList.add("active");
            cat = +b.dataset.i; shown = PAGE; renderGrid();
        });
        more.addEventListener("click", function () { shown += PAGE; renderGrid(); });
        grid.addEventListener("click", function (e) {
            var c = e.target.closest(".wl-card"); if (c) play(c.dataset.id, c.dataset.title);
        });
    })();

    // ---- Showreel: newest videos in the Drive "Best Work" folder (falls back to newest overall) ----
    var reelItems = [];
    function renderReel(src) {
        if (!reel) return;
        var best = src.filter(function (c) { return c.name === "Best Work"; })[0];
        reelItems = best && best.items.length ? best.items.slice().sort(byDate).slice(0, REEL_COUNT) : newest(src, REEL_COUNT);
        reel.hidden = !reelItems.length;
        reel.querySelector(".vr-grid").innerHTML = reelItems.map(function (it, i) {
            return '<button type="button" class="vr-card' + (i ? "" : " vr-featured") + '" data-i="' + i + '">' +
                '<span class="vr-thumb">' + thumb(it, "w1280") + PLAY + (i ? "" : '<span class="vr-badge">FEATURED</span>') + "</span>" +
                '<span class="vr-meta"><span class="vr-num">' + String(i + 1).padStart(2, "0") + '</span><span><span class="vr-title">' + esc(it[0]) + "</span>" +
                (it[2] ? '<span class="wl-tag">' + esc(it[2]) + "</span>" : "") + "</span></span></button>";
        }).join("");
    }
    if (reel) reel.addEventListener("click", function (e) {
        var c = e.target.closest(".vr-card"); if (!c) return;
        var it = reelItems[+c.dataset.i]; play(it[1], it[0]);
    });

    function renderAll(src, keepPlace) { renderLibrary(src, keepPlace); renderReel(src); }

    // Live data keeps the snapshot's category names and order, and fills in dates Drive didn't show
    function merge(live, snap) {
        var byFolder = {}, dates = {}, order = snap.map(function (c) { return c.folder; });
        snap.forEach(function (c) { byFolder[c.folder] = c; c.items.forEach(function (i) { dates[i[1]] = i[3]; }); });
        var todayIso = new Date().toISOString().slice(0, 10);
        return live.map(function (c) {
            var prev = byFolder[c.folder];
            return { name: prev ? prev.name : c.name, folder: c.folder, items: c.items.map(function (i) {
                return [i[0], i[1], i[2], i[3] || dates[i[1]] || todayIso];
            }).sort(byDate) };
        }).sort(function (a, b) { return ((order.indexOf(a.folder) + 1) || 999) - ((order.indexOf(b.folder) + 1) || 999); });
    }

    var snapshot = window.WORK_DATA || [];
    renderAll(snapshot, false);
    if (window.fetch && location.protocol !== "file:") {
        fetch(LIVE_URL, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (live) {
            if (!Array.isArray(live) || !live.length) return;
            var merged = merge(live, snapshot);
            if (JSON.stringify(merged) !== JSON.stringify(snapshot)) renderAll(merged, true);
        }).catch(function () { /* keep the snapshot */ });
    }
})();
