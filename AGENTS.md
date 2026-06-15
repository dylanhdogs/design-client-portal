# Construction Client Portal - Agent Guide

## Project Overview

Full-stack web application for managing construction clients, consultations, documents, and communications.

## Tech Stack

- **Backend**: Node.js + Express + TypeScript + Prisma + SQLite
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Auth**: JWT with role-based access (ADMIN, STAFF, CLIENT)
- **File Uploads**: Multer with local storage

## Quick Start

```bash
# Install dependencies
npm install

# Start both servers
npm run dev

# Backend: http://localhost:4000
# Frontend: http://localhost:3000
```

## Demo Credentials

- Admin: `admin@example.com` / `admin123`
- Staff: `staff@example.com` / `staff123`
- Client: `client@example.com` / `client123` (created by admin)

## Key Commands

```bash
# Backend
cd backend
npm run dev         # Start dev server
npm run build       # Build TypeScript
npm run db:migrate  # Run migrations
npm run db:seed     # Seed data
npm run db:studio   # Prisma Studio

# Frontend
cd frontend
npm run dev     # Start dev server
npm run build   # Build for production
npm run preview # Preview production build
```

## Database

SQLite database at `backend/dev.db`. Schema in `backend/prisma/schema.prisma`.

## API Structure

All API routes prefixed with `/api`:
- `/auth/*` - Authentication
- `/clients/*` - Client CRUD
- `/clients/:id/consultations/*` - Consultations
- `/clients/:id/documents/*` - Documents
- `/clients/:id/communications/*` - Communications
- `/clients/:id/project/*` - Pool Projects
- `/clients/:id/project/phases/*` - Phases
- `/clients/:id/project/notes/*` - Pool Notes
- `/my-project` - Client's own project

## File Structure

- `backend/src/routes/` - API route handlers
- `backend/src/middleware/` - Auth & upload middleware
- `backend/src/utils/` - Prisma client, errors, pool project helper
- `frontend/src/pages/` - React page components
- `frontend/src/pages/client/` - Client portal pages
- `frontend/src/api/` - API client functions
- `frontend/src/components/` - Reusable UI components
- `frontend/src/context/` - React context (auth)
- `frontend/src/types/` - TypeScript interfaces

## Environment Variables

Backend `.env`:
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="construction-portal-jwt-secret-key-2026"
PORT=4000
UPLOAD_DIR="uploads"
```

## Notes

- Frontend proxy config in `frontend/vite.config.ts` forwards `/api` to backend
- File uploads stored in `backend/uploads/`
- Production builds: backend serves frontend static files from `frontend/dist/`
- TypeScript strict mode enabled for both projects
- Client portal is accessible at `/my-project` for CLIENT role users
- Pool project creation auto-generates 6 phases with checklist items
- Client login accounts are created by admin via client detail page
