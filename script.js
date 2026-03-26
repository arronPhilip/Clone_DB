// ============================================================
//  PictoPlex — Frontend JavaScript (Fully Functional)
//  All navigation, search, filters, and data loading working
// ============================================================

const API = '/api'

// ── UTILITY FUNCTIONS ────────────────────────────────────────

async function fetchAPI(endpoint) {
  const res = await fetch(`${API}${endpoint}`)
  if (!res.ok) throw new Error(`API ${res.status}: ${endpoint}`)
  return res.json()
}

function initials(name) {
  return (name || '').split(' ').filter(w => w.length > 0).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function formatMoney(n) {
  if (!n || n <= 0) return 'N/A'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return '$' + Math.round(n / 1e6) + 'M'
  if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K'
  return '$' + n
}

function formatYear(dateStr) {
  if (!dateStr) return ''
  try { return new Date(dateStr).getFullYear() } catch { return '' }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try { return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return dateStr }
}

function getParam(key) {
  return new URLSearchParams(window.location.search).get(key)
}

const PC_COLORS = ['pc1','pc2','pc3','pc4','pc5','pc6']
const MP_COLORS = ['mp1','mp2','mp3','mp4','mp5']
const TP_COLORS = ['tp1','tp2','tp3','tp4','tp5']
const FP_COLORS = ['fp1','fp2','fp3','fp4']

// ── SHARED NAV SEARCH ────────────────────────────────────────

function initNavSearch() {
  const input   = document.getElementById('nav-search-input')
  const results = document.getElementById('nav-search-results')
  if (!input || !results) return

  let timer = null

  input.addEventListener('input', () => {
    clearTimeout(timer)
    const q = input.value.trim()
    if (q.length < 2) { results.classList.remove('open'); return }
    timer = setTimeout(() => runNavSearch(q), 300)
  })

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = input.value.trim()
      if (q) window.location.href = `browse.html?q=${encodeURIComponent(q)}`
    }
    if (e.key === 'Escape') { results.classList.remove('open'); input.blur() }
  })

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !results.contains(e.target)) results.classList.remove('open')
  })
}

async function runNavSearch(q) {
  const results = document.getElementById('nav-search-results')
  if (!results) return
  results.innerHTML = '<div class="search-no-results">Searching…</div>'
  results.classList.add('open')

  try {
    const data = await fetchAPI(`/search?q=${encodeURIComponent(q)}`)
    if (!data.length) {
      results.innerHTML = `<div class="search-no-results">No results for "${q}"</div>`
      return
    }
    results.innerHTML = data.slice(0, 8).map((m, i) => `
      <div class="search-result-item" onclick="location.href='movie-detail.html?id=${m.movie_id}'">
        <div class="sri-poster ${MP_COLORS[i % 5]}"></div>
        <div>
          <div class="sri-title">${m.title}</div>
          <div class="sri-meta">${formatYear(m.release_date)}${m.budget > 0 ? ' · ' + formatMoney(m.budget) : ''}</div>
        </div>
      </div>
    `).join('')
  } catch (e) {
    results.innerHTML = '<div class="search-no-results">Search unavailable — is the server running?</div>'
  }
}

// ── SHARED TABS ───────────────────────────────────────────────

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const group = tab.closest('.tabs')
      group.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      const target = tab.dataset.tab
      if (target) {
        const scope = document.body
        scope.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
        const content = document.getElementById(target)
        if (content) content.classList.add('active')
      }
    })
  })
}

// ── SHARED SCROLL REVEAL ──────────────────────────────────────

function initReveal() {
  const els = document.querySelectorAll('.reveal')
  if (!els.length) return
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) } })
  }, { threshold: 0.08 })
  els.forEach(el => obs.observe(el))
}

// ── SET ACTIVE NAV LINK ───────────────────────────────────────

function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html'
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active')
    const href = link.getAttribute('href') || ''
    if (href === page) link.classList.add('active')
    if ((page === '' || page === 'index.html') && href === 'index.html') link.classList.add('active')
    if (page === 'browse.html' && href === 'browse.html') link.classList.add('active')
    if ((page === 'celebrities.html' || page === 'celebrity-detail.html' || page === 'celebrity-detail-director.html') && href === 'celebrities.html') link.classList.add('active')
  })
}

// ── HOMEPAGE ─────────────────────────────────────────────────

async function initHomepage() {
  // Load trending movies
  try {
    const data = await fetchAPI('/movies?limit=5')
    const grid = document.querySelector('.trending-grid')
    if (grid && data.movies?.length) {
      grid.innerHTML = data.movies.map((m, i) => `
        <div class="trend-card" onclick="location.href='movie-detail.html?id=${m.movie_id}'">
          <div class="trend-poster ${TP_COLORS[i]}">
            <div class="trend-overlay"></div>
            <div class="trend-rank">#${i + 1}</div>
          </div>
          <div class="trend-body">
            <div class="trend-title">${m.title}</div>
            <div class="trend-meta">
              ${formatYear(m.release_date)}
              ${m.genres ? `· <span class="movie-tag">${m.genres.split(',')[0].trim()}</span>` : ''}
            </div>
          </div>
        </div>
      `).join('')
    }
  } catch (e) { console.warn('Trending load failed:', e.message) }

  // Load genres
  try {
    const genres = await fetchAPI('/genres')
    const grid = document.querySelector('.genre-grid')
    if (grid && genres.length) {
      grid.innerHTML = genres.slice(0, 10).map(g => `
        <a href="browse.html?genre=${encodeURIComponent(g.name)}" class="genre-pill">${g.name}</a>
      `).join('')
    }
  } catch (e) { console.warn('Genres load failed:', e.message) }

  // Load popular actors
  try {
    const data = await fetchAPI('/celebrities?type=actor&limit=8')
    const row = document.querySelectorAll('.people-row')[0]
    if (row && data.actors?.length) {
      row.innerHTML = data.actors.map((a, i) => `
        <a href="celebrity-detail.html?id=${a.person_id}" class="person-card">
          <div class="person-circle md ${PC_COLORS[i % 6]}">${initials(a.name)}</div>
          <div class="person-name">${a.name}</div>
          <div class="person-role">Actor</div>
        </a>
      `).join('')
    }
  } catch (e) { console.warn('Actors load failed:', e.message) }

  // Load popular directors
  try {
    const data = await fetchAPI('/celebrities?type=director&limit=8')
    const row = document.querySelectorAll('.people-row')[1]
    if (row && data.directors?.length) {
      row.innerHTML = data.directors.map((d, i) => `
        <a href="celebrity-detail-director.html?id=${d.person_id}" class="person-card">
          <div class="person-circle md ${PC_COLORS[i % 6]}">${initials(d.name)}</div>
          <div class="person-name">${d.name}</div>
          <div class="person-role">Director</div>
        </a>
      `).join('')
    }
  } catch (e) { console.warn('Directors load failed:', e.message) }
}

// ── BROWSE PAGE ───────────────────────────────────────────────

async function initBrowse() {
  // Check for search query in URL
  const q = getParam('q')
  if (q) {
    const input = document.getElementById('nav-search-input')
    if (input) input.value = q
    await runBrowseSearch(q)
    return
  }

  // Check for genre in URL
  const genreParam = getParam('genre')

  // Load genres into pills
  try {
    const genres = await fetchAPI('/genres')
    const bar = document.querySelector('.genre-bar')
    if (bar) {
      const label = bar.querySelector('.filter-label')
      bar.innerHTML = ''
      if (label) bar.appendChild(label)
      genres.forEach(g => {
        const btn = document.createElement('button')
        btn.className = 'genre-pill' + (g.name === genreParam ? ' active' : '')
        btn.textContent = g.name
        btn.dataset.genre = g.name
        btn.addEventListener('click', () => {
          btn.classList.toggle('active')
          loadBrowseMovies(1) // Reset to page 1 when genre changes
        })
        bar.appendChild(btn)
      })
    }
  } catch (e) { console.warn('Genre pills failed:', e.message) }

  // Wire up filter button - reset to page 1
  const filterBtn = document.querySelector('.filter-btn')
  if (filterBtn) filterBtn.addEventListener('click', () => loadBrowseMovies(1))

  // Wire up clear button - reset to page 1
  const clearBtn = document.querySelector('.filter-clear')
  if (clearBtn) clearBtn.addEventListener('click', () => {
    document.querySelectorAll('.filter-input').forEach(i => i.value = '')
    document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'))
    loadBrowseMovies(1)
  })

  // Wire up sort - reset to page 1
  const sortSel = document.querySelector('.sort-select')
  if (sortSel) sortSel.addEventListener('change', () => loadBrowseMovies(1))

  await loadBrowseMovies(1) // Start at page 1
}
async function runBrowseSearch(q) {
  const list = document.querySelector('.movie-list')
  if (!list) return
  list.innerHTML = '<div class="loading"></div>'

  const countEl = document.querySelector('.results-count')
  if (countEl) countEl.innerHTML = `Searching for <strong>"${q}"</strong>…`

  try {
    const results = await fetchAPI(`/search?q=${encodeURIComponent(q)}`)
    updateResultsCount(results.length)
    renderMovieList(list, results)
  } catch (e) {
    list.innerHTML = '<div class="empty-state"><h3>Search failed</h3><p>Is the server running at localhost:3000?</p></div>'
  }
}

async function loadBrowseMovies() {
  const list = document.querySelector('.movie-list')
  if (!list) return
  list.innerHTML = '<div class="loading"></div>'

  const inputs = document.querySelectorAll('.filter-input')
  const yearFrom  = inputs[0]?.value || ''
  const yearTo    = inputs[1]?.value || ''
  const budgetMin = inputs[2]?.value ? String(parseFloat(inputs[2].value) * 1_000_000) : ''
  const budgetMax = inputs[3]?.value ? String(parseFloat(inputs[3].value) * 1_000_000) : ''
  const revMin    = inputs[4]?.value ? String(parseFloat(inputs[4].value) * 1_000_000) : ''
  const revMax    = inputs[5]?.value ? String(parseFloat(inputs[5].value) * 1_000_000) : ''

  const activeGenres = [...document.querySelectorAll('.genre-pill.active')].map(p => p.dataset.genre)

  const sortSel = document.querySelector('.sort-select')
  const sortVal = sortSel?.value || 'revenue'
  const sortMap = {
    'Revenue (highest)': 'revenue',
    'Budget (highest)': 'budget',
    'Year (newest)': 'year_desc',
    'Year (oldest)': 'year_asc',
    'Title A–Z': 'title'
  }
  const sort = sortMap[sortVal] || 'revenue'

  const params = new URLSearchParams()
  if (yearFrom)         params.set('yearFrom',  yearFrom)
  if (yearTo)           params.set('yearTo',    yearTo)
  if (budgetMin)        params.set('budgetMin', budgetMin)
  if (budgetMax)        params.set('budgetMax', budgetMax)
  if (revMin)           params.set('revMin',    revMin)
  if (revMax)           params.set('revMax',    revMax)
  if (activeGenres[0])  params.set('genre',     activeGenres[0])
  params.set('sort',  sort)
  params.set('limit', '20')

  try {
    const data = await fetchAPI(`/movies?${params}`)
    updateResultsCount(data.total || data.movies?.length || 0)
    renderMovieList(list, data.movies || [])
  } catch (e) {
    list.innerHTML = '<div class="empty-state"><h3>Could not load movies</h3><p>Is the server running at localhost:3000?</p></div>'
  }
}

function updateResultsCount(total) {
  const el = document.querySelector('.results-count')
  if (el) el.innerHTML = `Showing <strong>${total.toLocaleString()}</strong> films`
}

function renderMovieList(list, movies) {
  if (!movies.length) {
    list.innerHTML = '<div class="empty-state"><h3>No films found</h3><p>Try adjusting your filters.</p></div>'
    return
  }
  list.innerHTML = movies.map((m, i) => `
    <div class="movie-row" onclick="location.href='movie-detail.html?id=${m.movie_id}'">
      <div class="movie-poster ${MP_COLORS[i % 5]}"></div>
      <div class="movie-info">
        <div class="movie-title">${m.title}</div>
        <div class="movie-meta">
          ${formatYear(m.release_date) ? `<span><strong>${formatYear(m.release_date)}</strong></span>` : ''}
          ${m.runtime ? `<span>${m.runtime} min</span>` : ''}
          ${m.budget  > 0 ? `<span>Budget: <strong>${formatMoney(m.budget)}</strong></span>` : ''}
          ${m.revenue > 0 ? `<span>Revenue: <strong>${formatMoney(m.revenue)}</strong></span>` : ''}
        </div>
        <div class="movie-tags">
          ${m.genres ? m.genres.split(',').slice(0, 3).map(g => `<span class="movie-tag">${g.trim()}</span>`).join('') : ''}
        </div>
        <div class="movie-desc">${m.overview || 'No overview available.'}</div>
        <div class="movie-btns">
          <button class="btn btn-dark btn-sm" onclick="event.stopPropagation(); location.href='movie-detail.html?id=${m.movie_id}'">View Details</button>
        </div>
      </div>
    </div>
  `).join('')
}

// ── MOVIE DETAIL PAGE ─────────────────────────────────────────
async function initMovieDetail() {
  const id = getParam('id')
  console.log('[PictoPlex] Movie detail page loaded. ID:', id)
  console.log('[PictoPlex] API base URL:', API)

  // Show error if no ID
  if (!id) {
    showError('No movie ID found', 'Please go back to the browse page and click a film.')
    return
  }

  function showError(title, msg) {
    const banner = document.getElementById('error-banner')
    const t = document.getElementById('error-title')
    const m = document.getElementById('error-msg')
    
    // Create error banner if it doesn't exist
    if (!banner) {
      const detailHero = document.querySelector('.detail-hero')
      if (detailHero) {
        const errorDiv = document.createElement('div')
        errorDiv.id = 'error-banner'
        errorDiv.style.cssText = 'background: #ff4444; color: white; padding: 20px; margin: 20px; border-radius: 8px; text-align: center;'
        errorDiv.innerHTML = `
          <h3 id="error-title" style="margin: 0 0 10px 0;">${title}</h3>
          <p id="error-msg" style="margin: 0;">${msg}</p>
        `
        detailHero.parentNode.insertBefore(errorDiv, detailHero)
      }
    } else {
      banner.style.display = 'block'
      const tEl = document.getElementById('error-title')
      const mEl = document.getElementById('error-msg')
      if (tEl) tEl.textContent = title
      if (mEl) mEl.textContent = msg
    }
    
    const titleEl = document.getElementById('detail-title')
    if (titleEl) titleEl.textContent = 'Error loading movie'
  }

  function setEl(id, html, isText = false) {
    const el = document.getElementById(id)
    if (!el) {
      console.warn(`Element with id "${id}" not found`)
      return
    }
    if (isText) el.textContent = html
    else el.innerHTML = html
  }

  try {
    // Fetch movie data
    console.log(`Fetching from: ${API}/movies/${id}`)
    const m = await fetchAPI(`/movies/${id}`)
    console.log('[PictoPlex] Movie data received:', m)
    console.log('[PictoPlex] Movie data structure:', Object.keys(m))

    if (!m || !m.movie_id) {
      showError('Movie not found', `No movie found with ID ${id}. Please check if the movie exists in the database.`)
      return
    }

    // Page title
    document.title = `${m.title} — PictoPlex`

    // Breadcrumb
    setEl('bc-movie', m.title, true)

    // Section sub title
    setEl('movie-title-sub', `${m.title} (${formatYear(m.release_date)})`, true)

    // Poster placeholder text
    setEl('detail-poster', m.title, true)

    // Badges
    setEl('detail-badges', `
      ${formatYear(m.release_date) ? `<span class="badge badge-navy">${formatYear(m.release_date)}</span>` : ''}
      ${m.runtime ? `<span class="badge badge-blue">${m.runtime} min</span>` : ''}
      ${m.release_date ? `<span class="badge badge-blue">Released ${formatDate(m.release_date)}</span>` : ''}
    `)

    // Title
    setEl('detail-title', m.title, true)

    // Genres
    if (m.genres && m.genres.length) {
      setEl('detail-genres', m.genres.map(g => `<span class="movie-tag">${g.name}</span>`).join(''))
    } else {
      setEl('detail-genres', '')
    }

    // Description
    setEl('detail-desc', m.overview || 'No overview available.', true)

    // Stats
    setEl('stat-budget',  `<span class="stat-val">${formatMoney(m.budget)}</span><span class="stat-lbl">Budget</span>`)
    setEl('stat-revenue', `<span class="stat-val">${formatMoney(m.revenue)}</span><span class="stat-lbl">Revenue</span>`)
    const roi = m.budget > 0 && m.revenue > 0 ? (m.revenue / m.budget).toFixed(1) + '×' : 'N/A'
    setEl('stat-roi',     `<span class="stat-val">${roi}</span><span class="stat-lbl">ROI</span>`)
    setEl('stat-runtime', `<span class="stat-val">${m.runtime ? m.runtime + ' min' : 'N/A'}</span><span class="stat-lbl">Runtime</span>`)

    // Cast
    const actorsGrid = document.getElementById('actors-grid')
    if (actorsGrid) {
      if (m.cast && m.cast.length) {
        actorsGrid.innerHTML = m.cast.map((a, i) => `
          <a href="celebrity-detail.html?id=${a.person_id}" class="actor-card">
            <div class="person-circle sm ${PC_COLORS[i % PC_COLORS.length]}">${initials(a.name)}</div>
            <div class="actor-name">${a.name}</div>
            <div class="actor-char">${a.character_name || ''}</div>
          </a>
        `).join('')
      } else {
        actorsGrid.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px 0">No cast data available for this film.</p>'
      }
    }

    // Director
    const directorWrap = document.getElementById('director-wrap')
    if (directorWrap) {
      if (m.directors && m.directors.length) {
        const d = m.directors[0]
        const card = document.getElementById('director-card')
        const avatar = document.getElementById('dir-avatar')
        const name = document.getElementById('dir-name')
        const also = document.getElementById('dir-also')
        if (card) card.href = `celebrity-detail-director.html?id=${d.person_id}`
        if (avatar) { 
          avatar.textContent = initials(d.name)
          avatar.className = 'person-circle lg pc2'
        }
        if (name) name.textContent = d.name
        if (also) also.textContent = 'Click to view full filmography →'
      } else {
        directorWrap.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px 0">No director data available.</p>'
      }
    }

    // Similar films
    const similarPanel = document.getElementById('similar-panel')
    if (similarPanel && m.genres && m.genres.length) {
      try {
        const similar = await fetchAPI(`/movies?genre=${encodeURIComponent(m.genres[0].name)}&limit=5`)
        const filtered = (similar.movies || []).filter(s => s.movie_id !== m.movie_id).slice(0, 3)
        if (filtered.length) {
          const simCards = document.getElementById('sim-cards')
          if (simCards) {
            simCards.innerHTML = filtered.map((s, i) => `
              <div class="sim-card" onclick="location.href='movie-detail.html?id=${s.movie_id}'">
                <div class="sim-poster ${['sp1','sp2','sp3','sp4'][i % 4]}"></div>
                <div>
                  <div class="sim-t">${s.title}</div>
                  <div class="sim-s">${s.genres ? s.genres.split(',')[0].trim() : ''} · ${formatYear(s.release_date)}</div>
                </div>
              </div>
            `).join('')
          }
        } else {
          if (similarPanel) similarPanel.style.display = 'none'
        }
      } catch(e) {
        console.warn('Similar films failed to load:', e)
        if (similarPanel) similarPanel.style.display = 'none'
      }
    }

  } catch (err) {
    console.error('initMovieDetail error:', err)
    showError(
      'Could not load movie details',
      `Error: ${err.message}. Make sure the Node.js server is running at http://localhost:3000\n\nCheck the console for more details.`
    )
  }
}


// ── CELEBRITIES PAGE ──────────────────────────────────────────

async function initCelebrities() {
  const q = getParam('q')

  // Wire up search
  const searchInput = document.querySelector('.search-dark-input')
  if (searchInput) {
    if (q) searchInput.value = q
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const val = searchInput.value.trim()
        if (val) window.location.href = `celebrities.html?q=${encodeURIComponent(val)}`
      }
    })
  }

  // If search query, run search
  if (q) {
    await runCelebSearch(q)
    return
  }

  // Load tabs
  initTabs()

  try {
    const data = await fetchAPI('/celebrities?limit=12')

    // Actors grid
    const actorGrid = document.querySelectorAll('.celeb-grid')[0]
    if (actorGrid && data.actors?.length) {
      actorGrid.innerHTML = data.actors.slice(0, 6).map((a, i) => `
        <div class="celeb-gcard" onclick="location.href='celebrity-detail.html?id=${a.person_id}'">
          <div class="cg-img" style="background:linear-gradient(135deg,var(--gold3),#ffe0a0)">
            <div class="cg-init">${initials(a.name)}</div>
          </div>
          <div class="cg-body">
            <div class="cg-name">${a.name}</div>
            <span class="cg-tag actor">Actor</span>
            <div class="cg-films">${a.film_count} films</div>
          </div>
        </div>
      `).join('')
    }

    // Directors grid
    const dirGrid = document.querySelectorAll('.celeb-grid')[1]
    if (dirGrid && data.directors?.length) {
      dirGrid.innerHTML = data.directors.slice(0, 6).map((d, i) => `
        <div class="celeb-gcard" onclick="location.href='celebrity-detail-director.html?id=${d.person_id}'">
          <div class="cg-img" style="background:linear-gradient(135deg,var(--blue3),#c8d8f5)">
            <div class="cg-init">${initials(d.name)}</div>
          </div>
          <div class="cg-body">
            <div class="cg-name">${d.name}</div>
            <span class="cg-tag director">Director</span>
            <div class="cg-films">${d.film_count} films</div>
          </div>
        </div>
      `).join('')
    }

    // Popularity chart
    const chart = document.querySelector('.pop-chart')
    if (chart) {
      const combined = [
        ...(data.actors || []).slice(0, 3).map(a => ({ ...a, role: 'actor' })),
        ...(data.directors || []).slice(0, 2).map(d => ({ ...d, role: 'director' }))
      ].sort((a, b) => b.film_count - a.film_count).slice(0, 5)
      chart.innerHTML = combined.map((p, i) => `
        <div class="pop-row" onclick="location.href='${p.role === 'actor' ? 'celebrity-detail' : 'celebrity-detail-director'}.html?id=${p.person_id}'">
          <div class="pop-rank ${i < 3 ? 'top' : ''}">${i + 1}</div>
          <div class="person-circle sm ${PC_COLORS[i]}" style="font-size:13px;width:44px;height:44px">${initials(p.name)}</div>
          <div class="pop-info">
            <div class="pop-name">${p.name} <span class="pop-badge ${p.role}">${p.role === 'actor' ? 'Actor' : 'Director'}</span></div>
          </div>
          <div class="pop-films"><strong>${p.film_count}</strong><span>Films</span></div>
        </div>
      `).join('')
    }

  } catch (e) {
    console.error('Celebrities failed:', e.message)
  }
}

async function runCelebSearch(q) {
  try {
    const data = await fetchAPI(`/search?q=${encodeURIComponent(q)}`)
    const actorGrid = document.querySelectorAll('.celeb-grid')[0]
    const hdr = document.querySelector('.page-header-title')
    if (hdr) hdr.innerHTML = `Results for <span>"${q}"</span>`
    if (actorGrid) {
      actorGrid.innerHTML = data.slice(0, 6).map((m, i) => `
        <div class="celeb-gcard" onclick="location.href='movie-detail.html?id=${m.movie_id}'">
          <div class="cg-img" style="background:linear-gradient(135deg,var(--gold3),#ffe0a0)">
            <div class="cg-init">${m.title.slice(0,2).toUpperCase()}</div>
          </div>
          <div class="cg-body">
            <div class="cg-name">${m.title}</div>
            <span class="cg-tag actor">${formatYear(m.release_date)}</span>
          </div>
        </div>
      `).join('')
    }
  } catch (e) { console.error('Celeb search failed:', e) }
}

// ── CELEBRITY DETAIL (ACTOR) ──────────────────────────────────

async function initCelebrityDetailActor() {
  const id = getParam('id')
  if (!id) { window.location.href = 'celebrities.html'; return }

  try {
    const p = await fetchAPI(`/celebrities/${id}`)
    document.title = `${p.name} — PictoPlex`

    const nameEl = document.querySelector('.celeb-hero-name')
    if (nameEl) nameEl.textContent = p.name

    const avatar = document.querySelector('.celeb-hero-avatar')
    if (avatar) avatar.textContent = initials(p.name)

    const metaEl = document.querySelector('.celeb-hero-meta')
    if (metaEl) metaEl.innerHTML = `
      <div class="celeb-meta-item">Known for <strong>${p.actedIn?.length || 0} films</strong></div>
      <div class="celeb-meta-item">Role <strong>Actor</strong></div>
    `

    const bcEl = document.getElementById('bc-person')
    if (bcEl) bcEl.textContent = p.name

    const bioEl = document.querySelector('.celeb-bio')
    if (bioEl) bioEl.textContent = `${p.name} has appeared in ${p.actedIn?.length || 0} films in the PictoPlex database. Click any film below to view its full details.`

    const filmGrid = document.querySelector('.filmography')
    if (filmGrid) {
      filmGrid.innerHTML = (p.actedIn || []).slice(0, 8).map((f, i) => `
        <div class="film-card" onclick="location.href='movie-detail.html?id=${f.movie_id}'">
          <div class="film-poster ${FP_COLORS[i % 4]}"></div>
          <div class="film-body">
            <div class="film-title">${f.title}</div>
            <div class="film-meta">${formatYear(f.release_date)}</div>
            ${f.character_name ? `<div class="film-char">as ${f.character_name}</div>` : ''}
          </div>
        </div>
      `).join('')
      if (!p.actedIn?.length) filmGrid.innerHTML = '<p style="color:var(--muted)">No films found.</p>'
    }
  } catch (e) {
    console.error('Actor detail failed:', e)
  }
}

// ── CELEBRITY DETAIL (DIRECTOR) ───────────────────────────────

async function initCelebrityDetailDirector() {
  const id = getParam('id')
  if (!id) { window.location.href = 'celebrities.html'; return }

  try {
    const p = await fetchAPI(`/celebrities/${id}`)
    document.title = `${p.name} — PictoPlex`

    const nameEl = document.querySelector('.celeb-hero-name')
    if (nameEl) nameEl.textContent = p.name

    const avatar = document.querySelector('.celeb-hero-avatar')
    if (avatar) avatar.textContent = initials(p.name)

    const metaEl = document.querySelector('.celeb-hero-meta')
    if (metaEl) metaEl.innerHTML = `
      <div class="celeb-meta-item">Directed <strong>${p.directed?.length || 0} films</strong></div>
      <div class="celeb-meta-item">Role <strong>Director</strong></div>
    `

    const bcEl = document.getElementById('bc-person')
    if (bcEl) bcEl.textContent = p.name

    const bioEl = document.querySelector('.celeb-bio')
    if (bioEl) bioEl.textContent = `${p.name} has directed ${p.directed?.length || 0} films in the PictoPlex database.`

    const filmGrid = document.querySelector('.filmography')
    if (filmGrid) {
      filmGrid.innerHTML = (p.directed || []).slice(0, 8).map((f, i) => `
        <div class="film-card" onclick="location.href='movie-detail.html?id=${f.movie_id}'">
          <div class="film-poster ${FP_COLORS[i % 4]}"></div>
          <div class="film-body">
            <div class="film-title">${f.title}</div>
            <div class="film-meta">${formatYear(f.release_date)}</div>
            ${f.revenue > 0 ? `<div class="film-revenue">${formatMoney(f.revenue)} revenue</div>` : ''}
          </div>
        </div>
      `).join('')
      if (!p.directed?.length) filmGrid.innerHTML = '<p style="color:var(--muted)">No films found.</p>'
    }
  } catch (e) {
    console.error('Director detail failed:', e)
  }
}

// ── INIT ON LOAD ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initNavSearch()
  initReveal()
  setActiveNav()

  const page = window.location.pathname.split('/').pop() || 'index.html'

  if (page === 'index.html' || page === '')              initHomepage()
  if (page === 'browse.html')                            initBrowse()
  if (page === 'movie-detail.html')                      initMovieDetail()
  if (page === 'celebrities.html')                       initCelebrities()
  if (page === 'celebrity-detail.html')                  initCelebrityDetailActor()
  if (page === 'celebrity-detail-director.html')         initCelebrityDetailDirector()
})
// Enhanced Pagination Variables
let currentPage = 1;
let totalPages = 1;
let totalMovies = 0;
const ITEMS_PER_PAGE = 20;

function updatePaginationControls() {
  const firstBtn = document.getElementById('first-page');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const lastBtn = document.getElementById('last-page');
  const pageNumbersDiv = document.getElementById('page-numbers');
  
  if (!pageNumbersDiv) return;
  
  // Update button states
  if (firstBtn) firstBtn.disabled = currentPage === 1;
  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage === totalPages;
  if (lastBtn) lastBtn.disabled = currentPage === totalPages;
  
  // Set button actions
  if (firstBtn) firstBtn.onclick = () => currentPage !== 1 && loadBrowseMovies(1);
  if (prevBtn) prevBtn.onclick = () => currentPage > 1 && loadBrowseMovies(currentPage - 1);
  if (nextBtn) nextBtn.onclick = () => currentPage < totalPages && loadBrowseMovies(currentPage + 1);
  if (lastBtn) lastBtn.onclick = () => currentPage !== totalPages && loadBrowseMovies(totalPages);
  
  // Generate page numbers
  const maxVisiblePages = 7; // Show up to 7 page numbers at once
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  // Adjust if we're near the end
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  let pagesHtml = '';
  
  // First page button (always show)
  if (startPage > 1) {
    pagesHtml += `<div class="page-number" data-page="1">1</div>`;
    if (startPage > 2) {
      pagesHtml += `<div class="page-number dots">...</div>`;
    }
  }
  
  // Page numbers
  for (let i = startPage; i <= endPage; i++) {
    pagesHtml += `
      <div class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">
        ${i}
      </div>
    `;
  }
  
  // Last page button
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pagesHtml += `<div class="page-number dots">...</div>`;
    }
    pagesHtml += `<div class="page-number" data-page="${totalPages}">${totalPages}</div>`;
  }
  
  pageNumbersDiv.innerHTML = pagesHtml;
  
  // Add click handlers to page numbers
  document.querySelectorAll('.page-number[data-page]').forEach(el => {
    el.addEventListener('click', () => {
      const page = parseInt(el.dataset.page);
      if (page !== currentPage) {
        loadBrowseMovies(page);
      }
    });
  });
}

// Update your loadBrowseMovies function to use totalPages from API
async function loadBrowseMovies(page = 1) {
  const list = document.querySelector('.movie-grid') || document.querySelector('.movie-list')
  if (!list) return
  list.innerHTML = '<div class="loading"></div>'

  // Get filter values
  const inputs = document.querySelectorAll('.filter-input')
  const yearFrom  = inputs[0]?.value || ''
  const yearTo    = inputs[1]?.value || ''
  const budgetMin = inputs[2]?.value ? String(parseFloat(inputs[2].value) * 1_000_000) : ''
  const budgetMax = inputs[3]?.value ? String(parseFloat(inputs[3].value) * 1_000_000) : ''
  const revMin    = inputs[4]?.value ? String(parseFloat(inputs[4].value) * 1_000_000) : ''
  const revMax    = inputs[5]?.value ? String(parseFloat(inputs[5].value) * 1_000_000) : ''

  const activeGenres = [...document.querySelectorAll('.genre-pill.active')].map(p => p.dataset.genre)

  const sortSel = document.querySelector('.sort-select')
  const sortVal = sortSel?.value || 'revenue'
  const sortMap = {
    'Revenue (highest)': 'revenue',
    'Budget (highest)': 'budget',
    'Year (newest)': 'year_desc',
    'Year (oldest)': 'year_asc',
    'Title A–Z': 'title'
  }
  const sort = sortMap[sortVal] || 'revenue'
  
  // Store current filters for pagination
  currentFilters = { yearFrom, yearTo, budgetMin, budgetMax, revMin, revMax, activeGenres }
  currentSort = sort
  currentPage = page

  // Calculate offset based on page (20 items per page)
  const limit = ITEMS_PER_PAGE
  const offset = (page - 1) * limit

  const params = new URLSearchParams()
  if (yearFrom)         params.set('yearFrom',  yearFrom)
  if (yearTo)           params.set('yearTo',    yearTo)
  if (budgetMin)        params.set('budgetMin', budgetMin)
  if (budgetMax)        params.set('budgetMax', budgetMax)
  if (revMin)           params.set('revMin',    revMin)
  if (revMax)           params.set('revMax',    revMax)
  if (activeGenres[0])  params.set('genre',     activeGenres[0])
  params.set('sort',  sort)
  params.set('limit', limit.toString())
  params.set('offset', offset.toString())

  try {
    const data = await fetchAPI(`/movies?${params}`)
    totalMovies = data.total || data.movies?.length || 0
    totalPages = Math.ceil(totalMovies / limit)
    
    updateResultsCount(totalMovies)
    
    // Make sure list is a grid
    if (list.classList && !list.classList.contains('movie-grid')) {
      list.classList.remove('movie-list')
      list.classList.add('movie-grid')
    }
    
    renderMovieList(list, data.movies || [])
    updatePaginationControls()
    
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    console.error('Load movies error:', e)
    list.innerHTML = '<div class="empty-state"><h3>Could not load movies</h3><p>Is the server running at localhost:3000?</p></div>'
  }
}