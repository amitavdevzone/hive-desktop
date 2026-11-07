# Architecture

## UI components

- Use shadcn/ui (Radix base, Tailwind v4) for UI primitives. Add them with `npx shadcn@latest add <name>`; they land in `src/components/ui/`.
- Theme tokens live in `src/index.css` and mirror `design.md` (dark only). Change colours there, never per component.
- Don't hand-roll primitives shadcn already provides (dialog, dropdown, tooltip, etc.). Custom shared pieces go in `src/components/`.
- Brand pieces (logo, honeycomb backgrounds) are custom.

## Design decisions

Any design decision (UI, layout, colour, typography, components, spacing, interaction) must follow [design.md](design.md), the HIVE UI Design & Style Guide.

- Read `design.md` before making or proposing a design decision.
- If a decision isn't covered there, choose what fits its direction (modern, minimal, dark developer tool) and update `design.md` so the gap is closed.
- If a decision conflicts with `design.md`, don't override it silently. Raise it with the user and change `design.md` first if the conflict is intentional.
