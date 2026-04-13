# Temporary Staffing Platform

A full-stack web application for temporary staffing, built with React (frontend) and Express + Prisma + SQLite (backend).

## Prerequisites

- Node.js (v18+)
- npm

## Setup & Run

### Backend

```bash
cd backend
npm install

npx prisma migrate dev        # create/apply database migrations
npx prisma generate            # generate Prisma client
npx prisma studio

npm run seed                   # seed the database

npm start                      # starts server on port 3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                    # starts Vite dev server on http://localhost:5173
```

### Superuser

To create an admin/superuser account:

```bash
cd backend
node prisma/createsu.js
```

## Build for Production

```bash
cd frontend
npm run build
npm run preview                # preview production build
```

## Cleanup

From the `A3/` directory:

```bash
make clean                     # removes node_modules and lockfiles
```
