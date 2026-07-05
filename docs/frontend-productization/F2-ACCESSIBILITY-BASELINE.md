# F2 Accessibility Baseline

## Phase

F2-A Accessibility and Semantic Baseline.

## Purpose

Formal product surfaces must have semantic structure, screen-reader-readable navigation, and accessible interaction basics. This is an engineering baseline toward WCAG 2.2 AA direction, not a full legal WCAG audit.

## Scope

Covered surfaces: CustomerLayout, OperatorLayout, AdminLayout, Operator Runtime Overview, Field Runtime, Replay Demo, Pilot Readiness, Customer Dashboard, Customer Fields, Customer Reports, Customer Export, Admin Dashboard, Admin Evidence, Admin Health, and Admin Skills / Config.

## Minimum requirements

F2-A minimum requirements are semantic headings, landmark regions, aria-label for shell nav and locale switch, keyboard reachable formal nav, visible focus state, button vs link semantics, no color-only status communication, basic contrast declaration, and form labels where applicable.

## Semantic headings

Each formal shell exposes one visible h1 or equivalent page title. Major sections should use ordered h2/h3 hierarchy. No heading is used only for styling. No heading jump from h1 to h4 is allowed unless documented.

Known baseline note: report/export scaffolds may inherit the shell h1 or render their own print title. Any exception must remain documented before F0-B.

## Landmark regions

Formal shells must provide navigation, topbar, and main content structure.

Minimum baseline:

- CustomerLayout: sidebar navigation region, topbar header, main content.
- OperatorLayout: sidebar navigation region, topbar header, runtime nonclaim section, main content.
- AdminLayout: sidebar navigation region, topbar header, boundary section, main content.

Formal shell nav must be labelled or contained by a labelled navigation/sidebar region. Main content must be represented by main. Topbar must be represented by header or equivalent shell topbar structure.

## Aria labels and active state

Formal shell navigation must expose an accessible label. LocaleToggle must expose aria-label. Active navigation must expose aria-current page state or an equivalent accessible active state provided by the routing component. Disabled nav placeholders must use aria-disabled true. Icon-only visual marks must be hidden from assistive technology.

## Keyboard reachable formal nav

Customer nav, Operator nav, Admin nav, LocaleToggle, topbar actions, report links, export links, field card links, and operation card links must be keyboard reachable or explicitly unavailable.

## Button and link semantics

Navigation uses links. Actions use buttons. Disabled non-action nav placeholders are not clickable buttons. The baseline blocks obvious fake-button patterns and anchor click handlers without a navigation target.

## Form labels

Formal inputs, selects, and textareas must have visible labels or aria-label. Disabled controls must have a visible or accessible reason where the purpose is not obvious. Customer shell search and LocaleToggle must remain labelled.

## No color-only communication

Status must not be communicated by color only. Badges and status pills must include visible text. Red, green, or yellow alone must not be the only semantic channel. Class-only semantic status tokens such as success-green, risk-red, or warning-yellow are forbidden.

## Basic contrast declaration

Formal text/background pairs are intended to meet readable enterprise-console contrast. This document is not a full contrast audit. Known contrast risks must be registered before F0-B. Low-contrast muted text must not be the only source of critical information.

Static gate blocks extreme contrast-danger patterns in changed F2 files.

## WCAG 2.2 AA direction

This baseline follows WCAG 2.2 AA direction for semantic structure, keyboard access, visible focus, labelled controls, and non-color-only communication. It does not claim complete WCAG 2.2 AA certification.

## Acceptance hooks

The F2 acceptance gate checks shell landmarks, nav labels, LocaleToggle label, disabled semantics, focus-visible presence, fake button patterns, blocked color-only status tokens, and basic contrast-danger tokens.

## Non-goals

No full WCAG certification. No browser/device legal accessibility certification. No runtime capability claim.
