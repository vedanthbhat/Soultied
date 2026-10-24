// Clarity runs only on public marketing pages, after the visitor opts in.
(() => {
  const allowed = /^\/watch(?:\/[^/]+)?\/?$/.test(location.pathname);
  if (!allowed || location.search || location.hash) return;
  const key = 'soultied-marketing-analytics';
  let choice = null;
  try { choice = localStorage.getItem(key); } catch { /* Ask again when storage is unavailable. */ }
  let started = false;
  function start() {
    if (started) return;
    started = true;
    window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
    window.clarity('consentv2', { analytics_Storage: 'granted', ad_Storage: 'denied' });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.clarity.ms/tag/z2ts6mn9ie';
    document.head.appendChild(script);
  }
  function save(value) {
    try { localStorage.setItem(key, value); } catch { /* The choice still applies to this page. */ }
    choice = value;
  }
  const style = document.createElement('style');
  style.textContent = '#soultied-analytics{position:fixed;bottom:16px;left:16px;right:16px;z-index:9999;max-width:620px;padding:16px;background:#f4e8d0;color:#3a2a26;border:2px solid #2b1e1c;box-shadow:4px 4px #2b1e1c33;font:15px/1.5 system-ui,sans-serif}#soultied-analytics p{margin:0 0 12px}#soultied-analytics a{color:#8f4b3a}#soultied-analytics button{margin:0 10px 0 0;padding:7px 12px;font:inherit;cursor:pointer;border:1px solid #2b1e1c;background:#f7ebd4;color:#2b1e1c}#soultied-analytics button:focus-visible,#soultied-analytics-choice:focus-visible{outline:3px solid #8f4b3a;outline-offset:3px}#soultied-analytics-choice{display:block;margin:20px auto;background:none;border:0;text-decoration:underline;color:#8f4b3a;font:14px system-ui,sans-serif;cursor:pointer}';
  document.head.appendChild(style);
  function show() {
    if (document.getElementById('soultied-analytics')) return;
    const panel = document.createElement('section');
    panel.id = 'soultied-analytics';
    panel.setAttribute('aria-label', 'Optional website analytics');
    panel.innerHTML = '<p>Help improve Soultied’s public pages? With your permission, Microsoft Clarity records clicks, scrolling and visits on these pages. Your private place and watch-party chats are excluded. <a href="/privacy/#website-analytics">Privacy details</a></p><button type="button" data-choice="yes">Allow analytics</button><button type="button" data-choice="no">No thanks</button>';
    panel.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-choice]');
      if (!button) return;
      const value = button.dataset.choice;
      save(value);
      panel.remove();
      if (value === 'yes') start();
      else if (started) {
        window.clarity('consentv2', { analytics_Storage: 'denied', ad_Storage: 'denied' });
        location.reload();
      }
      settings.focus();
    });
    document.body.appendChild(panel);
  }
  const settings = document.createElement('button');
  settings.id = 'soultied-analytics-choice';
  settings.type = 'button';
  settings.textContent = 'Analytics preferences';
  settings.addEventListener('click', show);
  document.body.appendChild(settings);
  if (choice === 'yes') start();
  else if (choice !== 'no') show();
})();
