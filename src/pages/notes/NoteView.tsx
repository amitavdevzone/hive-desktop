import { useState } from "react";
import Markdown from "react-markdown";
import type { Note } from "@/services/api";

export function NoteView({ note }: { note: Note }) {
  const [preview, setPreview] = useState(true);
  const md = note.format === "markdown";
  return (
    <article className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">{note.title}</h2>
        {md && (
          <button
            onClick={() => setPreview(!preview)}
            className="text-sm text-primary hover:underline"
          >
            {preview ? "Edit" : "Preview"}
          </button>
        )}
      </div>
      {md && preview ? (
        <div className="space-y-2 text-sm text-foreground [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_ul]:list-disc [&_ul]:pl-5">
          <Markdown>{note.text}</Markdown>
        </div>
      ) : md ? (
        <textarea
          readOnly
          value={note.text}
          className="h-64 w-full rounded-md border border-border bg-input p-3 font-mono text-sm text-foreground"
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm text-foreground">{note.text}</p>
      )}
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {note.tags.map((t) => (
            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
