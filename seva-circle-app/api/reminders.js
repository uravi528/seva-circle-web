import { sql, requireDb } from "./_db.js";

function pad2(n) { return String(n).padStart(2, "0"); }
function dateKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

async function sendEmail(emails, subject, message) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !emails || emails.length === 0) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Seva Circle <onboarding@resend.dev>", to: emails, subject, text: message }),
  });
}

// Vercel Cron calls this automatically on the schedule set in vercel.json.
// Visiting the URL manually also works, for testing.
export default async function handler(req, res) {
  if (!requireDb(res)) return;
  try {
    const today = new Date();
    const todayKey = dateKey(today);
    const weekOut = new Date(today);
    weekOut.setDate(weekOut.getDate() + 7);
    const weekKey = dateKey(weekOut);

    const events = await sql`select * from events where date = ${todayKey} or date = ${weekKey}`;
    const members = await sql`select * from members`;
    let sent = 0;

    for (const ev of events) {
      const kind = ev.date === todayKey ? "today" : "week";
      const already = await sql`select 1 from reminders_sent where event_id=${ev.id} and kind=${kind}`;
      if (already.length > 0) continue;

      const emails = members.filter((m) => m.team_id === ev.team_id && m.email).map((m) => m.email);
      const when = kind === "today" ? "today" : "in one week";
      await sendEmail(emails, `Reminder: ${ev.title}`, `${ev.title} is ${when} (${ev.date}).`);
      await sql`insert into reminders_sent (event_id, kind) values (${ev.id}, ${kind}) on conflict do nothing`;
      sent++;
    }

    res.status(200).json({ ok: true, checked: events.length, sent });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
