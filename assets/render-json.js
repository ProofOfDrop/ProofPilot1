async function loadProofdropContent() {
  try {
    const res = await fetch('proofdrop.json', { cache: 'no-store' });
    const { page } = await res.json();

    // Theme from JSON
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

        // Inject the scoring widget right after
        appEl.insertAdjacentHTML('beforeend', renderScoringWidget());

        // INIT modal *after* widget HTML is present
        initWeb3Modal();
        bindWidgetHandlers();

      } else {
        appEl.insertAdjacentHTML('beforeend', renderSection(section));
      }
    }

    bindCTAActions();
  } catch (err) {
    console.error('Failed to load JSON', err);
    document.getElementById('app').innerHTML =
      `<section class="section"><p class="text-danger">Failed to load content.</p></section>`;
  }
}

function renderHowItWorks(s) {
  const steps = (s.steps || []).map(st =>
    `<li><strong>${escapeHTML(st.title)}</strong> — ${escapeHTML(st.description)}</li>`
  ).join('');
  return `
    <section class="section">
      <h2>${escapeHTML(s.title)}</h2>
      <ol>${steps}</ol>
    </section>
  `;
}

function renderSection(section) {
  // simplified: hero, badges, footer, etc. as you already had
  // use your previous renderSection cases here
  return ''; // placeholder
}

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
      <!-- summarySection, breakdownSection, signatureSection as in your previous HTML -->
    </section>
  `;
}

function bindWidgetHandlers() {
  document.getElementById('connectBtn')?.addEventListener('click', e => {
    e.preventDefault();
    window.onConnect?.();
  });
  document.getElementById('fetchBtn')?.addEventListener('click', e => {
    e.preventDefault();
    window.onFetch?.();
  });
  document.getElementById('mintBtn')?.addEventListener('click', e => {
    e.preventDefault();
    window.onMint?.();
  });
}

function bindCTAActions() {
  document.querySelectorAll('[data-action="connect_wallet"]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      window.onConnect?.();
    });
  });
}

function escapeHTML(s) {
  return (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.addEventListener('DOMContentLoaded', loadProofdropContent);
