# Seva Circle — deploy guide

Everything lives in one place: your GitHub repo, deployed on Vercel, with a
database and scheduled reminders that are also just part of the same Vercel
project. No Supabase, no separate services beyond one free email API.

## 1. Push to GitHub / deploy on Vercel
Same as before — push this folder to GitHub, import it on Vercel, deploy.
(If you've already done this once, just push these new changes and Vercel
will redeploy automatically.)

## 2. Add a database (this is the big new step)
1. In Vercel, open your project → **Storage** tab
2. **Create Database** → choose **Postgres** (powered by Neon — this is
   Vercel's own native integration, no separate account needed)
3. Once it's created, Vercel automatically adds the right environment
   variables to your project (`DATABASE_URL` or similar) — you don't need to
   copy/paste anything yourself
4. Open the database's **Query** tab (or "SQL Editor," wording varies)
5. Paste in everything from `schema.sql` (in this folder) → Run
   — this creates all the tables and seeds Kishori + Balika as starting teams
6. Go to **Deployments** → redeploy the latest one, so the app picks up the
   new database connection

That's it — from here on, the app reads and writes real shared data. Two
different phones will now see each other's changes (checked every ~15
seconds, or instantly on refresh).

## 3. Turn on notifications + reminders (optional)
1. Go to resend.com → sign up (free: 100 emails/day)
2. Create an API key → copy it
3. Vercel → your project → **Settings → Environment Variables** → add:
   `RESEND_API_KEY` = the key you copied
4. Redeploy

Once that's live:
- New events, swap requests, and idea posts email the relevant people
  automatically (already wired up)
- A daily check (`api/reminders.js`, scheduled via `vercel.json`) emails
  "this is today" and "this is in a week" reminders for upcoming events —
  runs once a day at 13:00 UTC (roughly 8–9am Eastern, depending on daylight
  saving). To change the time, edit the `schedule` value in `vercel.json`
  (it uses standard cron syntax) and redeploy.

## How the Recent Activity feed works
Notable actions — someone joining, an event being added, a swap requested,
an idea posted — get logged automatically and show up on the Roster tab
under "Recent activity," visible to everyone on that team. Routine stuff
(marking Present/Absent, upvoting) isn't logged, to keep the feed meaningful
rather than noisy.

## Known limitation, worth remembering
There's still no individual login — access is controlled by each team's
shared passcode, same as before. That means the database uses open read/write
rules rather than per-person permissions, enforced through the API routes
rather than directly from the browser (a real improvement over exposing
database credentials to the client — nothing sensitive is ever sent to
anyone's device). Private notes are private through the app's interface and
its API, not through a locked-per-person database. True individual accounts
would close that last gap, but that's a separate, bigger project.
