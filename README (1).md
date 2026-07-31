# Seva Circle

A mobile-first web app for the Kishori Karyakar Team and Balika Karyakar Team —
shared calendar, roster, seva tracking, swap requests, and an idea board, all
behind each team's own passcode.

## What's in here

- `src/App.jsx` — the whole app
- `api/notify.js` — a Vercel serverless function that sends notification emails (optional)
- `DEPLOY.md` — step-by-step deploy instructions

## Local setup

```
npm install
npm run dev
```

Opens at `localhost:5173`.

## Deploying

See `DEPLOY.md` for the full walkthrough — push to GitHub, import on Vercel,
done. Notifications (optional) need one free Resend API key, also covered
there.

## Passcodes

- Kishori Karyakar Team: `KKT1234`
- Balika Karyakar Team: `BKT1234`

(Changeable anytime from inside the app by that team's Main or Co, under
Profile & Settings.)

## Known limitation

There's no shared database yet — each person's data lives in their own
browser only, so it won't sync between devices. That's the next real piece
of work once this is deployed and tested.
