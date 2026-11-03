# Knode Games — Session End Process

> **Purpose:** what every AI session does before it ends, so the next session (or another chat) can pick up without guessing.
> **Applies to:** every chat — platform, game, audit, bug fixing, architecture, library.
> **Last updated:** 2026-11-03 · Starter prompts and shared rules: `../standards/AI_CHAT_STARTER.md`.

## When
- A piece of work is finished, or a PR is opened.
- The owner says "wrap up", or the chat is close to running out of context.
- Before any long pause (e.g. waiting on an audit or a timelock).

## Steps
1. **Check the facts.** Use `git status`, the branch and commit, open PRs, and the last workflow runs. Report only what you checked. Mark the rest ❓.
2. **Make sure nothing is half-done.** No unsent dry run is left looking "done". No PR is called merged unless it is. No secret was printed.
3. **Write the session-end report** (below) as your last message.
4. **The owner pastes it into the library chat.** That chat files it into `.ai/` in one docs PR. If the owner asks, save it to the Claude project as `claude/<area>/HANDOFF-<yyyy-mm-dd>.md` too.
   - **Two kinds of saved notes, two names:** a session-end report is `claude/<area>/HANDOFF-<yyyy-mm-dd>.md`. Instructions one chat leaves for another (the older style, e.g. `claude/handoff-sponsor-v6-day.md`) keep `claude/handoff-<topic>.md`.
5. **The next session** starts with its starter prompt (`AI_CHAT_STARTER.md` §3) plus this report.

## The session-end report
Keep it short: one line per item, plain words, with D-/I-/PR numbers.

```
SESSION END — <chat name> — <date, time UTC>
Area / branch / PR: <e.g. Survivor · survivor @ a8a1979 · PR #NN open, not merged>

1. What changed
   - <files, branches, PRs, chain sends, settings — what is different now than at the start>
2. What was completed
   - <finished and verified: tests passing, PR merged by the owner, send confirmed on chain>
   - Not finished: <what's left and where it stands>
3. Documentation to update
   - <.ai/ file → what's now wrong or missing (e.g. CURRENT_STATE: Survivor PR open; OPENISSUES: I-050 partly done)>
   - Proposed decisions: <D-xxx with the owner's words and date, or "none">
   - Proposed issues: <I-xxx, priority P1–P4, owner, or "none">
4. What the next AI should know
   - <context that isn't in the docs yet: gotchas, half-made choices, commands that worked or failed>
   - Owner actions waiting: <steps with dates and deadlines>
   - Needs from other chats: <chat → exact request, or "none">
5. Current blockers
   - <what stops progress, who can unblock it, by when — or "none">
```

## Rules
- **Facts only.** Don't present guesses as done; mark ✅ verified · 💬 from a chat · 👤 owner said · ❓ unknown.
- **Never include keys, seed phrases or `.env` contents** in a report.
- **Don't edit other areas' docs yourself.** List them under item 3. The library chat makes the changes.
- **One report per session.** If the session covered two areas, make one section per area.
