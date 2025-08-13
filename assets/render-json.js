async function loadProofdropContent() {
  try {
    const res = await fetch('proofdrop.json', { cache: 'no-store' });
    const { page } = await res.json();

    // Apply theme to CSS variables
    const root = document.documentElement;
    if (page?.theme?.primaryColor) root.style.setProperty('--primary', page.theme.primaryColor);
    if (page?.theme?.backgroundColor) root.style.setProperty('--bg', page.theme.backgroundColor);
    if (page?.theme?.textColor) root.style.setProperty('--text', page.theme.textColor);
    if (page?.theme?.font) document.body.style.fontFamily = page.theme.font;

    // Title + favicon
    if (page?.title) document.title = page.title;
    if (page?.favicon) {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = page.favicon;
      document.head.appendChild(link);
    }

    // Render sections
    const appEl = document.getElementById('app');
    appEl.innerHTML = '';

    for (let i = 0; i < page.sections.length; i++) {
      const section = page.sections[i];

      if (section.type === 'hero') {
        appEl.insertAdjacentHTML('beforeend', renderHero(section));
      } else if (section.type === 'section') {
        appEl.insertAdjacentHTML('beforeend', renderTextSection(section));
      } else if (section.type === 'how_it_works') {
        appEl.insertAdjacentHTML('beforeend', renderHowItWorks(section));

        // Inject dApp widget right after "How It Works"
        appEl.insertAdjacentHTML('beforeend', renderScoringWidget());
        bindWidgetHandlers(); // wire buttons to global functions
      } else if (section.type === 'badge_preview') {
        appEl.insertAdjacentHTML('beforeend', renderBadges(section));
      } else if (section.type === 'leaderboard_preview') {
        appEl.insertAdjacentHTML('beforeend', renderLeaderboardPreview(section));
      } else if (section.type === 'cta') {
        appEl.insertAdjacentHTML('beforeend', renderCTA(section));
      } else if (section.type === 'footer') {
        appEl.insertAdjacentHTML('beforeend', renderFooter(section));
      }
    }

    // Bind hero CTA actions (e.g., connect_wallet)
    bindCTAActions();
  } catch (err) {
    console.error('Failed to load proofdrop.json', err);
    const appEl = document.getElementById('app');
    appEl.innerHTML = `<section class="section container-narrow"><p class="text-danger">Failed to load content.</p></section>`;
  }
}

// ---- Renderers ----
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
      <div class="container-narrow">
        <h1 class="display-5 fw-bold">${escapeHTML(s.title)}</h1>
        <p class="lead mt-2">${escapeHTML(s.subtitle)}</p>
        <div class="mt-3">${buttons}</div>
      </div>
    </section>
  `;
}

function renderTextSection(s) {
  const paragraphs = (s.content || []).map(p => `<p>${escapeHTML(p)}</p>`).join('');
  return `
    <section class="section">
      <div class="container-narrow">
        <h2 class="h4">${escapeHTML(s.title)}</h2>
        ${paragraphs}
      </div>
    </section>
  `;
}

function renderHowItWorks(s) {
  const steps = (s.steps || []).sort((a,b) => a.step - b.step).map(st => `
    <li class="mb-2"><strong>${escapeHTML(st.title)}</strong> — ${escapeHTML(st.description)}</li>
  `).join('');
  return `
    <section class="section">
      <div class="container-narrow">
        <h2 class="h4">${escapeHTML(s.title)}</h2>
        <ol class="mt-2">${steps}</ol>
      </div>
    </section>
  `;
}

function renderBadges(s) {
  const cards = (s.badges || []).map(b => `
    <div class="badge-card">
      <div class="fs-3">${escapeHTML(b.emoji || '')}</div>
      <div class="fw-bold mt-1">${escapeHTML(b.name)}</div>
      <div class="small mt-1">${escapeHTML(b.requirements)}</div>
    </div>
  `).join('');
  return `
    <section class="section">
      <div class="container-narrow">
        <h2 class="h4">${escapeHTML(s.title)}</h2>
        <div class="badge-list mt-3">${cards}</div>
      </div>
    </section>
  `;
}

function renderLeaderboardPreview(s) {
  const rows = (s.wallets || []).map(w => `
    <tr>
      <td>${w.rank}</td>
      <td>${escapeHTML(w.wallet)}</td>
      <td>${w.score}</td>
    </tr>
  `).join('');
  return `
    <section class="section">
      <div class="container-narrow">
        <h2 class="h4">${escapeHTML(s.title)}</h2>
        <div class="table-responsive mt-2">
          <table class="table table-dark table-striped align-middle">
            <thead><tr><th>#</th><th>Wallet</th><th>Score</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${s.note ? `<p class="small text-muted mt-2">${escapeHTML(s.note)}</p>` : ''}
      </div>
    </section>
  `;
}

function renderCTA(s) {
  const btn = s.ctaButton ? `<a href="${s.ctaButton.link}" target="_blank" rel="noopener" class="btn btn-primary mt-2">${escapeHTML(s.ctaButton.label)}</a>` : '';
  return `
    <section class="section text-center">
      <div class="container-narrow">
        <h2 class="h4">${escapeHTML(s.title)}</h2>
        <p class="mt-1">${escapeHTML(s.subtitle)}</p>
        ${btn}
      </div>
    </section>
  `;
}

function renderFooter(s) {
  const links = (s.links || []).map(l => `<a class="me-3" target="_blank" rel="noopener" href="${l.url}">${escapeHTML(l.label)}</a>`).join('');
  return `
    <section class="footer">
      <div class="container-narrow">
        <div class="mb-2">${links}</div>
        <div class="small">${escapeHTML(s.copyright || '')}</div>
      </div>
    </section>
  `;
}

// Inject the dApp scoring/mint widget
function renderScoringWidget() {
  return `
    <section class="section">
      <div class="container-narrow">
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
            <div class="metric"><span><strong>DeFi engagement (LP + lend/borrow):</strong> <span id="m-defi">—</span></span><span id="p-defi">0/20</span></div>
            <div class="metric"><span><strong>Unique contract interactions:</strong> <span id="m-uniq">—</span></span><span id="p-uniq">0/15</span></div>
            <div class="metric"><span><strong>Airdrops claimed:</strong> <span id="m-air">—</span></span><span id="p-air">0/15</span></div>
            <div class="metric"><span><strong>DEX swaps:</strong> <span id="m-swaps">—</span></span><span id="p-swaps">0/15</span></div>
            <div class="metric"><span><strong>On‑chain balance (USD est.):</strong> <span id="m-bal">—</span></span><span id="p-bal">0/15</span></div>
          </div>
        </section>

        <section id="signatureSection" class="mt-4 d-none">
          <h2 class="h5 mb-2">Signed verification</h2>
          <div class="card card-translucent p-3">
            <div class="mb-2"><strong>Message:</strong></div>
            <pre id="signedMessage" class="small mb-3"></pre>
            <div class="mb-2"><strong>Signature:</strong></div>
            <pre id="signature" class="small mb-3"></pre>
            <div><strong>Verified:</strong> <span id="verified" class="badge bg-secondary">No</span></div>
          </div>
        </section>
      </div>
    </section>
  `;
}

// Wire widget buttons to app.js functions, after injection
function bindWidgetHandlers() {
  const connectBtn = document.getElementById('connectBtn');
  const fetchBtn = document.getElementById('fetchBtn');
  const mintBtn = document.getElementById('mintBtn');
  if (connectBtn) connectBtn.addEventListener('click', (e) => { e.preventDefault(); window.onConnect && window.onConnect(); });
  if (fetchBtn) fetchBtn.addEventListener('click', (e) => { e.preventDefault(); window.onFetch && window.onFetch(); });
  if (mintBtn) mintBtn.addEventListener('click', (e) => { e.preventDefault(); window.onMint && window.onMint(); });
}

// Bind hero CTA "connect_wallet"
function bindCTAActions() {
  document.querySelectorAll('[data-action="connect_wallet"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.onConnect && window.onConnect();
    });
  });
}

// Small utils
function escapeHTML(s) {
  return (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.addEventListener('DOMContentLoaded', loadProofdropContent);
