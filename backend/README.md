# ILSI Cohort Learning Management System (Backend)

Production-ready backend for the ILSI Cohort Learning platform built with **Node.js**, **Express**, **TypeScript**, **Supabase PostgreSQL**, **Better Auth**, **Supabase Storage (PRO)**, and **Google Meet / Calendar API**.

---

## Architecture Overview

```
[ Frontend: React + TypeScript + TanStack Router ]
                       │
                       │ REST API (JSON + Cookie Sessions)
                       ▼
          [ Express.js REST API Server ]
                       │
         ┌─────────────┼─────────────┬─────────────────┐
         │             │             │                 │
         ▼             ▼             ▼                 ▼
   Better Auth    Supabase DB    Supabase PRO     Google Calendar
   (PostgreSQL)   (PostgreSQL)     Storage             API
                                 (Signed URLs)     (Google Meet)
```

---

## 1. Prerequisites & Stack

- **Runtime**: Node.js v20+ or v22+
- **Database**: Supabase PostgreSQL (or any PostgreSQL 15+ database)
- **Storage**: Supabase Storage (PRO Plan recommended for course videos and resources)
- **Authentication**: Better Auth with PostgreSQL adapter
- **Live Sessions**: Google Calendar API v3 with Google Meet conference generation

---

## 2. Environment Variables Configuration

Copy `.env.example` to `.env` in `backend/`:

```bash
cp .env.example .env
```

Set the following variables in `.env`:

```env
# Server
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:8080

# Supabase Credentials (from Project Settings -> API)
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]

# Database Connection (from Project Settings -> Database -> Connection string)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Better Auth
BETTER_AUTH_SECRET=ilsi_lms_super_secret_auth_key_replace_in_production_min_32_chars
BETTER_AUTH_URL=http://localhost:4000

# Google OAuth (for Google Meet conference creation)
GOOGLE_CLIENT_ID=[YOUR-GOOGLE-CLIENT-ID].apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=[YOUR-GOOGLE-CLIENT-SECRET]
GOOGLE_REDIRECT_URI=http://localhost:4000/api/google/callback

# Email
EMAIL_FROM=admissions@ilsi-leadership.org
```

---

## 3. Database Migration & Seeding

Run schema migrations to create all 25 tables, constraints, and indexes:

```bash
# In backend/
npm run migrate
```

Seed the database with default programs, cohorts, modules, lessons, quizzes, demo admin, and demo student:

```bash
npm run seed
```

### Seed Accounts Created:
- **Administrator**: `admin@ilsi-leadership.org` / `AdminPassword123!`
- **Student**: `participant@ilsi-leadership.org` / `StudentPassword123!`

---

## 4. Supabase Storage Setup (PRO Plan)

Course videos and resources are stored in **private buckets** and streamed via **short-lived signed URLs** generated on-demand only after strict prerequisite and enrollment authorization.

### Step 1: Create Storage Buckets in Supabase Dashboard
Go to **Storage -> Create Bucket**:
1. `course-videos`: **Private** (Public bucket: OFF)
2. `course-resources`: **Private** (Public bucket: OFF)
3. `live-recordings`: **Private** (Public bucket: OFF)
4. `certificates`: **Private** (Public bucket: OFF)
5. `course-thumbnails`: **Public** (Public bucket: ON)

### Step 2: Storage Security Policies
Because our backend accesses Supabase Storage using the **Supabase Service Role Key** (`SUPABASE_SERVICE_ROLE_KEY`), RLS policies can remain locked down. Direct client uploads or reads without backend authorization are completely blocked.

When a student requests a video (`GET /api/lessons/:id/video`), the server checks `ModuleAccessService` and returns a signed URL valid for 3600 seconds. The student's browser plays the media directly from Supabase's high-speed global CDN without routing video binaries through the Node.js memory.

---

## 5. Google Meet & Calendar Setup

### Step 1: Create Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `ILSI LMS Live Sessions`.
3. Enable the **Google Calendar API** under **APIs & Services -> Library**.

### Step 2: Configure OAuth Consent Screen
1. Set User Type to **Internal** (if using Google Workspace) or **External**.
2. Add App Name (`ILSI LMS`) and support emails.
3. Add Scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`

### Step 3: Create OAuth 2.0 Client Credentials
1. Go to **APIs & Services -> Credentials -> Create Credentials -> OAuth client ID**.
2. Application type: **Web application**.
3. Authorized redirect URI:
   `http://localhost:4000/api/google/callback` (or your production URL).
4. Copy `Client ID` and `Client Secret` into `.env`.

### Step 4: Authorize Organizer Account
From the admin dashboard, or by visiting `http://localhost:4000/api/google/auth`, log in with your Google account. The server securely stores the refresh token in `google_oauth_tokens`. Whenever you schedule a session in `/admin`, a Google Calendar event with a Google Meet conference link is automatically generated and enrolled students are invited.

---

## 6. Centralized Module Progression Engine

The LMS strictly enforces sequential module progression:
1. **Module 1**: Accessible once its start date arrives and payment status is settled.
2. **Subsequent Modules ($M_i$)**:
   - Must complete all mandatory lessons in previous module $M_{i-1}$.
   - Must achieve $\ge \text{requiredCompletion}$ % in $M_{i-1}$.
   - Must pass $M_{i-1}$ quiz with score $\ge \text{passingScore}$ %.
   - Only unlocks when $M_i$'s calendar start date arrives.
   - Calendar date alone **never** unlocks a module if previous requirements are unmet.

---

## 7. Running the Servers

### Development Mode

Run backend dev server:
```bash
npm run dev --prefix backend
# Server listens on http://localhost:4000
```

Run frontend dev server:
```bash
npm run dev --prefix frontend
# App opens on http://localhost:8080
```

### Running Automated Tests
```bash
npm run test:backend
# Executes Vitest test suite testing progression rules and gating
```

---

## 8. REST API Reference

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/sign-in/email` | POST | Public | Better Auth login |
| `/api/auth/sign-up/email` | POST | Public | Better Auth registration |
| `/api/profile` | GET / PATCH | Authenticated | Retrieve or update user profile |
| `/api/profile/complete-onboarding` | POST | Authenticated | First-login password change & profile finalization |
| `/api/student/dashboard` | GET | Participant | Aggregated dashboard data (modules, progress, live sessions) |
| `/api/lessons/:id` | GET | Participant | Fetch lesson content (verifies module access) |
| `/api/lessons/:id/video` | GET | Participant | Generate short-lived signed video URL |
| `/api/progress/lessons/:id` | POST | Participant | Track watch position and mark complete |
| `/api/quizzes/:id` | GET | Participant | Fetch quiz questions (answer keys omitted) |
| `/api/quizzes/:id/attempts` | POST | Participant | Submit quiz answers and auto-grade attempt |
| `/api/live-sessions` | GET | Participant | List live sessions for student's cohort |
| `/api/applications` | POST | Public | Submit program admission application |
| `/api/admin/dashboard` | GET | Admin | High-level analytics and KPI cards |
| `/api/admin/cohorts` | GET / POST | Admin | Manage cohorts and schedules |
| `/api/admin/participants` | GET / POST | Admin | Manage students and manually provision accounts |
| `/api/admin/applications` | GET / PATCH | Admin | Admissions review pipeline |
| `/api/admin/live-sessions` | POST | Admin | Create live session with Google Meet |
| `/api/admin/settings` | GET / PUT | Admin | Global passing score and notification settings |
| `/api/google/auth` | GET | Admin | Initiate Google Calendar OAuth link |
