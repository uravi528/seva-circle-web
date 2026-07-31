// Vercel serverless function — deploys automatically as part of this same project,
// reachable at /api/notify once live. No separate account or URL to manage beyond
// the one Resend API key.
//
// Setup (once):
// 1. Go to resend.com -> sign up (free tier: 100 emails/day, 3,000/month)
// 2. Verify a sending domain OR just use their default onboarding@resend.dev
//    sender for testing (real domain is better long-term, but not required to start)
// 3. Create an API key -> copy it
// 4. In Vercel: your project -> Settings -> Environment Variables -> add
//      RESEND_API_KEY = the key you copied
// 5. Redeploy (Vercel picks up new env vars on the next deploy)
//
// That's it — the app already calls this endpoint automatically (see
// NOTIFY_WEBHOOK_URL in src/App.jsx, which should be set to "/api/notify").

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ ok: false, error: "RESEND_API_KEY not set yet — notifications are off for now" });
  }

  try {
    const { emails, message, subject } = req.body || {};
    if (!Array.isArray(emails) || emails.length === 0 || !message) {
      return res.status(400).json({ ok: false, error: "Missing emails or message" });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Seva Circle <onboarding@resend.dev>", // swap for your own verified domain later
        to: emails,
        subject: subject || "Seva Circle update",
        text: message,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(200).json({ ok: false, error: errText });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(200).json({ ok: false, error: String(err) });
  }
}
