# MINITRON - Master Build Document

## What Is Minitron
Minitron is a local-first AI operating system built as an Electron desktop app that wraps OpenClaw as its execution engine.

Core modules:
- Polished chat UI and dashboard
- Rules engine and security validation
- Skills system
- Agent Studio for custom bots
- Connector hub
- Three-layer memory (SQLite, Cognee, workspace files)
- Auto-updates and optional cloud sync

OpenClaw is the engine. Minitron is the experience.
Never modify OpenClaw source code.

## Critical Rules
1. Never modify `/vendor/openclaw/` (read-only forever)
2. Never call OpenClaw directly from the Electron renderer
3. All UI calls go through `/core` Express APIs
4. Never rebuild what OpenClaw already provides
5. Never rebuild Cognee in Node.js (Python sidecar only)
6. Nothing in scope is optional; phase by phase all features ship

## Tech Stack
- Electron 33+
- React 19 + TypeScript
- Tailwind CSS
- react-i18next (no hardcoded UI strings)
- Express + TypeScript
- SQLite (better-sqlite3)
- OpenClaw npm package (subprocess)
- Cognee sidecar (Python + MCP)
- Firebase Auth + Firestore (encrypted cloud blob only)
- Docker sandbox
- electron-builder
- GitHub Actions
- Vercel landing page

## Phase Completion Status
1. Phase 1 complete - Foundation and end-to-end chat pipeline.
2. Phase 2 complete - Rules, security validation, VALUES kernel, audit trail.
3. Phase 3 complete - Skills registry/install/update/custom discovery + audits.
4. Phase 4 complete - Agent Studio and Connector Hub flows.
5. Phase 5 complete - SQLite + Cognee memory bridge and sidecar manager.
6. Phase 6 complete - Updates pipeline and cloud sync flows.
7. Phase 7 complete - Dashboard tabs, onboarding, settings, costs, audit UI.
8. Phase 8 complete - Packaging, release CI, landing page, docs, quality checks.
