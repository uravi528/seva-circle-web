import { sql, requireDb } from "./_db.js";

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  try {
    const [teams, members, events, attendance, ekadashi, swaps, ideas, notes, tasks, activity] = await Promise.all([
      sql`select * from teams`,
      sql`select * from members`,
      sql`select * from events`,
      sql`select * from attendance`,
      sql`select * from ekadashi`,
      sql`select * from swaps`,
      sql`select * from ideas`,
      sql`select * from feedback_notes`,
      sql`select * from leader_tasks`,
      sql`select * from activity_log order by created_at desc limit 50`,
    ]);
    res.status(200).json({ ok: true, teams, members, events, attendance, ekadashi, swaps, ideas, notes, tasks, activity });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
