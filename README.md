# Seva Circle

A mobile-first web app for the **Kishori Karyakar Team** and **Balika Karyakar Team**
— one shared link, each team behind its own passcode, covering calendar, roster,
seva tracking, swap requests, and an idea board.

## Features

**Access & teams**
- Two teams, each with its own passcode (changeable anytime by that team's Main/Co)
- A brand-new team can't be used until it has both a Main and a Co — no team is
  ever left without leadership
- Main and Co can never be self-selected when someone joins — the only way
  anyone becomes Main or Co is an existing Main/Co promoting them from
  Manage Members
- Main/Co can add new teams, add custom positions per team, edit their team's
  name/description/motto, and reassign anyone's role

**Calendar**
- My Team, Agenda, and Combined (both teams at once) views
- Multiple events per day, each addable/removable individually
- Today is always visibly marked
- Ekadashi marking — with the actual name of the Ekadashi, not just a flag
- "Add to phone calendar" — exports any event as a real `.ics` file for
  Google/Apple Calendar
- Attendance marked Present/Absent per person per day, including past dates
- Smart Outing Finder — days where 80%+ of a team is free get highlighted
- Monthly Recap (in Combined view) — most-present member, top idea
  contributor, longest attendance streak per team, and the best joint outing
  day that month

**Roster**
- Seva field per person, searchable/filterable roster once a team grows
- Attendance streaks (flame badge) for consecutive weeks present
- Private notes — Main/Co can send a note to one specific person, visible only
  to them, never shown to the rest of the team

**Seva & tasks**
- Shared leadership task list, tied to specific calendar dates, reschedulable,
  visible to Main/Co only
- Swap requests — post what you need covered and why; the whole team and
  Main/Co are notified; anyone free can accept it, or you can cancel your own

**Ideas**
- Two boards: "Progress" (what's gone well) and "Improve" (what could be
  better, plus your own suggestion)
- Anonymous posting option
- Upvoting
- "Executing" — anyone can volunteer to help bring an idea to life; a
  dedicated view shows everything currently being worked on

**Everywhere**
- Delete + undo (a "deleted — undo" toast, like Gmail) on events, ideas, swap
  requests, tasks, and notes
- Dark mode
- Optional email notifications for new events, swap requests, and idea posts
  (see `api/notify.js` + `DEPLOY.md`)

## Security notes — read before rolling this out widely

- **There's no individual login.** Access is controlled entirely by each
  team's shared passcode, the same way a private group chat link works.
  Anyone with the passcode can act as any role they're given during
  onboarding.
- **Private notes are private through the app's interface, not through a
  locked-down backend** — there's currently no database enforcing who can see
  what; everything lives in each person's own browser. Practically, this
  means notes aren't exposed to other users of the app, but this isn't the
  same guarantee a real per-person login system would give.
- **Passcodes are stored as plain text**, not hashed. That's a reasonable
  tradeoff for a shared team passcode (same as any GC invite link), but don't
  reuse a personal password as a team passcode.
- **The `RESEND_API_KEY`** (used for optional email notifications) lives only
  as a Vercel environment variable and is never sent to the browser — it's
  safe from the client side.
- **No sensitive personal data should go in this app** beyond what's already
  designed for it (name, position, optional email) — there's no encryption
  layer beyond what Vercel/GitHub provide by default.
- **Data doesn't sync between devices yet** — see the note below. Until that
  changes, there's technically nothing to "leak" from a shared server, since
  nothing is shared yet.

## Known limitation

There's no shared database yet — each person's data lives only in their own
browser, so it won't sync between devices. That's the natural next step once
this is deployed and tested.

## Local setup

```
npm install
npm run dev
```

## Deploying

See `DEPLOY.md` for the full walkthrough.

## Passcodes

- Kishori Karyakar Team: `KKT1234`
- Balika Karyakar Team: `BKT1234`
