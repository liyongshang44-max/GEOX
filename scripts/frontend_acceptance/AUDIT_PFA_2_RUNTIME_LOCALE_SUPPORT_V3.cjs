// scripts/frontend_acceptance/AUDIT_PFA_2_RUNTIME_LOCALE_SUPPORT_V3.cjs
'use strict';

const base = require('./AUDIT_PFA_2_RUNTIME_LOCALE_SUPPORT_V2.cjs');

async function snapshot(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const selectors = 'nav,h1,h2,h3,table th,button,label,[aria-label],[title],[placeholder],[class*="boundary" i],[data-status]';
    const governed = [...document.querySelectorAll(selectors)].flatMap((element) => {
      if (element.closest('code,pre,[data-locale-neutral="true"]')) return [];
      const clone = element.cloneNode(true);
      clone.querySelectorAll('code,pre,[data-locale-neutral="true"]').forEach((node) => node.remove());
      return [
        clone.textContent,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('placeholder'),
      ].map((value) => clean(value)).filter(Boolean);
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

module.exports = {
  ...base,
  snapshot,
};
