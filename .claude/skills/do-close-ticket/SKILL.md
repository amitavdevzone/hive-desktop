---
name: do-close-ticket
description: Close out a finished ticket - verify every plan task is done, close the GitHub/GitLab issue, rebase-merge the branch into main (keeping every commit), update the wiki index, and archive the plan. Use when the user says "do-close-ticket", "/do-close-ticket", or asks to close / finish / merge the current ticket.
---

# do-close-ticket

Finish a ticket end to end. Stop at the first failed gate; never skip ahead.

## Steps

1. **Find the plan.** Same rule as do-work: run `git branch --show-current`. On a feature branch, find the plan in `docs/plans/` (not `archive/`) matching the branch's kebab name or its leading number (`Ticket:` line). If there is no single match (on `main`, detached, no match), ask the user for the plan number with `AskUserQuestion` (list `docs/plans/NNN-*.md`) and ask for the branch to merge if you are not on it.

2. **Gate: all tasks done.** Read the plan's `## Tasks`. If ANY item is `- [ ]`, list the open ones and **stop**. Do not close, merge or move anything. If there is no `## Tasks` section, stop and tell the user.

3. **Gate: clean tree.** `git status --short`. Uncommitted changes (other than files this skill will touch) -> ask the user whether to commit them to the branch first; do not discard anything.

4. **Find the ticket.** Read the plan's `Ticket:` line (`none` = no ticket). Detect host from `git remote get-url origin` (`github.com` -> `gh`, `gitlab` -> `glab`). If a ticket exists and the CLI works, remember the number; it is closed in step 7 only after the merge succeeds. If the CLI is missing, say so and continue.

5. **Merge into main (keep every commit).** Ask the user to confirm first, showing the branch and its commit count. Never squash.
   - **Preferred, when an open PR/MR exists for the branch and the CLI works:** make sure the branch is pushed (`git push`, no force), mark a draft ready (`gh pr ready` / `glab mr update --ready`), then `gh pr merge <n> --rebase` (GitHub) or `glab mr merge <n> --rebase` (GitLab). The host replays every commit onto main (linear, nothing force-pushed) and marks the PR merged. If the host reports conflicts or the rebase can't be done, do not resolve them yourself: tell the user and **stop**. Then `git switch main && git pull --ff-only`.
   - **Fallback, no PR/MR or no CLI:** `git switch main && git pull --ff-only` (skip the pull if no remote), `git switch <branch> && git rebase main`, then `git switch main && git merge --ff-only <branch>`. On conflicts run `git rebase --abort`, list the conflicting files, ask the user to fix them, and **stop**. If the branch is already on the remote, tell the user that pushing main is fine but the old branch is now diverged; don't force-push it.
   - Do NOT push `main` unless the user asks (the preferred path already updated the remote; the fallback needs a push, so offer it).

6. **Update the wiki.** Edit `docs/wiki/index.md` (create it if missing) based on the plan and the merged diff, keeping the file's existing structure and tone:
   - New feature -> add a new section.
   - Bug fix or behavior change to an existing feature -> update that feature's section in place.
   - Describe what the feature does and how to use it, not the implementation history. Link related wiki pages if any exist.

7. **Close the ticket.** `gh issue close <n> --comment "Merged to main in <short sha>"` (or `glab issue close <n>`). Skip if `Ticket: none`. If a PR/MR is open for the branch, it closes via the merge; if not auto-closed, close it too.

8. **Archive the plan.** Set `Status: done` in the plan, then `mkdir -p docs/plans/archive && git mv docs/plans/NNN-*.md docs/plans/archive/`.

9. **Commit the wiki + archive** to main as one commit: `docs: update wiki and archive plan NNN`. Don't push unless asked.

10. **Report**: gates passed, new head sha on main, ticket closed (or why skipped), wiki sections changed, archived plan path, and whether anything is unpushed. Offer to delete the merged branch (don't delete without a yes).

## Rules

- Never close the ticket, merge, or archive if any task is unchecked.
- Never squash. Never force-push, and never resolve merge conflicts silently.
- Never push to the remote without the user asking.
- Close the ticket only after the branch commits are on main.
