---
name: do-plan
description: Turn a finished planning conversation into a plan document in docs/plans and a matching GitHub or GitLab ticket, optionally with a branch and merge request. Use when the user says "do-plan", "/do-plan", or asks to write up / file the plan we just agreed on.
---

# do-plan

Convert the planning already done in this conversation into (1) a plan file, (2) a ticket, and optionally (3) a branch + merge request. Do not re-plan; capture what was agreed. Archiving plans is NOT part of this skill.

## Steps

1. **Gather context.** Use the conversation as the source. Read `docs/architecture/index.md` and the files it links to, if they exist. Plan decisions must respect them. If the plan conflicts with one, stop and ask the user which wins.

2. **Draft requirements and acceptance criteria.** Requirements: what must be built, in plain bullets. Acceptance criteria: a numbered list of concrete, verifiable statements (`AC1`, `AC2`, ...), each phrased so it can become a test case.

3. **Grill on ambiguity.** For every acceptance criterion that is vague, untestable, or missing edge cases (errors, empty states, auth expiry, limits), ask the user with `AskUserQuestion` (1-4 questions per call, 2-4 options each, recommended option first). Repeat until every criterion is testable. Don't ask about things already decided in the conversation.

4. **Pick the plan number.** List `docs/plans/` and `docs/plans/archive/`, take the highest `NNN` across both, add 1, zero-pad to 3 digits. Create `docs/plans/` if missing. File name: `docs/plans/NNN-kebab-case-name.md`. Plan number and ticket number are independent.

5. **Confirm the ticket.** Show the user the title and summary of what will be filed and the host it will go to, then ask with `AskUserQuestion` whether to create it. Do not create the ticket without a yes. If they decline, set `Ticket: none`.

6. **Create the ticket** (only after confirmation) before writing the file so the ID can go on top.
   - Detect host: `git remote get-url origin`. Contains `github.com` -> `gh issue create`. Contains `gitlab` -> `glab issue create`. Otherwise (no remote, or the CLI is missing / not authenticated) skip the ticket, say why, and put `Ticket: none` in the plan.
   - Title = plan title. Body = summary, requirements, acceptance criteria, and the plan file path. Pass the body via `--body-file` / `--description` from a temp file, not inline shell quoting.
   - Capture the issue number/URL from the CLI output.

7. **Write the plan file** using the template below.

8. **Offer branch + merge request.** Ask with `AskUserQuestion`: "Create a branch and merge request for this ticket and switch to it?" Goal: development happens on a branch, never on the default branch. If yes:
   - Check `git status`. If there are unrelated uncommitted changes, tell the user and ask before continuing.
   - Create and switch: `git switch -c <NNN>-<kebab-name>` (prefix with the ticket number if there is one, e.g. `123-kebab-name`), branched from the current default branch.
   - Commit only the plan file (message: `Add plan NNN: <title>`), then `git push -u origin <branch>`. A merge request needs at least one commit, and the plan is that commit.
   - Open a **draft** request: `gh pr create --draft` (GitHub) or `glab mr create --draft` (GitLab). Title = plan title, body links the ticket (`Closes #123`) and the plan file. Use a body file, not inline quoting.
   - Leave the user checked out on the new branch.
   - If the remote/CLI is missing, create and switch to the local branch only and say what was skipped.
   If no: stay on the current branch, but if it is the default branch (`main`/`master`), remind the user once to branch before developing.

9. **Report**: plan path, ticket URL, branch and MR URL (if created), and any open questions left.

## Plan template

```markdown
# <Plan title>

Ticket: <#123 or full URL, or "none">
Status: planned
Date: <YYYY-MM-DD>

## Summary
<2-3 sentences: what and why.>

## Requirements
- ...

## Acceptance criteria
1. AC1: ...
2. AC2: ...

## Test cases
<One or more per AC, e.g. "AC1 -> Given ..., when ..., then ...">

## Architectural decisions
<Decisions made during planning, each with a one-line reason. Note which existing docs/architecture decisions apply.>

## Out of scope
- ...

## Open questions
- ... (or "none")
```

## Rules

- Never invent requirements the conversation didn't contain; put doubts under Open questions.
- Don't ask the ticket-confirmation question until the acceptance-criteria questions in step 3 are done.
- Never create a ticket, branch, commit, push, or MR without the user's confirmation in this run.
- Only commit the plan file; never `git add -A`. Never push to the default branch.
