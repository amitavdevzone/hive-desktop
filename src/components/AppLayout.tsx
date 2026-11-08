import { Link, Outlet } from "react-router";
import { HiveLogo } from "@/components/HiveLogo";

export default function AppLayout() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <nav className="flex items-center gap-6 border-b border-border px-4 py-2">
        <Link to="/dashboard" aria-label="Dashboard">
          <HiveLogo className="h-8 w-8" />
        </Link>
        <Link
          to="/notes"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          Notes
        </Link>
      </nav>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
