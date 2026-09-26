import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity, Bell, ChartColumn, ChevronDown, ClipboardCheck, HeartPulse, LayoutDashboard, NotebookPen, Pill, Radio,
  ScrollText, Settings, Siren, UserRound, Users, Sparkles, LogOut, Wifi, WifiOff, Smartphone,
} from "lucide-react";
import { useWard } from "../context/WardContext";
import { can, ROLE_LABEL } from "../access";
import { enablePhoneAlerts, resumePhoneAlerts } from "../push";
import { formatDay, greeting } from "../format";
import BrandLogo from "./BrandLogo";
import ThemeToggle from "./ThemeToggle";

const GROUPS = [
  ["Ward", [
    ["/app", "Overview", LayoutDashboard, true, "dashboard"],
    ["/app/patients", "Patients", Users, false, "patients"],
    ["/app/monitor", "Live Monitoring", HeartPulse, false, "monitor"],
    ["/app/ai", "AI Risk Prediction", Sparkles, false, "insights"],
    ["/app/alerts", "Alerts & Emergencies", Siren, false, "alerts"],
  ]],
  ["Care", [
    ["/app/caregivers", "Caregiver Management", UserRound, false, "caregivers"],
    ["/app/attendance", "Visit & Attendance", ClipboardCheck, false, "attendance"],
    ["/app/notes", "Patient Care Notes", NotebookPen, false, "notes"],
    ["/app/medications", "Medication & Reminders", Pill, false, "medications"],
  ]],
  ["System", [
    ["/app/reports", "Reports & History", ChartColumn, false, "reports"],
    ["/app/iot", "Device & IoT Simulator", Radio, false, "devices"],
    ["/app/audit", "Safety & Audit Logs", ScrollText, false, "audit"],
    ["/app/settings", "Settings", Settings, false, "settings"],
  ]],
];

export default function Shell() {
  const { state, user, logout, flash } = useWard();
  const navigate = useNavigate();
  const open = (state?.alerts || []).filter((alert) => !alert.acknowledged).length;
  const critical = (state?.patients || []).some((patient) => patient.risk.level === "high");
  const watch = (state?.patients || []).some((patient) => patient.risk.level === "medium");
  const overall = !state ? "healthy" : critical ? "critical" : watch || state.power.mode === "backup" || !state.internet ? "attention" : "healthy";

  useEffect(() => {
    if (!user) return;
    resumePhoneAlerts().catch(() => {});
  }, [user]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandLogo size={42} />
          <div><b>WardZero</b><small>Home hospital</small></div>
        </div>
        <nav className="nav">
          {GROUPS.map(([title, items]) => {
            const visible = items.filter((item) => can(user, item[4]));
            if (!visible.length) return null;
            return (
              <div className="nav-group" key={title}>
                <p>{title}</p>
                {visible.map(([to, label, Icon, end]) => (
                  <NavLink key={to} to={to} end={end}>
                    <Icon size={18} />
                    <span>{label}</span>
                    {to === "/app/alerts" && open > 0 ? <b className="badge">{open}</b> : null}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="side-foot">
          <strong>Home Ward Status</strong>
          <p>{user?.role === "caregiver" ? "Shared patient view" : state ? `${state.patients.length} patients monitored` : "Home ward"}</p>
          <span className={`pill ${overall === "healthy" ? "low" : overall === "attention" ? "medium" : "high"}`}>
            {overall === "healthy" ? "Healthy" : overall === "attention" ? "Attention" : "Critical"}
          </span>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <h1>{greeting(user?.name || "there")}</h1>
            <p>{formatDay()}</p>
          </div>
          <div className="top-actions">
            <Connection state={state} />
            <button className="icon-btn" onClick={() => navigate("/app/alerts")} aria-label="Alerts" title="Alerts">
              <Bell size={18} />
              {open > 0 ? <em>{open}</em> : null}
            </button>
            <AccountMenu
              user={user}
              onSignOut={() => { logout(); navigate("/"); }}
              onPhone={() => enablePhoneAlerts().then(() => flash("This phone will receive patient alerts.")).catch((err) => flash(err.message))}
            />
          </div>
        </header>
        <div className="content fade">
          {state ? <Outlet /> : <div className="card pad">{state === null ? "Connecting to the ward API…" : "Waiting for data"}</div>}
        </div>
      </div>
    </div>
  );
}

function AccountMenu({ user, onSignOut, onPhone }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const role = ROLE_LABEL[user?.role] || "User";

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="account" ref={ref}>
      <button type="button" className="account-chip" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>
        <div className="who">
          <div className="avatar">{user?.name?.[0] || "A"}</div>
          <div><b>{user?.name}</b><div className="muted">{role}</div></div>
        </div>
        <ChevronDown className="chev" size={16} />
      </button>
      {open ? (
        <div className="account-menu" role="menu">
          <div className="account-menu-head">
            <div className="avatar">{user?.name?.[0] || "A"}</div>
            <div>
              <b>{user?.name}</b>
              <div className="muted">{role}</div>
              {user?.email ? <small>{user.email}</small> : null}
            </div>
          </div>
          <button type="button" className="account-action" onClick={() => { setOpen(false); onPhone(); }}>
            <span><Smartphone size={16} /> Phone alerts</span>
          </button>
          <div className="account-action">
            <span>Appearance</span>
            <ThemeToggle />
          </div>
          <button type="button" className="account-signout" role="menuitem" onClick={onSignOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Connection({ state }) {
  if (!state) return null;
  const restored = state.internet && Date.now() - state.restoredAt < 30000 && state.lastSync.total > 0;
  if (!state.internet) return <span className="status-chip warn"><WifiOff size={14} /> OFFLINE MODE</span>;
  if (restored) return <span className="status-chip"><Wifi size={14} /> CONNECTION RESTORED</span>;
  return <span className="status-chip"><Activity size={14} /> Online</span>;
}
