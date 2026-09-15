# ILSI Cohort Learning

You are a senior full-stack software architect and engineer.

Build a complete, production-ready Learning Management System (LMS) for an organization called ILSI.

The platform is similar in concept to Coursera, but is specifically designed around structured, time-restricted training cohorts.

IMPORTANT:

Do not build only a frontend mockup.

Build the COMPLETE application including:

- Frontend

- Backend/API

- Database schema

- Authentication

- Authorization

- Course/module progression logic

- Quiz engine

- Admin dashboard

- Participant dashboard

- Cohort management

- Live-session management

- Payment workflow

- Notifications

- Bilingual support

- Responsive design

- Validation

- Error handling

- Loading states

- Empty states

- Security

- Seed/demo data

The application must be modular and scalable so that ILSI can add new programs, cohorts, modules, lessons, quizzes and participants without changing the codebase.

==================================================

1. TECHNOLOGY STACK

==================================================

Frontend:

- React

- TypeScript

- Vite

- Tailwind CSS

- React Router

- TanStack Query

- React Hook Form

- Zod

- Lucide React icons

Backend:

- Node.js

- Express.js

- TypeScript

- REST API architecture

- Zod validation

Database:

- Supabase PostgreSQL

- Supabase Storage for files/resources/videos where appropriate

Authentication:

- Better Auth

- Integrate Better Auth properly with the application

- Secure sessions

- Password hashing

- Session management

- Protected routes

- Role-based access control

Other:

- Use environment variables for secrets

- Never expose secrets to the frontend

- Use clean service/controller/repository architecture

- Use reusable components

- Use TypeScript strictly

- Avoid unnecessary dependencies

Do NOT use Firebase.

Do NOT use MongoDB.

Do NOT use fake/local-only authentication.

==================================================

2. CORE PRODUCT CONCEPT

==================================================

This is a cohort-based LMS.

Participants enroll in a training program.

A program contains:

- Cohorts

- Modules

- Lessons

- Videos

- Text/resources

- Case studies

- Interactive activities

- Quizzes

- Live sessions

The most important business rule is:

MODULES ARE TIME-RESTRICTED AND SEQUENTIAL.

Example:

Module 1:

September 28 → October 14

Live session:

October 15

Module 2:

October 15 → October 28

A participant cannot simply skip Module 1 and access Module 2.

Even if the calendar date reaches October 15:

IF:

- Module 1 is incomplete

OR

- Required lessons are incomplete

OR

- Required quiz is incomplete

OR

- Quiz score is below the minimum passing score

THEN:

Module 2 remains LOCKED.

The participant remains blocked until the requirements of Module 1 are satisfied.

The system must enforce this restriction on the BACKEND, not only through frontend UI.

Never trust frontend state for access control.

==================================================

3. USER ROLES

==================================================

Implement at least these roles:

1. ADMIN

2. INSTRUCTOR / TRAINER

3. PARTICIPANT

Optional future-ready role:

4. SUPER_ADMIN

Permissions:

ADMIN:

- Manage users

- Manage applications

- Manage programs

- Manage cohorts

- Manage modules

- Manage lessons

- Manage resources

- Manage quizzes

- Manage live sessions

- View participant progress

- View quiz results

- Manage payments

- Send notifications

- Manage certificates

- Configure passing scores

- Configure module dates

- Lock/unlock participants when necessary

INSTRUCTOR:

- View assigned cohorts

- View participants

- View progress

- View quiz performance

- Manage/view live sessions

- Add educational content where permitted

PARTICIPANT:

- Access assigned program

- View dashboard

- Access unlocked modules

- Complete lessons

- Watch videos

- Read resources

- Complete activities

- Take quizzes

- View results

- Attend live sessions

- View notifications

- View completion/certification status

- Update profile

==================================================

4. PUBLIC WEBSITE

==================================================

Create a modern public-facing website.

Pages:

/

Home

/programs

Training programs

/programs/:id

Program details

/apply

Application form

/login

Login

/forgot-password

Password recovery

/reset-password

Reset password

/about

About ILSI

/contact

Contact

The public website should feel modern, trustworthy and educational.

Do NOT make it look like a generic corporate template.

==================================================

5. APPLICATION / REGISTRATION FLOW

==================================================

From launch, people must be able to apply for the program.

Application fields should be configurable but initially include:

- First name

- Last name

- Email

- Phone

- Country

- City

- Date of birth

- Education

- Occupation

- Organization

- Motivation

- Previous experience

- Program applied for

Application statuses:

- PENDING

- UNDER_REVIEW

- SELECTED

- REJECTED

- WAITLISTED

- PAYMENT_PENDING

- ENROLLED

The application does NOT immediately grant course access.

The current cohort may already be running.

New applicants should wait while the current cohort is active.

Around week 4 or 5, administrators can review applications.

Selected applicants can then:

- Receive an account

- Log in

- Complete profile

- Make payment if required

- Gain access to the upcoming/assigned training

==================================================

6. ACCOUNT CREATION

==================================================

Initially, administrators manually create participant accounts.

Admin creates:

- Name

- Email/username

- Temporary password

- Program

- Cohort

- Role

Participant receives credentials.

FIRST LOGIN:

If firstLogin = true:

Automatically redirect participant to:

/profile/setup

They must:

- Complete missing profile information

- Change temporary password

- Accept required terms

- Save profile

After successful completion:

Redirect to:

/dashboard

Implement a secure first-login flow.

==================================================

7. PARTICIPANT DASHBOARD

==================================================

Create a beautiful participant dashboard.

It should show:

- Welcome message

- Current program

- Overall progress

- Current module

- Module status

- Progress percentage

- Next deadline

- Next live session

- Upcoming activities

- Recent quiz results

- Available resources

- Notifications

- Completion/certification status

Example dashboard:

-----------------------------------------

Welcome back, Sarah 👋

Digital Leadership Program

Overall Progress

████████████░░░ 78%

Current Module

Module 4 — Leadership & Collaboration

Deadline

October 14, 2026

Next Live Session

October 15, 2026

6:00 PM

[Join Session]

Recent Activity

✓ Lesson completed

✓ Quiz completed — 86%

-----------------------------------------

Make the dashboard visually clean and not overloaded.

==================================================

8. COURSE STRUCTURE

==================================================

Hierarchy:

Program

  └── Cohort

       └── Module

            ├── Lesson

            │    ├── Video

            │    ├── Text

            │    ├── Resources

            │    ├── Case Study

            │    └── Activity

            │

            └── Quiz

A program may contain multiple cohorts.

Example:

Program:

"Young Leaders Training"

Cohort:

"September 2026 Cohort"

Modules:

1. Introduction

2. Communication

3. Leadership

4. Problem Solving

5. Final Project

The architecture must support unlimited programs and cohorts.

==================================================

9. MODULE SYSTEM

==================================================

Each module should contain:

- Title

- Description

- Thumbnail

- Start date

- End date

- Order/index

- Estimated duration

- Required completion percentage

- Passing quiz score

- Status

- Lessons

- Resources

- Quiz

- Live session

Module states:

- UPCOMING

- ACTIVE

- LOCKED

- COMPLETED

- FAILED

- EXPIRED

Participant UI should clearly communicate these states.

Example:

✓ Module 1

Completed

✓ Module 2

Completed

→ Module 3

Currently active

Deadline: October 14

🔒 Module 4

Locked

Complete Module 3 to unlock

==================================================

10. MODULE ACCESS LOGIC

==================================================

THIS IS ONE OF THE MOST IMPORTANT PARTS OF THE SYSTEM.

Implement backend authorization for module access.

A participant can access Module N only if:

1. Module N is available according to its cohort schedule

AND

2. Module N-1 has been completed

AND

3. All mandatory lessons of Module N-1 are completed

AND

4. Required quiz has been submitted

AND

5. Quiz score >= configured passing score

Example:

Module 1:

Sep 28 - Oct 14

Module 2:

Oct 15 - Oct 28

If participant fails Module 1 quiz:

Module 2 remains locked.

The participant must:

- Review Module 1

- Retake the quiz

- Pass it

Only then unlock Module 2.

The frontend should display:

"Module locked"

"Complete Module 1 and achieve at least 70% to unlock this module."

Backend must reject unauthorized requests with proper HTTP status.

Do not rely on simply hiding the module in React.

Create reusable authorization logic such as:

canAccessModule(userId, cohortId, moduleId)

==================================================

11. LESSON SYSTEM

==================================================

Each lesson can contain one or more content types:

VIDEO

TEXT

PDF

RESOURCE

CASE_STUDY

INTERACTIVE_ACTIVITY

Lesson fields:

- Title

- Description

- Type

- Content

- Video URL

- Duration

- Order

- Is mandatory

- Resources

- Completion status

Participants should be able to:

- Start lesson

- Resume lesson

- Mark lesson complete

- Track progress

- Navigate between lessons

For videos:

Track:

- Started

- Progress percentage

- Completed

Consider a configurable completion threshold such as 80%.

==================================================

12. RESOURCES

==================================================

Resources may include:

- PDF

- DOC

- PPT

- Images

- External links

- Downloadable files

Use Supabase Storage where appropriate.

Resources should have:

- Name

- Description

- File URL

- Type

- Size

- Module

- Lesson

- Download permission

Admin should be able to upload/manage resources.

==================================================

13. QUIZ ENGINE

==================================================

Build a reusable quiz engine.

Supported question types:

1. Multiple Choice

2. True / False

3. Written Answer

4. Fill in the Blank

5. Reflection Question

6. Scenario-based question

Quiz fields:

- Title

- Description

- Time limit (optional)

- Passing score

- Attempts allowed

- Questions

- Randomization option

- Published status

Each question:

- Question text

- Type

- Options

- Correct answer

- Points

- Explanation

- Required

For automatic grading:

MCQ

True/False

Fill in blank

Scenario MCQ

Written/reflection answers may require manual grading.

Store every attempt.

Attempt fields:

- participant

- quiz

- started_at

- submitted_at

- score

- percentage

- passed

- attempt_number

After submission:

Show:

Score

Correct answers

Incorrect answers

Explanation

Pass/fail status

If failed:

"Review the module and try again."

==================================================

14. QUIZ PROGRESSION LOGIC

==================================================

A quiz can determine module completion.

Example:

Passing score = 70%

Participant gets:

65%

Result:

FAILED

Next module remains locked.

Participant gets another attempt.

Participant gets:

82%

Result:

PASSED

Module becomes completed.

Next module becomes eligible.

The system should retain previous attempts.

==================================================

15. LIVE SESSION SYSTEM

==================================================

Live sessions happen after each module deadline.

Example:

Module ends:

October 14

Live:

October 15

Live sessions are NOT simply additional lessons.

They are used for:

- Collective debrief

- Reviewing concepts

- Questions

- Discussion

- Practical application

- Experiences

- Deeper explanation

Live session fields:

- Title

- Description

- Cohort

- Module

- Date

- Start time

- End time

- Meeting link

- Recording URL

- Status

- Instructor

- Attendance tracking (future-ready)

Admin can schedule sessions in advance.

Participant dashboard should show:

NEXT LIVE SESSION

October 15

6:00 PM – 7:00 PM

Module 1 Debrief

[Join Live]

After session:

[Watch Recording]

If recording is available.

==================================================

16. NOTIFICATIONS

==================================================

Implement a notification system.

Notification types:

- New module unlocked

- Module deadline approaching

- Quiz failed

- Quiz passed

- Live session scheduled

- Live session reminder

- Application status update

- Payment required

- Payment successful

- Certificate available

Notification states:

- unread

- read

Create notification center in dashboard.

==================================================

17. PAYMENT SYSTEM

==================================================

Selected applicants may need to pay before gaining course access.

Payment status:

- NOT_REQUIRED

- PENDING

- PAID

- FAILED

- REFUNDED

Create architecture that supports payment providers.

Do NOT hardcode a payment provider unless required.

Create a PaymentService abstraction so Stripe or another provider can be integrated later.

For now, support:

- Payment records

- Payment status

- Transaction ID

- Amount

- Currency

- Timestamp

- User

- Application

- Cohort

Course access should depend on payment when payment is required.

==================================================

18. CERTIFICATION

==================================================

At the end of the program, calculate completion.

Participant should receive certification status:

NOT_STARTED

IN_PROGRESS

COMPLETED

CERTIFIED

Admin should be able to configure:

- Minimum module completion

- Required quizzes

- Final assessment

- Attendance requirements

- Certificate eligibility

Participant dashboard should display:

"Certificate Eligible"

or

"Program Completed"

Create a certificate-ready architecture.

==================================================

19. ADMIN DASHBOARD

==================================================

Build a complete admin dashboard.

Main sections:

Dashboard

Participants

Applications

Programs

Cohorts

Modules

Lessons

Quizzes

Live Sessions

Payments

Resources

Notifications

Certificates

Settings

Admin dashboard overview:

Total Participants

Active Cohorts

Pending Applications

Completion Rate

Average Quiz Score

Upcoming Live Sessions

Pending Payments

==================================================

20. PARTICIPANT MANAGEMENT

==================================================

Admin can:

- Search participants

- Filter by cohort

- Filter by program

- Filter by payment status

- Filter by progress

- View participant profile

- View progress

- View completed modules

- View quiz attempts

- View scores

- View live sessions

- View payment status

- Suspend/reactivate account

- Reset password

- Manually unlock module when necessary

Participant detail page should show:

Profile

Program

Cohort

Progress timeline

Module completion

Quiz scores

Attempts

Live sessions

Payment

Certification

==================================================

21. APPLICATION MANAGEMENT

==================================================

Admin can view:

- Applicant

- Program

- Application date

- Status

- Score/review

- Notes

- Payment status

Actions:

Approve

Reject

Waitlist

Select

Request information

Use confirmation dialogs for destructive actions.

==================================================

22. PROGRAM & COHORT MANAGEMENT

==================================================

Admin can create:

Program

Example:

"Young Leaders Program"

Then create:

Cohort

Example:

"September 2026"

Cohort fields:

- Name

- Program

- Start date

- End date

- Capacity

- Status

Statuses:

UPCOMING

ACTIVE

COMPLETED

ARCHIVED

A cohort should have its own module schedule.

IMPORTANT:

Do not hardcode dates inside React.

==================================================

23. CONTENT MANAGEMENT

==================================================

Admin should be able to create/edit/delete:

Programs

Cohorts

Modules

Lessons

Videos

Resources

Quizzes

Questions

Live sessions

Build reusable CRUD interfaces.

Use forms with:

- Validation

- Error messages

- Loading state

- Success state

==================================================

24. BILINGUAL SUPPORT

==================================================

The entire platform must support:

English

French

Implement proper i18n.

Do NOT hardcode UI text everywhere.

Use translation files such as:

/locales/en.json

/locales/fr.json

Users can switch language from the navbar/profile.

Store preferred language in the user profile.

Content itself should be capable of being bilingual.

For example:

Module:

title_en

title_fr

description_en

description_fr

Lesson:

title_en

title_fr

content_en

content_fr

Quiz:

question_en

question_fr

etc.

==================================================

25. DATABASE DESIGN

==================================================

Design a normalized PostgreSQL database.

At minimum consider these tables:

users

profiles

roles

programs

cohorts

cohort_members

applications

payments

modules

lessons

lesson_resources

resources

quizzes

quiz_questions

quiz_options

quiz_attempts

quiz_answers

lesson_progress

module_progress

live_sessions

live_attendance

notifications

certificates

Add timestamps:

created_at

updated_at

Use UUIDs.

Define proper:

- Primary keys

- Foreign keys

- Unique constraints

- Indexes

- Cascading rules where appropriate

Create database migrations/schema.

==================================================

26. SUPABASE

==================================================

Use Supabase PostgreSQL.

Use Supabase Storage for:

- PDFs

- Images

- Documents

- Video files if appropriate

Do NOT expose service-role keys to the browser.

Use environment variables:

SUPABASE_URL

SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY

BETTER_AUTH_SECRET

DATABASE_URL

etc.

Implement proper storage access policies.

==================================================

27. SECURITY

==================================================

Security is critical.

Implement:

- Authentication

- Authorization

- Role-based access control

- Protected API routes

- Input validation

- Zod schemas

- Secure password handling through Better Auth

- Rate limiting where appropriate

- CORS configuration

- Helmet

- Secure cookies/session handling

- SQL injection protection

- XSS prevention

- File upload validation

- File size limits

- Proper error responses

Never expose:

- passwords

- secrets

- service-role keys

- sensitive internal data

Never trust:

- frontend role

- frontend progress

- frontend module status

- frontend payment status

Everything important must be verified server-side.

==================================================

28. API ARCHITECTURE

==================================================

Create clean REST endpoints.

Examples:

POST /api/auth/...

GET /api/programs

GET /api/programs/:id

GET /api/cohorts

POST /api/cohorts

GET /api/modules/:id

GET /api/modules/:id/access

GET /api/lessons/:id

POST /api/lessons/:id/complete

GET /api/quizzes/:id

POST /api/quizzes/:id/attempt

POST /api/quizzes/:id/submit

GET /api/progress

GET /api/live-sessions

POST /api/applications

GET /api/admin/applications

GET /api/admin/participants

etc.

Organize routes by feature.

==================================================

29. PROJECT STRUCTURE

==================================================

Use a scalable structure similar to:

/client

  /src

    /components

    /pages

    /layouts

    /features

      /auth

      /dashboard

      /courses

      /modules

      /lessons

      /quizzes

      /live

      /applications

      /payments

      /notifications

      /admin

    /hooks

    /lib

    /services

    /types

    /i18n

/server

  /src

    /controllers

    /routes

    /services

    /repositories

    /middleware

    /schemas

    /utils

    /types

    /config

/database

  migrations

  seed

Keep frontend and backend concerns separated.

==================================================

30. DESIGN SYSTEM

==================================================

Design should be:

- Clean

- Minimal

- Modern

- Aesthetic

- Professional

- Youth-oriented

- Educational

- Accessible

Avoid:

- excessive gradients

- excessive glassmorphism

- overly rounded everything

- huge text everywhere

- unnecessary animations

- visual clutter

Use:

- generous whitespace

- strong typography

- subtle borders

- soft shadows

- restrained colors

- clear hierarchy

- elegant cards

- intuitive navigation

Think:

"Modern education startup + professional training institution."

The interface should feel premium but simple.

==================================================

31. RESPONSIVE DESIGN

==================================================

The platform MUST work properly on:

Desktop

Tablet

Mobile

Do not simply shrink desktop UI.

Create responsive layouts.

Desktop:

- sidebar

- content area

Tablet:

- collapsible sidebar

Mobile:

- bottom navigation or compact navigation

- mobile-friendly cards

- full-width content

- touch-friendly buttons

- responsive quiz interface

- responsive video player

Test common widths:

375px

390px

768px

1024px

1440px

==================================================

32. PARTICIPANT COURSE UI

==================================================

Create a course learning interface.

Layout:

Sidebar:

Module navigation

Main:

Lesson title

Video/content

Resources

Activity

Bottom:

Previous

Next

Progress indicator:

Lesson 3 of 7

43% complete

Module progress:

████████░░ 80%

If lesson is mandatory, don't allow the participant to mark it complete without satisfying its completion requirements.

==================================================

33. UX DETAILS

==================================================

Include:

Skeleton loaders

Empty states

Error states

Toast notifications

Confirmation modals

Form validation

Accessible components

Keyboard navigation

Good focus states

Responsive tables

Pagination

Search

Filtering

Sorting

Never show a blank screen while data is loading.

==================================================

34. ANALYTICS

==================================================

Admin should be able to see:

- Enrollment count

- Active participants

- Completion rate

- Module completion rate

- Average quiz score

- Quiz failure rate

- Most difficult modules

- Payment conversion

- Application conversion

- Cohort performance

Keep analytics architecture extensible.

==================================================

35. IMPORTANT BUSINESS RULES

==================================================

Implement these carefully:

RULE 1:

A participant only sees programs/cohorts assigned to them.

RULE 2:

A participant cannot access locked modules.

RULE 3:

Calendar dates alone do NOT unlock a module.

RULE 4:

Previous module requirements must be satisfied.

RULE 5:

Required lessons must be completed.

RULE 6:

Required quiz must be passed.

RULE 7:

Failed quizzes can be retaken according to configured attempts.

RULE 8:

All quiz attempts must be stored.

RULE 9:

Live sessions are associated with modules and cohorts.

RULE 10:

Admin can schedule live sessions in advance.

RULE 11:

Recordings can be added after the live.

RULE 12:

Payment can be required before course access.

RULE 13:

First-time users must complete profile setup.

RULE 14:

Application approval does not necessarily equal enrollment.

RULE 15:

All important access checks must happen server-side.

==================================================

36. DEMO DATA

==================================================

Create seed data for:

1 Admin

2 Instructors

5-10 Participants

One demo program:

"Young Leaders Training"

One cohort:

"September 2026 Cohort"

Create 5 modules.

Each module should contain:

- 3-5 lessons

- videos using placeholder URLs

- resources

- one quiz

Use different quiz question types.

Create live sessions after each module.

Create example applications and payments.

==================================================

37. ERROR HANDLING

==================================================

Create consistent API responses.

Example:

{

  "success": false,

  "error": {

    "code": "MODULE_LOCKED",

    "message": "Complete the previous module before accessing this module."

  }

}

Use meaningful error codes.

Frontend should translate these into useful UX messages.

==================================================

38. PERFORMANCE

==================================================

Optimize for:

- Fast initial load

- Lazy-loaded routes

- Code splitting

- Optimized images

- Query caching

- Pagination

- Efficient database queries

- Proper indexes

Do not fetch the entire course database for every dashboard request.

==================================================

39. ACCESSIBILITY

==================================================

Follow WCAG principles.

Include:

- semantic HTML

- keyboard navigation

- accessible labels

- sufficient contrast

- visible focus states

- alt text

- accessible dialogs

- accessible forms

==================================================

40. DEVELOPMENT REQUIREMENTS

==================================================

Before coding:

1. Analyze requirements.

2. Design architecture.

3. Define database schema.

4. Define relationships.

5. Define API contracts.

6. Define authentication/authorization flow.

7. Define module access algorithm.

8. Define frontend routes.

9. Define component structure.

Then implement.

Do NOT randomly start creating components without architecture.

==================================================

41. DELIVERABLES

==================================================

The final implementation must include:

✓ Complete frontend

✓ Complete backend

✓ Supabase database schema

✓ Migrations

✓ Seed data

✓ Better Auth integration

✓ Role-based access

✓ Participant dashboard

✓ Admin dashboard

✓ Instructor dashboard

✓ Application system

✓ Program management

✓ Cohort management

✓ Module management

✓ Lesson system

✓ Resource management

✓ Quiz engine

✓ Quiz grading

✓ Progress tracking

✓ Module locking/unlocking

✓ Live sessions

✓ Recording support

✓ Notifications

✓ Payment architecture

✓ Certification architecture

✓ English/French i18n

✓ Responsive UI

✓ Security

✓ Error handling

✓ Loading states

✓ Empty states

✓ Documentation

==================================================

42. CODE QUALITY

==================================================

Write clean, maintainable TypeScript.

Use:

- interfaces/types

- reusable functions

- reusable components

- services

- validation schemas

- constants

- enums

Avoid:

- any

- duplicated logic

- giant components

- hardcoded business rules

- hardcoded dates

- hardcoded user IDs

- hardcoded permissions

Business logic should live in services, not React components.

==================================================

43. FINAL CHECK

==================================================

Before considering the project complete, verify the following scenario manually:

Participant joins Module 1.

Module 1:

September 28 → October 14

Participant completes only 50% of lessons.

October 15 arrives.

Expected:

Module 2 = LOCKED.

Participant finishes Module 1.

Takes quiz.

Score = 55%.

Passing score = 70%.

Expected:

Module 2 = LOCKED.

Participant retakes quiz.

Score = 82%.

Expected:

Module 2 = UNLOCKED.

Participant accesses Module 2.

Verify that directly calling the Module 2 API before satisfying requirements returns:

MODULE_LOCKED

Also test:

- unauthenticated user accessing dashboard

- participant accessing admin API

- participant accessing another participant's data

- failed quiz

- retake

- payment pending

- first login

- language switching

- mobile layout

- expired module

- live session

- recording

- notification

==================================================

44. IMPORTANT IMPLEMENTATION PHILOSOPHY

==================================================

This is NOT a static website.

This is a real LMS.

Prioritize:

1. Correct business logic

2. Security

3. Data integrity

4. Scalability

5. UX

6. Visual polish

If a design decision conflicts with business logic, business logic wins.

If a frontend feature can be manipulated through the browser, implement server-side validation.

Do not create fake functionality merely to make the UI look complete.

If a feature cannot yet be connected to a real external provider, create a clean abstraction/interface for it and implement a realistic development/mock provider.

Build the application so that future developers can easily add:

- new training programs

- new cohorts

- new modules

- new content types

- new quiz types

- payment providers

- email providers

- video providers

- certificate providers

Start by producing the architecture and database schema, then implement the application feature-by-feature.

create the ui very clean, modern and aesthetic. adding a reference of a landing page and dashbaord so use these for the insipration

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7d76d3ca-7233-46f9-ab7c-3656df2627aa).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
