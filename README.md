# Construction Client Design Portal

A web application for managing construction clients, consultations, documents, and communications.

## Features

- **Client Management**: Create, update, and track client profiles with contact information, status, and notes
- **Pool Project Tracking**: Track pool construction projects through 6 phases:
  1. Initial Inquiry & Intake
  2. Site Evaluation
  3. Design & Conceptualization
  4. Proposal & Pricing
  5. Contracting & Permitting
  6. Pre-Construction Handoff
- **Phase Checklists**: Each phase has 4-7 checklist items for tracking progress
- **Consultation Tracking**: Record and manage consultation sessions with dates, notes, and status
- **Document Management**: Upload, download, and organize client-related documents (blueprints, contracts, permits, etc.)
- **Communication Log**: Track all client communications including emails, phone calls, and in-person meetings
- **Pool Notes**: Separate note stream per pool project that both staff and clients can use
- **Role-Based Access**: Different user roles (Admin, Staff, Client) with appropriate permissions
- **Client Portal**: Dedicated client interface for viewing project progress, uploading documents, logging communications, and adding notes
- **Dashboard**: Overview of client statistics and recent activity

## Tech Stack

### Backend
- Node.js + Express
- TypeScript
- Prisma ORM with SQLite
- JWT Authentication
- Multer for file uploads

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS
- React Router
- Lucide React (icons)

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation

1. Install root dependencies:
```bash
npm install
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Set up the database:
```bash
npm run db:migrate
npm run db:seed
```

4. Install frontend dependencies:
```bash
cd frontend
npm install
```

### Running the Application

1. Start both servers:
```bash
npm run dev
```

Or start separately:
```bash
# Backend
cd backend
npm run dev
# API: http://localhost:4000

# Frontend
cd frontend
npm run dev
# App: http://localhost:3000
```

## Deploying Frontend To Cloudflare Pages

Cloudflare Pages can host the React/Vite frontend. The current Express + SQLite backend does not run on Cloudflare Pages, so deploy the backend separately first, then point the Pages frontend at that backend URL.

### Cloudflare Pages Settings

- **Root directory**: `frontend`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Node.js version**: `20` or newer

### Environment Variables

Set these in Cloudflare Pages under **Settings > Environment variables**:

```bash
VITE_API_URL=https://your-backend-domain.com/api
VITE_UPLOADS_URL=https://your-backend-domain.com/uploads
```

For local frontend development, copy `frontend/.env.example` to `frontend/.env` if you want explicit API URLs. If unset, the frontend defaults to `/api` and `/uploads`, which works with the Vite dev proxy and with a same-origin production deployment.

### Backend Hosting Note

Use a Node-capable host for the backend, such as Render, Railway, Fly.io, or a VPS. Make sure the backend allows requests from your Cloudflare Pages domain. The current backend uses permissive CORS by default.

For Render, use one of these configurations:

**Option A: Render root directory set to repository root**

- **Root Directory**: leave blank or `/`
- **Build Command**: `npm run build:backend`
- **Start Command**: `npm start`

**Option B: Render root directory set to backend**

- **Root Directory**: `backend`
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm start`

Do not use the root `npm run build` command for backend-only Render deploys unless you intentionally want to build both backend and frontend.

### SPA Routing

`frontend/public/_redirects` is included so direct visits to routes like `/clients` or `/my-project` load the React app correctly on Cloudflare Pages.

### Demo Credentials

- **Admin**: `admin@example.com` / `admin123`
- **Staff**: `staff@example.com` / `staff123`
- **Client**: `client@example.com` / `client123` (created by admin)

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/register` - Register new user (Admin only)
- `GET /api/auth/me` - Get current user profile
- `GET /api/auth/users` - List all users (Admin only)

### Clients
- `GET /api/clients` - List clients (Admin/Staff only)
- `GET /api/clients/:id` - Get client details (Admin/Staff/Client own)
- `POST /api/clients` - Create client (Admin/Staff)
- `PUT /api/clients/:id` - Update client (Admin/Staff)
- `DELETE /api/clients/:id` - Delete client (Admin)

### Pool Projects
- `POST /api/clients/:clientId/project` - Create pool project (Admin/Staff)
- `GET /api/clients/:clientId/project` - Get pool project (Admin/Staff/Client own)
- `PUT /api/clients/:clientId/project` - Update project (Admin/Staff)
- `GET /api/my-project` - Get own project (Client only)

### Phases
- `GET /api/clients/:clientId/project/phases` - List phases
- `PUT /api/clients/:clientId/project/phases/:phaseId` - Update phase status
- `PUT /api/clients/:clientId/project/phases/:phaseId/checklist/:itemId` - Toggle checklist item

### Pool Notes
- `GET /api/clients/:clientId/project/notes` - List notes
- `POST /api/clients/:clientId/project/notes` - Add note (All roles)

### Client Users
- `POST /api/clients/:clientId/create-login` - Create client login (Admin)
- `GET /api/clients/:clientId/login-info` - Get client login info (Admin)

### Consultations
- `GET /api/clients/:clientId/consultations` - List consultations
- `POST /api/clients/:clientId/consultations` - Create consultation
- `PUT /api/consultations/:id` - Update consultation
- `DELETE /api/consultations/:id` - Delete consultation

### Documents
- `GET /api/clients/:clientId/documents` - List documents
- `POST /api/clients/:clientId/documents` - Upload document
- `GET /api/documents/:id/download` - Download document
- `DELETE /api/documents/:id` - Delete document

### Communications
- `GET /api/clients/:clientId/communications` - List communications
- `POST /api/clients/:clientId/communications` - Log communication
- `PUT /api/communications/:id` - Update communication
- `DELETE /api/communications/:id` - Delete communication

## Project Structure

```
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── seed.ts             # Seed data
│   ├── src/
│   │   ├── middleware/
│   │   │   ├── auth.ts         # JWT auth & role middleware
│   │   │   └── upload.ts       # File upload middleware
│   │   ├── routes/
│   │   │   ├── auth.ts         # Auth routes
│   │   │   ├── clients.ts      # Client CRUD
│   │   │   ├── consultations.ts # Consultation routes
│   │   │   ├── documents.ts    # Document routes
│   │   │   ├── communications.ts # Communication routes
│   │   │   ├── poolProject.ts  # Pool project routes
│   │   │   ├── phases.ts       # Phase routes
│   │   │   ├── poolNotes.ts    # Pool notes routes
│   │   │   ├── clientUsers.ts  # Client user creation
│   │   │   └── myProject.ts    # My project route
│   │   ├── utils/
│   │   │   ├── prisma.ts       # Prisma client
│   │   │   ├── errors.ts       # Error handling
│   │   │   └── poolProject.ts  # Pool project helper
│   │   └── index.ts            # Express app entry
│   └── uploads/                # File storage directory
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── index.ts        # API client functions
│   │   ├── components/
│   │   │   ├── Layout.tsx        # Admin/Staff layout
│   │   │   ├── ClientLayout.tsx  # Client layout
│   │   │   ├── PhaseProgressBar.tsx # Phase progress visual
│   │   │   └── CreateLoginForm.tsx  # Client login creation
│   │   ├── context/
│   │   │   └── AuthContext.tsx  # Auth state management
│   │   ├── pages/
│   │   │   ├── Login.tsx        # Login page
│   │   │   ├── Dashboard.tsx    # Dashboard with stats
│   │   │   ├── Clients.tsx      # Client list
│   │   │   ├── ClientForm.tsx   # Client create/edit form
│   │   │   ├── ClientDetail.tsx # Client detail with tabs
│   │   │   └── client/
│   │   │       ├── ClientDashboard.tsx  # Client portal dashboard
│   │   │       ├── MyProject.tsx        # Client project view
│   │   │       ├── ClientDocuments.tsx   # Client documents
│   │   │       └── ClientCommunications.tsx # Client communications
│   │   ├── types/
│   │   │   └── index.ts        # TypeScript interfaces
│   │   ├── App.tsx             # Router setup
│   │   └── main.tsx            # React entry point
│   └── index.html              # HTML template
```

## Database Schema

The application uses SQLite with the following tables:

- **users**: System users (admin, staff, client)
- **clients**: Client profiles with contact info and status
- **consultations**: Consultation notes and sessions
- **documents**: Uploaded files with metadata
- **communications**: Communication log entries
- **pool_projects**: Pool construction projects
- **project_phases**: 6 phases per pool project
- **checklist_items**: Phase checklist items
- **pool_notes**: Project-level notes

## Client Portal Workflow

1. Admin creates a client in the system
2. Admin creates a pool project for the client (auto-generates 6 phases with checklist items)
3. Admin creates a client login account for the client
4. Client receives login credentials and logs in at `/login`
5. Client is redirected to their project dashboard showing:
   - Phase progress bar
   - Current phase status
   - Project details
   - Quick actions (upload documents, log communications)
6. Client can:
   - View their project progress and phase details
   - Upload documents
   - Log communications
   - Add pool notes
   - View all project activity

## Admin/Staff Workflow

1. Log in as admin or staff
2. View dashboard with client stats
3. Create new clients
4. Create pool projects for clients
5. Create client login accounts
6. Track project progress through phases
7. Manage consultations, documents, and communications
8. Update phase checklist items

## Future Enhancements

- Add email notifications for phase updates
- Implement real-time chat between client and staff
- Add project photos and timeline
- Implement calendar integration for consultations
- Add reporting and analytics
- Support for multiple projects per client
- Document versioning
- Mobile app
