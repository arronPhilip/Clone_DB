/* ============================================================
   PictoPlex — main.js
   Merged from script.js + api.js
   ============================================================ */

const API = "http://localhost:5000/api";

// ─── API Helpers ──────────────────────────────────────────────────────────────

/** Simple in-memory cache — avoids re-fetching the same endpoint in the same session */
const _cache = new Map();
async function apiFetch(path, opts = {}) {
  const cacheKey = path;
  if (!opts.noCache && _cache.has(cacheKey)) return _cache.get(cacheKey);
  const res = await fetch(`${API}${path}`, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${path}`);
  const data = await res.json();
  if (!opts.noCache) _cache.set(cacheKey, data);
  return data;
}

/** POST JSON to our Flask backend */
async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Get tmdb_id from URL: ?id=12345 */
function getUrlId() {
  return new URLSearchParams(window.location.search).get("id");
}

/** Format a dollar amount nicely: 2800000000 → $2.8B */
function fmtMoney(n) {
  if (!n) return "N/A";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

/** Format runtime: 181 → 3h 1m */
function fmtRuntime(mins) {
  if (!mins) return "";
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** Build a movie card HTML (used on index + browse) */
function movieCardHTML(movie, rank = null) {
  const year = (movie.release_date || "").slice(0, 4);
  const poster = movie.poster
    ? `<img src="${movie.poster}" alt="${movie.title}" style="width:100%;height:100%;object-fit:cover;">`
    : `<div style="width:100%;height:100%;background:linear-gradient(160deg,#c8d8f5,#8ab0e8);display:flex;align-items:center;justify-content:center;font-size:11px;color:#5580b0;padding:8px;text-align:center;">${movie.title}</div>`;

  return `
    <div class="trend-card" onclick="location.href='movie-detail.html?id=${movie.tmdb_id}'" style="cursor:pointer">
      <div class="trend-poster" style="overflow:hidden;position:relative;">
        ${poster}
        <div class="trend-overlay"></div>
        ${rank ? `<div class="trend-rank">#${rank}</div>` : ""}
        <div style="position:absolute;bottom:6px;right:8px;background:rgba(10,16,28,.8);color:var(--gold);font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;">&#9733; ${movie.rating}</div>
      </div>
      <div class="trend-body">
        <div class="trend-title">${movie.title}</div>
        <div class="trend-meta">${year}</div>
      </div>
    </div>`;
}

/** Build a movie list-row HTML (browse page) */
function movieRowHTML(movie) {
  const year   = (movie.release_date || "").slice(0, 4);
  const genres = (movie.genres || []).slice(0, 3).map(g => `<span class="movie-tag">${g}</span>`).join("");
  const poster = movie.poster
    ? `<img src="${movie.poster}" alt="${movie.title}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`
    : `<div style="width:100%;height:100%;background:linear-gradient(160deg,#c8d8f5,#8ab0e8);border-radius:6px;"></div>`;

  return `
    <div class="movie-row" onclick="location.href='movie-detail.html?id=${movie.tmdb_id}'">
      <div class="movie-poster" style="overflow:hidden;">${poster}</div>
      <div class="movie-info">
        <div class="movie-title">${movie.title}</div>
        <div class="movie-meta">
          <span><strong>${year}</strong></span>
          ${movie.runtime ? `<span>${fmtRuntime(movie.runtime)}</span>` : ""}
          ${movie.budget ? `<span>Budget: <strong>${fmtMoney(movie.budget)}</strong></span>` : ""}
          ${movie.revenue ? `<span>Revenue: <strong>${fmtMoney(movie.revenue)}</strong></span>` : ""}
        </div>
        <div class="movie-tags">${genres}</div>
        <p class="movie-desc">${(movie.overview || "").slice(0, 180)}${movie.overview?.length > 180 ? "&hellip;" : ""}</p>
        <div class="movie-btns">
          <a href="movie-detail.html?id=${movie.tmdb_id}" class="btn btn-dark btn-sm">View Details</a>
        </div>
      </div>
    </div>`;
}

/** Build a celebrity card HTML */
function celebCardHTML(person, isDirector = false) {
  const tagClass = isDirector ? "director" : "actor";
  const tagLabel = isDirector ? "Director" : "Actor";
  const initials = person.name.split(" ").map(w => w[0]).join("").slice(0, 2);
  const detailPage = isDirector ? "celebrity-detail-director" : "celebrity-detail";

  const photo = person.photo
    ? `<img src="${person.photo}" alt="${person.name}" style="width:100%;height:100%;object-fit:cover;">`
    : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:26px;font-weight:800;color:var(--blue2);">${initials}</div>`;

  return `
    <div class="celeb-gcard" onclick="location.href='${detailPage}.html?id=${person.person_id}'">
      <div class="cg-img" style="overflow:hidden;">${photo}</div>
      <div class="cg-body">
        <div class="cg-name">${person.name}</div>
        <span class="cg-tag ${tagClass}">${tagLabel}</span>
        <div class="cg-films">${(person.known_for || []).join(", ").slice(0, 40) || ""}</div>
      </div>
    </div>`;
}


// ==============================================================================
// SKELETONS
// ==============================================================================

function skelTrendGrid() {
  return Array.from({length:5}, () => `
    <div class="skel-trend-card">
      <div class="skel skel-trend-poster"></div>
      <div class="skel-trend-body">
        <div class="skel skel-trend-title"></div>
        <div class="skel skel-trend-meta"></div>
      </div>
    </div>`).join("");
}

function skelFeatCards() {
  return `
    <div class="skel-feat-card"><div class="skel-dark skel-feat-poster"></div><div class="skel-feat-bottom"></div></div>
    <div class="skel-feat-card big"><div class="skel-dark skel-feat-poster"></div><div class="skel-feat-bottom"></div></div>
    <div class="skel-feat-card"><div class="skel-dark skel-feat-poster"></div><div class="skel-feat-bottom"></div></div>`;
}

function skelMovieRows(n = 5) {
  return Array.from({length:n}, () => `
    <div class="skel-movie-row">
      <div class="skel skel-movie-poster"></div>
      <div class="skel-movie-info">
        <div class="skel skel-movie-title"></div>
        <div class="skel skel-movie-meta"></div>
        <div class="skel skel-movie-desc"></div>
        <div class="skel skel-movie-desc2"></div>
      </div>
    </div>`).join("");
}

function skelCelebGrid(n = 6) {
  return Array.from({length:n}, () => `
    <div class="skel-celeb-card">
      <div class="skel skel-celeb-img"></div>
      <div class="skel-celeb-body">
        <div class="skel skel-celeb-name"></div>
        <div class="skel skel-celeb-tag"></div>
      </div>
    </div>`).join("");
}

function skelPeopleRow(n = 8) {
  return Array.from({length:n}, () => `
    <div class="skel-person-card">
      <div class="skel skel-person-circle"></div>
      <div class="skel skel-person-name"></div>
      <div class="skel skel-person-role"></div>
    </div>`).join("");
}

function skelPopChart(n = 5) {
  return Array.from({length:n}, () => `
    <div class="skel-pop-row">
      <div class="skel skel-pop-rank"></div>
      <div class="skel skel-pop-circle"></div>
      <div class="skel-pop-info">
        <div class="skel skel-pop-name"></div>
        <div class="skel skel-pop-sub"></div>
      </div>
    </div>`).join("");
}

function skelFilmGrid(n = 4) {
  return Array.from({length:n}, () => `
    <div class="skel-film-card">
      <div class="skel skel-film-poster"></div>
      <div class="skel-film-body">
        <div class="skel skel-film-title"></div>
        <div class="skel skel-film-meta"></div>
      </div>
    </div>`).join("");
}

function skelCelebDetail() {
  // Hero skeleton
  const hero = document.querySelector(".celeb-hero");
  if (hero) {
    const circle = hero.querySelector(".person-circle");
   if (circle) circle.style.cssText = "width:126px;height:126px;border-radius:50%;display:inline-block;background:linear-gradient(90deg,#e8dcc8 25%,#f0e4d0 50%,#e8dcc8 75%);background-size:600px 100%;animation:shimmer 1.4s infinite linear;flex-shrink:0;";
    const badge = hero.querySelector(".celeb-hero-badge");
    if (badge) badge.innerHTML = `<div class="skel" "></div>`;
    const name = hero.querySelector(".celeb-hero-name");
    if (name) name.innerHTML = `<div class="skel" style="height:34px;width:220px;border-radius:6px;"></div>`;
    const meta = hero.querySelector(".celeb-hero-meta");
    if (meta) meta.innerHTML = `
      <div class="skel" style="height:13px;width:120px;border-radius:4px;"></div>
      <div class="skel" style="height:13px;width:160px;border-radius:4px;"></div>
      <div class="skel" style="height:13px;width:100px;border-radius:4px;"></div>`;
  }
  // Bio skeleton
  const bio = document.querySelector(".celeb-bio");
  if (bio) bio.innerHTML = `
    ${Array.from({length:8}, () => `<div class="skel" style="height:13px;width:${80+Math.floor(Math.random()*20)}%;border-radius:4px;margin-bottom:8px;"></div>`).join("")}`;
  // Filmography skeleton
  const grid = document.querySelector(".filmography");
  if (grid) grid.innerHTML = skelFilmGrid(8);
}

function skelMovieDetail() {
  // Hero skeleton
  const detailBg = document.querySelector(".detail-bg");
  if (detailBg) {
    detailBg.style.background = "";
    const posterEl = document.querySelector(".detail-poster");
    if (posterEl) { posterEl.style.backgroundImage = ""; posterEl.className = "detail-poster dp1"; }
    const badges  = document.querySelector(".detail-badges");
    const title   = document.querySelector(".detail-title");
    const genres  = document.querySelector(".detail-genres");
    const desc    = document.querySelector(".detail-desc");
    if (badges) badges.innerHTML = `<div class="skel" style="height:20px;width:48px;border-radius:4px;"></div><div class="skel" style="height:20px;width:60px;border-radius:4px;"></div><div class="skel" style="height:20px;width:52px;border-radius:4px;"></div>`;
    if (title)  title.innerHTML  = `<div class="skel" style="height:32px;width:65%;border-radius:6px;"></div>`;
    if (genres) genres.innerHTML = `<div class="skel" style="height:20px;width:70px;border-radius:99px;"></div><div class="skel" style="height:20px;width:60px;border-radius:99px;"></div>`;
    if (desc)   desc.innerHTML   = `<div class="skel" style="height:13px;width:100%;border-radius:4px;margin-bottom:6px;"></div><div class="skel" style="height:13px;width:90%;border-radius:4px;margin-bottom:6px;"></div><div class="skel" style="height:13px;width:75%;border-radius:4px;"></div>`;
  }
  // Similar panel skeleton
  const simPanel = document.querySelector(".similar-panel");
  if (simPanel) {
    simPanel.innerHTML = `
      <div class="panel-lbl">More like this</div>
      ${Array.from({length:5}, () => `
        <div class="sim-card">
          <div class="skel" style="width:60px;height:84px;border-radius:6px;flex-shrink:0;"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
            <div class="skel" style="height:13px;width:85%;border-radius:4px;"></div>
            <div class="skel" style="height:11px;width:50%;border-radius:4px;"></div>
          </div>
        </div>`).join("")}`;
  }
  // Stats skeleton
  document.querySelectorAll(".stat-val").forEach(el => {
    el.innerHTML = `<div class="skel" style="height:22px;width:60px;border-radius:4px;display:inline-block;"></div>`;
  });
  // Cast + director rows
  const castRow = document.getElementById("cast-row");
  const dirRow  = document.getElementById("director-row");
  if (castRow) castRow.innerHTML = skelPeopleRow(6);
  if (dirRow)  dirRow.innerHTML  = skelPeopleRow(3);
}

// ==============================================================================
// SHARED: Nav search input (used on all pages)
// ==============================================================================

function initNavSearch() {
  const navSearch = document.querySelector(".nav-search");
  if (!navSearch) return;

  const wrap = document.createElement("div");
  wrap.className = "nav-search-wrap";
  wrap.style.cssText = "flex:1;max-width:420px;position:relative;margin:0 20px;";
  wrap.innerHTML = `
    <svg class="nav-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
    <input class="nav-search-input" id="navSearchInput" type="text" placeholder="Search movies, actors, directors&hellip;" autocomplete="off">
    <div class="nav-search-results" id="navSearchResults"></div>`;
  navSearch.replaceWith(wrap);

  const input   = wrap.querySelector("#navSearchInput");
  const results = wrap.querySelector("#navSearchResults");
  let debounceTimer;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) { results.classList.remove("open"); return; }
    debounceTimer = setTimeout(async () => {
      try {
        const [movieData, personData] = await Promise.allSettled([
          apiFetch(`/search?q=${encodeURIComponent(q)}`, {noCache: true}),
          apiFetch(`/person/search?q=${encodeURIComponent(q)}`, {noCache: true}),
        ]);

        const movies  = movieData.status  === "fulfilled" ? (movieData.value.results  || []).slice(0, 4) : [];
        const people  = personData.status === "fulfilled" ? (personData.value         || []).slice(0, 3) : [];

        if (!movies.length && !people.length) {
          results.innerHTML = `<div class="search-no-results">No results found</div>`;
          results.classList.add("open");
          return;
        }

        let html = "";

        if (movies.length) {
          html += `<div style="padding:8px 14px 4px;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.3);font-weight:600;">Movies</div>`;
          html += movies.map(m => `
            <div class="search-result-item" onclick="location.href='movie-detail.html?id=${m.tmdb_id}'">
              ${m.poster
                ? `<img src="${m.poster}" class="sri-poster" style="object-fit:cover;">`
                : `<div class="sri-poster" style="background:var(--navy3);"></div>`}
              <div>
                <div class="sri-title">${m.title}</div>
                <div class="sri-meta">${(m.release_date || "").slice(0,4)}</div>
              </div>
            </div>`).join("");
        }

        if (people.length) {
          html += `<div style="padding:8px 14px 4px;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.3);font-weight:600;border-top:1px solid var(--navy3);">People</div>`;
          html += people.map(p => {
            const isDir  = p.department === "Directing";
            const page   = isDir ? "celebrity-detail-director" : "celebrity-detail";
            const role   = isDir ? "Director" : "Actor";
            return `
              <div class="search-result-item" onclick="location.href='${page}.html?id=${p.person_id}'">
                ${p.photo
                  ? `<img src="${p.photo}" class="sri-poster" style="object-fit:cover;border-radius:50%;">`
                  : `<div class="sri-poster" style="background:var(--navy3);border-radius:50%;"></div>`}
                <div>
                  <div class="sri-title">${p.name}</div>
                  <div class="sri-meta">${role}</div>
                </div>
              </div>`;
          }).join("");
        }

        results.innerHTML = html;
        results.classList.add("open");
      } catch (_) {}
    }, 320);
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Escape") { results.classList.remove("open"); input.blur(); }
    if (e.key === "Enter") {
      const q = input.value.trim();
      if (q) location.href = `browse.html?q=${encodeURIComponent(q)}`;
    }
  });

  document.addEventListener("click", e => {
    if (!wrap.contains(e.target)) results.classList.remove("open");
  });
}

// ==============================================================================
// PAGE: index.html
// ==============================================================================

async function loadIndexPage() {
  if (!document.querySelector(".trending-grid")) return;

  const trendGrid  = document.querySelector(".trending-grid");
  const featured   = document.querySelector(".hero-featured");
  const peopleRows = document.querySelectorAll(".people-row");
  if (trendGrid) trendGrid.innerHTML = skelTrendGrid();
  if (featured)  featured.innerHTML  = skelFeatCards();
  peopleRows.forEach(r => { r.innerHTML = skelPeopleRow(); });

  const [trendingRes, popularRes, peopleRes] = await Promise.allSettled([
    apiFetch("/movies/trending"),
    apiFetch("/movies/popular"),
    apiFetch("/person/popular"),
  ]);

  // Trending grid
  if (trendGrid) {
    if (trendingRes.status === "fulfilled") {
      trendGrid.innerHTML = (trendingRes.value.movies || []).slice(0, 5)
        .map((m, i) => movieCardHTML(m, i + 1)).join("");
    } else {
      trendGrid.innerHTML = `<div style="grid-column:1/-1;color:var(--muted)">Could not load trending movies.</div>`;
    }
  }

  // Hero featured
  if (featured) {
    if (popularRes.status === "fulfilled") {
      const picks     = (popularRes.value.movies || []).slice(0, 3);
      const bgClasses = ["fp_h1", "fp_h2", "fp_h3"];
      const isBig     = [false, true, false];
      featured.innerHTML = picks.map((movie, i) => {
        const year    = (movie.release_date || "").slice(0, 4);
        const genres  = (movie.genres || []).slice(0, 2).join(" \u00b7 ");
        const bgStyle = movie.poster || movie.backdrop
          ? `style="background-image:url('${movie.poster || movie.backdrop}');background-size:cover;background-position:center;"`
          : `class="${bgClasses[i]}"`;
        return `
          <div class="feat-card${isBig[i] ? " big" : ""}" onclick="location.href='movie-detail.html?id=${movie.tmdb_id}'">
            <div class="feat-poster" ${bgStyle}>
              <div class="feat-overlay"></div>
              <div class="feat-info">
                <div class="feat-title">${movie.title}</div>
                <div class="feat-year">${year}</div>
              </div>
            </div>
            <div class="feat-bottom">
              <div class="feat-rating">\u2605 ${movie.rating}</div>
              <div class="feat-genre">${genres}</div>
            </div>
          </div>`;
      }).join("");
    } else {
      featured.innerHTML = "";
    }
  }

  // People rows
  if (peopleRes.status === "fulfilled") {
    const people    = peopleRes.value;
    const actors    = people.filter(p => p.department === "Acting").slice(0, 8);
    const directors = people.filter(p => p.department === "Directing").slice(0, 8);
    const actorRow  = peopleRows[0];
    const dirRow    = peopleRows[1];
    if (actorRow) {
      actorRow.innerHTML = actors.map(p => {
        const initials = p.name.split(" ").map(w => w[0]).join("").slice(0, 2);
        const photo = p.photo
          ? `<img src="${p.photo}" alt="${p.name}" style="width:94px;height:94px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">`
          : `<div class="person-circle pc1">${initials}</div>`;
        return `<div class="person-card" onclick="location.href='celebrity-detail.html?id=${p.person_id}'">${photo}<div class="person-name">${p.name}</div><div class="person-role">Actor</div></div>`;
      }).join("");
    }
    if (dirRow) {
      dirRow.innerHTML = directors
        .filter(p => p.photo)
        .map(p => `
          <div class="person-card" onclick="location.href='celebrity-detail-director.html?id=${p.person_id}'">
            <img src="${p.photo}" alt="${p.name}" style="width:94px;height:94px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">
            <div class="person-name">${p.name}</div>
            <div class="person-role">Director</div>
          </div>`).join("");
    }
  }
}


// ==============================================================================
// PAGE: browse.html
// ==============================================================================

// Browse page state — server-side filtering via /discover endpoint
let _allMovies      = [];
let _activeGenreIds = [];   // comma-joined = AND logic in TMDB
let _currentPage    = 1;
let _totalPages     = 1;
let _sortBy         = "popularity.desc";
let _yearFrom       = "";
let _yearTo         = "";
let _budgetMin      = "";   // in $B e.g. "0.5" = $500M
let _budgetMax      = "";
let _revenueMin     = "";   // in $B e.g. "1" = $1B
let _revenueMax     = "";

async function loadBrowsePage() {
  const movieList = document.getElementById("movie-list");
  if (!movieList) return;
  movieList.innerHTML = skelMovieRows(5);

  try {
    const genres = await apiFetch("/genres");
    const genreBar = document.querySelector(".genre-bar");
    if (genreBar) {
      const label = genreBar.querySelector(".filter-label");
      genreBar.innerHTML = "";
      if (label) genreBar.appendChild(label);
      genres.slice(0, 12).forEach(g => {
        const btn = document.createElement("button");
        btn.className = "genre-pill";
        btn.textContent = g.name;
        btn.dataset.genreId = g.id;
        genreBar.appendChild(btn);
        btn.addEventListener("click", () => {
          btn.classList.toggle("active");
          _activeGenreIds = Array.from(genreBar.querySelectorAll(".genre-pill.active"))
            .map(b => b.dataset.genreId);
          _currentPage = 1;
          fetchAndRender(1);
        });
      });
    }
  } catch (_) {}

  await fetchAndRender(1);

  function readFilters() {
    _yearFrom   = document.getElementById("yearFrom")?.value    || "";
    _yearTo     = document.getElementById("yearTo")?.value      || "";
    _budgetMin  = document.getElementById("budgetFrom")?.value  || "";
    _budgetMax  = document.getElementById("budgetTo")?.value    || "";
    _revenueMin = document.getElementById("revenueFrom")?.value || "";
    _revenueMax = document.getElementById("revenueTo")?.value   || "";
  }

  document.getElementById("applyFilters")?.addEventListener("click", () => {
    readFilters(); _currentPage = 1; fetchAndRender(1);
  });

  document.getElementById("clearFilters")?.addEventListener("click", () => {
    ["yearFrom","yearTo","budgetFrom","budgetTo","revenueFrom","revenueTo"].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = "";
    });
    document.querySelectorAll(".genre-pill").forEach(p => p.classList.remove("active"));
    _activeGenreIds = []; _yearFrom = ""; _yearTo = "";
    _budgetMin = ""; _budgetMax = ""; _revenueMin = ""; _revenueMax = "";
    _sortBy = "popularity.desc";
    const sortEl = document.getElementById("sortSelect");
    if (sortEl) sortEl.value = "popularity";
    _currentPage = 1; fetchAndRender(1);
  });

  document.getElementById("sortSelect")?.addEventListener("change", (e) => {
    const map = {
      "popularity":   "popularity.desc",
      "year_desc":    "primary_release_date.desc",
      "year_asc":     "primary_release_date.asc",
      "rating_desc":  "vote_average.desc",
      "revenue_desc": "revenue.desc",
    };
    _sortBy = map[e.target.value] || "popularity.desc";
    _currentPage = 1; fetchAndRender(1);
  });

  document.querySelectorAll(".filter-input").forEach(input => {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { readFilters(); _currentPage = 1; fetchAndRender(1); }
    });
  });
}

async function fetchAndRender(page = 1) {
  const movieList = document.getElementById("movie-list");
  if (!movieList) return;

  const hasBudgetRevFilter = _budgetMin || _budgetMax || _revenueMin || _revenueMax;
  if (hasBudgetRevFilter) {
    movieList.innerHTML = `<div class="loading" style="padding:60px;text-align:center;color:var(--muted)">
      Fetching detailed data for filtering&hellip;</div>`;
  } else {
    movieList.innerHTML = skelMovieRows(5);
  }

  try {
    const params = new URLSearchParams({ page, sort_by: _sortBy });
    if (_activeGenreIds.length > 0) params.set("genres",      _activeGenreIds.join(","));
    if (_yearFrom)   params.set("year_from",   _yearFrom);
    if (_yearTo)     params.set("year_to",     _yearTo);
    // Pass in $B — backend converts to raw $
    if (_budgetMin)  params.set("budget_min",  _budgetMin);
    if (_budgetMax)  params.set("budget_max",  _budgetMax);
    if (_revenueMin) params.set("revenue_min", _revenueMin);
    if (_revenueMax) params.set("revenue_max", _revenueMax);

    const data = await apiFetch(`/movies/discover?${params}`, {noCache: true});
    _allMovies   = data.movies     || [];
    _currentPage = data.page       || page;
    _totalPages  = data.total_pages || 1;
    renderMovies();
  } catch (e) {
    movieList.innerHTML = `<div style="padding:20px;color:var(--muted)">Could not load movies: ${e.message}</div>`;
  }
}

function renderMovies() {
  const movieList = document.getElementById("movie-list");
  if (!movieList) return;
  const countEl = document.getElementById("results-count");
  if (countEl) countEl.textContent = _allMovies.length;
  if (!_allMovies.length) {
    movieList.innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted)">No movies found for these filters.</div>`;
    renderPagination(); return;
  }
  movieList.innerHTML = _allMovies.map(m => movieRowHTML(m)).join("");
  renderPagination();
}

function renderPagination() {
  const old = document.getElementById("browse-pagination");
  if (old) old.remove();
  if (_totalPages <= 1) return;

  const pag = document.createElement("div");
  pag.id = "browse-pagination";
  pag.className = "browse-pagination";

  let pages = [];
  if (_totalPages <= 7) {
    pages = Array.from({length: _totalPages}, (_, i) => i + 1);
  } else {
    pages = [1];
    if (_currentPage > 3) pages.push("...");
    for (let i = Math.max(2, _currentPage - 1); i <= Math.min(_totalPages - 1, _currentPage + 1); i++) pages.push(i);
    if (_currentPage < _totalPages - 2) pages.push("...");
    pages.push(_totalPages);
  }

  const prev = document.createElement("button");
  prev.className = "pag-btn" + (_currentPage === 1 ? " disabled" : "");
  prev.textContent = "\u2190";
  prev.onclick = () => { if (_currentPage > 1) goToPage(_currentPage - 1); };
  pag.appendChild(prev);

  pages.forEach(p => {
    const btn = document.createElement("button");
    if (p === "...") {
      btn.className = "pag-ellipsis"; btn.textContent = "\u2026"; btn.disabled = true;
    } else {
      btn.className = "pag-btn" + (p === _currentPage ? " active" : "");
      btn.textContent = p;
      btn.onclick = () => goToPage(p);
    }
    pag.appendChild(btn);
  });

  const next = document.createElement("button");
  next.className = "pag-btn" + (_currentPage === _totalPages ? " disabled" : "");
  next.textContent = "\u2192";
  next.onclick = () => { if (_currentPage < _totalPages) goToPage(_currentPage + 1); };
  pag.appendChild(next);

  document.getElementById("movie-list").insertAdjacentElement("afterend", pag);
}

function goToPage(page) {
  _currentPage = page;
  window.scrollTo({top: 0, behavior: "smooth"});
  fetchAndRender(page);
}


async function loadSearch(q) {
  const movieList = document.getElementById("movie-list") || document.querySelector(".movie-list");
  movieList.innerHTML = skelMovieRows(3);
  try {
    const data    = await apiFetch(`/search?q=${encodeURIComponent(q)}`);
    const countEl = document.querySelector(".results-count strong");
    if (countEl) countEl.textContent = data.total || 0;
    renderMovieList(data.results || [], data.total || 0);
  } catch (e) {
    movieList.innerHTML = `<div style="padding:20px;color:var(--muted)">Error: ${e.message}</div>`;
  }
}

function renderMovieList(movies, total) {
  const movieList = document.getElementById("movie-list") || document.querySelector(".movie-list");
  const countEl   = document.querySelector(".results-count strong");
  if (countEl) countEl.textContent = total || movies.length;
  if (!movies.length) {
    movieList.innerHTML = `<div style="padding:20px;color:var(--muted)">No movies found.</div>`;
    return;
  }
  movieList.innerHTML = movies.map(m => movieRowHTML(m)).join("");
}


// ==============================================================================
// PAGE: movie-detail.html
// ==============================================================================

async function loadMovieDetailPage() {
  const detailBg = document.querySelector(".detail-bg");
  if (!detailBg) return;

  const id = getUrlId();
  if (!id) return;
 skelMovieDetail();
  try {
    const m = await apiFetch(`/movies/${id}`);

    // Poster
    const posterEl = document.querySelector(".detail-poster");
    if (posterEl && m.poster) {
      posterEl.style.backgroundImage    = `url('${m.poster}')`;
      posterEl.style.backgroundSize     = "cover";
      posterEl.style.backgroundPosition = "center";
      posterEl.textContent = "";
    }
// Backdrop
detailBg.style.background = m.backdrop
  ? `linear-gradient(to bottom,rgba(10,16,28,.5),rgba(238,244,255,.95)), url('${m.backdrop}') center/cover no-repeat`
  : "";
    // Title
    const titleEl = document.querySelector(".detail-title");
    if (titleEl) titleEl.textContent = m.title;
    document.title = `${m.title} \u2014 PictoPlex`;

    // Breadcrumb
    const crumbTitle = document.querySelector(".breadcrumb-movie-title");
    if (crumbTitle) crumbTitle.textContent = m.title;

    // Badges — no director in badge, it's in the director section below
    const badgesEl = document.querySelector(".detail-badges");
    if (badgesEl) {
      const year    = (m.release_date || "").slice(0, 4);
      const runtime = fmtRuntime(m.runtime);
      badgesEl.innerHTML = `
        <span class="badge badge-navy">${year}</span>
        ${runtime ? `<span class="badge badge-blue">${runtime}</span>` : ""}
        <span class="badge" style="background:var(--gold);color:var(--navy)">\u2605 ${m.rating}</span>`;
    }

    // Genres
    const genreEl = document.querySelector(".detail-genres");
    if (genreEl) genreEl.innerHTML = (m.genres || []).map(g => `<span class="movie-tag">${g}</span>`).join("");

    // Description
    const descEl = document.querySelector(".detail-desc");
    if (descEl) descEl.textContent = m.overview;

    // Trailer
    const trailerBtn = document.querySelector(".btn-dark");
    if (trailerBtn && m.trailer_url) {
      trailerBtn.href        = m.trailer_url;
      trailerBtn.target      = "_blank";
      trailerBtn.textContent = "\u25b6 Watch trailer";
    }

    // Stats
    const stats = document.querySelectorAll(".stat-val");
    if (stats.length >= 4) {
      stats[0].textContent = fmtMoney(m.budget);
      stats[1].textContent = fmtMoney(m.revenue);
      const roi = m.budget && m.revenue ? (m.revenue / m.budget).toFixed(1) + "\u00d7" : "N/A";
      stats[2].textContent = roi;
      stats[3].textContent = (m.release_date || "").slice(0, 7).replace("-", "/") || "N/A";
    }

    // Similar panel
    const simPanel = document.querySelector(".similar-panel");
    if (simPanel && m.similar?.length) {
      simPanel.innerHTML = `
        <div class="panel-lbl">More like this</div>
        ${m.similar.map(s => `
          <div class="sim-card" onclick="location.href='movie-detail.html?id=${s.tmdb_id}'">
            ${s.poster ? `<img src="${s.poster}" class="sim-poster" style="object-fit:cover;">` : `<div class="sim-poster sp1"></div>`}
            <div><div class="sim-t">${s.title}</div><div class="sim-s">\u2605 ${s.rating}</div></div>
          </div>`).join("")}
        <div class="sim-all" onclick="location.href='browse.html'">See all similar &rarr;</div>`;
    }

    // Cast row — only actors with photos
    const castRow       = document.getElementById("cast-row");
    const allActorsLink = document.getElementById("all-actors-link");
    if (castRow && m.cast?.length) {
      const withPhoto = m.cast.filter(c => c.photo);
      castRow.innerHTML = withPhoto.map(c => `
        <div class="person-card" onclick="location.href='celebrity-detail.html?id=${c.person_id}'">
          <img src="${c.photo}" alt="${c.name}" style="width:84px;height:84px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">
          <div class="person-name">${c.name}</div>
          <div class="person-role">${c.character_name || ""}</div>
        </div>`).join("");
      if (allActorsLink) allActorsLink.href = `all-actors.html?id=${id}`;
    }

    // Director row — only directors with photos
    const dirRow        = document.getElementById("director-row");
    const allDirsLink   = document.getElementById("all-directors-link");
    if (dirRow && m.directors?.length) {
      const withPhoto = m.directors.filter(d => d.photo);
      dirRow.innerHTML = withPhoto.map(d => `
        <div class="person-card" onclick="location.href='celebrity-detail-director.html?id=${d.person_id}'">
          <img src="${d.photo}" alt="${d.name}" style="width:84px;height:84px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">
          <div class="person-name">${d.name}</div>
          <div class="person-role">Director</div>
        </div>`).join("");
      if (allDirsLink) allDirsLink.href = `all-directors.html?id=${id}`;
    }

    
  } catch (e) {
    detailBg.innerHTML = `<div style="padding:40px;color:var(--muted)">Could not load movie: ${e.message}</div>`;
  }
}

function addWatchlistButton(tmdbId, title) {
  const btns = document.querySelector(".detail-btns");
  if (!btns) return;
  const btn = document.createElement("button");
  btn.className   = "btn btn-outline btn-sm";
  btn.textContent = "+ Watchlist";
  btn.onclick = async () => {
    const data = await apiPost("/watchlist", { tmdb_id: parseInt(tmdbId) });
    if (data.watchlist_id) {
      btn.textContent = "\u2713 Added";
      btn.disabled = true;
    } else {
      alert(data.error || "Could not add to watchlist");
    }
  };
  btns.appendChild(btn);
}


// ==============================================================================
// PAGE: all-actors.html
// ==============================================================================

async function loadAllActorsPage() {
  const grid = document.getElementById("actors-grid");
  if (!grid) return;
  grid.innerHTML = skelCelebGrid(12);
  try {
    const people = await apiFetch("/person/popular");
    const actors = people.filter(p => p.department === "Acting");
    grid.innerHTML = actors.map(p => celebCardHTML(p, false)).join("");
  } catch (e) {
    grid.innerHTML = `<div style="color:var(--muted)">Could not load actors.</div>`;
  }
}


// ==============================================================================
// PAGE: all-directors.html
// ==============================================================================

async function loadAllDirectorsPage() {
  const grid = document.getElementById("directors-grid");
  if (!grid) return;
  grid.innerHTML = skelCelebGrid(12);
  try {
    const people = await apiFetch("/person/popular");
    const directors = people.filter(p => p.department === "Directing");
    grid.innerHTML = directors.map(p => celebCardHTML(p, true)).join("");
  } catch (e) {
    grid.innerHTML = `<div style="color:var(--muted)">Could not load directors.</div>`;
  }
}


// ==============================================================================
// PAGE: celebrity-detail.html & celebrity-detail-director.html
// ==============================================================================

async function loadCelebDetailPage() {
  const celebHero = document.querySelector(".celeb-hero");
  if (!celebHero) return;

  const id = getUrlId();
  if (!id) return;
   skelCelebDetail();

  try {
    const p = await apiFetch(`/person/${id}`);

    document.title = `${p.name} \u2014 PictoPlex`;

    const nameEl = celebHero.querySelector(".celeb-hero-name");
    if (nameEl) nameEl.textContent = p.name;

    const badgeEl = celebHero.querySelector(".celeb-hero-badge");
    if (badgeEl) {
      const isDirector = p.department === "Directing";
      badgeEl.textContent      = isDirector ? "Director" : "Actor";
      badgeEl.style.background = isDirector ? "var(--gold)" : "var(--blue)";
      badgeEl.style.color      = isDirector ? "var(--navy)" : "#fff";
    }

    const circle = celebHero.querySelector(".person-circle");
    if (circle && p.photo) {
      const img = document.createElement("img");
      img.src   = p.photo;
      img.alt   = p.name;
      img.style.cssText = "width:126px;height:126px;border-radius:50%;object-fit:cover;border:3px solid var(--border);flex-shrink:0;";
      circle.replaceWith(img);
    }

    const metaEl = celebHero.querySelector(".celeb-hero-meta");
    if (metaEl) {
      metaEl.innerHTML = `
        ${p.birthday   ? `<div class="celeb-meta-item">Born <strong>${p.birthday}</strong></div>` : ""}
        ${p.birthplace ? `<div class="celeb-meta-item">From <strong>${p.birthplace}</strong></div>` : ""}
        <div class="celeb-meta-item">Known for <strong>${p.total_films} films</strong></div>`;
    }

    const bioEl = document.querySelector(".celeb-bio");
    if (bioEl) bioEl.textContent = p.biography || "No biography available.";

    const filmGrid = document.querySelector(".filmography");
    if (filmGrid && p.filmography?.length) {
      filmGrid.innerHTML = p.filmography
        .filter(f => f.poster)
        .map(f => {
          const role = f.character || f.job || "";
          return `
            <div class="film-card" onclick="location.href='movie-detail.html?id=${f.tmdb_id}'">
              <div class="film-poster">
                <img src="${f.poster}" alt="${f.title}" style="width:100%;height:100%;object-fit:cover;">
              </div>
              <div class="film-body">
                <div class="film-title">${f.title}</div>
                <div class="film-meta">${f.year}</div>
                ${role ? `<div class="film-char">${role}</div>` : ""}
              </div>
            </div>`;
        }).join("");
    }

    const secLabel = document.querySelector(".celeb-body .sec-label:last-of-type");
    if (secLabel) secLabel.textContent = `Filmography \u2014 ${p.total_films} films`;

  } catch (e) {
    console.error("Could not load celebrity:", e);
  }
}


// ==============================================================================
// PAGE: celebrities.html
// ==============================================================================

async function loadCelebritiesPage() {
  const celebGrids = document.querySelectorAll(".celeb-grid");
  if (!celebGrids.length) return;

  if (celebGrids[0]) celebGrids[0].innerHTML = skelCelebGrid(6);
  if (celebGrids[1]) celebGrids[1].innerHTML = skelCelebGrid(6);
  const popChart = document.querySelector(".pop-chart");
  if (popChart) popChart.innerHTML = skelPopChart(5);

  try {
    const people    = await apiFetch("/person/popular");
    const actors    = people.filter(p => p.department === "Acting").slice(0, 6);
    const directors = people.filter(p => p.department === "Directing").slice(0, 6);

    if (celebGrids[0]) celebGrids[0].innerHTML = actors.map(p => celebCardHTML(p, false)).join("");
    if (celebGrids[1]) celebGrids[1].innerHTML = directors.map(p => celebCardHTML(p, true)).join("");

    const chart = document.querySelector(".pop-chart");
    if (chart) {
      chart.innerHTML = people.slice(0, 5).map((p, i) => {
        const initials   = p.name.split(" ").map(w => w[0]).join("").slice(0, 2);
        const isDir      = p.department === "Directing";
        const detailPage = isDir ? "celebrity-detail-director" : "celebrity-detail";
        const photo      = p.photo
          ? `<img src="${p.photo}" alt="${p.name}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">`
          : `<div class="person-circle" style="width:44px;height:44px;font-size:14px;${isDir ? "background:linear-gradient(135deg,var(--blue3),#c8d8f5);color:var(--blue2);" : "background:linear-gradient(135deg,var(--gold3),#ffe8a0);color:var(--gold2);"}">${initials}</div>`;
        return `
          <div class="pop-row" onclick="location.href='${detailPage}.html?id=${p.person_id}'">
            <div class="pop-rank${i < 3 ? " top" : ""}">${i + 1}</div>
            ${photo}
            <div class="pop-info">
              <div class="pop-name">${p.name} <span class="pop-badge ${isDir ? "director" : "actor"}">${isDir ? "Director" : "Actor"}</span></div>
              <div class="pop-sub">${(p.known_for || []).join(", ")}</div>
            </div>
          </div>`;
      }).join("");
    }

  } catch (e) {
    console.error("Could not load celebrities:", e);
  }
}


// ==============================================================================
// AUTH
// ==============================================================================

window.handleLogin = async function (event) {
  event.preventDefault();
  const email    = document.getElementById("login-email")?.value;
  const password = document.getElementById("login-password")?.value;
  try {
    const data = await apiPost("/auth/login", { email, password });
    if (data.user_id) {
      sessionStorage.setItem("user_id",  data.user_id);
      sessionStorage.setItem("username", data.username);
      updateNav(data.username);
      window.closeAccountModal?.();
      document.getElementById("login-email").value    = "";
      document.getElementById("login-password").value = "";
    } else {
      alert(data.error || "Login failed");
    }
  } catch { alert("Could not reach the server."); }
};

window.handleSignUp = async function (event) {
  event.preventDefault();
  const username = document.getElementById("signup-name")?.value;
  const email    = document.getElementById("signup-email")?.value;
  const password = document.getElementById("signup-password")?.value;
  const confirm  = document.getElementById("signup-confirm")?.value;
  if (password !== confirm) { alert("Passwords do not match!"); return; }
  try {
    const data = await apiPost("/auth/register", { username, email, password });
    if (data.user_id) {
      sessionStorage.setItem("user_id",  data.user_id);
      sessionStorage.setItem("username", data.username);
      updateNav(data.username);
      window.closeAccountModal?.();
    } else {
      alert(data.error || "Registration failed");
    }
  } catch { alert("Could not reach the server."); }
};

window.handleLogout = async function () {
  await apiPost("/auth/logout", {});
  sessionStorage.clear();
  updateNav(null);
};

function updateNav(username) {
  const btn = document.getElementById("navAccount");
  if (btn) btn.textContent = username || "Account";
}


// ==============================================================================
// UI — Scroll reveal, tabs, genre pills, nav active state
// ==============================================================================

function initUI() {

  // ── NAV SEARCH ──
  initNavSearch();

  // ── SCROLL REVEAL ──
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });
    reveals.forEach(el => observer.observe(el));
  }

  // ── TABS ──
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const group = tab.closest('.tabs');
      const panel = tab.closest('section') || tab.closest('.tabs-wrapper') || document;
      group.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      if (target) {
        panel.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const content = panel.querySelector(`#${target}`);
        if (content) content.classList.add('active');
      }
    });
  });

  // ── GENRE PILLS ──
  document.querySelectorAll('.genre-pill').forEach(pill => {
    pill.addEventListener('click', e => {
      e.preventDefault();
      const multi = pill.closest('[data-multi]');
      if (multi) {
        pill.classList.toggle('active');
      } else {
        pill.closest('.genre-bar, .genre-grid')
          ?.querySelectorAll('.genre-pill')
          .forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
      }
    });
  });

  // ── NAV ACTIVE LINK ──
  const page       = window.location.pathname.split('/').pop() || 'index.html';
  const celebPages = ['celebrities.html', 'celebrity-detail.html', 'celebrity-detail-director.html'];
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href') || '';
    if (href === 'celebrities.html' && celebPages.includes(page)) link.classList.add('active');
    else if (href === 'index.html' && !celebPages.includes(page))  link.classList.add('active');
  });

  // ── SORT SELECT ──
  const sortSelect = document.querySelector('.sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      console.log('Sort by:', sortSelect.value);
    });
  }
}


// ==============================================================================
// ROUTER
// ==============================================================================

document.addEventListener("DOMContentLoaded", () => {
  const page = window.location.pathname.split("/").pop() || "index.html";

  const savedUser = sessionStorage.getItem("username");
  if (savedUser) updateNav(savedUser);

  initUI();

  if      (page === "index.html" || page === "")            loadIndexPage();
  else if (page === "browse.html")                           loadBrowsePage();
  else if (page === "movie-detail.html")                     loadMovieDetailPage();
  else if (page === "all-actors.html")                       loadAllActorsPage();
  else if (page === "all-directors.html")                    loadAllDirectorsPage();
  else if (page === "celebrities.html")                      loadCelebritiesPage();
  else if (page === "celebrity-detail.html" ||
           page === "celebrity-detail-director.html")        loadCelebDetailPage();
});