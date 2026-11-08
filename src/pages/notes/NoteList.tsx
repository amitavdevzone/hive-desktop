import type { Note } from "@/services/api";
import { cn } from "@/lib/utils";

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
    return <p className="p-4 text-sm text-muted-foreground">No notes yet.</p>;
  }
  return (
    <ul>
      {notes.map((n) => (
        <li key={n.id}>
          <button
            onClick={() => onSelect(n.id)}
            className={cn(
              "w-full border-b border-border px-4 py-3 text-left hover:bg-accent",
              n.id === selectedId && "bg-accent",
            )}
          >
            <div className="truncate text-sm font-medium text-foreground">{n.title}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(n.updated_at).toLocaleString()}
              {n.status !== "synced" && " · unsynced"}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
