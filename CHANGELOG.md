# Changelog

Notable application changes are recorded here. Each production deployment also
gets a unique release ID recorded in `DEPLOYMENT_STATUS.md`; the application
sidebar displays both the SemVer and deployed release ID.

## 1.1.0 — Unreleased candidate (2026-09-30)

- Added a visible application version and per-deployment release ID to both
  admin and client portals.
- Refined Reception Intake into a staged, criteria-gated workflow, including
  representative-led pre-design discovery and clearer design handoff readiness.
- Added release metadata to the Docker frontend build so devices can be checked
  against the exact deployed release.

This candidate has not been deployed. Its migration history now matches the
observed production endpoint, but the exact source revision of the running VPS
image remains unknown. Complete release testing and deployment preflight before
publishing it to production.

## 1.0.0 — 2026-09-04

- Initial production release baseline; see `DEPLOYMENT_STATUS.md` for the
  historical deployment and verification record.
