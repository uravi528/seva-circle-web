import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchState, mutate } from "./lib/api";
import {
  Calendar as CalendarIcon,
  Users,
  RefreshCw,
  Lightbulb,
  LogOut,
  Plus,
  ArrowUp,
  Check,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Layers,
  Star,
  Settings,
  Moon,
  Sun,
  Trophy,
  Rocket,
  Activity,
  Download,
  List,
  ListTodo,
  Flame,
  Search,
} from "lucide-react";

/* ---------------------------------------------------------------
   HELPERS
--------------------------------------------------------------- */
function pad2(n) { return String(n).padStart(2, "0"); }
function dateKey(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }
function monthPrefix(y, m) { return `${y}-${pad2(m + 1)}`; }
function computeStreak(teamId, memberId, attendance) {
  const rec = attendance[teamId] || {};
  const today = new Date();
  let streak = 0;
  for (let w = 0; w < 52; w++) {
    let hasPresent = false;
    for (let d = 0; d < 7; d++) {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - (w * 7 + d));
      const key = dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
      if (rec[key]?.[memberId] === "Present") { hasPresent = true; break; }
    }
    if (hasPresent) streak++;
    else break;
  }
  return streak;
}
function downloadICS(title, key) {
  const [y, m, d] = key.split("-").map(Number);
  const startStr = `${y}${pad2(m)}${pad2(d)}`;
  const endDateObj = new Date(y, m - 1, d + 1);
  const endStr = `${endDateObj.getFullYear()}${pad2(endDateObj.getMonth() + 1)}${pad2(endDateObj.getDate())}`;
  const safeTitle = title.replace(/[\r\n]+/g, " ");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Seva Circle//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@sevacircle`,
    `DTSTART;VALUE=DATE:${startStr}`,
    `DTEND;VALUE=DATE:${endStr}`,
    `SUMMARY:${safeTitle}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "event"}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function formatKeyLong(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function formatKeyShort(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
function slugify(s) {
  const base = s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return base || "team";
}
function isColorTaken(color, members, excludeId) {
  return members.some((m) => m.id !== excludeId && m.color.toLowerCase() === color.toLowerCase());
}
function isTeamColorTaken(color, teams, excludeId) {
  return teams.some((t) => t.id !== excludeId && t.color.toLowerCase() === color.toLowerCase());
}
function autoColor(members) {
  return SWATCHES.find((c) => !isColorTaken(c, members)) || SWATCHES[Math.floor(Math.random() * SWATCHES.length)];
}
function missingLeaderRoles(teamId, members) {
  const tm = members.filter((m) => m.team === teamId);
  const missing = [];
  if (!tm.some((m) => m.role === "Main")) missing.push("Main");
  if (!tm.some((m) => m.role === "Co")) missing.push("Co");
  return missing;
}

/* ---------------------------------------------------------------
   TOKENS
--------------------------------------------------------------- */
const SWATCHES = [
  "#E8A33D", "#2F8F87", "#C9679B", "#7C6FB0", "#3E6D9C", "#4C8577",
  "#D9834F", "#6E8B3D", "#B0555A", "#5B7FBF", "#A87CC7", "#4F9D6E",
  "#C99A3E", "#527A9C", "#9C5B8C", "#6FA8A0",
];
const TEAM_SWATCHES = [
  "#8B1E3F", "#E85D9E", "#3E6D9C", "#4C8577", "#7C6FB0", "#D9834F", "#2F8F87", "#6E8B3D",
];
const STATUS_COLORS = { Present: "#4F9D6E", Absent: "#C97575" };
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Notifications go through /api/notify — a Vercel serverless function that lives
// in this same project (see api/notify.js). Nothing to paste here; once RESEND_API_KEY
// is set in Vercel and deployed, this just works.
const NOTIFY_WEBHOOK_URL = "/api/notify";
function notifyTeam(team, message, members, subject) {
  if (!NOTIFY_WEBHOOK_URL) return; // not deployed yet — silently does nothing
  const emails = (members || []).filter((m) => m.team === team && m.email).map((m) => m.email);
  if (emails.length === 0) return; // nobody on this team has added an email yet
  fetch(NOTIFY_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emails, message, subject: subject || "Seva Circle update" }),
  }).catch(() => {}); // never let a failed notification break the app
}
function notifyMember(email, message, subject) {
  if (!NOTIFY_WEBHOOK_URL || !email) return;
  fetch(NOTIFY_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emails: [email], message, subject: subject || "Seva Circle" }),
  }).catch(() => {});
}
function notifyLeaders(team, message, members, subject) {
  if (!NOTIFY_WEBHOOK_URL) return;
  const emails = (members || []).filter((m) => m.team === team && (m.role === "Main" || m.role === "Co") && m.email).map((m) => m.email);
  if (emails.length === 0) return;
  fetch(NOTIFY_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emails, message, subject: subject || "Seva Circle" }),
  }).catch(() => {});
}

const DEFAULT_TEAMS = [
  { id: "kishori", name: "Kishori Karyakar Team", color: "#8B1E3F", description: "", motto: "" },
  { id: "balika", name: "Balika Karyakar Team", color: "#E85D9E", description: "", motto: "" },
];
const DEFAULT_ROLES = {
  kishori: ["Main", "Co", "Admin", "PC"],
  balika: ["Main", "Co", "Group 0 Karyakar", "Group 1 Karyakar", "Group 2 Karyakar", "Group 3 Karyakar", "Admin", "PC"],
};

/* ---------------------------------------------------------------
   LOCAL PERSISTENCE (per-device — see README for the multi-device limitation)
--------------------------------------------------------------- */
const LS_KEY = "sevaCircleState_v1";
function loadPersisted() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function savePersisted(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — fail silently, app still works this session
  }
}

/* ---------------------------------------------------------------
   ROOT
--------------------------------------------------------------- */
export default function KaryakarHub() {
  const saved = useState(() => loadPersisted())[0];
  const [stage, setStage] = useState(saved?.currentUser ? "dashboard" : "login"); // login | team-setup | onboarding | dashboard
  const [passcode, setPasscode] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [teamPasscodes, setTeamPasscodes] = useState(saved?.teamPasscodes || { kishori: "KKT1234", balika: "BKT1234" });
  const [pendingTeam, setPendingTeam] = useState(saved?.currentUser?.team || null);
  const [pendingMissingRoles, setPendingMissingRoles] = useState([]);

  const [teams, setTeams] = useState(saved?.teams || DEFAULT_TEAMS);
  const [rolesByTeam, setRolesByTeam] = useState(saved?.rolesByTeam || DEFAULT_ROLES);
  const [members, setMembers] = useState(saved?.members || []);
  const [currentUser, setCurrentUser] = useState(saved?.currentUser || null);
  const [theme, setTheme] = useState(saved?.theme || "light");

  const [tab, setTab] = useState("calendar");
  const [profileOpen, setProfileOpen] = useState(false);

  const [today] = useState(() => new Date());
  const [eventsByTeam, setEventsByTeam] = useState(saved?.eventsByTeam || {});
  const [attendance, setAttendance] = useState(saved?.attendance || {});
  const [ekadashiDates, setEkadashiDates] = useState(saved?.ekadashiDates || {});
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const [swaps, setSwaps] = useState(saved?.swaps || []);
  const [ideas, setIdeas] = useState(saved?.ideas || []);
  const [ideaDraft, setIdeaDraft] = useState("");
  const [feedbackNotes, setFeedbackNotes] = useState(saved?.feedbackNotes || []);
  const [leaderTasks, setLeaderTasks] = useState(saved?.leaderTasks || []);
  const [activity, setActivity] = useState(saved?.activity || []);
  const [syncError, setSyncError] = useState(null);
  const [toast, setToast] = useState(null); // { message, undo? }
  const [welcomeName, setWelcomeName] = useState("");

  useEffect(() => {
    savePersisted({ teams, rolesByTeam, teamPasscodes, members, currentUser, eventsByTeam, attendance, ekadashiDates, swaps, ideas, feedbackNotes, leaderTasks, activity, theme });
  }, [teams, rolesByTeam, teamPasscodes, members, currentUser, eventsByTeam, attendance, ekadashiDates, swaps, ideas, feedbackNotes, leaderTasks, activity, theme]);

  // Pulls the shared, real state from the database — this is what makes
  // different people's devices see each other's changes. Local storage above
  // just gives an instant paint on load; this reconciles with the source of truth.
  async function syncFromServer() {
    try {
      const data = await fetchState();
      setTeams(data.teams.length ? data.teams : DEFAULT_TEAMS);
      setRolesByTeam(Object.keys(data.rolesByTeam).length ? data.rolesByTeam : DEFAULT_ROLES);
      setTeamPasscodes(Object.keys(data.teamPasscodes).length ? data.teamPasscodes : { kishori: "KKT1234", balika: "BKT1234" });
      setMembers(data.members);
      setEventsByTeam(data.eventsByTeam);
      setAttendance(data.attendance);
      setEkadashiDates(data.ekadashiDates);
      setSwaps(data.swaps);
      setIdeas(data.ideas);
      setFeedbackNotes(data.feedbackNotes);
      setLeaderTasks(data.leaderTasks);
      setActivity(data.activity);
      setCurrentUser((prev) => (prev ? data.members.find((m) => m.id === prev.id) || prev : prev));
      setSyncError(null);
    } catch (err) {
      setSyncError(err.message || "Couldn't reach the database yet");
    }
  }
  useEffect(() => {
    syncFromServer();
    const interval = setInterval(syncFromServer, 15000);
    const onFocus = () => syncFromServer();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(interval); window.removeEventListener("focus", onFocus); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showToast(message) {
    setToast({ message, undo: null });
  }
  function showUndoToast(message, undoFn) {
    setToast({ message, undo: undoFn });
  }
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo ? 5000 : 2200);
    return () => clearTimeout(t);
  }, [toast]);

  function handleLogin(e) {
    e.preventDefault();
    const trimmed = passcode.trim();
    const matched = teams.find((t) => teamPasscodes[t.id] === trimmed);
    if (!matched) { setLoginError(true); return; }
    setLoginError(false);
    setPendingTeam(matched.id);
    const missing = missingLeaderRoles(matched.id, members);
    if (missing.length > 0) { setPendingMissingRoles(missing); setStage("team-setup"); }
    else setStage("onboarding");
  }
  function handleTeamSetupComplete(profile) {
    const newUser = { id: "u-" + Date.now(), team: pendingTeam, color: autoColor(members), seva: "", ...profile };
    setMembers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    setWelcomeName(profile.name);
    setStage("welcome");
    mutate("insertMember", newUser);
  }
  function handleOnboardingComplete(profile) {
    const newUser = { id: "u-" + Date.now(), team: pendingTeam, color: autoColor(members), seva: "", ...profile };
    setMembers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    setWelcomeName(profile.name);
    setStage("welcome");
    mutate("insertMember", newUser);
  }
  useEffect(() => {
    if (stage !== "welcome") return;
    const t = setTimeout(() => setStage("dashboard"), 1300);
    return () => clearTimeout(t);
  }, [stage]);
  function handleLogout() {
    setStage("login");
    setPasscode("");
    setPendingTeam(null);
    setPendingMissingRoles([]);
    setCurrentUser(null);
    setTab("calendar");
  }

  const rootProps = {
    currentUser, setCurrentUser, members, setMembers, teams, setTeams, rolesByTeam, setRolesByTeam,
    teamPasscodes, setTeamPasscodes, tab, setTab, profileOpen, setProfileOpen, theme, setTheme,
    eventsByTeam, setEventsByTeam, attendance, setAttendance, ekadashiDates, setEkadashiDates,
    viewMonth, setViewMonth, viewYear, setViewYear, swaps, setSwaps, ideas, setIdeas, ideaDraft, setIdeaDraft,
    feedbackNotes, setFeedbackNotes, leaderTasks, setLeaderTasks, activity,
    onLogout: handleLogout, showToast, showUndoToast,
  };

  return (
    <div className="skh-app" data-theme={theme}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
        .skh-app {
          --navy: #37352F; --navy-deep: #24211D; --bg: #F7F6F3; --card: #FFFFFF;
          --ink: #37352F; --muted: #9B9A97; --line: #E9E9E7; --saffron: #D9A441; --teal: #2F8F87;
          font-family: 'Inter', -apple-system, sans-serif; color: var(--ink); background: var(--bg);
          min-height: 640px; width: 100%; border-radius: 10px; overflow: hidden;
          display: flex; flex-direction: column; box-shadow: 0 1px 2px rgba(0,0,0,0.05); position: relative;
        }
        .skh-app[data-theme="dark"] {
          --bg: #191919; --card: #202020; --ink: #E9E9E7; --muted: #9B9A97; --line: #2F2F2F;
        }
        .skh-app h1, .skh-app h2, .skh-app h3 { font-family: 'Fraunces', serif; letter-spacing: -0.01em; }
        .skh-app button { font-family: inherit; cursor: pointer; }
        .skh-scroll { overflow-y: auto; flex: 1; }
        .skh-card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
        .skh-btn { background: var(--navy); color: white; border: none; border-radius: 7px; padding: 10px 16px; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; transition: opacity 0.15s ease, transform 0.1s ease; }
        .skh-btn:hover { opacity: 0.88; }
        .skh-btn:active { transform: scale(0.97); }
        .skh-btn-ghost { background: transparent; color: var(--navy); border: 1.5px solid var(--line); border-radius: 7px; padding: 9px 14px; font-weight: 600; font-size: 14px; transition: transform 0.1s ease; }
        .skh-btn-ghost:active { transform: scale(0.97); }
        .skh-app[data-theme="dark"] .skh-btn-ghost { color: var(--ink); }
        .skh-btn-saffron { background: var(--saffron); color: #2E2003; border: none; border-radius: 7px; padding: 10px 16px; font-weight: 700; font-size: 14px; }
        .skh-input { border: 1.5px solid var(--line); border-radius: 7px; padding: 10px 12px; font-size: 14px; width: 100%; background: var(--card); color: var(--ink); }
        .skh-input:focus, .skh-btn:focus-visible, .skh-btn-ghost:focus-visible, .skh-btn-saffron:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
        .skh-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; color: white; white-space: nowrap; }
        .skh-tabbtn { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 600; color: var(--muted); background: none; border: none; padding: 6px 4px; flex: 1; }
        .skh-tabbtn.active { color: var(--ink); }
        .skh-tabbtn .dot { width: 4px; height: 4px; border-radius: 50%; background: var(--saffron); opacity: 0; }
        .skh-tabbtn.active .dot { opacity: 1; }
        .skh-pillrow { display: flex; gap: 6px; background: var(--line); padding: 4px; border-radius: 9px; margin-bottom: 14px; }
        .skh-pill { flex: 1; text-align: center; padding: 8px 4px; border-radius: 6px; font-size: 12.5px; font-weight: 700; color: var(--muted); background: transparent; border: none; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .skh-pill.active { background: var(--card); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
        .skh-chip { font-size: 7.5px; font-weight: 700; color: white; border-radius: 4px; padding: 1px 3px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.5; }
        .skh-quote { background: rgba(217,164,65,0.09); border-left: 3px solid var(--saffron); border-radius: 4px; padding: 12px 14px; }
        @media (prefers-reduced-motion: reduce) { .skh-app * { transition: none !important; animation: none !important; } }
      `}</style>

      <AnimatePresence mode="wait">
        {stage === "login" && (
          <motion.div key="login" style={{ display: "flex", flex: 1 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
            <LoginScreen passcode={passcode} setPasscode={setPasscode} onSubmit={handleLogin} error={loginError} />
          </motion.div>
        )}
        {stage === "team-setup" && (
          <motion.div key="team-setup" style={{ display: "flex", flex: 1 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
            <TeamSetupScreen team={teams.find((t) => t.id === pendingTeam)} missingRoles={pendingMissingRoles} onComplete={handleTeamSetupComplete} onBack={handleLogout} />
          </motion.div>
        )}
        {stage === "onboarding" && (
          <motion.div key="onboarding" style={{ display: "flex", flex: 1 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
            <OnboardingScreen team={teams.find((t) => t.id === pendingTeam)} rolesByTeam={rolesByTeam} onComplete={handleOnboardingComplete} />
          </motion.div>
        )}
        {stage === "welcome" && (
          <motion.div key="welcome" style={{ display: "flex", flex: 1 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <WelcomeScreen name={welcomeName} color={teams.find((t) => t.id === pendingTeam)?.color} />
          </motion.div>
        )}
        {stage === "dashboard" && currentUser && (
          <motion.div key="dashboard" style={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Dashboard {...rootProps} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 16, x: "-50%" }}
            transition={{ duration: 0.2 }}
            style={{ position: "absolute", bottom: stage === "dashboard" ? 70 : 20, left: "50%", background: "var(--ink)", color: "var(--bg)", fontSize: 12.5, fontWeight: 600, padding: "9px 16px", borderRadius: 999, zIndex: 50, whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 12 }}
          >
            <span>{toast.message}</span>
            {toast.undo && (
              <button onClick={() => { toast.undo(); setToast(null); }} style={{ background: "none", border: "none", color: "var(--saffron)", fontWeight: 800, fontSize: 12.5, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                Undo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------
   WELCOME (brief animated moment right after joining)
--------------------------------------------------------------- */
function WelcomeScreen({ name, color }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ textAlign: "center" }}>
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          style={{ width: 60, height: 60, borderRadius: "50%", background: color || "var(--saffron)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}
        >
          <Check size={28} color="white" strokeWidth={3} />
        </motion.div>
        <motion.h2 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }} style={{ margin: 0, fontSize: 19 }}>
          Welcome, {name}!
        </motion.h2>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   LOGIN
--------------------------------------------------------------- */
function LoginScreen({ passcode, setPasscode, onSubmit, error }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "32px 20px" }}>
      <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--card)", border: "1.5px solid var(--line)", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={22} color="var(--ink)" />
        </div>
        <h1 style={{ color: "var(--ink)", fontSize: 24, margin: "0 0 6px" }}>Seva Circle</h1>
        <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 28px", lineHeight: 1.5 }}>
          One link. Your whole team's calendar, seva, and swaps &mdash; in one place.
        </p>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input className="skh-input" type="text" autoComplete="off" placeholder="Enter team passcode" value={passcode} onChange={(e) => setPasscode(e.target.value)} style={{ textAlign: "center", letterSpacing: 2 }} autoFocus />
          {error && <p style={{ color: "#C97575", fontSize: 12.5, margin: 0 }}>That passcode doesn't match &mdash; ask a Main or Co Karyakar for the current code.</p>}
          <button type="submit" className="skh-btn" style={{ justifyContent: "center", padding: "12px 16px", fontSize: 15 }} onClick={onSubmit}>Continue</button>
        </form>
        <p style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 22 }}>Each team has its own passcode, shared in their group chat.</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   TEAM SETUP (Main + Co bootstrap \u2014 the app won't start for anyone else until this is done)
--------------------------------------------------------------- */
function TeamSetupScreen({ team, missingRoles, onComplete, onBack }) {
  const [role, setRole] = useState(missingRoles[0] || "Main");
  const [name, setName] = useState("");
  const canGo = name.trim().length > 0;

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "32px 20px" }}>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div className="skh-card" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: team?.color }} />
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>{team?.name} isn't set up yet</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px", lineHeight: 1.5 }}>
            Every team needs a Main and a Co before anyone else can join. If that's you, sign in below. If not, ask your Main or Co Karyakar to do this first.
          </p>

          {missingRoles.length > 1 ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {missingRoles.map((r) => (
                <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: "9px 4px", borderRadius: 10, fontWeight: 700, fontSize: 13, border: role === r ? "2px solid var(--saffron)" : "1.5px solid var(--line)", background: role === r ? "#FCEBC9" : "var(--card)", color: role === r ? "#8A5A17" : "var(--muted)" }}>
                  I'm the {r}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--saffron)", marginBottom: 14 }}>Signing in as {role}</p>
          )}

          <input className="skh-input" style={{ marginBottom: 14, textAlign: "center" }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus />

          <button className="skh-btn" style={{ width: "100%", justifyContent: "center", marginBottom: 10 }} disabled={!canGo} onClick={() => canGo && onComplete({ name: name.trim(), role })}>
            Set up as {role}
          </button>
          <button className="skh-btn-ghost" style={{ width: "100%", justifyContent: "center", display: "flex" }} onClick={onBack}>Back to passcode</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   ONBOARDING (regular members \u2014 team is locked in by the passcode; just name + position)
--------------------------------------------------------------- */
function OnboardingScreen({ team, rolesByTeam, onComplete }) {
  const [name, setName] = useState("");
  const nonLeaderRoles = (rolesByTeam[team?.id] || []).filter((r) => r !== "Main" && r !== "Co");
  const [role, setRole] = useState(nonLeaderRoles[0] || "__other__");
  const [customRole, setCustomRole] = useState("");
  const trimmedCustom = customRole.trim();
  const customIsProtected = trimmedCustom.toLowerCase() === "main" || trimmedCustom.toLowerCase() === "co";
  const finalRole = role === "__other__" ? (trimmedCustom || "Karyakar") : role;
  const canGo = name.trim().length > 0 && (role !== "__other__" || (trimmedCustom.length > 0 && !customIsProtected));

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "32px 20px" }}>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div className="skh-card">
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: team?.color }} />
            <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0, fontWeight: 700, letterSpacing: 0.4 }}>JOINING {team?.name?.toUpperCase()}</p>
          </div>

          <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>What's your name?</label>
          <input className="skh-input" style={{ marginTop: 6, marginBottom: 14 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priyasha" autoFocus />

          <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>What's your position?</label>
          <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "4px 0 8px" }}>Main and Co are assigned by your team's current leaders, not picked here.</p>
          <select className="skh-input" value={role} onChange={(e) => setRole(e.target.value)}>
            {nonLeaderRoles.map((r) => <option key={r} value={r}>{r}</option>)}
            <option value="__other__">Other &mdash; type in your position</option>
          </select>
          {role === "__other__" && (
            <>
              <input className="skh-input" style={{ marginTop: 8 }} value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="Type in your position" />
              {customIsProtected && <p style={{ fontSize: 12, color: "#C97575", marginTop: 6 }}>Main and Co can't be self-assigned. Ask a current Main or Co Karyakar to promote you.</p>}
            </>
          )}

          <button className="skh-btn" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} disabled={!canGo} onClick={() => canGo && onComplete({ name: name.trim(), role: finalRole })}>
            Join {team?.name}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   DASHBOARD SHELL
--------------------------------------------------------------- */
function Dashboard(props) {
  const { currentUser, teams, tab, setTab, profileOpen, setProfileOpen, swaps, feedbackNotes } = props;
  const myTeam = teams.find((t) => t.id === currentUser.team);
  const openSwapCount = (swaps || []).filter((s) => s.team === currentUser.team && s.status === "open").length;
  const hasUnreadNotes = (feedbackNotes || []).some((n) => n.memberId === currentUser.id && !n.read);

  const TABS = [
    { id: "calendar", label: "Calendar", icon: CalendarIcon },
    { id: "roster", label: "Roster", icon: Users },
    { id: "swap", label: "Swap", icon: RefreshCw, badge: openSwapCount },
    { id: "ideas", label: "Ideas", icon: Lightbulb },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ background: "var(--card)", borderBottom: "1px solid var(--line)", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontSize: 10.5, color: "var(--muted)", fontWeight: 700, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: myTeam?.color }} />
            {(myTeam?.name || "YOUR TEAM").toUpperCase()}
          </p>
          <h1 style={{ margin: "2px 0 0", fontSize: 19, color: "var(--ink)" }}>Seva Circle</h1>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setProfileOpen(true)} style={{ width: 38, height: 38, borderRadius: "50%", background: currentUser.color, border: "2px solid var(--card)", boxShadow: "0 0 0 1px var(--line)", color: "white", fontWeight: 700, fontSize: 14, position: "relative" }}>
          {currentUser.name.charAt(0).toUpperCase()}
          {hasUnreadNotes && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }} style={{ position: "absolute", top: -2, right: -2, width: 11, height: 11, borderRadius: "50%", background: "var(--saffron)", border: "2px solid var(--card)" }} />
          )}
        </motion.button>
      </div>

      <div className="skh-scroll" style={{ padding: 16 }}>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }}>
            {tab === "calendar" && <CalendarTab {...props} />}
            {tab === "roster" && <RosterTab {...props} />}
            {tab === "swap" && <SwapTab {...props} />}
            {tab === "ideas" && <IdeasTab {...props} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ display: "flex", borderTop: "1px solid var(--line)", background: "var(--card)", padding: "4px 4px 8px" }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <motion.button key={t.id} whileTap={{ scale: 0.88 }} className={`skh-tabbtn ${active ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <motion.span animate={{ scale: active ? 1.12 : 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} style={{ display: "flex", position: "relative" }}>
                <Icon size={19} strokeWidth={active ? 2.4 : 1.9} />
                <AnimatePresence>
                  {!!t.badge && (
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}
                      style={{ position: "absolute", top: -4, right: -6, minWidth: 13, height: 13, borderRadius: 7, background: "var(--saffron)", color: "#2E2003", fontSize: 8.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}
                    >
                      {t.badge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.span>
              {t.label}
              <span className="dot" />
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>{profileOpen && <ProfileModal {...props} />}</AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------
   CALENDAR TAB (Google-Calendar-style event chips + Combined view)
--------------------------------------------------------------- */
function CalendarTab(props) {
  const { currentUser, members, teams, eventsByTeam, setEventsByTeam, attendance, setAttendance, ekadashiDates, setEkadashiDates, viewMonth, setViewMonth, viewYear, setViewYear, showToast, showUndoToast, ideas, leaderTasks, setLeaderTasks } = props;
  const [mode, setMode] = useState("mine");
  const [selectedKey, setSelectedKey] = useState(null);
  const [eventDraft, setEventDraft] = useState("");
  const [ekadashiDraft, setEkadashiDraft] = useState("");
  const [taskDraft, setTaskDraft] = useState("");

  const isLeader = currentUser.role === "Main" || currentUser.role === "Co";
  const myTeam = teams.find((t) => t.id === currentUser.team);
  const teamMembers = members.filter((m) => m.team === currentUser.team);
  const todayKey = dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function keyFor(day) { return dateKey(viewYear, viewMonth, day); }

  function dayStats(key) {
    const rec = attendance[currentUser.team]?.[key] || {};
    const present = teamMembers.filter((m) => rec[m.id] === "Present").length;
    return { present, total: teamMembers.length, pct: teamMembers.length ? Math.round((present / teamMembers.length) * 100) : 0 };
  }

  const prefix = monthPrefix(viewYear, viewMonth);
  function recapForTeam(team) {
    const tm = members.filter((m) => m.team === team.id);
    const presentCounts = {};
    Object.entries(attendance[team.id] || {}).forEach(([key, rec]) => {
      if (!key.startsWith(prefix)) return;
      Object.entries(rec).forEach(([memberId, status]) => {
        if (status === "Present") presentCounts[memberId] = (presentCounts[memberId] || 0) + 1;
      });
    });
    let topAttendee = null, topAttendeeCount = 0;
    Object.entries(presentCounts).forEach(([memberId, count]) => {
      if (count > topAttendeeCount) { topAttendeeCount = count; topAttendee = tm.find((m) => m.id === memberId); }
    });
    const ideaCounts = {};
    (ideas || []).forEach((i) => {
      if (i.team !== team.id || i.anonymous || !i.date?.startsWith(prefix)) return;
      ideaCounts[i.author] = (ideaCounts[i.author] || 0) + 1;
    });
    let topContributor = null, topContributorCount = 0;
    Object.entries(ideaCounts).forEach(([name, count]) => {
      if (count > topContributorCount) { topContributorCount = count; topContributor = name; }
    });
    let streakLeader = null, streakLeaderCount = 0;
    tm.forEach((m) => {
      const s = computeStreak(team.id, m.id, attendance);
      if (s > streakLeaderCount) { streakLeaderCount = s; streakLeader = m; }
    });
    return { team, topAttendee, topAttendeeCount, topContributor, topContributorCount, streakLeader, streakLeaderCount };
  }
  const recaps = teams.map(recapForTeam);

  let bestOutingDay = null, bestOutingPct = -1;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(viewYear, viewMonth, d);
    let sum = 0, count = 0;
    teams.forEach((t) => {
      const tm = members.filter((m) => m.team === t.id);
      if (tm.length === 0) return;
      const rec = attendance[t.id]?.[key] || {};
      const present = tm.filter((m) => rec[m.id] === "Present").length;
      sum += (present / tm.length) * 100;
      count++;
    });
    if (count > 0) {
      const avg = sum / count;
      if (avg > bestOutingPct) { bestOutingPct = avg; bestOutingDay = key; }
    }
  }
  const hasAnyRecapData = recaps.some((r) => r.topAttendee || r.topContributor) || bestOutingPct > 0;

  function changeMonth(delta) {
    let m = viewMonth + delta, y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y); setSelectedKey(null);
  }
  function setMyStatus(key, status) {
    setAttendance((prev) => {
      const teamRec = { ...(prev[currentUser.team] || {}) };
      const dayRec = { ...(teamRec[key] || {}), [currentUser.id]: status };
      teamRec[key] = dayRec;
      return { ...prev, [currentUser.team]: teamRec };
    });
    mutate("setAttendance", { teamId: currentUser.team, date: key, memberId: currentUser.id, status });
  }
  function addEvent() {
    if (!eventDraft.trim()) return;
    const newEvent = { id: "e" + Date.now(), title: eventDraft.trim() };
    setEventsByTeam((prev) => {
      const teamEvents = { ...(prev[currentUser.team] || {}) };
      teamEvents[selectedKey] = [...(teamEvents[selectedKey] || []), newEvent];
      return { ...prev, [currentUser.team]: teamEvents };
    });
    mutate("insertEvent", { teamId: currentUser.team, date: selectedKey, event: newEvent, actor: currentUser.name });
    notifyTeam(currentUser.team, `New event: ${eventDraft.trim()} on ${formatKeyLong(selectedKey)}`, members, "New event on your calendar");
    showToast?.("Event added");
    setEventDraft("");
  }
  function removeEvent(eventId) {
    const removed = (eventsByTeam[currentUser.team]?.[selectedKey] || []).find((e) => e.id === eventId);
    setEventsByTeam((prev) => {
      const teamEvents = { ...(prev[currentUser.team] || {}) };
      const remaining = (teamEvents[selectedKey] || []).filter((e) => e.id !== eventId);
      if (remaining.length > 0) teamEvents[selectedKey] = remaining;
      else delete teamEvents[selectedKey];
      return { ...prev, [currentUser.team]: teamEvents };
    });
    mutate("deleteEvent", { eventId });
    showUndoToast?.("Event removed", () => {
      if (!removed) return;
      setEventsByTeam((prev) => {
        const teamEvents = { ...(prev[currentUser.team] || {}) };
        teamEvents[selectedKey] = [...(teamEvents[selectedKey] || []), removed];
        return { ...prev, [currentUser.team]: teamEvents };
      });
      mutate("insertEvent", { teamId: currentUser.team, date: selectedKey, event: removed, actor: currentUser.name });
    });
  }
  function saveEkadashi() {
    if (!ekadashiDraft.trim()) return;
    setEkadashiDates((prev) => ({ ...prev, [selectedKey]: ekadashiDraft.trim() }));
    mutate("setEkadashi", { date: selectedKey, name: ekadashiDraft.trim() });
    showToast?.("Marked as Ekadashi");
    setEkadashiDraft("");
  }
  function removeEkadashi(key) {
    const removedName = ekadashiDates[key];
    setEkadashiDates((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    mutate("deleteEkadashi", { date: key });
    showUndoToast?.("Ekadashi mark removed", () => {
      setEkadashiDates((prev) => ({ ...prev, [key]: removedName }));
      mutate("setEkadashi", { date: key, name: removedName });
    });
  }
  function addTask() {
    if (!taskDraft.trim() || !selectedKey) return;
    const newTask = { id: "t" + Date.now(), team: currentUser.team, text: taskDraft.trim(), date: selectedKey, done: false };
    setLeaderTasks((prev) => [...prev, newTask]);
    mutate("insertTask", newTask);
    showToast?.("Task added");
    setTaskDraft("");
  }
  function toggleTask(id) {
    const task = (leaderTasks || []).find((t) => t.id === id);
    setLeaderTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    if (task) mutate("updateTask", { id, patch: { done: !task.done } });
  }
  function rescheduleTask(id, newDate) {
    setLeaderTasks((prev) => prev.map((t) => (t.id === id ? { ...t, date: newDate } : t)));
    mutate("updateTask", { id, patch: { date: newDate } });
    showToast?.("Task moved");
  }
  function deleteTask(id) {
    const removed = (leaderTasks || []).find((t) => t.id === id);
    setLeaderTasks((prev) => prev.filter((t) => t.id !== id));
    mutate("deleteTask", { id });
    showUndoToast?.("Task deleted", () => {
      if (removed) { setLeaderTasks((prev) => [...prev, removed]); mutate("insertTask", removed); }
    });
  }

  const upcoming = Object.entries(eventsByTeam[currentUser.team] || {}).filter(([k]) => k >= todayKey).sort(([a], [b]) => (a > b ? 1 : -1)).slice(0, 3);
  const nextEkadashiKey = Object.keys(ekadashiDates).filter((k) => k >= todayKey).sort()[0];

  const agendaDateSet = new Set([...Object.keys(eventsByTeam[currentUser.team] || {}), ...Object.keys(ekadashiDates)]);
  const agendaItems = [...agendaDateSet].filter((k) => k >= todayKey).sort().map((k) => ({
    key: k,
    events: eventsByTeam[currentUser.team]?.[k] || [],
    ekadashi: ekadashiDates[k],
  }));
  const openTasks = (leaderTasks || []).filter((t) => t.team === currentUser.team && !t.done).sort((a, b) => (a.date < b.date ? -1 : 1));

  function jumpToDate(key) {
    const [y, m] = key.split("-").map(Number);
    setViewYear(y); setViewMonth(m - 1); setSelectedKey(key); setMode("mine");
    const ev = (eventsByTeam[currentUser.team]?.[key] || [])[0];
    setEventDraft("");
  }

  return (
    <div>
      <div className="skh-pillrow">
        <button className={`skh-pill ${mode === "mine" ? "active" : ""}`} onClick={() => { setMode("mine"); setSelectedKey(null); }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: myTeam?.color }} /> My Team
        </button>
        <button className={`skh-pill ${mode === "agenda" ? "active" : ""}`} onClick={() => { setMode("agenda"); setSelectedKey(null); }}>
          <List size={13} /> Agenda
        </button>
        <button className={`skh-pill ${mode === "combined" ? "active" : ""}`} onClick={() => { setMode("combined"); setSelectedKey(null); }}>
          <Layers size={13} /> Combined
        </button>
      </div>

      {mode === "combined" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="skh-card" style={{ marginBottom: 14, background: "linear-gradient(160deg, #37352F, #24211D)", border: "none", color: "white" }}>
          <p style={{ margin: "0 0 10px", fontSize: 12.5, fontWeight: 700, color: "var(--saffron)", display: "flex", alignItems: "center", gap: 6 }}>
            <Trophy size={14} /> {MONTH_NAMES[viewMonth].toUpperCase()} RECAP
          </p>
          {!hasAnyRecapData ? (
            <p style={{ margin: 0, fontSize: 12.5, color: "#C7CAD1" }}>Not enough marked so far this month — check back as people log attendance and ideas.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recaps.map(({ team, topAttendee, topAttendeeCount, topContributor, topContributorCount, streakLeader, streakLeaderCount }) => (
                <div key={team.id} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: team.color }} /> {team.name}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "#D8DAE0" }}>
                    {topAttendee ? `Most present: ${topAttendee.name} (${topAttendeeCount})` : "No attendance marked yet"}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "#D8DAE0" }}>
                    {topContributor ? `Top idea contributor: ${topContributor} (${topContributorCount})` : "No named ideas posted yet"}
                  </p>
                  {streakLeaderCount >= 2 && (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--saffron)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Flame size={11} fill="var(--saffron)" /> {streakLeader.name} is on a {streakLeaderCount}-week streak
                    </p>
                  )}
                </div>
              ))}
              {bestOutingDay && bestOutingPct > 0 && (
                <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 700, color: "var(--saffron)" }}>
                  Best outing day so far: {formatKeyLong(bestOutingDay)} ({Math.round(bestOutingPct)}% free across both teams)
                </p>
              )}
            </div>
          )}
        </motion.div>
      )}

      {mode === "mine" && myTeam?.motto && (
        <div className="skh-quote" style={{ marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--saffron)", letterSpacing: 0.3 }}>MOTTO OF THE MONTH</p>
          <p style={{ margin: "4px 0 0", fontSize: 14, fontFamily: "'Fraunces', serif", fontStyle: "italic", color: "var(--ink)", lineHeight: 1.5 }}>&ldquo;{myTeam.motto}&rdquo;</p>
        </div>
      )}

      {mode === "mine" && upcoming.length === 0 && !nextEkadashiKey && (
        <div className="skh-card" style={{ marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>No upcoming events yet &mdash; {isLeader ? "tap a day below to add one." : "check back once your Main or Co adds one."}</p>
        </div>
      )}
      {mode === "mine" && (upcoming.length > 0 || nextEkadashiKey) && (
        <div className="skh-card" style={{ marginBottom: 14 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>UPCOMING</p>
          {upcoming.map(([k, evs]) => (
            <div key={k} style={{ marginBottom: 5 }}>
              {evs.map((ev) => (
                <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{ev.title}</span><span style={{ color: "var(--muted)" }}>{formatKeyShort(k)}</span>
                </div>
              ))}
            </div>
          ))}
          {nextEkadashiKey && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Star size={12} color="var(--saffron)" /> {ekadashiDates[nextEkadashiKey]}</span>
              <span style={{ color: "var(--muted)" }}>{formatKeyShort(nextEkadashiKey)}</span>
            </div>
          )}
        </div>
      )}

      {mode === "agenda" && (
        <div>
          {agendaItems.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>Nothing coming up yet.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: openTasks.length > 0 ? 18 : 0 }}>
            <AnimatePresence>
              {agendaItems.map((item) => (
                <motion.button key={item.key} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} onClick={() => jumpToDate(item.key)} className="skh-card" style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 4, borderLeft: `4px solid ${myTeam?.color}` }}>
                  <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>{formatKeyLong(item.key)}</p>
                  {item.events.map((ev) => <p key={ev.id} style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{ev.title}</p>)}
                  {item.ekadashi && <p style={{ margin: 0, fontSize: 12.5, color: "var(--saffron)", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}><Star size={11} fill="var(--saffron)" /> {item.ekadashi}</p>}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          {isLeader && openTasks.length > 0 && (
            <>
              <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>YOUR TEAM'S OPEN TASKS</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <AnimatePresence>
                  {openTasks.map((t) => (
                    <motion.div key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="skh-card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <motion.button whileTap={{ scale: 0.85 }} onClick={() => toggleTask(t.id)} style={{ background: "none", border: "1.5px solid var(--line)", borderRadius: 6, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                        {t.done && <Check size={13} color="var(--teal)" />}
                      </motion.button>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13 }}>{t.text}</p>
                      </div>
                      <input type="date" value={t.date} onChange={(e) => rescheduleTask(t.id, e.target.value)} style={{ fontSize: 11, border: "1px solid var(--line)", borderRadius: 6, padding: "2px 4px", background: "var(--card)", color: "var(--ink)" }} />
                      <button onClick={() => deleteTask(t.id)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={13} /></button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      )}

      {mode !== "agenda" && (
      <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button className="skh-btn-ghost" onClick={() => changeMonth(-1)} style={{ padding: "6px 10px" }}><ChevronLeft size={16} /></button>
        <h3 style={{ margin: 0, fontSize: 16 }}>{MONTH_NAMES[viewMonth]} {viewYear}</h3>
        <button className="skh-btn-ghost" onClick={() => changeMonth(1)} style={{ padding: "6px 10px" }}><ChevronRight size={16} /></button>
      </div>

      <div className="skh-card">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
          {DAY_LABELS.map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: "var(--muted)" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = keyFor(d);
            const isEkadashi = !!ekadashiDates[key];
            const isSelected = selectedKey === key;
            const isToday = key === todayKey;

            if (mode === "mine") {
              const stats = dayStats(key);
              const isHot = stats.total > 0 && stats.pct >= 80;
              const dayEvents = eventsByTeam[currentUser.team]?.[key] || [];
              return (
                <motion.button key={i} whileTap={{ scale: 0.9 }}
                  animate={isHot ? { boxShadow: ["0 0 0 0 rgba(232,163,61,0.35)", "0 0 0 4px rgba(232,163,61,0)"] } : {}}
                  transition={isHot ? { duration: 1.6, repeat: Infinity, ease: "easeOut" } : {}}
                  onClick={() => { setSelectedKey(key); setEventDraft(""); }}
                  style={{ minHeight: 52, borderRadius: 9, border: isSelected ? "2px solid var(--ink)" : isHot ? "1.5px solid #E8A33D" : "1px solid var(--line)", background: isHot ? "radial-gradient(circle at 50% 20%, #FCEBC9, #F6D9A0)" : "var(--card)", display: "flex", flexDirection: "column", alignItems: "center", padding: "3px 2px", gap: 2 }}>
                  <span style={{ fontSize: 10.5, fontWeight: isHot || isToday ? 800 : 600, color: isToday ? "white" : isHot ? "#8A5A17" : "var(--ink)", display: "flex", alignItems: "center", gap: 2, background: isToday ? "var(--ink)" : "transparent", borderRadius: "50%", width: 17, height: 17, justifyContent: "center" }}>
                    {d}
                  </span>
                  {isEkadashi && <Star size={6} color="var(--saffron)" fill="var(--saffron)" style={{ marginTop: -2 }} />}
                  {dayEvents.slice(0, 2).map((ev) => <span key={ev.id} className="skh-chip" style={{ background: myTeam?.color }}>{ev.title}</span>)}
                  {dayEvents.length > 2 && <span style={{ fontSize: 7, fontWeight: 700, color: "var(--muted)" }}>+{dayEvents.length - 2} more</span>}
                </motion.button>
              );
            }

            const chips = teams.map((t) => {
              const evs = eventsByTeam[t.id]?.[key] || [];
              if (evs.length === 0) return null;
              return { text: evs.length > 1 ? `${evs[0].title} +${evs.length - 1}` : evs[0].title, color: t.color };
            }).filter(Boolean).slice(0, 2);
            return (
              <motion.button key={i} whileTap={{ scale: 0.9 }} onClick={() => setSelectedKey(key)} style={{ minHeight: 52, borderRadius: 9, border: isSelected ? "2px solid var(--ink)" : "1px solid var(--line)", background: "var(--card)", display: "flex", flexDirection: "column", alignItems: "center", padding: "3px 2px", gap: 2 }}>
                <span style={{ fontSize: 10.5, fontWeight: isToday ? 800 : 600, color: isToday ? "white" : "var(--ink)", display: "flex", alignItems: "center", gap: 2, background: isToday ? "var(--ink)" : "transparent", borderRadius: "50%", width: 17, height: 17, justifyContent: "center" }}>
                  {d}
                </span>
                {isEkadashi && <Star size={6} color="var(--saffron)" fill="var(--saffron)" style={{ marginTop: -2 }} />}
                {chips.map((c, idx) => <span key={idx} className="skh-chip" style={{ background: c.color }}>{c.text}</span>)}
              </motion.button>
            );
          })}
        </div>
      </div>
      </>
      )}

      <AnimatePresence>
      {selectedKey && mode === "mine" && (
        <motion.div key={selectedKey} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.18 }} className="skh-card" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>{formatKeyLong(selectedKey)}</h3>
            <button onClick={() => setSelectedKey(null)} className="skh-btn-ghost" style={{ padding: "4px 8px" }}><X size={14} /></button>
          </div>

          {ekadashiDates[selectedKey] ? (
            <div style={{ marginBottom: 10, padding: "6px 10px", background: "#FCEBC9", borderRadius: 8, fontSize: 12.5, fontWeight: 700, color: "#8A5A17", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Star size={13} fill="#8A5A17" /> {ekadashiDates[selectedKey]}</span>
              {isLeader && <button onClick={() => removeEkadashi(selectedKey)} style={{ background: "none", border: "none", color: "#8A5A17", cursor: "pointer" }}><X size={13} /></button>}
            </div>
          ) : isLeader ? (
            <div style={{ marginBottom: 12, display: "flex", gap: 6 }}>
              <input className="skh-input" style={{ flex: 1 }} value={ekadashiDraft} onChange={(e) => setEkadashiDraft(e.target.value)} placeholder="Which Ekadashi? e.g. Devshayani Ekadashi" />
              <button className="skh-btn-ghost" style={{ fontSize: 12, padding: "6px 10px" }} onClick={saveEkadashi} disabled={!ekadashiDraft.trim()}>Mark</button>
            </div>
          ) : null}

          {(eventsByTeam[currentUser.team]?.[selectedKey] || []).length > 0 && (
            <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {eventsByTeam[currentUser.team][selectedKey].map((ev) => (
                <div key={ev.id} style={{ padding: "10px 12px", background: "var(--line)", borderRadius: 8, borderLeft: `4px solid ${myTeam?.color}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{ev.title}</span>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => downloadICS(ev.title, selectedKey)} title="Add to phone calendar" style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}><Download size={14} /></button>
                    {isLeader && <button onClick={() => removeEvent(ev.id)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}><X size={14} /></button>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {isLeader && (
            <div style={{ marginBottom: 12, display: "flex", gap: 6 }}>
              <input className="skh-input" style={{ flex: 1 }} value={eventDraft} onChange={(e) => setEventDraft(e.target.value)} placeholder="Add an event \u2014 Sabha, Shibir, Parayan session" />
              <button className="skh-btn-ghost" style={{ fontSize: 12, padding: "6px 10px" }} onClick={addEvent} disabled={!eventDraft.trim()}>Add</button>
            </div>
          )}

          {isLeader && (
            <div style={{ marginBottom: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 5 }}>
                <ListTodo size={13} /> Tasks for this day
              </p>
              {(leaderTasks || []).filter((t) => t.team === currentUser.team && t.date === selectedKey).length === 0 && (
                <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Nothing on the list yet.</p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                <AnimatePresence>
                  {(leaderTasks || []).filter((t) => t.team === currentUser.team && t.date === selectedKey).map((t) => (
                    <motion.div key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <motion.button whileTap={{ scale: 0.85 }} onClick={() => toggleTask(t.id)} style={{ background: t.done ? "rgba(47,143,135,0.15)" : "none", border: "1.5px solid var(--line)", borderRadius: 6, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                        {t.done && <Check size={13} color="var(--teal)" />}
                      </motion.button>
                      <span style={{ fontSize: 13, flex: 1, textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--muted)" : "var(--ink)" }}>{t.text}</span>
                      <button onClick={() => deleteTask(t.id)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={13} /></button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="skh-input" style={{ flex: 1 }} value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} placeholder="e.g. Confirm hall booking" />
                <button className="skh-btn-ghost" style={{ fontSize: 12, padding: "6px 10px" }} onClick={addTask} disabled={!taskDraft.trim()}>Add</button>
              </div>
            </div>
          )}

          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", margin: "0 0 6px" }}>Your status &mdash; freedom to log past dates too</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {["Present", "Absent"].map((s) => {
              const Icon = s === "Present" ? CheckCircle2 : XCircle;
              const mine = (attendance[currentUser.team]?.[selectedKey] || {})[currentUser.id] === s;
              return (
                <motion.button key={s} whileTap={{ scale: 0.93 }} animate={{ scale: mine ? [1, 1.06, 1] : 1 }} transition={{ duration: 0.25 }} onClick={() => setMyStatus(selectedKey, s)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 4px", borderRadius: 10, border: mine ? `2px solid ${STATUS_COLORS[s]}` : "1.5px solid var(--line)", background: mine ? `${STATUS_COLORS[s]}1c` : "var(--card)", color: mine ? STATUS_COLORS[s] : "var(--muted)", fontWeight: 700, fontSize: 13 }}>
                  <Icon size={15} /> {s}
                </motion.button>
              );
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {teamMembers.map((m) => {
              const s = (attendance[currentUser.team]?.[selectedKey] || {})[m.id];
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color }} /> {m.name}</span>
                  {s ? <span className="skh-badge" style={{ background: STATUS_COLORS[s] }}>{s}</span> : <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Not marked</span>}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
      {selectedKey && mode === "combined" && (
        <motion.div key={selectedKey} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.18 }} className="skh-card" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>{formatKeyLong(selectedKey)}</h3>
            <button onClick={() => setSelectedKey(null)} className="skh-btn-ghost" style={{ padding: "4px 8px" }}><X size={14} /></button>
          </div>
          {ekadashiDates[selectedKey] && (
            <div style={{ marginBottom: 10, padding: "6px 10px", background: "#FCEBC9", borderRadius: 8, fontSize: 12.5, fontWeight: 700, color: "#8A5A17", display: "flex", alignItems: "center", gap: 6 }}>
              <Star size={13} fill="#8A5A17" /> {ekadashiDates[selectedKey]}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {teams.map((t) => {
              const evs = eventsByTeam[t.id]?.[selectedKey] || [];
              return (
                <div key={t.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: t.color }} />
                    <span style={{ fontWeight: 600 }}>{t.name}:</span>
                    {evs.length === 0 && <span style={{ color: "var(--muted)" }}>No event</span>}
                  </div>
                  {evs.map((ev) => <p key={ev.id} style={{ margin: "0 0 0 17px", fontSize: 12.5 }}>{ev.title}</p>)}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>This view updates itself automatically from each team's own calendar.</p>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------
   ROSTER TAB
--------------------------------------------------------------- */
function RosterTab({ members, currentUser, setCurrentUser, setMembers, teams, showToast, feedbackNotes, setFeedbackNotes, attendance, activity }) {
  const [seva, setSeva] = useState(currentUser.seva);
  const [openNoteFor, setOpenNoteFor] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [search, setSearch] = useState("");
  const [showAllActivity, setShowAllActivity] = useState(false);
  const myTeam = teams.find((t) => t.id === currentUser.team);
  const teamMembers = members.filter((m) => m.team === currentUser.team);
  const q = search.trim().toLowerCase();
  const filteredMembers = q
    ? teamMembers.filter((m) => m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q) || (m.seva || "").toLowerCase().includes(q))
    : teamMembers;
  const isLeader = currentUser.role === "Main" || currentUser.role === "Co";
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const teamActivity = (activity || []).filter((a) => a.team === currentUser.team);
  const visibleActivity = showAllActivity ? teamActivity.slice(0, 20) : teamActivity.slice(0, 5);

  function save() {
    const updated = { ...currentUser, seva };
    setCurrentUser(updated);
    setMembers((prev) => prev.map((m) => (m.id === currentUser.id ? updated : m)));
    mutate("updateMember", updated);
    showToast?.("Seva saved");
  }
  function sendNote(member) {
    if (!noteDraft.trim()) return;
    const note = { id: "f" + Date.now(), memberId: member.id, team: currentUser.team, text: noteDraft.trim(), date: todayKey, read: false };
    setFeedbackNotes((prev) => [...prev, note]);
    mutate("insertNote", note);
    notifyMember(member.email, "You have a private note from your team leadership. Open Seva Circle to read it.", "New note from your leadership");
    showToast?.("Note sent");
    setNoteDraft(""); setOpenNoteFor(null);
  }

  return (
    <div>
      <div className="skh-card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Seva</h3>
        <input className="skh-input" style={{ marginBottom: 10 }} value={seva} onChange={(e) => setSeva(e.target.value)} placeholder="Add your seva whenever you're ready" />
        <button className="skh-btn" style={{ width: "100%", justifyContent: "center" }} onClick={save}><Check size={15} /> Save</button>
      </div>

      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{myTeam?.name} roster</h3>
      {myTeam?.description && <p style={{ fontSize: 12.5, color: "var(--muted)", fontStyle: "italic", margin: "0 0 10px" }}>{myTeam.description}</p>}

      {teamMembers.length > 4 && (
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={14} color="var(--muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input className="skh-input" style={{ paddingLeft: 34 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, position, or seva" />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: myTeam?.description || teamMembers.length > 4 ? 0 : 10 }}>
        {teamMembers.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)" }}>Just you so far &mdash; more karyakars will show up here as they join.</p>}
        {teamMembers.length > 0 && filteredMembers.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)" }}>No one matches "{search}".</p>}
        <AnimatePresence>
          {filteredMembers.map((m) => {
            const streak = computeStreak(currentUser.team, m.id, attendance || {});
            return (
              <motion.div key={m.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="skh-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: m.color, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{m.name.charAt(0)}</div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                        {m.name}
                        {streak >= 2 && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 10.5, fontWeight: 700, color: "var(--saffron)" }}>
                            <Flame size={11} fill="var(--saffron)" /> {streak}
                          </motion.span>
                        )}
                      </p>
                      <p style={{ margin: "1px 0 0", fontSize: 11.5, color: "var(--muted)" }}>{m.seva || "No seva added yet"}</p>
                    </div>
                  </div>
                  <span className="skh-badge" style={{ background: m.color }}>{m.role}</span>
                </div>

                {isLeader && m.id !== currentUser.id && (
                  <>
                    <button
                      className="skh-btn-ghost"
                      style={{ marginTop: 10, fontSize: 11.5, padding: "5px 10px" }}
                      onClick={() => { setOpenNoteFor(openNoteFor === m.id ? null : m.id); setNoteDraft(""); }}
                    >
                      {openNoteFor === m.id ? "Cancel" : "Private note"}
                    </button>
                    <AnimatePresence>
                      {openNoteFor === m.id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                          <p style={{ fontSize: 11, color: "var(--muted)", margin: "10px 0 6px" }}>
                            Only {m.name} sees this &mdash; not shown to anyone else on the team.
                          </p>
                          <textarea className="skh-input" style={{ minHeight: 60, marginBottom: 8 }} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder={`e.g. This is what we've been seeing lacking with ${m.seva || "your seva"}, and this is what we'd love to see...`} />
                          <button className="skh-btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => sendNote(m)} disabled={!noteDraft.trim()}>Send note</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Recent activity</h3>
        {teamActivity.length > 5 && (
          <button className="skh-btn-ghost" style={{ fontSize: 11.5, padding: "4px 10px" }} onClick={() => setShowAllActivity((v) => !v)}>
            {showAllActivity ? "Show less" : "View history"}
          </button>
        )}
      </div>
      <div className="skh-card">
        {teamActivity.length === 0 && <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>Nothing yet &mdash; activity shows up here as your team uses the app.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AnimatePresence>
            {visibleActivity.map((a) => (
              <motion.div key={a.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Activity size={13} color="var(--muted)" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 12.5 }}><strong>{a.actor}</strong> {a.action}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>{timeAgo(a.createdAt)}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   SWAP TAB
--------------------------------------------------------------- */
function SwapTab({ swaps, setSwaps, currentUser, members, showToast, showUndoToast }) {
  const [swapDate, setSwapDate] = useState("");
  const [swapReason, setSwapReason] = useState("");

  const teamSwaps = swaps.filter((s) => s.team === currentUser.team);
  const open = teamSwaps.filter((s) => s.status === "open");
  const resolved = teamSwaps.filter((s) => s.status !== "open");

  function accept(id) {
    const swap = swaps.find((s) => s.id === id);
    setSwaps((prev) => prev.map((s) => (s.id === id ? { ...s, status: "covered", coveredBy: currentUser.name } : s)));
    mutate("updateSwap", { id, status: "covered", coveredBy: currentUser.name, actor: currentUser.name });
    if (swap) {
      const requester = members.find((m) => m.id === swap.memberId);
      notifyMember(requester?.email, `${currentUser.name} can cover your seva on ${formatKeyShort(swap.date)}.`, "Your swap is covered");
    }
    showToast?.("Swap accepted");
  }
  function requestSwap() {
    if (!swapDate) return;
    const id = "s" + Date.now();
    const newSwap = { id, team: currentUser.team, memberId: currentUser.id, member: currentUser.name, seva: currentUser.seva || "Seva", date: swapDate, reason: swapReason.trim(), status: "open" };
    setSwaps((prev) => [newSwap, ...prev]);
    mutate("insertSwap", newSwap);
    const forText = swapReason.trim() ? ` for ${swapReason.trim()}` : "";
    notifyTeam(currentUser.team, `${currentUser.name} needs a sub on ${formatKeyShort(swapDate)}${forText}. If you're available, reach out or accept it in the Swap tab.`, members, "Swap needed");
    notifyLeaders(currentUser.team, `${currentUser.name} needs a sub on ${formatKeyShort(swapDate)}${forText} \u2014 worth helping coordinate who can cover.`, members, "Swap needs coordinating");
    showToast?.("Swap requested");
    setSwapDate(""); setSwapReason("");
  }
  function cancelSwap(id) {
    const removed = swaps.find((s) => s.id === id);
    setSwaps((prev) => prev.filter((s) => s.id !== id));
    mutate("deleteSwap", { id });
    showUndoToast?.("Swap request canceled", () => {
      if (removed) { setSwaps((prev) => [removed, ...prev]); mutate("insertSwap", removed); }
    });
  }

  return (
    <div>
      <div className="skh-card" style={{ marginBottom: 14 }}>
        <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 14 }}>Plans changed?</p>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
          Only request a swap if you're truly unavailable. Your whole team and your Main/Co see it &mdash; if someone's free, they can accept it here or just find you in person.
        </p>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>What's this for?</label>
        <input className="skh-input" style={{ marginTop: 5, marginBottom: 10 }} value={swapReason} onChange={(e) => setSwapReason(e.target.value)} placeholder="e.g. Sabha, Diwali event, Shibir" />
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Date you need covered</label>
        <input type="date" className="skh-input" style={{ marginTop: 5, marginBottom: 10 }} value={swapDate} onChange={(e) => setSwapDate(e.target.value)} />
        <button className="skh-btn" style={{ width: "100%", justifyContent: "center" }} disabled={!swapDate} onClick={requestSwap}>Request sub</button>
      </div>

      <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Open requests</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {open.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)" }}>No open swap requests right now.</p>}
        <AnimatePresence>
          {open.map((s) => (
            <motion.div key={s.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="skh-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5 }}>{s.member}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>{s.seva} &middot; {formatKeyShort(s.date)}{s.reason ? ` \u00b7 ${s.reason}` : ""}</p>
              </div>
              {s.memberId === currentUser.id ? (
                <button className="skh-btn-ghost" onClick={() => cancelSwap(s.id)} style={{ padding: "7px 12px", fontSize: 12.5 }}>Cancel</button>
              ) : (
                <button className="skh-btn" onClick={() => accept(s.id)} style={{ padding: "7px 12px", fontSize: 12.5 }}>Accept swap</button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {resolved.length > 0 && (
        <>
          <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Covered</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <AnimatePresence>
              {resolved.map((s) => (
                <motion.div key={s.id} layout initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} className="skh-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5 }}>{s.member}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>{s.seva} &middot; {formatKeyShort(s.date)}{s.reason ? ` \u00b7 ${s.reason}` : ""} &middot; covered by {s.coveredBy}</p>
                  </div>
                  <Check size={16} color="var(--teal)" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   IDEAS TAB (Progress / Improve boards, anonymous option, uploadable memory wall)
--------------------------------------------------------------- */
function IdeasTab({ ideas, setIdeas, currentUser, members, showToast, showUndoToast }) {
  const [category, setCategory] = useState("progress");
  const [draft, setDraft] = useState("");
  const [anon, setAnon] = useState(false);
  const isLeader = currentUser.role === "Main" || currentUser.role === "Co";

  const prompts = {
    progress: "What have you noticed this month that's progressed and want to share with everyone?",
    improve: "What can we improve on \u2014 and if you've got an idea for how, share that too?",
  };
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  function submitIdea() {
    if (!draft.trim()) return;
    const newIdea = { id: "i" + Date.now(), category, text: draft.trim(), anonymous: anon, author: currentUser.name, team: currentUser.team, date: todayKey, votes: 0, executing: false, executors: [] };
    setIdeas((prev) => [newIdea, ...prev]);
    mutate("insertIdea", newIdea);
    notifyTeam(currentUser.team, `New idea posted under "${category === "progress" ? "Progress" : "Improve"}"${anon ? "" : ` by ${currentUser.name}`}`, members, "New idea posted");
    showToast?.("Idea posted");
    setDraft(""); setAnon(false);
  }
  function upvote(id) {
    const idea = ideas.find((i) => i.id === id);
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, votes: i.votes + 1 } : i)));
    if (idea) mutate("updateIdea", { id, patch: { votes: idea.votes + 1 } });
  }
  function toggleExecute(id) {
    let patch = null;
    setIdeas((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      const already = (i.executors || []).includes(currentUser.name);
      const executors = already ? i.executors.filter((n) => n !== currentUser.name) : [...(i.executors || []), currentUser.name];
      if (!already) showToast?.("You're in — added to executors");
      patch = { executors, executing: executors.length > 0 };
      return { ...i, ...patch };
    }));
    if (patch) mutate("updateIdea", { id, patch });
  }
  function deleteIdea(id) {
    const removed = ideas.find((i) => i.id === id);
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    mutate("deleteIdea", { id });
    showUndoToast?.("Idea deleted", () => {
      if (removed) { setIdeas((prev) => [removed, ...prev]); mutate("insertIdea", removed); }
    });
  }

  const filtered = category === "executing"
    ? [...ideas].filter((i) => i.executing).sort((a, b) => (b.executors?.length || 0) - (a.executors?.length || 0))
    : [...ideas].filter((i) => i.category === category).sort((a, b) => b.votes - a.votes);

  return (
    <div>
      <div className="skh-pillrow">
        <button className={`skh-pill ${category === "progress" ? "active" : ""}`} onClick={() => setCategory("progress")}>Progress</button>
        <button className={`skh-pill ${category === "improve" ? "active" : ""}`} onClick={() => setCategory("improve")}>Improve</button>
        <button className={`skh-pill ${category === "executing" ? "active" : ""}`} onClick={() => setCategory("executing")}>
          <Rocket size={13} /> Executing
        </button>
      </div>

      {category !== "executing" && (
        <div className="skh-card" style={{ marginBottom: 14, background: "linear-gradient(135deg, #E8A33D, #D9834F)", border: "none" }}>
          <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 14, color: "#3A2408" }}>{prompts[category]}</p>
          <textarea className="skh-input" style={{ minHeight: 60, marginBottom: 8 }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Share with the team..." />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#3A2408", marginBottom: 10 }}>
            <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> Post anonymously
          </label>
          <button className="skh-btn" style={{ width: "100%", justifyContent: "center", background: "#3A2408" }} onClick={submitIdea}><Plus size={15} /> Submit</button>
        </div>
      )}
      {category === "executing" && (
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>Ideas people have said yes to helping bring to life this month.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)" }}>{category === "executing" ? "Nobody's signed up to execute an idea yet." : "Nothing here yet — be the first to share."}</p>}
        <AnimatePresence>
          {filtered.map((i) => {
            const imIn = (i.executors || []).includes(currentUser.name);
            const canDelete = isLeader || (!i.anonymous && i.author === currentUser.name);
            return (
              <motion.div key={i.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="skh-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13.5 }}>{i.text}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--muted)" }}>&mdash; {i.anonymous ? "Anonymous" : i.author}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {canDelete && (
                      <button onClick={() => deleteIdea(i.id)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}><X size={14} /></button>
                    )}
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => upvote(i.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "var(--line)", border: "none", borderRadius: 10, padding: "6px 10px", color: "var(--ink)" }}>
                      <ArrowUp size={14} /><span style={{ fontSize: 12, fontWeight: 700 }}>{i.votes}</span>
                    </motion.button>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {i.executors?.length > 0 ? `${i.executors.length} ${i.executors.length === 1 ? "person" : "people"} in` : "Nobody signed up yet"}
                  </span>
                  <motion.button whileTap={{ scale: 0.92 }} onClick={() => toggleExecute(i.id)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "5px 10px", borderRadius: 8, border: imIn ? "1.5px solid var(--saffron)" : "1.5px solid var(--line)", background: imIn ? "rgba(217,164,65,0.12)" : "transparent", color: imIn ? "var(--saffron)" : "var(--muted)" }}>
                    <Rocket size={12} /> {imIn ? "I'm in" : "Want to execute this"}
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   PROFILE MODAL
--------------------------------------------------------------- */
function ProfileModal({ currentUser, setCurrentUser, setMembers, members, setProfileOpen, onLogout, teamPasscodes, setTeamPasscodes, teams, setTeams, rolesByTeam, setRolesByTeam, theme, setTheme, showToast, showUndoToast, feedbackNotes, setFeedbackNotes }) {
  const [name, setName] = useState(currentUser.name);
  const [role, setRole] = useState(currentUser.role);
  const [color, setColor] = useState(currentUser.color);
  const [email, setEmail] = useState(currentUser.email || "");

  const myTeam = teams.find((t) => t.id === currentUser.team);
  const [teamNameEdit, setTeamNameEdit] = useState(myTeam?.name || "");
  const [teamBlurbEdit, setTeamBlurbEdit] = useState(myTeam?.description || "");
  const [teamMottoEdit, setTeamMottoEdit] = useState(myTeam?.motto || "");
  const [teamSaved, setTeamSaved] = useState(false);

  const myNotes = (feedbackNotes || []).filter((n) => n.memberId === currentUser.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  useEffect(() => {
    if (myNotes.some((n) => !n.read)) {
      setFeedbackNotes((prev) => prev.map((n) => (n.memberId === currentUser.id ? { ...n, read: true } : n)));
      mutate("markNotesRead", { memberId: currentUser.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function deleteNote(id) {
    const removed = (feedbackNotes || []).find((n) => n.id === id);
    setFeedbackNotes((prev) => prev.filter((n) => n.id !== id));
    mutate("deleteNote", { id });
    showUndoToast?.("Note deleted", () => {
      if (removed) { setFeedbackNotes((prev) => [...prev, removed]); mutate("insertNote", removed); }
    });
  }

  const [newPasscode, setNewPasscode] = useState("");
  const [passcodeSaved, setPasscodeSaved] = useState(false);
  const [passcodeError, setPasscodeError] = useState("");

  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState(TEAM_SWATCHES.find((c) => !isTeamColorTaken(c, teams)) || TEAM_SWATCHES[0]);
  const [foundingMainName, setFoundingMainName] = useState("");
  const [foundingCoName, setFoundingCoName] = useState("");
  const [newTeamPasscode, setNewTeamPasscode] = useState("");
  const [teamAdded, setTeamAdded] = useState(false);

  const [roleTeamId, setRoleTeamId] = useState(teams[0]?.id || "");
  const [newRoleName, setNewRoleName] = useState("");
  const [roleAdded, setRoleAdded] = useState(false);

  const [promoteMemberId, setPromoteMemberId] = useState(members[0]?.id || "");
  const [promoteRole, setPromoteRole] = useState("");
  const [promoted, setPromoted] = useState(false);

  const canManageTeamSettings = currentUser.role === "Main" || currentUser.role === "Co";
  const colorConflict = isColorTaken(color, members, currentUser.id);

  function save() {
    if (colorConflict) return;
    const updated = { ...currentUser, name, role, color, email: email.trim() };
    setCurrentUser(updated);
    setMembers((prev) => prev.map((m) => (m.id === currentUser.id ? updated : m)));
    mutate("updateMember", updated);
    showToast?.("Profile updated");
    setProfileOpen(false);
  }
  function saveTeamInfo() {
    if (!teamNameEdit.trim()) return;
    const updatedTeam = { id: currentUser.team, name: teamNameEdit.trim(), color: myTeam.color, description: teamBlurbEdit, motto: teamMottoEdit };
    setTeams((prev) => prev.map((t) => (t.id === currentUser.team ? updatedTeam : t)));
    mutate("upsertTeam", updatedTeam);
    setTeamSaved(true);
    showToast?.("Team info saved");
  }
  function savePasscode() {
    if (newPasscode.trim().length < 4) { setPasscodeError("Passcode needs at least 4 characters."); setPasscodeSaved(false); return; }
    setTeamPasscodes((prev) => ({ ...prev, [currentUser.team]: newPasscode.trim() }));
    mutate("setPasscode", { teamId: currentUser.team, passcode: newPasscode.trim() });
    setPasscodeError(""); setNewPasscode(""); setPasscodeSaved(true);
    showToast?.("Passcode updated");
  }
  function addTeam() {
    if (!newTeamName.trim() || !foundingMainName.trim() || !foundingCoName.trim() || newTeamPasscode.trim().length < 4 || isTeamColorTaken(newTeamColor, teams)) return;
    let id = slugify(newTeamName);
    if (teams.some((t) => t.id === id)) id = id + "-" + Date.now().toString(36).slice(-4);
    const newTeam = { id, name: newTeamName.trim(), color: newTeamColor, description: "", motto: "" };
    const newRoles = ["Main", "Co", "Karyakar", "Admin", "PC"];
    setTeams((prev) => [...prev, newTeam]);
    setRolesByTeam((prev) => ({ ...prev, [id]: newRoles }));
    const c1 = SWATCHES.find((c) => !isColorTaken(c, members)) || SWATCHES[0];
    const mainMember = { id: "m-" + Date.now(), name: foundingMainName.trim(), team: id, role: "Main", color: c1, seva: "" };
    const c2 = SWATCHES.find((c) => !isColorTaken(c, [...members, mainMember])) || SWATCHES[1];
    const coMember = { id: "m-" + (Date.now() + 1), name: foundingCoName.trim(), team: id, role: "Co", color: c2, seva: "" };
    setMembers((prev) => [...prev, mainMember, coMember]);
    setTeamPasscodes((prev) => ({ ...prev, [id]: newTeamPasscode.trim() }));
    mutate("insertTeamFull", { team: newTeam, passcode: newTeamPasscode.trim(), roles: newRoles, mainMember, coMember });
    setNewTeamName(""); setFoundingMainName(""); setFoundingCoName(""); setNewTeamPasscode(""); setTeamAdded(true);
    showToast?.("Team created");
  }
  function promoteMember() {
    if (!promoteMemberId || !promoteRole) return;
    const target = members.find((m) => m.id === promoteMemberId);
    if (!target) return;
    const updated = { ...target, role: promoteRole };
    setMembers((prev) => prev.map((m) => (m.id === promoteMemberId ? updated : m)));
    if (promoteMemberId === currentUser.id) setCurrentUser((prev) => ({ ...prev, role: promoteRole }));
    mutate("updateMember", updated);
    setPromoted(true);
    showToast?.("Position updated");
  }
  function addRole() {
    const label = newRoleName.trim();
    if (!label || !roleTeamId) return;
    let updatedRoles = null;
    setRolesByTeam((prev) => {
      const existing = prev[roleTeamId] || [];
      if (existing.includes(label)) return prev;
      updatedRoles = [...existing, label];
      return { ...prev, [roleTeamId]: updatedRoles };
    });
    if (updatedRoles) mutate("setRoles", { teamId: roleTeamId, roles: updatedRoles });
    setNewRoleName(""); setRoleAdded(true);
    showToast?.("Position added");
  }

  return (
    <ModalShell onClose={() => setProfileOpen(false)} title="Profile & settings">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, padding: "10px 12px", background: "var(--line)", borderRadius: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}>
          {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />} Dark mode
        </span>
        <motion.button whileTap={{ scale: 0.94 }} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={{ width: 42, height: 24, borderRadius: 12, border: "none", background: theme === "dark" ? "var(--saffron)" : "var(--line)", position: "relative", cursor: "pointer" }}>
          <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }} style={{ position: "absolute", top: 2, left: theme === "dark" ? 20 : 2, width: 20, height: 20, borderRadius: "50%", background: "white" }} />
        </motion.button>
      </div>

      {myNotes.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3 }}>NOTES FROM YOUR LEADERSHIP</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {myNotes.map((n) => (
              <div key={n.id} className="skh-quote" style={{ position: "relative" }}>
                <button onClick={() => deleteNote(n.id)} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}><X size={13} /></button>
                <p style={{ margin: 0, paddingRight: 18, fontSize: 13, lineHeight: 1.5 }}>{n.text}</p>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted)" }}>{formatKeyShort(n.date)} &middot; only visible to you</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Name</label>
      <input className="skh-input" style={{ marginTop: 5, marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} />

      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Position</label>
      <input className="skh-input" style={{ marginTop: 5, marginBottom: 12 }} value={role} onChange={(e) => setRole(e.target.value)} />

      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Email (optional)</label>
      <p style={{ fontSize: 11, color: "var(--muted)", margin: "3px 0 6px" }}>For notifications, once those are turned on. Not required.</p>
      <input type="email" className="skh-input" style={{ marginBottom: 12 }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />

      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Highlight color</label>
      <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 6, flexWrap: "wrap" }}>
        {SWATCHES.map((c) => {
          const taken = isColorTaken(c, members, currentUser.id);
          return (
            <motion.button key={c} whileTap={!taken ? { scale: 0.85 } : {}} animate={{ scale: color === c ? 1.12 : 1 }} transition={{ type: "spring", stiffness: 450, damping: 16 }} onClick={() => !taken && setColor(c)} disabled={taken} style={{ position: "relative", width: 28, height: 28, borderRadius: "50%", background: c, border: color === c ? "3px solid var(--ink)" : "3px solid transparent", opacity: taken ? 0.28 : 1, cursor: taken ? "not-allowed" : "pointer" }}>
              {taken && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 13 }}>&times;</span>}
            </motion.button>
          );
        })}
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 28, height: 28, border: "none", borderRadius: "50%", padding: 0 }} />
      </div>
      {colorConflict && <p style={{ fontSize: 12, color: "#C97575", marginBottom: 10 }}>That color is already taken &mdash; pick another.</p>}

      <button className="skh-btn" style={{ width: "100%", justifyContent: "center", marginBottom: 18 }} onClick={save} disabled={colorConflict}>Save changes</button>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginBottom: 18 }}>
        <p style={{ margin: "0 0 4px", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3, display: "flex", alignItems: "center", gap: 6 }}>
          <Settings size={13} /> TEAM SETTINGS
        </p>
        {canManageTeamSettings ? (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "var(--muted)" }}>Only Main and Co Karyakars see this. Changes here are manual &mdash; no code needed, and they last for this session.</p>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Your team's name</label>
              <input className="skh-input" style={{ marginTop: 5, marginBottom: 8 }} value={teamNameEdit} onChange={(e) => { setTeamNameEdit(e.target.value); setTeamSaved(false); }} />
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Team blurb</label>
              <textarea className="skh-input" style={{ marginTop: 5, marginBottom: 8, minHeight: 60 }} value={teamBlurbEdit} onChange={(e) => { setTeamBlurbEdit(e.target.value); setTeamSaved(false); }} placeholder="A short description shown on your Roster tab" />
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Motto of the month</label>
              <textarea className="skh-input" style={{ marginTop: 5, marginBottom: 8, minHeight: 50 }} value={teamMottoEdit} onChange={(e) => { setTeamMottoEdit(e.target.value); setTeamSaved(false); }} placeholder="A quote or motto shown on your Calendar tab" />
              {teamSaved && <p style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600, marginBottom: 8 }}>Saved.</p>}
              <button className="skh-btn" style={{ width: "100%", justifyContent: "center" }} onClick={saveTeamInfo}>Save team info</button>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{myTeam?.name}'s passcode</label>
              <input className="skh-input" style={{ marginTop: 5, marginBottom: 10 }} value={teamPasscodes[currentUser.team] || ""} disabled />
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>New passcode for your team</label>
              <input className="skh-input" style={{ marginTop: 5, marginBottom: 8 }} value={newPasscode} onChange={(e) => { setNewPasscode(e.target.value); setPasscodeSaved(false); }} placeholder="At least 4 characters" />
              {passcodeError && <p style={{ margin: "0 0 8px", fontSize: 12, color: "#C97575" }}>{passcodeError}</p>}
              {passcodeSaved && <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--teal)", fontWeight: 600 }}>Passcode updated. Share it with your team only.</p>}
              <button className="skh-btn" style={{ width: "100%", justifyContent: "center" }} onClick={savePasscode}>Update passcode</button>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Add a new team</label>
              <input className="skh-input" style={{ marginTop: 5, marginBottom: 8 }} value={newTeamName} onChange={(e) => { setNewTeamName(e.target.value); setTeamAdded(false); }} placeholder="e.g. Yuvati Karyakar Team" />
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                {TEAM_SWATCHES.map((c) => {
                  const taken = isTeamColorTaken(c, teams);
                  return (
                    <button key={c} onClick={() => !taken && setNewTeamColor(c)} disabled={taken} style={{ position: "relative", width: 26, height: 26, borderRadius: "50%", background: c, border: newTeamColor === c ? "3px solid var(--ink)" : "3px solid transparent", opacity: taken ? 0.28 : 1, cursor: taken ? "not-allowed" : "pointer" }}>
                      {taken && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 12 }}>&times;</span>}
                    </button>
                  );
                })}
              </div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>Founding Main's name</label>
              <input className="skh-input" style={{ marginTop: 3, marginBottom: 8 }} value={foundingMainName} onChange={(e) => { setFoundingMainName(e.target.value); setTeamAdded(false); }} placeholder="e.g. Priyasha" />
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>Founding Co's name</label>
              <input className="skh-input" style={{ marginTop: 3, marginBottom: 8 }} value={foundingCoName} onChange={(e) => { setFoundingCoName(e.target.value); setTeamAdded(false); }} placeholder="e.g. Falguni" />
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>Passcode for this team</label>
              <input className="skh-input" style={{ marginTop: 3, marginBottom: 8 }} value={newTeamPasscode} onChange={(e) => { setNewTeamPasscode(e.target.value); setTeamAdded(false); }} placeholder="At least 4 characters" />
              {teamAdded && <p style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600, marginBottom: 8 }}>Team added, fully set up with a Main and Co already on the roster.</p>}
              <button className="skh-btn" style={{ width: "100%", justifyContent: "center" }} onClick={addTeam}><Plus size={15} /> Create team</button>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Add a position</label>
              <select className="skh-input" style={{ marginTop: 5, marginBottom: 8 }} value={roleTeamId} onChange={(e) => setRoleTeamId(e.target.value)}>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input className="skh-input" style={{ marginBottom: 8 }} value={newRoleName} onChange={(e) => { setNewRoleName(e.target.value); setRoleAdded(false); }} placeholder="e.g. Group 4 Karyakar" />
              {roleAdded && <p style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600, marginBottom: 8 }}>Position added to the dropdown.</p>}
              <button className="skh-btn" style={{ width: "100%", justifyContent: "center" }} onClick={addRole}><Plus size={15} /> Add position</button>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Manage members &mdash; promote or reassign</label>
              <p style={{ fontSize: 11, color: "var(--muted)", margin: "3px 0 8px" }}>This is the only way anyone becomes Main or Co &mdash; never by self-selecting at onboarding.</p>
              {members.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--muted)" }}>No members have joined yet.</p>
              ) : (
                <>
                  <select className="skh-input" style={{ marginBottom: 8 }} value={promoteMemberId} onChange={(e) => { setPromoteMemberId(e.target.value); setPromoteRole(""); setPromoted(false); }}>
                    {members.map((m) => {
                      const t = teams.find((tm) => tm.id === m.team);
                      return <option key={m.id} value={m.id}>{m.name} &middot; {t?.name || m.team} &middot; currently {m.role}</option>;
                    })}
                  </select>
                  <select className="skh-input" style={{ marginBottom: 8 }} value={promoteRole} onChange={(e) => { setPromoteRole(e.target.value); setPromoted(false); }}>
                    <option value="">Choose a new position</option>
                    {(rolesByTeam[members.find((m) => m.id === promoteMemberId)?.team] || []).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {promoted && <p style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600, marginBottom: 8 }}>Updated.</p>}
                  <button className="skh-btn" style={{ width: "100%", justifyContent: "center" }} onClick={promoteMember} disabled={!promoteRole}>Update position</button>
                </>
              )}
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>Passcode, teams, and position lists are managed by Main and Co Karyakars.</p>
        )}
      </div>

      <button className="skh-btn-ghost" style={{ width: "100%", justifyContent: "center", display: "flex", gap: 6, color: "#C97575", borderColor: "#F0D2D2" }} onClick={onLogout}>
        <LogOut size={15} /> Log out
      </button>
    </ModalShell>
  );
}

/* ---------------------------------------------------------------
   MODAL SHELL
--------------------------------------------------------------- */
function ModalShell({ children, onClose, title }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "absolute", inset: 0, background: "rgba(18,29,51,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 20 }}
      onClick={onClose}
    >
      <motion.div
        className="skh-card"
        style={{ width: "100%", borderRadius: "18px 18px 0 0", padding: 20, paddingTop: 10, maxHeight: "85%", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 34 }}
        drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(e, info) => { if (info.offset.y > 90) onClose(); }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--line)", margin: "0 auto 14px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} className="skh-btn-ghost" style={{ padding: "4px 8px" }}><X size={16} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
