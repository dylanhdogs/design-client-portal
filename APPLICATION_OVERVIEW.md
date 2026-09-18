# Construction Client Design Portal — Application Overview

## 1. Application Purpose

The Construction Client Design Portal is a full-stack web application for managing construction clients and guiding pool projects from initial inquiry through pre-construction handoff.

It provides two role-based experiences:

- An internal workspace for administrators and staff to manage clients, projects, consultations, documents, communications, and project progress.
- A client portal where clients can view their own project, review phase checklists, submit checklist items for review, upload documents, log communications, and exchange project notes.

The application is implemented as a React/Vite frontend and an Express/TypeScript backend backed by Prisma and SQLite.

## 2. User Roles and Permissions

### ADMIN

- View and manage all clients and client-related records.
- Create staff or other system users through the registration API.
- Create, update, and delete clients.
- Restore soft-deleted clients and records where supported.
- Create, update, and delete pool projects.
- Manage project phases and checklist items.
- Verify or reject checklist submissions.
- Create client login accounts and send client invitations.
- View activity logs and all notifications available to the account.

### STAFF

- View, create, and update clients.
- Manage consultations, documents, communications, pool projects, phases, and checklist items.
- Verify or reject checklist submissions.
- Send client invitations.
- View activity logs.
- Staff cannot perform admin-only actions such as creating client login accounts directly, deleting clients, or managing system users.

### CLIENT

- Access only the client record linked to the authenticated account.
- View the client dashboard and pool project details.
- View phase progress and checklist items.
- Submit checklist items for internal review.
- Upload and view their own documents.
- Log communications.
- Add project notes.
- Read and manage their own notifications.

## 3. Internal Workspace Sections

### Dashboard

Route: `/`

The internal dashboard provides an overview of the client pipeline, including client statistics and recent clients. It is the landing page for ADMIN and STAFF users.

### Client Management

Routes:

- `/clients`
- `/clients/new`
- `/clients/:id`
- `/clients/:id/edit`

The client management section supports:

- Client creation and editing.
- Search by client name, company, or email.
- Filtering by client status: `LEAD`, `ACTIVE`, or `INACTIVE`.
- Client contact information, address, company, notes, and status.
- Client detail views with related consultations, documents, communications, and pool project information.
- Soft deletion and ADMIN-only restoration.
- Summary counts for consultations, documents, and communications.

### Client Detail Workspace

The client detail page groups the main client-related work into tabs:

- Consultations.
- Documents.
- Communications.
- Pool Project.

It also provides internal actions such as creating a pool project, creating a client login, sending an invitation, and reviewing checklist submissions.

### Consultations

Consultations record scheduled or completed client meetings and related notes. Each consultation includes:

- Title.
- Date.
- Notes.
- Status.
- The staff user who created or owns the record.

Consultations support listing, creation, editing, soft deletion, restoration, pagination, and activity logging for key changes.

### Document Management

Documents can be uploaded against a client and optionally associated with a consultation. Stored metadata includes:

- Original filename and stored filename.
- MIME type.
- File size.
- Description.
- Uploading user.
- Optional consultation association.

The frontend supports drag-and-drop or file selection, descriptions, document previews for supported image/PDF files, downloads, description editing, and deletion. Files are served through authenticated endpoints rather than a public uploads directory.

### Communications

The communication log tracks client-facing interactions. Supported communication types are:

- `EMAIL`
- `PHONE`
- `IN_PERSON`
- `SMS`
- `OTHER`

Each entry can include a subject, body, direction (`INBOUND` or `OUTBOUND`), date, and author. Internal users can manage records, while clients can view and add communications for their own account.

### Pool Project Management

Each client can have one pool project. Project information includes:

- Pool type.
- Pool shape.
- Dimensions.
- Estimated budget.
- Project notes.
- Current phase number.
- Overall status.

Creating a project automatically creates six ordered phases and their checklist items. The first phase starts as `IN_PROGRESS`; the remaining phases start as `NOT_STARTED`.

### Project Phases and Checklists

The six default phases are:

1. Initial Inquiry & Intake.
2. Site Evaluation.
3. Design & Conceptualization.
4. Proposal & Pricing.
5. Contracting & Permitting.
6. Pre-Construction Handoff.

Each phase includes a description, status, optional start/completion dates, and an ordered checklist. Internal users can update phase status and checklist completion. Clients can submit checklist items for review.

Checklist verification states are:

- `NOT_SUBMITTED`
- `SUBMITTED`
- `APPROVED`
- `REJECTED`

Internal users can approve or reject submissions and provide a rejection reason. The interface includes phase progress bars, completion circles, status indicators, reminders, and checklist review controls.

### Pool Notes

Pool notes form a project-specific shared note stream. Both internal users and the linked client can add notes. Notes display the author name and role; deletion is restricted by the backend according to the note owner or internal-user permissions.

### Invitations and Client Accounts

Internal users can invite a client by email. Invitations have a unique token, a seven-day expiration period, and a pending/accepted status.

The client onboarding flow is:

1. An ADMIN or STAFF member creates or selects a client.
2. An invitation is created for the client email.
3. The client opens `/accept-invite?token=...`.
4. The client validates the invitation and chooses a name and password.
5. The system creates a `CLIENT` user linked to the client record.

ADMIN users can also create a client login directly from the client detail page.

## 4. Client Portal Sections

### Client Project Dashboard

Route: `/my-project`

The client dashboard presents:

- Overall phase completion.
- Current in-progress phase.
- Project status.
- Pool specifications.
- Project notes.
- Quick links to documents and communications.

### Project Details and Phase Review

Route: `/my-project/phase/:id`

Clients can expand phases, inspect descriptions and checklist items, see progress, submit checklist items for internal review, and add project notes. The page also calculates business-day duration for in-progress phases and displays phase reminders when appropriate.

### Client Documents

Route: `/my-documents`

Clients can view and upload documents associated with their own client record. Document access is checked against the authenticated user's linked client ID.

### Client Communications

Route: `/my-communications`

Clients can view prior communication records and create new communication entries for their own client record.

## 5. Authentication and Account Features

Public account routes:

- `/login`
- `/forgot-password`
- `/reset-password`
- `/accept-invite`

Authentication uses JWT bearer tokens. On login, the frontend stores the token and user information in browser local storage and attaches the token to API requests through an Axios interceptor. A `401` response clears the local session and redirects to `/login`.

Supported account features include:

- Login.
- Current-user lookup.
- ADMIN-only user registration and user listing.
- Profile name and email updates.
- Password changes requiring the current password.
- Password reset tokens that expire after one hour.
- Client invitation acceptance.

## 6. Notifications and Activity Tracking

### Notifications

The notification bell appears in the authenticated layouts and periodically refreshes. Notifications support:

- Listing notifications with pagination.
- Unread count.
- Marking one notification as read.
- Marking all notifications as read.
- Deep links to the related client, phase, or checklist item.

Notification types used by the frontend include `SUBMITTED`, `APPROVED`, `REJECTED`, and `REMINDER`.

### Activity Log

ADMIN and STAFF users can access activity records through `/api/activity`. Logs capture key actions such as create, update, delete, restore, submit, and verify operations, along with the acting user, entity type, entity ID, optional details, and timestamp.

## 7. Frontend Structure

The frontend is located in `frontend/` and uses React 18, TypeScript, Vite, React Router, Tailwind CSS, Axios, and Lucide icons.

Important frontend areas:

- `frontend/src/App.tsx` — route definitions, authentication guard, and role-based layout selection.
- `frontend/src/context/AuthContext.tsx` — login state, session restoration, login, and logout.
- `frontend/src/api/index.ts` — typed API request wrappers and authenticated file access.
- `frontend/src/pages/` — internal pages and account pages.
- `frontend/src/pages/client/` — client portal pages.
- `frontend/src/components/Layout.tsx` — ADMIN/STAFF navigation shell.
- `frontend/src/components/ClientLayout.tsx` — CLIENT navigation shell.
- `frontend/src/components/PhaseProgressBar.tsx` — project phase visualization.
- `frontend/src/components/PhaseCompletionCircle.tsx` — checklist completion visualization.
- `frontend/src/components/DocumentUpload.tsx` — file upload, preview, and document actions.
- `frontend/src/components/NotificationBell.tsx` — notification polling and read-state controls.
- `frontend/src/components/ErrorBoundary.tsx` — fallback UI for unexpected React rendering errors.

## 8. Backend API Sections

All API routes are prefixed with `/api`.

| Section | Main endpoints |
|---|---|
| Authentication | `/auth/login`, `/auth/register`, `/auth/me`, `/auth/users`, `/auth/forgot-password`, `/auth/reset-password` |
| Clients | `/clients`, `/clients/:id`, `/clients/:id/restore` |
| Client accounts | `/clients/:clientId/create-login`, `/clients/:clientId/login-info` |
| Invitations | `/clients/:clientId/invite`, `/invite/:token`, `/invite/:token/accept` |
| Consultations | `/clients/:clientId/consultations`, `/clients/:clientId/consultations/:id` |
| Documents | `/clients/:clientId/documents`, `/clients/:clientId/documents/:id/download`, `/files/:id` |
| Communications | `/clients/:clientId/communications`, `/clients/:clientId/communications/:id` |
| Pool projects | `/clients/:clientId/project`, `/my-project` |
| Phases | `/clients/:clientId/project/phases`, `/clients/:clientId/project/phases/:phaseId` |
| Checklist review | `/clients/:clientId/project/phases/:phaseId/checklist/:itemId`, including submit and verify actions |
| Pool notes | `/clients/:clientId/project/notes`, `/clients/:clientId/project/notes/:noteId` |
| Notifications | `/notifications`, `/notifications/unread-count`, `/notifications/read-all`, `/notifications/:id/read` |
| Activity | `/activity` |
| Health | `/health` |

List endpoints use a paginated response shaped like:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

## 9. Data Model

The Prisma schema is in `backend/prisma/schema.prisma`. SQLite is the development database.

| Model | Purpose |
|---|---|
| `User` | Authenticated admin, staff, and client accounts |
| `Client` | Customer profile and relationship owner for project records |
| `Consultation` | Scheduled or historical consultation record |
| `Document` | Uploaded file metadata and client association |
| `Communication` | Client communication history |
| `PoolProject` | One pool project associated with a client |
| `ProjectPhase` | Ordered phase within a pool project |
| `ChecklistItem` | Action item within a project phase, including verification state |
| `PoolNote` | Shared project note |
| `Invitation` | Tokenized client onboarding invitation |
| `ActivityLog` | Audit-style record of important user actions |
| `Notification` | User-specific project and checklist notifications |

Foreign-key indexes exist for the main client, user, project, phase, entity, and notification lookup paths.

## 10. Security and Reliability Controls

- JWT authentication is required for protected API routes.
- ADMIN, STAFF, and CLIENT permissions are enforced in backend middleware.
- CLIENT users are restricted to their linked client record.
- Uploaded files are accessed through an authenticated file proxy.
- Login attempts are rate limited to 10 attempts per IP per 15 minutes.
- Password-reset requests are rate limited to 5 requests per IP per 15 minutes.
- Passwords are hashed with bcrypt.
- Security headers are applied with Helmet.
- Request logging is enabled with Morgan.
- Request payloads are validated with Zod.
- Client, document, consultation, and communication deletion uses soft-delete fields where implemented.
- Orphaned document files are removed when document records are deleted.
- The frontend includes a React error boundary and a catch-all 404 route.
- `JWT_SECRET` is required from the environment; there is no production fallback secret.

## 11. Configuration and Deployment

### Backend environment variables

```text
DATABASE_URL="file:./dev.db"
JWT_SECRET="a-strong-random-secret"
PORT=4000
UPLOAD_DIR="uploads"
FRONTEND_URL="http://localhost:3000"
```

### Local development

```bash
npm install
cd backend && npm install
npm run db:migrate
npm run db:seed
cd ../frontend && npm install
cd ..
npm run dev
```

The backend runs on port 4000 and the Vite frontend runs on port 3000. The Vite proxy forwards `/api` requests to the backend during local development.

### Production shape

The frontend can be built and hosted separately, including on Cloudflare Pages. The Express/SQLite backend must run on a Node-capable host such as Render, Railway, Fly.io, or a VPS. Frontend deployments can use `VITE_API_URL` to point to the deployed backend API.

## 12. Seeded Demo Data

The seed script creates or updates:

- ADMIN: `admin@example.com` / `admin123`
- STAFF: `staff@example.com` / `staff123`
- CLIENT: `client@example.com` / `client123`

It also creates a demo client, a demo pool project, all six phases, and their checklist items when they do not already exist.

## 13. Planned or Not Yet Implemented Features

The project plan identifies these remaining or future items:

- Backend API integration tests.
- Email delivery for notifications and invitations; current invitation and reset flows log links to the backend console.
- Docker setup and CI/CD.

The README also lists longer-term ideas such as real-time chat, project photos and timelines, calendar integration, reporting/analytics, multiple projects per client, document versioning, and a mobile app.
