# Smart Curriculum & Attendance App — 3D Experience

**Hackathon-ready prototype — Smart Education domain, rendered as an immersive 3D layout.**

A responsive, lightweight, multi-view web application for managing curriculum activities and attendance with QR-based check-in, free-period productivity planning, and institutional analytics — presented on a real-time WebGL stage (Three.js).

## Quick Start

Open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari). Requires internet for the Three.js / Chart.js / Google Fonts CDNs.

```bash
# Optional: serve locally
npx serve .
# or
python -m http.server 8080
```

## Features

### Central Landing & Portal Router (3D)
- Immersive WebGL hero with a **floating 3D terminal mesh** streaming live attendance/QR data
- **Scroll-driven parallax camera** — tracks backward and tilts upward through a neon architectural grid
- **Module Matrix** — Student / Teacher / Admin nodes orbit a central glowing "SmartEdu Hub" on neon rings
- **Mouse perspective parallax** tilts the scene toward the cursor; hovering portal cards triggers **neon particle bursts**
- Keycap-style CTAs that press flush along the Z-axis; count-up stats (89.4% attendance, 3,912 scans, 1,284 online, 47 sessions)

### Teacher Module
- Secure login placeholder (demo credentials pre-filled)
- Dashboard with KPIs, active classes, and 7-day attendance trend chart
- Class Management panel (create / view classes)
- **Attendance Generator**: dynamic QR mock with live countdown + real-time "Students Checked In" counter and recent check-ins
- Sortable Attendance History table with search

### Student Module
- Secure login placeholder
- **Scan QR Code** interface (simulated camera + upload trigger + success toast)
- KPI cards including **radial attendance progress** (92%) and today's timetable
- **Free Period Productivity Planner**: timeline that auto-highlights gaps and suggests academic activities

### Central Analytics & Admin
- Institution-wide KPIs
- Daily attendance trends (line chart)
- Class-by-class comparison (bar chart)
- Department snapshot table
- Export Reports (PDF / Excel)

## Design System

Cyberpunk glassmorphism: frosted `backdrop-filter` cards over `#0B0F19` slates with neon blue/purple border highlights. Inter + JetBrains Mono. Dark mode default with a light-glass toggle (persistent).

## Tech Stack

- Vanilla HTML5 / CSS3 / ES6+
- Three.js r128 (CDN) — WebGL scene engine (`window.Scene3D` API)
- Chart.js 4 (CDN) for analytics charts
- No framework, no build tools

## Demo Credentials

| Portal  | Email / ID                          | Password     |
|---------|-------------------------------------|--------------|
| Teacher | dr.sarah.chen@smartedu.edu          | Atten@2026   |
| Student | alex.rivera@student.edu             | Learn@2026   |
| Admin   | admin@smartedu.edu                  | Admin@2026   |

Each portal requires sign-in with the matching demo account.

## Performance & Responsiveness

- Pixel-ratio capped; particle/star counts reduced on mobile.
- Large 3D elements downscale and depth layers recede on small screens to prevent overlap with nav text.
- `prefers-reduced-motion` users get a static gradient fallback; the page degrades gracefully if WebGL fails.

## Project Structure

```
smart-curriculum-app/
├── index.html          # Single-page app shell + all view templates
├── css/styles.css      # Cyberpunk 3D design system & responsive styles
├── js/scene.js         # Three.js WebGL engine (window.Scene3D API)
├── js/app.js           # Routing, interactions, mock data, charts, 3D bindings
└── README.md
```

---

Built as a high-fidelity 3D prototype for Smart Education hackathons.
