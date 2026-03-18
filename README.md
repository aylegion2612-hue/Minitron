# Minitron (Phase 1 Scaffold)

This repository now contains the initial Phase 1 foundation for Minitron:
- Electron shell + preload
- Core Express control layer and route stubs
- End-to-end `POST /chat` SSE flow
- SQLite schema and security primitives
- i18n bootstrap and initial locales

## Local setup

1. Run:
   - `npm install`
   - `npm run typecheck`
2. Start core API:
   - `npm run dev:core`

## Notes

- Product naming has been switched from JellyClaw to Minitron in setup files.
- `vendor/openclaw` is treated as read-only by project rules.

## Release and Distribution

- Build installers locally: `npm run dist`
- CI release build on tag push: `.github/workflows/release.yml`
- Landing page assets: `landing/`
- Docs: `docs/getting-started.md`, `docs/reference.md`, `docs/changelog.md`
