import { sql, requireDb } from "./_db.js";

async function logActivity(teamId, actor, action) {
  if (!teamId) return;
  const id = "a" + Date.now() + Math.random().toString(36).slice(2, 8);
  await sql`insert into activity_log (id, team_id, actor, action) values (${id}, ${teamId}, ${actor}, ${action})`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });
  if (!requireDb(res)) return;

  const { type, payload } = req.body || {};

  try {
    switch (type) {
      case "insertMember": {
        const m = payload;
        await sql`insert into members (id, team_id, name, role, color, seva, email)
                   values (${m.id}, ${m.team}, ${m.name}, ${m.role}, ${m.color}, ${m.seva || ""}, ${m.email || ""})`;
        await logActivity(m.team, m.name, "joined the team");
        break;
      }
      case "updateMember": {
        const m = payload;
        await sql`update members set name=${m.name}, role=${m.role}, color=${m.color}, seva=${m.seva || ""}, email=${m.email || ""} where id=${m.id}`;
        break;
      }
      case "upsertTeam": {
        const t = payload;
        await sql`update teams set name=${t.name}, description=${t.description || ""}, motto=${t.motto || ""} where id=${t.id}`;
        break;
      }
      case "insertTeamFull": {
        const { team, passcode, roles, mainMember, coMember } = payload;
        await sql`insert into teams (id, name, color, passcode, roles) values (${team.id}, ${team.name}, ${team.color}, ${passcode}, ${roles})`;
        await sql`insert into members (id, team_id, name, role, color, seva) values (${mainMember.id}, ${team.id}, ${mainMember.name}, 'Main', ${mainMember.color}, '')`;
        await sql`insert into members (id, team_id, name, role, color, seva) values (${coMember.id}, ${team.id}, ${coMember.name}, 'Co', ${coMember.color}, '')`;
        await logActivity(team.id, mainMember.name, "created this team");
        break;
      }
      case "setPasscode": {
        const { teamId, passcode } = payload;
        await sql`update teams set passcode=${passcode} where id=${teamId}`;
        break;
      }
      case "setRoles": {
        const { teamId, roles } = payload;
        await sql`update teams set roles=${roles} where id=${teamId}`;
        break;
      }
      case "insertEvent": {
        const { teamId, date, event, actor } = payload;
        await sql`insert into events (id, team_id, date, title) values (${event.id}, ${teamId}, ${date}, ${event.title})`;
        await logActivity(teamId, actor, `added an event: ${event.title}`);
        break;
      }
      case "deleteEvent": {
        await sql`delete from events where id=${payload.eventId}`;
        break;
      }
      case "setAttendance": {
        const { teamId, date, memberId, status } = payload;
        await sql`insert into attendance (team_id, date, member_id, status) values (${teamId}, ${date}, ${memberId}, ${status})
                   on conflict (team_id, date, member_id) do update set status=${status}`;
        break;
      }
      case "setEkadashi": {
        const { date, name } = payload;
        await sql`insert into ekadashi (date, name) values (${date}, ${name}) on conflict (date) do update set name=${name}`;
        break;
      }
      case "deleteEkadashi": {
        await sql`delete from ekadashi where date=${payload.date}`;
        break;
      }
      case "insertSwap": {
        const s = payload;
        await sql`insert into swaps (id, team_id, member_id, member, seva, date, reason, status)
                   values (${s.id}, ${s.team}, ${s.memberId}, ${s.member}, ${s.seva || ""}, ${s.date}, ${s.reason || ""}, ${s.status})`;
        await logActivity(s.team, s.member, `requested a swap for ${s.date}`);
        break;
      }
      case "updateSwap": {
        const { id, status, coveredBy, actor } = payload;
        await sql`update swaps set status=${status}, covered_by=${coveredBy || null} where id=${id}`;
        if (actor) {
          const row = await sql`select team_id from swaps where id=${id}`;
          if (row[0]) await logActivity(row[0].team_id, actor, "covered a swap");
        }
        break;
      }
      case "deleteSwap": {
        await sql`delete from swaps where id=${payload.id}`;
        break;
      }
      case "insertIdea": {
        const i = payload;
        await sql`insert into ideas (id, team_id, category, text, anonymous, author, date, votes, executing, executors)
                   values (${i.id}, ${i.team}, ${i.category}, ${i.text}, ${i.anonymous}, ${i.author}, ${i.date}, ${i.votes}, ${i.executing}, ${i.executors})`;
        await logActivity(i.team, i.anonymous ? "Someone" : i.author, `posted an idea under "${i.category === "progress" ? "Progress" : "Improve"}"`);
        break;
      }
      case "updateIdea": {
        const { id, patch } = payload;
        if (patch.votes !== undefined) await sql`update ideas set votes=${patch.votes} where id=${id}`;
        if (patch.executing !== undefined || patch.executors !== undefined) {
          await sql`update ideas set executing=${patch.executing}, executors=${patch.executors} where id=${id}`;
        }
        break;
      }
      case "deleteIdea": {
        await sql`delete from ideas where id=${payload.id}`;
        break;
      }
      case "insertNote": {
        const n = payload;
        await sql`insert into feedback_notes (id, member_id, team_id, text, date, read) values (${n.id}, ${n.memberId}, ${n.team}, ${n.text}, ${n.date}, ${n.read})`;
        break;
      }
      case "markNotesRead": {
        await sql`update feedback_notes set read=true where member_id=${payload.memberId}`;
        break;
      }
      case "deleteNote": {
        await sql`delete from feedback_notes where id=${payload.id}`;
        break;
      }
      case "insertTask": {
        const t = payload;
        await sql`insert into leader_tasks (id, team_id, text, date, done) values (${t.id}, ${t.team}, ${t.text}, ${t.date}, ${t.done})`;
        break;
      }
      case "updateTask": {
        const { id, patch } = payload;
        if (patch.done !== undefined) await sql`update leader_tasks set done=${patch.done} where id=${id}`;
        if (patch.date !== undefined) await sql`update leader_tasks set date=${patch.date} where id=${id}`;
        break;
      }
      case "deleteTask": {
        await sql`delete from leader_tasks where id=${payload.id}`;
        break;
      }
      default:
        return res.status(400).json({ ok: false, error: "Unknown mutation type: " + type });
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
