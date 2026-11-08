import { useEffect, useRef, useState } from "react";
import { CloudUpload, FileText, Trash2 } from "lucide-react";
import { saveNote, type Note } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MarkdownEditor } from "./MarkdownEditor";
import { formatDate } from "./NoteList";
import { TagInput } from "./TagInput";

/** Edits a note, saving to SQLite after a short pause. Remount (key) per note. */
export function NoteForm({
  note,
  onSaved,
  onDelete,
}: {
  note: Note;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [text, setText] = useState(note.text);
  const [format, setFormat] = useState(note.format);
  const [tags, setTags] = useState(note.tags);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const latest = useRef({ id: note.id, title, text, format, tags });
  const pending = useRef(false);
  const timer = useRef<number>(undefined);

  const flush = () => {
    window.clearTimeout(timer.current);
    if (!pending.current) return;
    pending.current = false;
    saveNote(latest.current)
      .then(() => {
        setError(null);
        onSaved();
      })
      .catch((e) => setError(String(e)));
  };

  const edit = <T,>(set: (v: T) => void, key: keyof typeof latest.current) => (v: T) => {
    set(v);
    (latest.current as Record<string, unknown>)[key] = v;
    pending.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 500);
  };

  // Save any pending edit when switching notes or leaving the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => flush, []);

  const md = format === "markdown";
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <FileText className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-11"
            value={title}
            onChange={(e) => edit(setTitle, "title")(e.target.value)}
            placeholder="Title"
          />
        </div>
        <Select
          value={format}
          onValueChange={(v) => {
            edit(setFormat, "format")(v as Note["format"]);
          }}
        >
          <SelectTrigger className="w-40 data-[size=default]:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plain">Plain</SelectItem>
            <SelectItem value="markdown">Markdown</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="destructive" size="icon" className="size-10" aria-label="Delete note" onClick={() => setConfirm(true)}>
          <Trash2 />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card">
        {md ? (
          <div className="min-h-0 flex-1 basis-0 space-y-2 overflow-y-auto p-6 font-serif text-base text-foreground [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none [&_code]:font-[inherit] [&_h1]:mt-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mt-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-xl [&_h3]:font-semibold [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_hr]:my-4 [&_hr]:border-border [&_ul]:list-disc [&_ul]:pl-5">
            <MarkdownEditor key={format} initial={text} onChange={edit(setText, "text")} />
          </div>
        ) : (
          <Textarea
            className="min-h-0 flex-1 resize-none rounded-2xl border-0 bg-transparent p-6 font-mono shadow-none focus-visible:ring-0"
            value={text}
            onChange={(e) => edit(setText, "text")(e.target.value)}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3 text-sm">
          <div className="flex items-center gap-3 text-muted-foreground">
            {note.status !== "synced" && (
              <>
                <span className={note.last_error ? "flex items-center gap-1.5 text-destructive" : "flex items-center gap-1.5 text-primary"}>
                  <CloudUpload className="size-4" />
                  Unsynced{note.last_error && `: ${note.last_error}`}
                </span>
                <span className="h-4 w-px bg-border" />
              </>
            )}
            <span>Last updated: {formatDate(note.updated_at)}</span>
            {error && <span className="text-destructive">{error}</span>}
          </div>
          <TagInput tags={tags} onChange={edit(setTags, "tags")} />
        </div>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this note?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                pending.current = false; // don't resurrect it on unmount
                window.clearTimeout(timer.current);
                onDelete();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
