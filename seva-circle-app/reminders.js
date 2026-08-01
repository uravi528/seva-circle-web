export async function fetchState() {
  const res = await fetch("/api/state");
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Couldn't reach the database");
  return transform(data);
}

function transform(data) {
  const teams = data.teams.map((r) => ({ id: r.id, name: r.name, color: r.color, description: r.description || "", motto: r.motto || "" }));

  const rolesByTeam = {};
  data.teams.forEach((r) => { rolesByTeam[r.id] = r.roles || []; });

  const teamPasscodes = {};
  data.teams.forEach((r) => { teamPasscodes[r.id] = r.passcode; });

  const members = data.members.map((r) => ({ id: r.id, team: r.team_id, name: r.name, role: r.role, color: r.color, seva: r.seva || "", email: r.email || "" }));

  const eventsByTeam = {};
  data.events.forEach((r) => {
    eventsByTeam[r.team_id] = eventsByTeam[r.team_id] || {};
    eventsByTeam[r.team_id][r.date] = eventsByTeam[r.team_id][r.date] || [];
    eventsByTeam[r.team_id][r.date].push({ id: r.id, title: r.title });
  });

  const attendance = {};
  data.attendance.forEach((r) => {
    attendance[r.team_id] = attendance[r.team_id] || {};
    attendance[r.team_id][r.date] = attendance[r.team_id][r.date] || {};
    attendance[r.team_id][r.date][r.member_id] = r.status;
  });

  const ekadashiDates = {};
  data.ekadashi.forEach((r) => { ekadashiDates[r.date] = r.name; });

  const swaps = data.swaps.map((r) => ({ id: r.id, team: r.team_id, memberId: r.member_id, member: r.member, seva: r.seva || "", date: r.date, reason: r.reason || "", status: r.status, coveredBy: r.covered_by || undefined }));

  const ideas = data.ideas.map((r) => ({ id: r.id, team: r.team_id, category: r.category, text: r.text, anonymous: r.anonymous, author: r.author, date: r.date, votes: r.votes, executing: r.executing, executors: r.executors || [] }));

  const feedbackNotes = data.notes.map((r) => ({ id: r.id, memberId: r.member_id, team: r.team_id, text: r.text, date: r.date, read: r.read }));

  const leaderTasks = data.tasks.map((r) => ({ id: r.id, team: r.team_id, text: r.text, date: r.date, done: r.done }));

  const activity = data.activity.map((r) => ({ id: r.id, team: r.team_id, actor: r.actor, action: r.action, createdAt: r.created_at }));

  return { teams, rolesByTeam, teamPasscodes, members, eventsByTeam, attendance, ekadashiDates, swaps, ideas, feedbackNotes, leaderTasks, activity };
}

// Fire-and-forget write — the UI already updated optimistically, this just
// persists it. The next periodic sync (or another device's sync) reconciles.
export function mutate(type, payload) {
  fetch("/api/mutate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload }),
  }).catch((err) => console.error("Seva Circle sync error:", err));
}
