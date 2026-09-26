"""What each strategic company should be watched for, and when it last was.

The research itself is not done here and is not done by this install's own
agents: Compass is weak at it (operator, 2026-09-26), so the work is handed to a
Claude skill running on a schedule of his making. What this plugin owns is the
BRIEF -- which companies, what to look for, how often -- and the record of what
came back.

So the contract is a file, not a call:

- **`Settings/Strategic-Enrichment.md`** is the brief, in the App Database
  Folder beside the strategic list. Markdown, because he reads and edits it
  himself, and because a skill can read it without this plugin running at all.
  The same thing is served as data at `GET /plugins/strategic-entities/enrichment`.
- The skill writes its findings **wherever it decides** -- news in its own file,
  a profile refresh into the hub note (operator, 2026-09-26) -- and then says
  what it did through `POST /entities/{stem}/enrichment/done`. That is the only
  thing recorded here: topic, file, when, and one line about it.

Nothing in this module fetches anything, and nothing here writes a company's
notes. It says what is wanted and remembers what happened.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timezone

BRIEF = "Settings/Strategic-Enrichment.md"
STATE = "data/StrategicEntities/enrichment.json"

# What the screen offers per company. Four, because they are four different
# questions with four different answers -- and the skill decides where each
# one's output belongs.
TOPICS = {
    "news": "News and announcements",
    "opportunities": "What Core42 should look at",
    "profile": "Refresh the profile",
    "people": "People and org moves",
}
CADENCES = ("weekly", "fortnightly", "monthly", "on demand")

HEADER = """# Strategic enrichment

What each strategic company should be watched for, and how often. This file is
the brief for the research skill; it reads this, does the work, and writes back
where it decides each kind of finding belongs.

The Strategic Entities screen writes this file, and so can you.

| Entity | Topics | Cadence | Watch for | Last enriched |
|---|---|---|---|---|
"""


def _text(value) -> str:
    return str(value or "").strip()


def _topics(values) -> list[str]:
    """Only topics the screen offers, in the order it offers them -- so a
    hand-edited brief cannot ask for something nothing understands."""
    wanted = {_text(v).lower() for v in (values or [])}
    return [key for key in TOPICS if key in wanted]


def read(api) -> dict:
    """`{stem: {topics, cadence, watch_for, runs: [...]}}`."""
    try:
        stored = json.loads(api.data.read_text(STATE) or "{}")
    except Exception:
        return {}
    asked = stored.get("entities") or {}
    found = {}
    for stem, row in asked.items():
        found[str(stem)] = {
            "topics": _topics(row.get("topics")),
            "cadence": _text(row.get("cadence")) or "monthly",
            "watch_for": _text(row.get("watch_for")),
            "runs": [r for r in (row.get("runs") or []) if isinstance(r, dict)],
        }
    return found


def _save(api, asked: dict, entities: list[dict]) -> None:
    api.data.write_text(STATE, json.dumps({
        "entities": asked,
        "saved_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ"),
    }, indent=2))
    api.data.write_text(BRIEF, _as_markdown(asked, entities))


def _last(row: dict) -> str:
    runs = row.get("runs") or []
    if not runs:
        return "never"
    newest = max(_text(run.get("at")) for run in runs)
    return newest[:10] or "never"


def _as_markdown(asked: dict, entities: list[dict]) -> str:
    """The brief as he reads it -- and as a skill can read it without asking
    this plugin anything."""
    by_stem = {entity["stem"]: entity for entity in entities}
    lines = []
    for stem in sorted(asked, key=str.lower):
        row = asked[stem]
        if not row.get("topics"):
            continue
        entity = by_stem.get(stem, {})
        topics = ", ".join(TOPICS[key] for key in row["topics"])
        lines.append(f"| {entity.get('name') or stem} | {topics} | {row['cadence']} | "
                     f"{row.get('watch_for') or '--'} | {_last(row)} |")

    written = [HEADER + "\n".join(lines) + "\n"]
    # Under the table, what a skill needs to actually do the work: where the
    # company lives, what it is called elsewhere, and how to hand back what it
    # found. A path is more use to it than a name.
    written.append("\n## For the research skill\n")
    written.append(
        "\nEach company below is one job. Do the work for the topics listed, write what you\n"
        "find wherever it belongs -- news in its own file beside the hub note, a profile\n"
        "refresh into the note itself -- and then record it:\n\n"
        "    POST /plugins/strategic-entities/entities/<stem>/enrichment/done\n"
        "    {\"topic\": \"news\", \"file\": \"<Name>-news.md\", \"summary\": \"one line\"}\n")
    for stem in sorted(asked, key=str.lower):
        row = asked[stem]
        if not row.get("topics"):
            continue
        entity = by_stem.get(stem)
        if not entity:
            # Asked for, but no such company any more: said plainly rather than
            # dropped, or the brief quietly shrinks.
            written.append(f"\n### {stem}\n\n- **gone from the vault** -- nothing to enrich.\n")
            continue
        written.append(f"\n### {entity['name']}\n\n")
        written.append(f"- Folder: `{entity['folder']}`\n")
        written.append(f"- Hub note: `{entity['note_path']}`\n")
        if entity.get("domains"):
            written.append(f"- Domains: {', '.join(entity['domains'])}\n")
        if entity.get("aliases"):
            written.append(f"- Also called: {', '.join(entity['aliases'])}\n")
        written.append(f"- Topics: {', '.join(TOPICS[key] for key in row['topics'])}\n")
        written.append(f"- Cadence: {row['cadence']}\n")
        if row.get("watch_for"):
            written.append(f"- Watch for: {row['watch_for']}\n")
        for run in sorted(row.get("runs") or [], key=lambda r: _text(r.get("at")), reverse=True)[:3]:
            written.append(f"- Last {TOPICS.get(_text(run.get('topic')), run.get('topic'))}: "
                           f"{_text(run.get('at'))[:10]} -> `{_text(run.get('file')) or '--'}`"
                           f"{' -- ' + _text(run['summary']) if _text(run.get('summary')) else ''}\n")
    return "".join(written)


def set_for(api, entity: dict, entities: list[dict], *, topics, cadence: str,
            watch_for: str = "") -> dict:
    """What this company should be watched for. No topics means it is off the
    brief entirely -- the row goes, rather than sitting there asking for
    nothing."""
    asked = read(api)
    stem = entity["stem"]
    chosen = _topics(topics)
    cadence = _text(cadence).lower()
    if cadence not in CADENCES:
        cadence = "monthly"
    if not chosen:
        asked.pop(stem, None)
    else:
        asked[stem] = {**asked.get(stem, {"runs": []}), "topics": chosen,
                       "cadence": cadence, "watch_for": _text(watch_for)}
        asked[stem].setdefault("runs", [])
    _save(api, asked, entities)
    return asked.get(stem, {"topics": [], "cadence": cadence, "watch_for": "", "runs": []})


def record_run(api, entity: dict, entities: list[dict], *, topic: str, file: str = "",
               summary: str = "") -> dict:
    """The skill saying what it did. One run per topic is kept -- the last one --
    because the question this answers is "when was this last looked at"."""
    key = _text(topic).lower()
    if key not in TOPICS:
        raise ValueError(f"topic must be one of {', '.join(TOPICS)}")
    asked = read(api)
    stem = entity["stem"]
    row = asked.setdefault(stem, {"topics": [key], "cadence": "on demand",
                                  "watch_for": "", "runs": []})
    row["runs"] = [run for run in row.get("runs") or []
                   if _text(run.get("topic")).lower() != key]
    row["runs"].append({"topic": key, "file": _text(file), "summary": _text(summary),
                        "at": date.today().isoformat()})
    _save(api, asked, entities)
    return row


def for_entity(api, stem: str) -> dict:
    return read(api).get(stem, {"topics": [], "cadence": "monthly", "watch_for": "", "runs": []})
