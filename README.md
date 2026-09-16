# ⚽ Footy Hub

**Find and join football games near you.**

Footy Hub is a football matchmaking platform built for the Malaysian futsal/football scene. Right now, organizers manage sign-ups manually through Instagram comments, WhatsApp groups, and DMs — which is messy, hard to track, and makes no-shows a constant headache. Footy Hub gives organizers a single place to post games, manage spots and payments, and build a track record — while giving players an easy way to discover and join games near them.

🔗 **Live demo:** [footy-hub-cyan.vercel.app](https://footy-hub-cyan.vercel.app/)

---

## The Problem

Local organizers already have an audience (usually on Instagram) but no real infrastructure:
- Sign-ups happen in comments or DMs, with no reliable way to track who's actually confirmed
- No-shows aren't accounted for, so organizers lose money on empty spots
- Players have to follow dozens of individual accounts to find games near them

Footy Hub solves this by giving organizers a lightweight system to post games, track spots filled, and manage the community around each match — without needing to rebuild what already works (players can still coordinate in the app's chat, no forced migration off what they already use).

## Features

- 🏠 **Home feed** — browse open games happening near you
- 📅 **Calendar view** — see games by day, filter by format (5s/7s/11s) or price
- 🗺️ **Map view** — find games by location and distance
- 💬 **Chat** — per-game group chat plus direct messages between players
- 👤 **Profiles** — player stats, turn-up rate, and game history
- 🏟️ **Organisations** — organizers can create a page for their recurring games/venues
- 💳 **Wallet** — track payments and fees per game
- 🔐 **Auth** — secure login and session handling

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Backend / DB:** [Supabase](https://supabase.com/) (Postgres, Auth, Row-Level Security)
- **Hosting:** [Vercel](https://vercel.com/)
- **Styling:** CSS Modules / global styles

## Getting Started

```bash
# Clone the repo
git clone https://github.com/aidilsss-coding/FootyHub.git
cd FootyHub

# Install dependencies
npm install

# Set up environment variables
# Create a .env.local file with your Supabase project keys:
# NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view it locally.

Database migrations live in `supabase/migrations/` — run them against your own Supabase project to set up the schema.

## Roadmap

- [ ] Payment integration for game fees
- [ ] Organizer ratings and reviews
- [ ] Push notifications for game updates
- [ ] Waitlist auto-promotion when a spot opens up

## About

Built as a way to learn full-stack web development by solving a real problem in the local football community, and to have a working demo to pitch to organizers directly.

---

Made by [aidilsss-coding](https://github.com/aidilsss-coding)
