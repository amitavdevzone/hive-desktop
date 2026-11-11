import { useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import { createReminder, updateReminder, type ApiError, type Reminder, type ReminderInput } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** `<input type="datetime-local">` value (local time) <-> ISO 8601 with offset. */
const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toIsoWithOffset = (local: string) => {
  const d = new Date(local);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `${local}:00${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
};

const Req = () => <span className="text-destructive"> *</span>;

/** One form for add and edit: pass `reminder` to edit. */
export function ReminderForm({
  reminder,
  onSaved,
  onCancel,
}: {
  reminder?: Reminder;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(reminder?.title ?? "");
  const [notes, setNotes] = useState(reminder?.notes ?? "");
  const [type, setType] = useState<Reminder["type"]>(reminder?.type ?? "once");
  const [remindAt, setRemindAt] = useState(toLocalInput(reminder?.remind_at ?? null));
  const [interval, setInterval] = useState(String(reminder?.interval_minutes ?? ""));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setFieldErrors({ title: ["Title is required."] });
    setSaving(true);
    setError(null);
    setFieldErrors({});
    // The API rejects `null` for the field that doesn't apply, so omit it on
    // create. On edit, null it only when the type changed (to clear the old one).
    const switched = reminder && reminder.type !== type;
    const body: ReminderInput = { title, notes: notes || null, type };
    if (type === "once") {
      if (remindAt) body.remind_at = toIsoWithOffset(remindAt);
      if (switched) body.interval_minutes = null;
    } else {
      if (interval) body.interval_minutes = Number(interval);
      if (switched) body.remind_at = null;
    }
    (reminder ? updateReminder(reminder.id, body) : createReminder(body))
      .then(onSaved)
      .catch((err: ApiError) => {
        setFieldErrors(err.errors ?? {});
        setError(err.message ?? String(err));
        setSaving(false);
      });
  };

  // Fields on screen; an error keyed on anything else still has to be visible.
  const shownKeys = ["title", "notes", "type", type === "once" ? "remind_at" : "interval_minutes"];

  const fieldError = (k: string) =>
    fieldErrors[k] && <p className="text-xs text-destructive">{fieldErrors[k][0]}</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="r-title">Title<Req /></Label>
        <Input id="r-title" placeholder="e.g. Drink water" aria-invalid={!!fieldErrors.title} value={title} onChange={(e) => setTitle(e.target.value)} />
        {fieldError("title")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-notes">Notes</Label>
        <Textarea id="r-notes" placeholder="Add a short note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {fieldError("notes")}
      </div>
      <div className="space-y-1.5">
        <Label>Type<Req /></Label>
        <Select value={type} onValueChange={(v) => setType(v as Reminder["type"])}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="once">
              <CalendarDays /> Once
            </SelectItem>
            <SelectItem value="recurring">
              <RefreshCw /> Recurring
            </SelectItem>
          </SelectContent>
        </Select>
        {fieldError("type")}
      </div>
      {type === "once" ? (
        <div className="space-y-1.5">
          <Label htmlFor="r-at">Remind at<Req /></Label>
          <Input id="r-at" type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
          {fieldError("remind_at")}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="r-int">Every (minutes)<Req /></Label>
          <Input id="r-int" type="number" min={1} value={interval} onChange={(e) => setInterval(e.target.value)} />
          {fieldError("interval_minutes")}
        </div>
      )}
      {error && !shownKeys.some((k) => fieldErrors[k]) && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {reminder ? "Save" : "Add reminder"}
        </Button>
      </div>
    </form>
  );
}
