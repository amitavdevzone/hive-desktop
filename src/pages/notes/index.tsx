import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { listNotes, syncNow, type Note } from "@/services/api";
import { NoteList } from "./NoteList";
import { NoteView } from "./NoteView";

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(() => {
    listNotes().then(setNotes).catch(() => setNotes([]));
  }, []);

  useEffect(() => {
    load();
    // Pull on open; failures (offline) just leave the local list as is.
    syncNow().catch(() => {});
    const unlisten = listen("notes-changed", load);
    return () => {
      unlisten.then((f) => f());
    };
  }, [load]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  return (
    <main className="flex h-full">
      <aside className="w-[30%] overflow-y-auto border-r border-border">
        <NoteList notes={notes} selectedId={selectedId} onSelect={setSelectedId} />
      </aside>
      <section className="w-[70%] overflow-y-auto">
        {selected ? (
          <NoteView key={selected.id} note={selected} />
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Select a note.</p>
        )}
      </section>
    </main>
  );
}
