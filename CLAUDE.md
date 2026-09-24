# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this repository is

**The Strategic Entities plugin** for Second Brain (`ADR-022`): the short list of
companies that matter, in the side panel. Adding one creates an **Expert** scoped
to that company's folder and tags; removing one deletes that Expert again.
Opening one shows what the vault holds on it -- the hub note, its charts, its
people, its captures (editable here) and the operator's own notes.

It is not the Entities plugin. `entities` owns the registry, discovery and
customer resolution; this one owns the short list and the screen, and reads the
same notes.

## Boundaries

- **A plugin imports only `app.plugin_api`.** Reaching past that facade is
  refused at install time, and no framework file may be copied in.
- **This plugin cannot create an agent or call a model.** `api.agents` only
  reads, and a plugin cannot find where agents live (framework `REQ-SB-93`).
  Both are asked of the install's own Hermes jobs: the request goes into a data
  file this plugin registered, and `api.hermes.run_cron_job` starts the job.
  When `REQ-SB-93` lands, the Expert half should move to the API and the
  `SB strategic experts` job should go.
- **It writes only two things in the vault**: `<Name>-notes.md`, which it owns,
  and `<Name>-captures.md`, which it edits on the operator's instruction.
  Everything else about a company is somebody else's to write.
- **A missing framework capability is logged in the framework repository** as a
  `REQ-SB-NN`, never worked around here.

## Layout

| Path | Holds |
|---|---|
| `plugin.json` | id, version, `framework_api`, what it requires |
| `backend/entities.py` | what an entity is, and what its folder holds |
| `backend/strategic.py` | the short list, and asking for its Experts |
| `backend/writing.py` | notes (tidied by an agent) and captures (never rewritten) |
| `backend/routes.py` | the HTTP surface |
| `ui/` | the list, the entity screen, their client and styles |
| `tests/` | against a stubbed Plugin API and a real folder |

## Commands

| Command | Where |
|---|---|
| `python -m pytest` | repository root, with any Python 3.11+ |

## Rules

- Read before writing; minimal changes; separate commits per logical change;
  never force-push `main`.
- Update `CHANGELOG.md` for everything created or changed.
- A screen shows what the data says. Where a model rewrote something, keep what
  the person actually wrote and show that it was rewritten.
- Add inline comments only where the WHY is non-obvious.
