async function loadProofdropContent() {
  try {
    const res = await fetch('proofdrop.json', { cache: 'no-store' });
    const { page } = await res.json();

    // Apply theme from JSON
    const root = document.documentElement;
    if (page?.theme?.primaryColor) root.style.setProperty('--primary', page.theme.primaryColor);
    if (page?.theme?.backgroundColor) root.style.setProperty('--bg', page.theme.backgroundColor);
    if (page?.theme?.textColor) root.style.setProperty('--text', page.theme.textColor);
    if (page?.theme?.font) document.body.style.fontFamily = page.theme.font;
    if (page?.title) document.title = page.title;
    if (page?.favicon) {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = page.favicon;
      document.head.appendChild(link);
    }

    const appEl = document.getElementById('app');
    appEl.innerHTML = '';

    for (const section of page.sections) {
      if (section.type === 'how_it_works') {
        appEl.insertAdjacentHTML('beforeend', renderHowItWorks(section));

        // Inject widget after "How It Works"
        appEl.insertAdjacentHTML('beforeend', renderScoringWidget());

        // Init Web3Modal now that widget exists, bind buttons
        initWeb3Modal();
        bindWidgetHandlers();

      } else {
        appEl.insertAdjacentHTML('beforeend', renderSection(section));
      }
    }

    bindCTAActions();
  } catch (err) {
    console.error('Failed to load proofdrop.json', err);
    document.getElementById('app').innerHTML =
      `<section class="section"><p class="text-danger">Failed to load content.</p></section>`;
  }
}

// --- Section renderers ---
function renderSection(section) {
  switch (section.type) {
    case 'hero':
      return renderHero(section);
    case 'section':
      return renderTextSection(section);
    case 'badge_preview':
      return renderBadges(section);
    case 'leaderboard_preview':
      return renderLeaderboardPreview(section);
    case 'cta':
      return renderCTA(section);
    case 'footer':
      return renderFooter(section);
    default:
      return '';
  }
}

function renderHero(s) {
  const bg = s.backgroundImage ? `style="background-image:url('${s.backgroundImage}')"` : '';
  const buttons = (s.ctaButtons || []).map(btn => {
    const isAction = btn.action === 'connect_wallet';
    const href = isAction ? '#' : btn.action;
    const extra = isAction ? `data-action="connect_wallet"` : `target="_blank" rel="noopener"`;
    return `<a class="btn btn-primary me-2 mt-2" href="${href}" ${extra}>${btn.label}</a>`;
  }).join('');
  return `
    <section class="hero text-center" ${bg}>
      <h1 class="display-5 fw-bold">${escapeHTML(s.title)}</h1>
      <p class="lead mt-2">${escapeHTML(s.subtitle)}</p>
      <div class="mt-3">${buttons}</div>
    </section>
  `;
}

function renderTextSection(s) {
  const paragraphs = (s.content || []).map(p => `<p>${escapeHTML(p)}</p>`).join('');
  return `<section class="section"><h2>${escapeHTML(s.title)}</h2>${paragraphs}</section>`;
}

function renderHowItWorks(s) {
  const steps = (s.steps || []).sort((a,b) => a.step - b.step).map(st =>
    `<li class="mb-2"><strong>${escapeHTML(st.title)}</strong> — ${escapeHTML(st.description)}</li>`
  ).join('');
  return `<section class="section"><h2>${escapeHTML(s.title)}</h2><ol>${steps}</ol></section>`;
}

function renderBadges(s) {
  const cards = (s.badges || []).map(b =>
    `<div class="badge-card">
      <div class="fs-3">${escapeHTML(b.emoji || '')}</div>
      <div class="fw-bold mt-1">${escapeHTML(b.name)}</div>
      <div class="small mt-1">${escapeHTML(b.requirements)}</div>
    </div>`
  ).join('');
  return `<section class="section"><h2>${escapeHTML(s.title)}</h2><div class="badge-list mt-3">${cards}</div></section>`;
}

function renderLeaderboardPreview(s) {
  const rows = (s.wallets || []).map(w =>
    `<tr><td>${w.rank}</td><td>${escapeHTML(w.wallet)}</td><td>${w.score}</td></tr>`
  ).join('');
  return `<section class="section">
    <h2>${escapeHTML(s.title)}</h2>
    <table class="table table-dark table-striped"><thead><tr><th>#</th><th>Wallet</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>
    ${s.note ? `<p class="small text-muted">${escapeHTML(s.note)}</p>` : ''}
  </section>`;
}

function renderCTA(s) {
  const btn = s.ctaButton ? `<a href="${s.ctaButton.link}" target="_blank" rel="noopener" class="btn btn-primary mt-2">${escapeHTML(s.ctaButton.label)}</a>` : '';
  return `<section class="section text-center"><h2>${escapeHTML(s.title)}</h2><p>${escapeHTML(s.subtitle)}</p>${btn}</section>`;
}

function renderFooter(s) {
  const links = (s.links || []).map(l => `<a class="me-3" target="_blank" rel="noopener" href="${l.url}">${escapeHTML(l.label)}</a>`).join('');
  return `<section class="footer"><div>${links}</div><div class="small">${escapeHTML(s.copyright)}</div></section>`;
}

// --- Inject dApp widget ---
function renderScoringWidget() {
  return `
    <section class="section">
      <div class="card-translucent p-3">
        <div class="d-flex flex-wrap gap-2 mb-2">
          <button id="connectBtn" class="btn btn-primary" type="button">🔗 Connect Wallet</button>
          <button id="fetchBtn" class="btn btn-outline-light" type="button" disabled>🔎 Fetch My Reputation</button>
          <button id="mintBtn" class="btn btn-accent" type="button" disabled>🪙 Mint My Reputation NFT</button>
        </div>
        <div id="walletInfo" class="small text-muted">Not connected</div>
        <div id="signInfo" class="small mt-2"></div>
      </div>

      <section id="summarySection" class="mt-4 d-none">
        <div class="score-card shadow-sm">
          <div class="row align-items-center">
            <div class="col-md-3 text-center">
              <div class="score-circle" id="totalScore">—</div>
              <div class="mt-2" id="tierLabel">Tier: —</div>
            </div>
            <div class="col-md-9">
              <h3 class="h5 mb-3">Overall reputation</h3>
              <div id="summaryText" class="small"></div>
            </div>
          </div>
        </div>
      </section>

      <section id="breakdownSection" class="mt-4 d-none">
        <h2 class="h5 mb-3">Metric breakdown</h2>
        <div class="card card-translucent p-3">
          <div class="metric"><span><strong>Governance participation:</strong> <span id="m-gov">—</span></span><span id="p-gov">0/20</span></div>
          <div class="metric"><span><strong>DeFi engagement:</strong> <span id="m-defi">—</span></span><span id="p-defi">0/20</span></div>
          <div class="metric"><span><strong>Unique contracts:</strong> <span id="m-uniq">—</span></span><span id="p-uniq">0/15</span></div>
          <div class="metric"><span><strong>Airdrops claimed:</strong> <span id="m-air">—</span></span><span id="p-air">0/15</span></div>
          <div class="metric"><span><strong>DEX swaps:</strong> <span id="m-swaps">—</span></span><span id="p-swaps">0/15</span></div>
          <div class="metric"><span><strong>Balance (USD):</strong> <span id="m-bal">—</span></span><span id="p-bal">0/
