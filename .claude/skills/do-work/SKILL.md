---
name: do-work
description: Work on the next incomplete to-do item of a plan in docs/plans, mark it done, then stop for review. Use when the user says "do-work", "/do-work", or asks to continue / pick up the next task from the plan.
---

# do-work

Do exactly ONE task from a plan per run, then stop.

## Steps

1. **Find the plan.**
   - Run `git branch --show-current`.
   - On a feature branch (not `main`/`master`, not detached): branch names look like `<ticket>-<kebab-name>` or `<NNN>-<kebab-name>`. Find the plan in `docs/plans/` (not `archive/`) whose file name matches the kebab part of the branch, or whose `Ticket:` line matches the branch's leading number. If exactly one matches, use it.
   - Otherwise (default branch, detached HEAD, or no match): ask the user for the plan number with `AskUserQuestion` (list the available `docs/plans/NNN-*.md` as options), then use that plan. Ask again every run; never remember it.

2. **Read** the plan, `AGENTS.md` and `docs/architecture/index.md` (and what it links). Work must follow them.

3. **Pick the task.** The plan's `## Tasks` section is a checklist (`- [ ]` / `- [x]`). Take the FIRST `- [ ]` item. If the plan has no `## Tasks` section, tell the user to add one (or re-run do-plan) and stop.
   - If every item is `- [x]`: say "All tasks in plan NNN are done." and stop. Do nothing else.

4. **Do only that task.** Read the relevant code first. Do not start the next task, even if it looks small. Run the checks AGENTS.md requires (`cargo check`, frontend build) when the task touches that side.

5. **Mark it done.** Change that item to `- [x]` in the plan file. Don't edit other items.

6. **Stop and wait for review.** Report: the task, files changed, checks run and their result, and the next incomplete task (title only). Do NOT commit or push unless the user asks.

## Rules

- One task per run. Never continue to the next without a new invocation.
- Never mark a task done if its checks fail; report the failure and leave it unchecked.
- Don't add dependencies or change `tauri.conf.json` permissions without asking (AGENTS.md).
