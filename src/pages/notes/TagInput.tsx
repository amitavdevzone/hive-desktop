import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { listTagNames } from "@/services/api";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
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
  };
  const suggestions = known.filter((k) => !tags.includes(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
          {t}
          <button aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="w-40">
            <Command shouldFilter>
              <CommandInput
                placeholder="Add tag…"
                value={query}
                onValueChange={setQuery}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim()) {
                    e.preventDefault();
                    add(query);
                  }
                }}
              />
            </Command>
          </div>
        </PopoverAnchor>
        <PopoverContent className="w-40 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Command>
            <CommandList>
              <CommandEmpty>Enter to add “{query.trim()}”</CommandEmpty>
              <CommandGroup>
                {suggestions
                  .filter((k) => k.includes(query.trim().toLowerCase()))
                  .map((k) => (
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
