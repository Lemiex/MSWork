# A3 Division of Labor

## Overview

The split below divides work by **user role**. This is the most decoupled approach, each person works on separate pages and can develop independently with only a thin shared interface.

---

## Sarah: Auth + Shared Infrastructure + Regular User

### Shared Infrastructure

| Item                            | Description                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Vite project setup              | `npm create vite@latest . -- --template react-ts` in `frontend/`, install deps |
| `src/api.ts`                    | Fetch wrapper: attaches `Authorization: Bearer <token>` header, handles JSON   |
| `src/contexts/AuthContext.tsx`  | Stores JWT in localStorage; provides `user`, `login`, `logout`                 |
| `src/components/Layout.tsx`     | Outer shell with role-aware navbar and `<Outlet />`                            |
| `src/components/Pagination.tsx` | Reusable component for any paginated list                                      |
| `src/App.tsx`                   | Route definitions                                                              |

### Auth Pages

| Page                    | Route           | API                        |
| ----------------------- | --------------- | -------------------------- |
| Login                   | `/login`        | `POST /auth/tokens`        |
| Register (regular user) | `/register`     | `POST /users`              |
| Request password reset  | `/reset`        | `POST /auth/resets`        |
| Activate / set password | `/reset/:token` | `POST /auth/resets/:token` |

### Regular User Pages

| Page                          | Route                   | API                                                                            |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| My Profile (view + edit)      | `/profile`              | `GET /users/me`, `PATCH /users/me`                                             |
| Avatar / resume upload        | (within profile)        | `POST /uploads/avatar`, `POST /uploads/resume`                                 |
| Availability toggle           | (within profile)        | `PATCH /users/me/available`                                                    |
| My Qualifications             | `/qualifications`       | `POST /qualifications`, `GET /qualifications/:id`, `PATCH /qualifications/:id` |
| Submit / revise qualification | (within qualifications) | upload document via `POST /uploads/qualification`                              |
| Browse Jobs                   | `/jobs`                 | `GET /jobs` (filter by position type, sort, pagination)                        |
| Job Detail                    | `/jobs/:id`             | `GET /jobs/:id`, `PATCH /jobs/:id/interested`                                  |
| My Interests                  | `/my-interests`         | `GET /users/me/interests`                                                      |
| My Invitations                | `/invitations`          | `GET /users/me/invitations`                                                    |
| Active Negotiation            | `/negotiation`          | `GET /negotiations/me`, `PATCH /negotiations/me/decision`, socket.io chat      |

Total pages: ~12

---

## Michelle: Business Register + Business + Admin

### Business Register

| Page                | Route                | API                |
| ------------------- | -------------------- | ------------------ |
| ~~Register (business)~~ | `/register/business` | `POST /businesses` |

### Business Pages

| Page                           | Route                                           | API                                                                       |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------- |
| ~~Business Profile (view + edit)~~ | `/business/profile`                             | `GET /businesses/me`, `PATCH /businesses/me`                              |
| ~~Business avatar upload~~         | (within profile)                                | `POST /uploads/avatar`                                                    |
| ~~My Jobs~~                        | `/business/jobs`                                | `GET /businesses/me/jobs` (filter by status, position type)               |
| ~~Create / Edit Job~~              | `/business/jobs/new`, `/business/jobs/:id/edit` | `POST /businesses/me/jobs`, `PATCH /businesses/me/jobs/:id`               |
| ~~Job Candidates~~                 | `/business/jobs/:id/candidates`                 | `GET /jobs/:id/candidates`, `PATCH /jobs/:id/candidates/:uid/interested`  |
| ~~Job Interests~~                  | `/business/jobs/:id/interests`                  | `GET /jobs/:id/interests`                                                 |
| ~~Mark No-Show~~                   | (button within job detail)                      | `PATCH /jobs/:id/no-show`                                                 |
| ~~Active Negotiation~~             | `/negotiation`                                  | `GET /negotiations/me`, `PATCH /negotiations/me/decision`, socket.io chat |

> **Note:** The negotiation page is the same route for both roles. Michelle can import and reuse the negotiation component that Sarah builds, or build a parallel version — agree beforehand.

### Admin Pages

| Page                 | Route                   | API                                                                      |
| -------------------- | ----------------------- | ------------------------------------------------------------------------ |
| ~~Admin Dashboard~~      | `/admin`                | (summary / landing page)                                                 |
| ~~User Management~~      | `/admin/users`          | `GET /users` (search, filter by activated/suspended, paginate, suspend)  |
| ~~Business Management~~  | `/admin/businesses`     | `GET /businesses` (search, filter, paginate, verify)                     |
| Qualification Review | `/admin/qualifications` | `GET /qualifications` (list pending, paginate, approve/reject)           |
| Position Types       | `/admin/position-types` | `GET /position-types`, `POST`, `PATCH`, `DELETE`                         |
| System Config        | `/admin/system`         | `PATCH /system/reset-cooldown`, `PATCH /system/negotiation-window`, etc. |

Total pages: ~12

## Interface Contract (what Michelle depends on from Sarah)

Michelle can start working once Sarah publishes these:

```ts
// src/contexts/AuthContext.tsx
const { user, login, logout } = useAuth();
// user = { id, role: "regular" | "business" | "admin", email: string, ... } | null

// src/api.ts — example shape
export const api = {
  get: (path: string) => ...,          // returns parsed JSON
  post: (path: string, body: unknown) => ...,
  patch: (path: string, body: unknown) => ...,
  delete: (path: string) => ...,
};
// Token from localStorage is attached automatically.

// src/components/Pagination.tsx
<Pagination page={page} total={total} limit={limit} onPageChange={setPage} />

// src/components/Layout.tsx
// Rendered by React Router as a parent route — no props needed
```

Michelle's pages just need to `import { useAuth } from "../contexts/AuthContext"` and `import { api } from "../api"`.

---

## Route structure (agree upfront — both edit App.jsx)

```
/                  → redirect based on role, or public landing
/login             → Login (Sarah)
/register          → Register regular user (Sarah)
/register/business → Register business (Michelle)
/reset             → Request password reset (Sarah)
/reset/:token      → Activate / set password (Sarah)
/profile           → Regular user profile (Sarah)
/qualifications    → My qualifications (Sarah)
/jobs              → Browse jobs (Sarah)
/jobs/:id          → Job detail (Sarah)
/my-interests      → My interests (Sarah)
/invitations       → My invitations (Sarah)
/negotiation       → Active negotiation — shared (A builds, B reuses)
/business/profile  → Business profile (Michelle)
/business/jobs     → My jobs (Michelle)
/business/jobs/new → Create job (Michelle)
/business/jobs/:id/candidates → Candidates (Michelle)
/admin             → Admin dashboard (Michelle)
/admin/users       → User management (Michelle)
/admin/businesses  → Business management (Michelle)
/admin/qualifications → Qual review (Michelle)
/admin/position-types → Position types (Michelle)
/admin/system      → System config (Michelle)
```

---

## Suggested order of implementation

**Sarah:**

1. Vite setup + install deps (`react-router-dom`, `socket.io-client`)
2. `api.js` + `AuthContext`
3. Login + Register
4. Layout + Navbar
5. Profile page
6. Jobs list + Job detail + Interest
7. Qualifications
8. Invitations + Interests
9. Negotiation (real-time chat)

**Michelle:**

1. Start after Sarah publishes `AuthContext` + `api.js`
2. Business register
3. Business profile
4. Job management (CRUD)
5. Candidate browsing + invitations
6. Admin pages (user/business management)
7. Qualification review + position types + system config

---

## Deployment

**Target environment:** Ubuntu 24.04 VPS (e.g., DigitalOcean, AWS EC2, Linode).
Both backend and frontend run on the same machine.

### Architecture

```
Browser → Nginx (port 80)
             ├── /          → serves frontend static files (dist/)
             └── /api/      → reverse proxy → Node.js backend (port 3000)
```

### Steps

1. **Build frontend:** `npm run build` inside `frontend/` → produces `dist/`
2. **Serve frontend:** Nginx serves `dist/` as static files
3. **Run backend:** `node src/server.js 3000` kept alive with PM2
4. **Nginx config:** reverse proxy `/api/` (or just have frontend call backend port directly)

### Backend CORS update (both should know)

Change `backend/index.js` from `http://localhost:5173` to the deployed frontend URL:

```js
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
```

Set `FRONTEND_URL=http://<your-domain-or-ip>` in the server's `.env`.
