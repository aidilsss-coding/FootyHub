# ⚽ Footy Hub

**Find and join football games near you.**

Footy Hub is a football matchmaking web app built for casual players in Malaysia. Right now, most pickup/futsal games are organized manually through Instagram DMs, WhatsApp groups, and story polls, messy, hard to discover, and easy to lose track of. Footy Hub gives organizers a dedicated place to post games and players a simple way to find and join them.

🔗 **Live demo:** [footy-hub-cyan.vercel.app](https://footy-hub-cyan.vercel.app)

> ⚠️ **Status: work in progress.** Footy Hub is an ongoing personal project, actively being built and refined. Features may be incomplete, change without notice, or contain bugs.

<!-- Add a screenshot or GIF here, e.g.: -->
<!-- ![Footy Hub screenshot](./design/screenshot.png) -->

---

## The problem

Organizers currently manage sign-ups through comments, DMs, and story polls, there's no reliable way to track who's actually coming, collect payment, or fill last-minute spots. Players have to follow multiple accounts and dig through stories just to find a game near them.

Footy Hub solves this with a shared hub: organizers post once, players discover games by day, location, or format, and both sides can track attendance and payment in one place.

## Features

- 📅 **Calendar view:** browse upcoming games by day, filtered by format (5s/7s/11s) or price
- 🗺️ **Map view:** find games near you
- 💬 **Chat:** group chat per game, plus direct messages between players
- 👤 **Profiles:** player stats, turn-up rate, and game history
- 🏟️ **Organizations & venues:** dedicated pages for recurring organizers and venues
- 🎟️ **Game creation & editing:** organizers can post, edit, and manage their own games
- ⏳ **Waitlists & turn-up tracking:** automatically manage full games and no-shows
- 💳 **Wallet:** track payments for games
- 🖼️ **Avatar uploads:** custom profile pictures
- 🔐 **Authentication:** secure login for players and organizers

## Tech stack

- **Frontend:** Next.js (App Router), React
- **Backend / DB:** Supabase (Postgres, Auth, Storage)
- **Deployment:** Vercel (auto-deploys from GitHub on every push)
- **Styling:** Custom CSS

## Getting started locally

```bash
git clone https://github.com/aidilsss-coding/FootyHub.git
cd FootyHub
npm install
```

Create a `.env.local` file with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Then run the dev server:

```bash
npm run dev
```

Visit `http://localhost:3000`.

## Database

Database schema and migrations live in [`/supabase/migrations`](./supabase/migrations), covering games, waitlists, organizations, direct messages, cancellation policies, and more.

## Roadmap

- Payment integration for game fees
- Player ratings and reviews after games
- Push notifications for game reminders and waitlist promotions
- Organizer verification badges

## About this project

Built as a way to learn full-stack web development by building something I actually wanted to use, a hub for finding pickup football games in Malaysia, instead of relying on Instagram and WhatsApp.

---

*Built by [Aidil](https://github.com/aidilsss-coding)*
