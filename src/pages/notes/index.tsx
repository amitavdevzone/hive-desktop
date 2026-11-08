import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { createNote, deleteNote, listNotes, syncNow, type Note } from "@/services/api";
import { Button } from "@/components/ui/button";
import { NoteList } from "./NoteList";
import { NoteForm } from "./NoteForm";

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

  const onNew = () =>
    createNote().then((n) => {
      setSelectedId(n.id);
      load();
    });

  const onDelete = (id: number) =>
    deleteNote(id).then(() => {
      setSelectedId(null);
      load();
    });

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  return (
    <main className="flex h-full">
      <aside className="w-[20%] overflow-y-auto border-r border-border">
        <div className="border-b border-border p-2">
          <Button className="w-full" onClick={onNew}>
            New note
          </Button>
        </div>
        <NoteList notes={notes} selectedId={selectedId} onSelect={setSelectedId} />
      </aside>
      <section className="w-[80%] overflow-y-auto">
        {selected ? (
          <NoteForm key={selected.id} note={selected} onSaved={load} onDelete={() => onDelete(selected.id)} />
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Select a note.</p>
        )}
      </section>
    </main>
  );
}
