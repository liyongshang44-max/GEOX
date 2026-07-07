// scripts/frontend_acceptance/AUDIT_PFA_2_RUNTIME_LOCALE_SNAPSHOT.cjs
'use strict';

async function snapshot(page) {
  return page.evaluate(() => {
    const selectors = 'nav,h1,h2,h3,table th,button,label,[aria-label],[title],[placeholder],[class*="boundary" i],[class*="status" i]';
    const governed = [...document.querySelectorAll(selectors)].flatMap((element) => {
      if (element.closest('code,pre,[data-locale-neutral="true"]')) return [];
      return [
        element.textContent,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('placeholder'),
      ]
        .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    });

    return {
      pathname: location.pathname,
      htmlLang: document.documentElement.lang,
      activeLocale: document.querySelector('[data-locale-active="true"]')?.getAttribute('data-locale-option') || '',
      governedText: [...new Set(governed)].join(' | '),
      bodyText: document.body?.innerText || '',
      guard: Boolean(document.querySelector('[data-runtime-text-guard]')),
    };
  });
}

module.exports = { snapshot };
