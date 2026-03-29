[PRD]

# PRD: Theme-Voting Admin Panel

## 1. Overview

Port the theme-voting admin panel from the standalone Express app into the Singulars Next.js application. The admin panel allows the project owner to manage submitted themes - editing content, marking themes as completed, deleting themes, and viewing voting statistics. Access is protected by a simple password page. The admin UI must use the Singulars design system.

---

## 2. Goals

- Provide a password-protected admin interface at `/theme-voting/admin`
- Port all admin features: edit theme, toggle complete, delete theme, stats dashboard, add theme
- Use Singulars design system consistently
- Admin API routes validate token server-side
- Session persists via cookie (24h)

---

## 3. Quality Gates

- `npm run build` - zero errors
- `npm run lint` - zero errors
- Manual visual verification

---

## 4. User Stories

### US-001: Password auth page

### US-002: Admin API routes with cookie validation

### US-003: Stats dashboard

### US-004: Theme list with edit/complete/delete controls

### US-005: Navigation and logout

See full details in PRD generation conversation.

[/PRD]
