// scripts/frontend_acceptance/AUDIT_PFA_2_RUNTIME_LOCALE_SUPPORT_V3.cjs
'use strict';

const base = require('./AUDIT_PFA_2_RUNTIME_LOCALE_SUPPORT_V2.cjs');

async function snapshot(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const withoutNeutralRoutes = (value) => String(value || '')
      .replace(/\/(?:[A-Za-z0-9_:.{}-]+\/)+[A-Za-z0-9_:.{}-]+/g, ' ');
    const governedCopy = (value) => clean(withoutNeutralRoutes(value));
    const governed = [];
    const add = (value) => {
      const normalized = governedCopy(value);
      if (normalized) governed.push(normalized);
    };

    const candidates = [...document.querySelectorAll('[data-pfa2-locale],[data-layout],.productPageShell,.customerReportCanvas')];
    const roots = candidates.length
      ? candidates.filter((candidate) => !candidates.some((other) => other !== candidate && other.contains(candidate)))
      : [document.body];

    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (!parent) continue;
        if (parent.closest('script,style,noscript,template,code,pre,[data-locale-neutral="true"],[aria-hidden="true"]')) continue;
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        add(node.nodeValue);
      }
    }

    for (const element of document.querySelectorAll('[aria-label]')) {
      if (!element.closest('code,pre,[data-locale-neutral="true"]')) add(element.getAttribute('aria-label'));
    }
    for (const element of document.querySelectorAll('[title]')) {
      if (!element.closest('code,pre,[data-locale-neutral="true"]')) add(element.getAttribute('title'));
    }
    for (const element of document.querySelectorAll('[placeholder]')) {
      if (!element.closest('code,pre,[data-locale-neutral="true"]')) add(element.getAttribute('placeholder'));
    }

    const htmlLang = document.documentElement.lang;
    const activeLocale = document.querySelector('[data-locale-active="true"]')?.getAttribute('data-locale-option') || htmlLang;
    return {
      pathname: location.pathname,
      htmlLang,
      activeLocale,
      localeControlPresent: Boolean(document.querySelector('[data-locale-option]')),
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
