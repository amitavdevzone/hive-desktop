import { CloudUpload, FileText } from "lucide-react";
import type { Note } from "@/services/api";
import { cn } from "@/lib/utils";

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function NoteList({
  notes,
  selectedId,
  onSelect,
}: {
  notes: Note[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (notes.length === 0) {
    return <p className="p-2 text-sm text-muted-foreground">No notes yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {notes.map((n) => (
        <li key={n.id}>
          <button
            onClick={() => onSelect(n.id)}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-accent",
              n.id === selectedId && "border-primary bg-primary/10",
            )}
          >
            <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{n.title}</div>
              <div className="text-xs text-muted-foreground">{formatDate(n.updated_at)}</div>
              {n.status !== "synced" && (
                <div
                  className={cn(
                    "mt-1 flex items-center gap-1 text-xs",
                    n.last_error ? "text-destructive" : "text-primary",
                  )}
                  title={n.last_error ?? undefined}
                >
                  <CloudUpload className="size-3.5 shrink-0" />
                  <span className="truncate">Unsynced{n.last_error && `: ${n.last_error}`}</span>
                </div>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
