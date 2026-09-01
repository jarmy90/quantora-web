# FREEBUFF_WORKFLOW.md · Quantora

Permanent operating and delivery protocol for Freebuff sessions in `jarmy90/quantora-web`.

## 1. Mandatory session start

At the beginning of every Quantora session, Freebuff must:

1. Read this file in full.
2. Read `MASTER.md`, if present.
3. Read the continuity documents specified by Javier.
4. Read `docs/COMMERCIAL_ROADMAP.md`.
5. Check the real repository state with Git.
6. Identify the active branch, HEAD, `origin/main`, and untracked files.
7. Separate clearly what is implemented, validated, pending, designed, desired, and blocked.
8. Never assume status from old documents.
9. Never invent data, metrics, slugs, deployments, validations, or functions.
10. Continue from the actual repository state, not incomplete memory.

## 2. Source of truth

- Git and the code are the technical source of truth.
- `docs/COMMERCIAL_ROADMAP.md` is the source of truth for commercial phases.
- `MASTER.md` is the living continuity document.
- Earlier reports are historical evidence and may be outdated.
- Before claiming something is implemented, deployed, merged, or validated, verify it.
- Local validation is not automatically CI-green.
- A pushed branch is not a created PR.
- A created PR is not a merged PR.
- A commit is not a production deployment.

## 3. Git working rules

- Work through branches and Pull Requests.
- Do not modify `main` directly.
- Do not force-push.
- Do not perform destructive resets.
- Do not merge without explicit authorization.
- Do not delete reference branches without authorization.
- Do not accidentally include local continuity files or reports.
- Review `git status` before and after changes.
- Run `git diff --check`.
- Check for secrets.
- Keep one scope per PR.
- Do not mix QNT phases.
- Do not renumber the roadmap.
- If a specifically authorized future deployment is required: commit, push, create or merge according to authorization, deploy, verify the real URL, and report the result.
- If deployment is not authorized, do not deploy.

## 4. Quantora safety and truthfulness

- Backtest is not demo.
- Demo is not a real account.
- Demo monitoring is not verified live.
- Internal review is not independent validation.
- Never invent balances, equity, trades, returns, or connections.
- Never promote a strategy to `quantora_validated` without an explicit editorial decision.
- Never expose credentials, tokens, keys, complete account identifiers, or passwords.
- Do not write to live Supabase without authorization.
- Do not run live migrations without authorization.
- Checkout, payments, licenses, and downloads are activated only in authorized phases.
- Secrets belong only on the server or in secure systems.
- Do not set prices or revenue shares without Javier's decision.
- Do not present future functionality as available.

## 5. Required validation

When applicable, require:

- Reproducible installation respecting the lockfile.
- Build.
- TypeScript.
- Existing canonical tests.
- New phase tests.
- Private-file protection.
- `git diff --check`.
- Final `git status`.
- Full diff review.
- Visual inspection when a browser is available.
- Never say “OK” for a command that was not executed.
- Separate local, CI, visual, and production validation.
- Document environment blocks precisely.

## 6. Continuity updates

At the end of a relevant task, Freebuff must:

- Update `MASTER.md` with date and time.
- Keep the actual state of branches, commits, PRs, CI, and deployment.
- Correct stale references when newer evidence exists.
- Include no secrets.
- Keep `MASTER.md` brief, precise, and operational.
- If `MASTER.md` is local and untracked, update it locally without accidentally committing it.
- If Javier later decides to version it, use a separate documentation task.

## 7. Permanent delivery contract: exactly one file

Freebuff must deliver exactly one final file per session. Delivery is incorrect if two or more files are returned.

Do not return an extra report, index, ZIP, loose PR body, loose logs, loose Git state, or copies of package contents alongside the final artifact. Repository-modified files are not delivery artifacts; this rule applies to files copied to Downloads or delivered to Javier.

### Mode A: text only

Prefer this mode. Create exactly one UTF-8 plain-text `.txt` containing all necessary summary, Git state, validations, PR, CI, errors, recommendations, human instructions, PR body if needed, important paths, and final `git status`.

Do not create a separate PR body or index.

### Mode B: multiple internal files are genuinely necessary

Create one real ZIP containing everything, including a main TXT report. Rename the final ZIP so it ends exactly in `.zip.txt`; it must remain internally a valid ZIP. Deliver only that file, with no loose copies or second report.

## 8. Delivery folder

Copy the one final file directly to the user's real Downloads folder. In Termux, first check `$HOME/storage/downloads/`; on desktop Linux, check `$HOME/Downloads/`. Use only a path that actually exists; never invent it. Do not leave the artifact only in the repository. Verify its existence using a read-only operation at the end.

## 9. Artifact cleanup

Before finishing, identify artifacts created during the session. Keep exactly one new delivery artifact in Downloads. Do not delete Javier's pre-existing files, continuity documents, or repository files. Delete only redundant auxiliary artifacts newly created by Freebuff during this session, and only when safe. Do not copy `MASTER.md` or this workflow file to Downloads unless explicitly requested.

## 10. Final chat response

Keep the visible response very short. State only the verdict, exact filename, exact Downloads path, commit/push/PR/CI/merge status, and the literal sentence:

> He entregado exactamente un solo archivo.

Do not paste the report or enumerate internal files when using a ZIP.

## 11. Short activation instruction

Once this file is incorporated into the repository, Javier may start future sessions with:

> Lee íntegramente FREEBUFF_WORKFLOW.md, MASTER.md y los documentos de continuidad. Comprueba Git y continúa con la tarea indicada. Respeta el contrato de un único archivo final en Downloads.

Freebuff must interpret that sentence as activation of this complete protocol.

## Delivery invariant for every session

Every Freebuff intervention must finish with a physically created, verified, and delivered TXT report. This applies to completed, partial, blocked, paused, authorization-required, and expiring sessions. If multiple files are needed, deliver the TXT separately and also a real ZIP renamed with `.zip.txt`; a chat-only response is never a valid delivery.

## Current incorporation rule

This file is currently prepared locally and must not be included in the QNT-0015 PR. Incorporate it later through a separate documentation branch based on `main`, after QNT-0015 PR and CI work is closed.
