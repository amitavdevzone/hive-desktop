import { useCallback, useEffect, useState } from "react";
import { Bell, CalendarDays, History, Pause, Plus, RefreshCw } from "lucide-react";
import {
  deleteReminder,
  listReminders,
  reminderLastFired,
  refreshReminders,
  updateReminder,
  type Reminder,
} from "@/services/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReminderSection } from "./ReminderList";
import { ReminderForm } from "./ReminderForm";

const DAY = 86_400_000;

function Stat({ icon, count, label, highlight }: { icon: React.ReactNode; count: number; label: string; highlight?: boolean }) {
  return (
    <div
      className={`flex min-w-36 items-center gap-3 rounded-xl border px-4 py-3 [&_svg]:size-5 ${
        highlight ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
      }`}
    >
      {icon}
      <div>
        <div className="text-base leading-tight font-semibold text-foreground">{count}</div>
        <div className="text-sm text-foreground">{label}</div>
      </div>
    </div>
  );
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [lastFired, setLastFired] = useState<Record<number, string>>({});
  const [now, setNow] = useState(Date.now());
  const [show, setShow] = useState<"all" | "active" | "paused">("all");
  const [windowDays, setWindowDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  // undefined = closed, null = adding, Reminder = editing
  const [deleting, setDeleting] = useState<Reminder | null>(null);
  const [editing, setEditing] = useState<Reminder | null | undefined>(undefined);

  const load = useCallback(() => {
    listReminders()
      .then((r) => {
        setReminders(r);
        setError(null);
      })
      .catch((e) => {
        setReminders((prev) => prev ?? []);
        setError(e?.message ?? String(e));
      });
    reminderLastFired().then(setLastFired).catch(() => {});
  }, []);

  useEffect(load, [load]);

  // Keeps "Next: in N min" fresh and picks up what the scheduler fired.
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      reminderLastFired().then(setLastFired).catch(() => {});
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  /** After any write: reload the list and refresh the scheduler's cache. */
  const changed = () => {
    load();
    refreshReminders().then(load).catch(() => {});
  };

  const list = reminders ?? [];
  const active = list.filter((r) => r.is_active);
  const at = (r: Reminder) => (r.remind_at ? Date.parse(r.remind_at) : 0);
  const futureOnce = active.filter((r) => r.type === "once" && at(r) >= now);
  const upcoming = futureOnce.filter((r) => windowDays === "all" || at(r) <= now + Number(windowDays) * DAY).sort((a, b) => at(a) - at(b));
  const past = active.filter((r) => r.type === "once" && at(r) < now);
  const recurring = active.filter((r) => r.type === "recurring");
  const paused = list.filter((r) => !r.is_active);

  const actions = {
    now,
    lastFired,
    onEdit: setEditing,
    onToggle: (r: Reminder) => updateReminder(r.id, { is_active: !r.is_active }).then(changed).catch(() => {}),
    onDelete: setDeleting,
  };
  const newButton = (
    <Button onClick={() => setEditing(null)}>
      <Plus /> New reminder
    </Button>
  );

  return (
    <main className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-foreground">Reminders</h1>
          <p className="text-sm text-muted-foreground">Get a desktop notification when it matters.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={show} onValueChange={(v) => setShow(v as typeof show)}>
            <SelectTrigger className="w-36 data-[size=default]:h-10">
              Show: <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>
          {newButton}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {reminders && list.length === 0 && !error ? (
          <div className="flex flex-col items-center gap-2 pt-16 text-center">
            <Bell className="mb-2 size-14 text-primary" strokeWidth={1.5} />
            <p className="text-xl font-semibold text-foreground">No reminders yet.</p>
            <p className="mb-3 max-w-sm text-sm text-muted-foreground">
              Create your first reminder to get desktop notifications at the right time.
            </p>
            {newButton}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <Stat highlight icon={<Bell />} count={active.length} label="Active" />
              <Stat icon={<Pause />} count={paused.length} label="Paused" />
              <Stat icon={<RefreshCw />} count={recurring.length} label="Recurring" />
              <Stat icon={<CalendarDays />} count={futureOnce.length} label="Upcoming" />
            </div>
            {show !== "paused" && (
              <>
                {(upcoming.length > 0 || futureOnce.length > 0) && (
                  <ReminderSection
                    title="Upcoming"
                    icon={<CalendarDays />}
                    reminders={upcoming}
                    right={
                      <Select value={windowDays} onValueChange={setWindowDays}>
                        <SelectTrigger className="w-36 border-0 bg-transparent text-muted-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">Next 7 days</SelectItem>
                          <SelectItem value="30">Next 30 days</SelectItem>
                          <SelectItem value="all">All upcoming</SelectItem>
                        </SelectContent>
                      </Select>
                    }
                    {...actions}
                  />
                )}
                {recurring.length > 0 && <ReminderSection title="Recurring" icon={<RefreshCw />} reminders={recurring} {...actions} />}
                {past.length > 0 && <ReminderSection title="Past" icon={<History />} reminders={past} {...actions} />}
              </>
            )}
            {show !== "active" && paused.length > 0 && (
              <ReminderSection title="Paused" icon={<Pause />} reminders={paused} {...actions} />
            )}
          </>
        )}
      </div>

      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit reminder" : "New reminder"}</DialogTitle>
          </DialogHeader>
          <ReminderForm
            key={editing?.id ?? "new"}
            reminder={editing ?? undefined}
            onCancel={() => setEditing(undefined)}
            onSaved={() => {
              setEditing(undefined);
              changed();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleting?.title}"?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const r = deleting;
                setDeleting(null);
                if (r) deleteReminder(r.id).then(changed).catch(() => {});
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
