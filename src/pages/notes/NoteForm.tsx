import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { saveNote, type Note } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [preview, setPreview] = useState(note.format === "markdown");
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
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex gap-2">
        <Input value={title} onChange={(e) => edit(setTitle, "title")(e.target.value)} placeholder="Title" />
        <Select
          value={format}
          onValueChange={(v) => {
            edit(setFormat, "format")(v as Note["format"]);
            setPreview(v === "markdown");
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plain">Plain</SelectItem>
            <SelectItem value="markdown">Markdown</SelectItem>
          </SelectContent>
        </Select>
        {md && (
          <Button variant="outline" onClick={() => setPreview(!preview)}>
            {preview ? "Edit" : "Preview"}
          </Button>
        )}
        <Button variant="destructive" onClick={() => setConfirm(true)}>
          Delete
        </Button>
      </div>

      {md && preview ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto text-sm text-foreground [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_ul]:list-disc [&_ul]:pl-5">
          <Markdown>{text}</Markdown>
        </div>
      ) : (
        <Textarea
          className="min-h-0 flex-1 font-mono"
          value={text}
          onChange={(e) => edit(setText, "text")(e.target.value)}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <TagInput tags={tags} onChange={edit(setTags, "tags")} />

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
