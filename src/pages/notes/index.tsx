import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { listen } from "@tauri-apps/api/event";
import { Cloud, Loader2, Plus, RefreshCw } from "lucide-react";
import { createNote, deleteNote, listNotes, syncNow, type Note } from "@/services/api";
import { Button } from "@/components/ui/button";
import type { SyncControls } from "@/components/AppLayout";
import { NoteList } from "./NoteList";
import { NoteForm } from "./NoteForm";

export default function NotesPage() {
  const { auto, toggleAuto, syncing, sync } = useOutletContext<SyncControls>();
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

  const selected = notes.find((n) => n.id === selectedId) ?? notes[0] ?? null; // default: newest

  return (
    <main className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-foreground">Notes</h1>
          <p className="text-sm text-muted-foreground">Capture ideas, logs and everything in between.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={toggleAuto}>
            <Cloud className={auto ? "text-green-500" : "text-muted-foreground"} />
            Auto sync: {auto ? "On" : "Off"}
          </Button>
          <Button onClick={sync} disabled={syncing}>
            {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <aside className="flex w-[20%] min-w-52 flex-col gap-3">
          <Button className="w-full" onClick={onNew}>
            <Plus /> New note
          </Button>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <NoteList notes={notes} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          </div>
        </aside>
        <section className="min-w-0 flex-1">
          {selected ? (
            <NoteForm key={selected.id} note={selected} onSaved={load} onDelete={() => onDelete(selected.id)} />
          ) : (
            <p className="p-2 text-sm text-muted-foreground">Select a note.</p>
          )}
        </section>
      </div>
    </main>
  );
}
