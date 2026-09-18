# Security and Privacy Review

Review date: 2026-08-26  
Scope: Express API, React client, Prisma/SQLite data model, local file storage, workflow authorization, automation, and operations controls.

## Outcome

No unresolved P0 security finding was identified. Automated dependency review reports zero known vulnerabilities in both backend and frontend dependency trees. The API integration suite exercises cross-client access, role boundaries, file ownership, deleted-file access, state permissions, high-risk approvals, procurement authorization, and automation isolation.

## Review findings and controls

| Area | Result | Implemented control |
|---|---|---|
| Authentication | Pass | JWT-backed HttpOnly session cookie, CSRF token, mandatory production secret, synchronized configurable eight-hour default lifetime, login and reset rate limits, and truthful administrator-led recovery when email is disabled |
| Authorization | Pass | Server-side ADMIN/STAFF/CLIENT checks, client-to-record boundary checks, project access service, assignment and approval authorization |
| Client isolation | Pass | Cross-client consultation, document, file, inquiry, project, compliance, readiness, and procurement access tests |
| Uploads | Pass | 10 MB limit, extension/MIME pairing, magic-byte verification, generated storage names, canonical path validation, authenticated serving, spoof cleanup, rate limiting, and production restriction of unscanned Office/ZIP files |
| Input handling | Pass | Zod schemas and standard error envelopes; no raw client values are interpolated into application database queries |
| Browser protections | Pass | Helmet headers, restrictive CSP, explicit CORS allowlist, no public upload directory, no object embedding |
| Auditability | Pass | Correlation IDs and before/after activity events for authoritative workflow actions |
| Automation safety | Pass | Suggestions remain non-authoritative until explicit human review; review decisions are audited |
| Retention | Pass | New documents receive a configurable retention date; ADMIN-controlled legal holds prevent soft deletion of a document or records under a client hold |
| Logging | Pass | JSON request/error logs contain method, route path, status, duration, request ID, and user ID only; bodies, credentials, authorization headers, cookies, tokens, addresses, emails, and phone numbers are excluded |

## File-upload review

- Stored filenames are UUID-based and preserve only an allowlisted extension.
- Storage paths are resolved under `UPLOAD_DIR`; separators and parent traversal are rejected.
- The declared MIME type must match both the extension and the file signature.
- Office Open XML and ZIP containers require a ZIP signature and are blocked in production unless an operator explicitly enables them after approving a malware-scanning control or time-limited pilot exception.
- Downloads and inline previews re-check the authenticated user's client boundary and reject soft-deleted records.
- Failed uploads are removed from storage and generate an `UPLOAD_FAILURE` operational alert.

## Session strategy

The browser uses an HttpOnly, Secure-in-production, SameSite=Strict session cookie with an independent CSRF cookie/header check on state-changing requests. The normal browser login response does not expose the signed token to JavaScript. Explicit bearer-token mode remains available only when an API client deliberately sends `X-Auth-Mode: bearer`; browser code does not request or persist that mode. Every authenticated request revalidates the user and session version against the database, so user deletion, role changes, and password resets are authoritative immediately. Sessions expire according to `JWT_EXPIRES_IN`, logout clears both cookies, and password-reset tokens are single-purpose and expire.

## Secrets and rotation

Production secrets must be injected by the deployment platform and must never be committed. Required secrets are `JWT_SECRET` and `BACKUP_ENCRYPTION_KEY`; provider credentials become required when external delivery is enabled. Rotation procedure:

1. Create a cryptographically random replacement in the platform secret manager.
2. For `JWT_SECRET`, deploy the new value during a scheduled re-authentication window; existing sessions will be invalidated.
3. For `BACKUP_ENCRYPTION_KEY`, retain the prior key in restricted escrow for the full retention period of backups encrypted with it, then create a verified backup with the new key.
4. Run readiness, login, backup, and restore checks.
5. Revoke the old active secret and record the rotation in the operations change log.

Rotate application secrets at least every 90 days and immediately after suspected disclosure or personnel/access changes.

## Residual non-blocking risks

- External email delivery is intentionally disabled in the validated production configuration; in-app notifications and verified administrator-led account recovery remain authoritative. A future provider requires implementation and separate delivery/security acceptance before this restriction is changed.
- SQLite is appropriate for the documented volume and single-service deployment. Multi-instance deployment requires migration to a shared transactional database.
- Malware scanning remains required before enabling Office/ZIP uploads for general public-internet use.
