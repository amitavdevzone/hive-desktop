import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router";
import { Loader2, RefreshCw } from "lucide-react";
import { HiveLogo } from "@/components/HiveLogo";
import { Button } from "@/components/ui/button";
import { getAutoSync, setAutoSync, syncNow } from "@/services/api";

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
      <nav className="flex items-center gap-6 border-b border-border px-4 py-2">
        <Link to="/dashboard" aria-label="Dashboard">
          <HiveLogo className="h-8 w-8" />
        </Link>
        <Link to="/notes" className="text-sm text-muted-foreground hover:text-primary">
          Notes
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleAuto}>
            Auto sync: {auto ? "on" : "off"}
          </Button>
          <Button size="sm" onClick={sync} disabled={syncing}>
            {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync
          </Button>
        </div>
      </nav>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
