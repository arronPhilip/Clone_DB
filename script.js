/* ============================================================
   PictoPlex — Shared JavaScript
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

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
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
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
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href === page || (page === 'index.html' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // ── MOVIE ROW HOVER ──
  document.querySelectorAll('.movie-row').forEach(row => {
    row.addEventListener('click', () => {
      window.location.href = 'movie-detail.html';
    });
  });

  // ── TREND CARD CLICK ──
  document.querySelectorAll('.trend-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = 'movie-detail.html';
    });
  });

  // ── CELEB CARD CLICK ──
  document.querySelectorAll('.celeb-gcard, .person-card, .actor-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = 'celebrity-detail.html';
    });
  });

  // ── DIRECTOR CARD CLICK ──
  document.querySelectorAll('.director-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = 'celebrity-detail-director.html';
    });
  });

  // ── FILM CARD CLICK (on detail pages) ──
  document.querySelectorAll('.film-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = 'movie-detail.html';
    });
  });

  // ── SORT SELECT ──
  const sortSelect = document.querySelector('.sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      console.log('Sort by:', sortSelect.value);
    });
  }

  // ── FILTER INPUTS — live update results count ──
  const filterInputs = document.querySelectorAll('.filter-input');
  filterInputs.forEach(input => {
    input.addEventListener('input', () => {
      const countEl = document.querySelector('.results-count strong');
      if (countEl) {
        const base = parseInt(countEl.dataset.base || countEl.textContent) || 284;
        countEl.dataset.base = base;
        const random = Math.floor(base * (0.6 + Math.random() * 0.4));
        countEl.textContent = random.toLocaleString();
      }
    });
  });

  // ── SEARCH BAR — focus effect ──
  document.querySelectorAll('.nav-search, .search-dark').forEach(bar => {
    bar.addEventListener('click', () => {
      bar.style.borderColor = 'var(--blue)';
    });
  });

});
