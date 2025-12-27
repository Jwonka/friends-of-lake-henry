# Friends of Lake Henry
Community-driven nonprofit website and content platform built with **Astro**, **Cloudflare Pages**, **Workers**, **D1**, and **R2**.

🔗 **Live site:** https://friendsoflakehenry.com

<p>
  <img src="https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white" />
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" />
  <img src="https://img.shields.io/badge/Cloudflare-D1-0F1E2E?logo=cloudflare&logoColor=white" />
  <img src="https://img.shields.io/badge/Cloudflare-R2-0F1E2E?logo=cloudflare&logoColor=white" />
  <img src="https://img.shields.io/badge/Astro-BC52EE?logo=astro&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-success" />
</p>

---

<details>
  <summary><strong>Table of Contents</strong></summary>

- [Live Site](#overview)
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Screenshots](#screenshots)
- [Development Setup](#development-setup)
- [Status](#status)
- [License](#license)

</details>

---

## Overview

**Friends of Lake Henry** is a nonprofit organization dedicated to lake restoration, conservation, and community engagement.

This platform provides a fast, accessible public website paired with secure administrative tools for managing:

- Information about the lake and restoration efforts
- Events and community calendars  
- Raffle and fundraising information
- Donor listings  
- Community photo submissions and moderation
- Donation and contact details

The site is built with **Astro** and deployed on **Cloudflare Pages**, with backend functionality powered by **Cloudflare Workers**, **D1**, and **R2**.

---

## Tech Stack

### Frontend
<p>
  <img height="30" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/astro/astro-original.svg" />
  <img height="30" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/typescript/typescript-original.svg" />
  <img height="30" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/javascript/javascript-original.svg" />
  <img height="30" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/html5/html5-original.svg" />
  <img height="30" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/css3/css3-original.svg" />
</p>

### Backend / Platform
<p>
  <img height="30" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/cloudflare/cloudflare-original.svg" />
  <img height="30" src="https://img.icons8.com/ios-filled/50/000000/server.png" />
</p>

### Data & Storage
📦 Cloudflare D1 (SQLite)  
📦 Cloudflare R2 Object Storage  

---

## Features

- ⚡ **Astro + Cloudflare Pages** static-first architecture
- 🔐 Secure admin authentication via Workers
- 🗓️ Event management (draft / publish, TBD dates, posters)
- 🎟️ Monthly raffle system with winners and live stream integration
- 💝 Donor management with public donor listings
- 📸 Community photo uploads with admin approval workflow
- 🧭 Public photo gallery with categories
- 🌎 Global CDN delivery with zero-downtime deployments
- ♿ Accessibility-first UI patterns and keyboard navigation

---

## Architecture

<details>
<summary><strong>Click to expand architecture details</strong></summary>

### Frontend (Astro)

- Hybrid static + dynamic rendering  
- Responsive layouts optimized for mobile and desktop  
- Public pages:
  - Home
  - Events
  - Raffle
  - Donors
  - Photos
  - Contact

- Admin pages:
  - Dashboard
  - Events CRUD
  - Raffle configuration and winners
  - Donor management
  - Photo approval and moderation

### Backend (Cloudflare Workers)

Workers handle all server-side functionality:

- Admin authentication and session handling
- D1 database queries (events, donors, raffle winners, photos)
- R2 object storage for images and posters
- Secure API routes under `/api/*`

### Database (Cloudflare D1)

- `events`
- `donors`
- `raffle_winners`
- `photos`

All timestamps are normalized and displayed in **America/Chicago** time.

### Storage (R2)

- Event poster images
- Community photo submissions
- Public gallery assets

### Security

- Cookie-based admin authentication
- Short-lived sessions
- No secrets committed to the repository
- All sensitive configuration stored in Cloudflare environment variables

</details>

---

## Screenshots 📸

<table>
  <tr>
    <td align="center">
      <strong>Homepage</strong><br/>
      <img src="docs/screenshots/homepage.jpg" width="380" alt="Friends of Lake Henry homepage" />
    </td>
    <td align="center">
      <strong>Events Page</strong><br/>
      <img src="docs/screenshots/events-public.jpg" width="380" alt="Friends of Lake Henry event page" />
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Raffle Page</strong><br/>
      <img src="docs/screenshots/raffle-public.jpg" width="380" alt="Friends of Lake Henry raffle page" />
    </td>
    <td align="center">
      <strong>Admin Dashboard</strong><br/>
      <img src="docs/screenshots/admin-dashboard.png" width="380" alt="Friends of Lake Henry admin dashboard" />
    </td>
  </tr>
    <tr>
    <td align="center">
      <strong>Admin Events</strong><br/>
      <img src="docs/screenshots/admin-events.png" width="380" alt="Friends of Lake Henry admin event page" />
    </td>
    <td align="center">
      <strong>Admin Approve Photos</strong><br/>
      <img src="docs/screenshots/admin-approved-photos.png" width="380" alt="Friends of Lake Henry approved photos page" />
    </td>
  </tr>
</table>

---

## Development Setup

### Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI (for local Workers / D1 development)

### Install & Run

```bash
npm install
npm run dev
```

---

## Status

This project is actively developed and deployed for the Friends of Lake Henry nonprofit.

The platform is production-backed, maintained, and evolving based on stakeholder,
community, and fundraising needs.

---

## License

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

The source code in this repository is open-source and licensed under the **MIT License**.

All site content, branding, and images are © Friends of Lake Henry and may not be reused without prior permission.
