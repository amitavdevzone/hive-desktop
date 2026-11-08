import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router";
import { HiveLogo } from "@/components/HiveLogo";
import { getAutoSync, setAutoSync, syncNow } from "@/services/api";

/** Shared with pages through the router's outlet context. */
export type SyncControls = {
  auto: boolean;
  toggleAuto: () => void;
  syncing: boolean;
  sync: () => void;
};

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
  };

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
        <Link to="/notes" className="text-sm text-muted-foreground hover:text-primary">
          Notes
        </Link>
      </nav>
      <div className="min-h-0 flex-1">
        <Outlet context={{ auto, toggleAuto, syncing, sync } satisfies SyncControls} />
      </div>
    </div>
  );
}
