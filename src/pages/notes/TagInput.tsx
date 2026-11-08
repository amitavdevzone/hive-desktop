import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { listTagNames } from "@/services/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [known, setKnown] = useState<string[]>([]);

  useEffect(() => {
    if (open) listTagNames().then(setKnown).catch(() => {});
  }, [open]);

  const add = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setQuery("");
    setOpen(false);
  };
  const suggestions = known.filter((k) => !tags.includes(k) && k.includes(query.trim().toLowerCase()));

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {tags.map((t) => (
        <span
          key={t}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm text-foreground"
        >
          {t}
          <button aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <Plus className="size-3.5" /> Add tag
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Tag name…"
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  e.preventDefault();
                  add(query);
                }
              }}
            />
            <CommandList>
              <CommandEmpty>Enter to add “{query.trim()}”</CommandEmpty>
              <CommandGroup>
                {suggestions.map((k) => (
                  <CommandItem key={k} value={k} onSelect={() => add(k)}>
                    {k}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
