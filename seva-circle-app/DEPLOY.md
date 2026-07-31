# Seva Circle — deploy guide

Everything here lives in one place: your GitHub repo, deployed on Vercel.
No Supabase, no separate database service, no Google Apps Script.

## 1. Push to GitHub
```
cd seva-circle-app
git init
git add .
git commit -m "Seva Circle"
gh repo create seva-circle-app --public --source=. --push
```
(No GitHub CLI? Create an empty repo on github.com, then `git remote add origin <url>` and `git push -u origin main`.)

## 2. Deploy on Vercel
- vercel.com → New Project → import the repo
- Vercel auto-detects Vite — leave the defaults
- Deploy

You'll get a `something.vercel.app` link — that's the one link for both group chats.
Share it along with each team's passcode (KKT1234 / BKT1234, unless changed).

## 3. Turn on notifications (optional, do whenever)
Notifications go through a small serverless function that's already part of this
project (`api/notify.js`) — it deploys automatically with the rest of the app on
Vercel, so there's no separate service to stand up.

1. Go to resend.com → sign up (free: 100 emails/day)
2. Create an API key → copy it
3. Vercel → your project → Settings → Environment Variables → add:
   `RESEND_API_KEY` = the key you copied
4. Redeploy (Vercel picks up new env vars on the next deploy — push anything,
   or use "Redeploy" in the Vercel dashboard)

That's the whole setup. Once it's live, the app automatically emails people
when there's a new event, swap request, idea, or private note — no extra
step, no URL to paste anywhere.

## Known limitation, worth remembering
Right now, all the app's data (roster, calendar, swaps, ideas, tasks) still
lives only in each person's own browser — there's no shared database yet, so
two people on two phones won't see each other's changes. Notifications will
work regardless (since those go through the serverless function), but the
data itself isn't synced between devices. That's a separate, bigger piece of
work — happy to revisit it whenever you're ready, using whatever approach
you're comfortable with.
