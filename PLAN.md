# Construction Client Portal — Task Plan

## Legend
- [ ] Pending
- [x] Completed

---

## P0 — Critical (ship-blocking for production)

- [x] **Secure file uploads** — Authenticate `/uploads` or serve via auth proxy
- [x] **Rate limit login** — Add `express-rate-limit`
- [x] **Security headers** — Add `helmet` middleware
- [x] **Replace dev JWT secret** — Remove hardcoded fallback, use env var only

## P1 — High (needed for real-world use)

- [x] **Add pagination** — `GET /clients`, `/consultations`, `/documents`, `/communications`
- [x] **Add database indexes** — Foreign keys on `clientId`, `userId`, `projectId`, `phaseId`
- [x] **User profile management** — `PUT /auth/me` (name, email, password)
- [x] **Password reset flow** — Forgot password / reset token

## P2 — Medium (important UX & functionality)

- [x] **React Error Boundary** — Prevent white-screen crashes
- [x] **Inline form validation** — Client-side field validation
- [x] **Catch-all 404 route** — React Router fallback
- [x] **Clean up orphaned files** — Delete disk files when document record is deleted
- [x] **Document metadata editing** — Allow editing description after upload
- [x] **Request logging** — Add `morgan` middleware

## P3 — Lower (nice-to-have / future)

- [ ] **Tests** — Backend API integration tests
- [ ] **Soft deletes** — Client, Document, Communication
- [ ] **Email notifications** — nodemailer + SendGrid/Mailgun
- [ ] **Client invitation flow** — Email-based onboarding
- [ ] **Activity / audit log** — Track changes
- [ ] **Docker setup + CI/CD** — Containerized dev & deploy
