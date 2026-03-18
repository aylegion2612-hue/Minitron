# Release Checklist (v1.0.0)

Use this checklist before pushing a release tag.

## 1) Repository and Landing Config
- [ ] Replace placeholder repo URL in `package.json` (`repository.url`).
- [ ] Replace placeholder repo in `landing/landing-config.js` (`window.MINITRON_REPO`).
- [ ] Confirm download asset names in `landing/index.html` match CI output.

## 2) Build and Quality
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:e2e` passes.
- [ ] `npm run perf:audit` passes.
- [ ] `npm run dist` produces installer artifact(s).

## 3) Runtime and Data
- [ ] `npm run setup:openclaw` has been run successfully.
- [ ] App boots and `GET /health` returns OK.
- [ ] Chat end-to-end works with SSE `done` event.
- [ ] Values kernel exists: `data/workspace/VALUES.md`.

## 4) Update and Cloud
- [ ] `GET /updates/check` returns successfully.
- [ ] `POST /updates/apply` works for at least one component.
- [ ] `POST /cloud/login`, `/cloud/sync`, `/cloud/restore` each return successfully.

## 5) CI Release
- [ ] `.github/workflows/release.yml` is present and valid.
- [ ] Push tag format: `v1.0.0` (or `vX.Y.Z`).
- [ ] Confirm GitHub release assets are generated.
- [ ] Confirm landing page downloads resolve to latest release assets.
