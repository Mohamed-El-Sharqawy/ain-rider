# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root: it points at one `CONTEXT.md` per context (backend, mobile, dashboard). Read each one relevant to the topic.
- **`docs/adr/`** at the root: system-wide decisions. Also check `apps/<context>/docs/adr/` for context-specific decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Multi-context repo:

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← system-wide decisions
└── apps/
    ├── backend/                       ← itself a nested monorepo (8 services + 8 packages)
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← backend-specific decisions
    ├── mobile/
    │   ├── CONTEXT.md
    │   └── docs/adr/
    └── dashboard/
        ├── CONTEXT.md
        └── docs/adr/
```

## Note on the existing docs/ tree

`docs/` currently holds a one-off codebase review (backend/mobile/dashboard/shared findings + ROADMAP), not domain docs. Treat it as background reading, not as the glossary or decision record; `CONTEXT.md` files and ADRs are the authoritative sources for vocabulary and decisions.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
