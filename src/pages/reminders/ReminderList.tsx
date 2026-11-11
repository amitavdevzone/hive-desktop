import type { ReactNode } from "react";
import { Bell, CalendarDays, Pause, Pencil, RefreshCw, Trash2 } from "lucide-react";
import type { Reminder } from "@/services/api";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString(undefined, o);

export const summary = (r: Reminder) =>
  r.type === "once"
    ? `Once, ${r.remind_at ? fmt(new Date(r.remind_at), { dateStyle: "medium", timeStyle: "short" }) : "-"}`
    : `Every ${r.interval_minutes} min`;

/** "Today, 2:00 PM" or "Thu, Dec 3, 11:00 AM". */
const whenLabel = (iso: string) => {
  const d = new Date(iso);
  const time = fmt(d, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return `Today, ${time}`;
  return `${fmt(d, { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
};

const inLabel = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m < 1) return "in <1 min";
  if (m < 60) return `in ${m} min`;
  if (m < 1440) return `in ${Math.round(m / 60)} h`;
  return `in ${Math.round(m / 1440)} d`;
};

function Badge({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground [&_svg]:size-3.5">
      {icon}
      {children}
    </span>
  );
}

function ReminderRow({
  r,
  now,
  lastFired,
  onEdit,
  onToggle,
  onDelete,
}: {
  r: Reminder;
  now: number;
  lastFired?: string;
  onEdit: (r: Reminder) => void;
  onToggle: (r: Reminder) => void;
  onDelete: (r: Reminder) => void;
}) {
  let badge: ReactNode = null;
  if (!r.is_active) {
    badge = <Badge icon={<Pause />}>Paused</Badge>;
  } else if (r.type === "once" && r.remind_at) {
    badge = <Badge icon={<CalendarDays />}>{whenLabel(r.remind_at)}</Badge>;
  } else if (r.type === "recurring" && r.interval_minutes) {
    const next = Date.parse(lastFired ?? r.created_at) + r.interval_minutes * 60000;
    badge = <Badge icon={<RefreshCw />}>Next: {inLabel(next - now)}</Badge>;
  }
  const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-border transition-colors";
  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted",
          r.is_active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Bell className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{r.title}</div>
        <div className="text-sm text-muted-foreground">{summary(r)}</div>
      </div>
      {badge}
      <Switch checked={r.is_active} onCheckedChange={() => onToggle(r)} aria-label="Active" />
      <button className={cn(iconBtn, "text-foreground hover:bg-accent")} aria-label="Edit reminder" onClick={() => onEdit(r)}>
        <Pencil className="size-4" />
      </button>
      <button
        className={cn(iconBtn, "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20")}
        aria-label="Delete reminder"
        onClick={() => onDelete(r)}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

/** A titled group of reminders in one bordered container. Renders nothing when empty. */
export function ReminderSection({
  title,
  icon,
  right,
  reminders,
  ...rowProps
}: {
  title: string;
  icon: ReactNode;
  right?: ReactNode;
  reminders: Reminder[];
  now: number;
  lastFired: Record<number, string>;
  onEdit: (r: Reminder) => void;
  onToggle: (r: Reminder) => void;
  onDelete: (r: Reminder) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground [&_svg]:size-5">
          {icon}
          {title} ({reminders.length})
        </h2>
        {right}
      </div>
      {reminders.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {reminders.map((r) => (
            <ReminderRow key={r.id} r={r} {...rowProps} lastFired={rowProps.lastFired[r.id]} />
          ))}
        </ul>
      )}
    </section>
  );
}
