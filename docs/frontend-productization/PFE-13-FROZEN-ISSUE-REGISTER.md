<!-- docs/frontend-productization/PFE-13-FROZEN-ISSUE-REGISTER.md -->
# PFE-13 Frozen Issue Register

## Register policy

This register records allowed later work after the Frontend Product v1 freeze. It cannot waive missing baseline evidence, changed product routes, changed runtime source, changed packages, changed backend files, failed CI, failed runtime audit, failed bundle budget, or failed copy gate.

## Non-blocking later work

| issue id | area | status after freeze | later owner |
|---|---|---|---|
| PFE13-LATER-001 | PFE-9-B visual assertion gate | deferred | later visual phase |
| PFE13-LATER-002 | pixel diff | deferred | later visual phase |
| PFE13-LATER-003 | Lighthouse score | deferred | later performance phase |
| PFE13-LATER-004 | RUM | deferred | later performance phase |
| PFE13-LATER-005 | full browser / device matrix | deferred | later QA phase |
| PFE13-LATER-006 | full page-string extraction | deferred | later copy phase |
| PFE13-LATER-007 | native translation review | deferred | later copy phase |
| PFE13-LATER-008 | next productization phase | deferred | post-freeze roadmap |
| PFE13-LATER-009 | real field pilot preparation | deferred | later pilot phase |
| PFE13-LATER-010 | deployment packaging | deferred | later delivery phase |

## Blocking issues not allowed

The following cannot be treated as non-blocking during PFE-13:

```text
missing formal route inventory
missing PFE baseline doc
missing PFE-9 screenshot manifest
missing PFE-10 bundle budget
missing PFE-11 copy/i18n gate
missing PFE-12 demo manifest
route topology changed
backend, package, fixture, or contract changed
runtime source changed
manifest freeze flags inconsistent
CI failed
runtime audit failed
bundle budget failed
copy / i18n gate failed
```

## Freeze rule

Post-freeze later work must not be described as completed by PFE-13. It must be scoped as a later phase or separate follow-up PR.
