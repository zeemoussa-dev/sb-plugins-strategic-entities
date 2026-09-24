"""The short list: the companies that matter, and what adding one sets off.

`Settings/Strategic-Entities.md` in the App Database Folder, one row each:

    | Entity | Kind | Expert | Added | By |
    |---|---|---|---|---|
    | ADNOC | Customer | strategic-adnoc | 2026-09-24 | operator |

Markdown, because the operator reads and edits this file himself, the same as
the Action Center's owner book.

**Adding one is not just a row.** It asks for an Expert agent scoped to that
entity's folder and tags, so the company has someone to ask about it. A plugin
cannot create an agent -- `api.agents` only reads, and a plugin cannot even find
where agents live (framework `REQ-SB-93`) -- so the request is left here and the
install's own Hermes job writes it. Removing one asks for the Expert to be
deleted again: removing undoes what adding did (operator, 2026-09-24).

The row is written immediately either way. The Expert follows within a tick, and
the screen says which state a row is actually in rather than pretending.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime, timezone

BOOK = "Settings/Strategic-Entities.md"
REQUESTS = "data/StrategicEntities/requested.json"

# The Hermes job that writes and deletes the agents. Its schedule is years out:
# it exists to be triggered, never to fire by itself.
JOB = "SB strategic experts"

HEADER = """# Strategic entities

The companies that matter enough to have their own Expert. Adding one here
creates an Expert scoped to that company's folder and tags; removing one deletes
it again. The Strategic Entities screen writes this file, and so can you.

| Entity | Kind | Expert | Added | By |
|---|---|---|---|---|
"""

_ROW = re.compile(r"^\|(?P<entity>[^|]*)\|(?P<kind>[^|]*)\|(?P<expert>[^|]*)\|"
                  r"(?P<added>[^|]*)\|(?P<by>[^|]*)\|\s*$")
_SLUG = re.compile(r"[^a-z0-9]+")


def expert_id(name: str) -> str:
    """`strategic-adnoc`. Stable for a given name, so a row and its agent can
    always find each other."""
    slug = _SLUG.sub("-", str(name or "").lower()).strip("-")
    return f"strategic-{slug or 'entity'}"


def read(api) -> dict[str, dict]:
    """`{entity stem: row}`. A missing or hand-mangled file is an empty list,
    never an error: the screen still works, it just has nothing on it."""
    try:
        text = api.data.read_text(BOOK) or ""
    except Exception:
        return {}
    rows = {}
    for line in text.splitlines():
        match = _ROW.match(line.strip())
        if not match:
            continue
        entity = match.group("entity").strip()
        if not entity or entity.lower() in ("entity", "---", ":---"):
            continue
        rows[entity] = {
            "entity": entity,
            "kind": match.group("kind").strip(),
            "expert_id": match.group("expert").strip(),
            "added": match.group("added").strip(),
            "by": match.group("by").strip() or "operator",
        }
    return rows


def _write(api, rows: dict[str, dict]) -> None:
    lines = [f"| {r['entity']} | {r['kind']} | {r['expert_id']} | {r['added']} | {r['by']} |"
             for _, r in sorted(rows.items(), key=lambda kv: kv[0].lower())]
    api.data.write_text(BOOK, HEADER + "\n".join(lines) + "\n")


def _ask_the_agent(api, action: str, row: dict) -> dict:
    """Queue the work and start the job. Queued rather than replaced: adding two
    entities before the job runs must create both agents."""
    try:
        queued = json.loads(api.data.read_text(REQUESTS) or "{}").get("requests") or []
    except Exception:
        queued = []
    request = {"do": action, "entity": row["entity"], "kind": row.get("kind", ""),
               "expert_id": row["expert_id"], "folder": row.get("folder", ""),
               "tags": row.get("tags", [])}
    queued = [q for q in queued if not (q.get("entity") == row["entity"])] + [request]
    api.data.write_text(REQUESTS, json.dumps({
        "requests": queued,
        "asked_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ"),
    }, indent=2))
    started, problem = False, ""
    try:
        started = bool(api.hermes.run_cron_job(JOB))
    except Exception as exc:
        problem = str(exc)
    return {"agent_started": started, "queued": len(queued),
            "note": ("The Expert is being written; it answers within a few seconds."
                     if started and action == "create" else
                     "The Expert is being deleted." if started else
                     "Queued. The agent could not be started just now"
                     + (f" ({problem})" if problem else "") + "; it will be picked up.")}


def add(api, entity: dict, *, by: str = "operator") -> dict:
    rows = read(api)
    if entity["stem"] in rows:
        return {"status": "already strategic", **rows[entity["stem"]]}
    row = {"entity": entity["stem"], "kind": entity["kind"],
           "expert_id": expert_id(entity["name"]), "added": date.today().isoformat(), "by": by}
    rows[entity["stem"]] = row
    _write(api, rows)
    asked = _ask_the_agent(api, "create", {**row, "folder": entity["folder"],
                                           "tags": entity.get("tags", [])})
    return {"status": "added", **row, **asked}


def remove(api, stem: str) -> dict:
    rows = read(api)
    row = rows.pop(stem, None)
    if row is None:
        return {"status": "not strategic", "entity": stem}
    _write(api, rows)
    # Removing undoes adding: the Expert goes too (operator, 2026-09-24). The
    # entity's own notes are never touched -- this list is not the company.
    asked = _ask_the_agent(api, "delete", row)
    return {"status": "removed", **row, **asked}
