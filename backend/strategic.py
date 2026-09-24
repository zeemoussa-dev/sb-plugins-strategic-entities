"""The short list: the companies that matter, and the Expert each one gets.

`Settings/Strategic-Entities.md` in the App Database Folder, one row each:

    | Entity | Kind | Expert | Added | By |
    |---|---|---|---|---|
    | ADNOC | Customer | strategic-adnoc | 2026-09-24 | operator |

Markdown, because the operator reads and edits this file himself.

**Adding one is not just a row.** The company gets an Expert scoped to its folder
and tags, so there is somebody to ask about it; removing one deletes that Expert
again. The agent itself is created through the framework's own `POST /agents`,
which does the whole job -- the Hermes profile and the Registry files -- and
`DELETE /agents/{id}` undoes it. This module writes the row and says what the
Expert should be; the screen makes the call.
"""
from __future__ import annotations

import re
from datetime import date

BOOK = "Settings/Strategic-Entities.md"
SECTION = "customers"
HUB = "customers-hub"
# Cloned from the section's own producer rather than `default`: it already has
# this install's provider and the vault skills, and a profile made from nothing
# has no `compass` provider at all (this install, 2026-09-18).
CLONE_FROM = "entity-manager"

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
    """`strategic-adnoc`, and the real Hermes profile folder name."""
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


def vault_scope(entity: dict) -> list[str]:
    """What the Expert may look at: the company's own folder, vault-relative as
    the scope field expects it, and its tags. `Work/Customers/ADNOC` rather than
    the absolute path -- the framework matches these against the vault's own
    folder and tag lists."""
    folder = str(entity.get("folder") or "").replace("\\", "/")
    marker = "/Work/"
    relative = folder[folder.index(marker) + 1:] if marker in folder else folder
    return ([relative] if relative else []) + list(entity.get("tags") or [])


def soul(entity: dict) -> str:
    """What the Expert is for, in the words the operator would use.

    Deliberately about WHERE to look and WHAT is there, never about what the CBO
    thinks of the company: a soul that judges a customer would be read by an
    agent as fact."""
    name = entity["name"]
    folder = entity.get("folder", "")
    tags = ", ".join(entity.get("tags") or []) or "none"
    aliases = ", ".join(entity.get("aliases") or []) or "none recorded"
    return f"""You are the {name} Expert. One company is your subject: {name},
a {entity.get('kind', 'company').lower()} of Core42, also known as {aliases}.

## What you answer from

Everything you say comes from this vault, and from this company's own folder:

    {folder}

with the tags {tags}. That folder holds:

- `{name}.md` -- the hub note: who they are, the domains, the state of play.
- `{name}-captures.md` -- the record of what has actually happened: meetings,
  decisions, approvals, invoices. This is the truth about the relationship.
- `{name}-history.md` -- the timeline.
- `{name}-notes.md` -- the CBO's own notes from the Strategic Entities screen.
- `People/` -- the individuals, one note each, with their addresses.
- `_assets/` -- charts and attachments.
- `Affiliates/` -- companies that belong to this one, each with the same shape.

**The vault is the only source.** If something is not in that folder, it is not
tracked, and you say so plainly rather than reaching for general knowledge about
{name}. You are not a source about this company; the vault is, and you read it.

## What you are for

Questions about {name}: who we deal with there, what was agreed, what is open,
what happened when, who to talk to about what. Answer with what the notes say
and cite the file you read it in. Where the notes disagree, say so.

A question about another company is out of your scope: say which company you
cover and stop. A question about {name} that the folder cannot answer gets "the
vault does not record that", not a guess.

## What you never do

- **You never write.** Capture, tagging and the screens write; you read.
- **You never invent a position.** What the CBO thinks of {name} is in his notes
  or it is nowhere.
- **You never carry a fact between companies.** What is true of an affiliate is
  not automatically true of the parent.
"""


def expert_spec(entity: dict, row: dict) -> dict:
    """Exactly what `POST /agents` wants. The screen makes that call: creating an
    agent is the framework's own job, and it does both halves -- the Hermes
    profile and the Registry files."""
    return {
        "id": row["expert_id"],
        "name": f"{entity['name']} Expert",
        "section_id": SECTION,
        "type": "expert",
        "is_background_agent": False,
        "depends_on": [HUB],
        "description": f"Answers about {entity['name']}, from its own folder in the vault.",
        "prompt": soul(entity),
        "scope": vault_scope(entity),
        "clone_from": CLONE_FROM,
    }


def add(api, entity: dict, *, by: str = "operator") -> dict:
    rows = read(api)
    if entity["stem"] in rows:
        return {"status": "already strategic", **rows[entity["stem"]]}
    row = {"entity": entity["stem"], "kind": entity["kind"],
           "expert_id": expert_id(entity["name"]), "added": date.today().isoformat(), "by": by}
    rows[entity["stem"]] = row
    _write(api, rows)
    return {"status": "added", **row, "expert": expert_spec(entity, row)}


def remove(api, stem: str) -> dict:
    rows = read(api)
    row = rows.pop(stem, None)
    if row is None:
        return {"status": "not strategic", "entity": stem}
    _write(api, rows)
    # Removing undoes adding: the screen deletes the Expert through the
    # framework's own API. The entity's own notes are never touched -- this list
    # is not the company.
    return {"status": "removed", **row, "delete_expert": row["expert_id"]}
