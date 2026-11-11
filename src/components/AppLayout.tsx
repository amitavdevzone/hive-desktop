import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { HiveLogo } from "@/components/HiveLogo";
import { getAutoSync, refreshReminders, setAutoSync, syncNow } from "@/services/api";

/** Shared with pages through the router's outlet context. */
export type SyncControls = {
  auto: boolean;
  toggleAuto: () => void;
  syncing: boolean;
  sync: () => void;
};

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-primary"}`;

const SYNC_INTERVAL_MS = 2 * 60 * 1000;

export default function AppLayout() {
  const [auto, setAuto] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    getAutoSync().then(setAuto).catch(() => {});
  }, []);

  const sync = () => {
    setSyncing(true);
    // Failures are shown on the notes themselves (last_error); 401 routes to login.
    syncNow().catch(() => {}).finally(() => setSyncing(false));
    refreshReminders().catch(() => {});
  };

  // Fill the reminder cache on startup, independent of the notes auto-sync setting.
  useEffect(() => {
    refreshReminders().catch(() => {});
  }, []);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(sync, SYNC_INTERVAL_MS);
    return () => clearInterval(t);
  }, [auto]);

  const toggleAuto = () => {
    const next = !auto;
    setAuto(next);
    setAutoSync(next).catch(() => setAuto(!next));
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <nav className="flex items-center gap-8 border-b border-border px-6 py-3">
        <Link to="/dashboard" aria-label="Dashboard" className="flex items-center gap-3">
          <HiveLogo className="h-8 w-8" />
          <span className="text-lg font-semibold uppercase tracking-[0.2em] text-foreground">Hive</span>
        </Link>
        <NavLink to="/notes" className={navClass}>
          Notes
        </NavLink>
        <NavLink to="/reminders" className={navClass}>
          Reminders
        </NavLink>
      </nav>
      <div className="min-h-0 flex-1">
        <Outlet context={{ auto, toggleAuto, syncing, sync } satisfies SyncControls} />
      </div>
    </div>
  );
}
