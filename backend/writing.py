"""What the screen writes: the operator's own notes, and edits to the captures.

Two different things, kept apart on purpose.

**Notes** are his. They live in the entity's folder as `<Name>-notes.md`, a file
this plugin owns and nothing else writes. A note is saved the moment he presses
save, exactly as typed -- and then a Hermes agent tidies it into clean prose,
because "use LLM to format the text and make it more appealing" (operator,
2026-09-24). **What he typed is kept underneath the tidied version**: a model
rewriting somebody's words is only acceptable while the words are still there.

**Captures** are the vault's: `<Name>-captures.md`, written by the capture
passes. The screen may edit them, because a capture that is wrong is worth
correcting at the moment it is read -- but it is saved as given. Nothing
rewrites the record of what happened.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from pathlib import Path

REQUESTS = "data/StrategicEntities/notes-to-tidy.json"
JOB = "SB strategic notes"

NOTES_SUFFIX = "-notes.md"
_HEADER = """---
type: "StrategicNotes"
---

"""
# What he typed, kept under what the agent made of it.
AS_TYPED = "<!-- as typed -->"


def notes_path(entity: dict) -> Path:
    folder = Path(entity["folder"])
    return folder / f"{folder.name}{NOTES_SUFFIX}"


def read_notes(entity: dict) -> str:
    path = notes_path(entity)
    if not path.is_file():
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end != -1:
            text = text[end + 5:]
    return text.strip()


def add_note(api, entity: dict, text: str, *, tidy: bool = True) -> dict:
    """Appends one note, as typed, and asks for it to be tidied."""
    said = str(text or "").strip()
    if not said:
        raise ValueError("a note needs something in it")
    path = notes_path(entity)
    when = date.today().isoformat()
    existing = path.read_text(encoding="utf-8", errors="replace") if path.is_file() else _HEADER
    entry = f"\n## {when}\n\n{said}\n"
    path.write_text(existing.rstrip("\n") + "\n" + entry, encoding="utf-8")

    if not tidy:
        return {"status": "saved", "tidying": False}
    try:
        queued = json.loads(api.data.read_text(REQUESTS) or "{}").get("notes") or []
    except Exception:
        queued = []
    queued.append({"entity": entity["stem"], "note_file": str(path), "heading": when})
    api.data.write_text(REQUESTS, json.dumps({
        "notes": queued,
        "asked_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ"),
    }, indent=2))
    started = False
    try:
        started = bool(api.hermes.run_cron_job(JOB))
    except Exception:
        started = False
    return {"status": "saved", "tidying": started,
            "note": ("Saved. The agent is tidying it; what you typed is kept underneath."
                     if started else "Saved as typed. The agent will tidy it when it next runs.")}


def read_captures(entity: dict) -> str:
    folder = Path(entity["folder"])
    path = folder / f"{folder.name}-captures.md"
    return path.read_text(encoding="utf-8", errors="replace") if path.is_file() else ""


def save_captures(entity: dict, text: str) -> dict:
    """Saved exactly as given. This is the record of what happened; correcting
    it is the operator's business and nothing rewrites it for him."""
    folder = Path(entity["folder"])
    path = folder / f"{folder.name}-captures.md"
    if not path.is_file():
        raise FileNotFoundError(f"{entity['name']} has no captures file to edit")
    if not str(text or "").strip():
        raise ValueError("refusing to empty the captures file")
    path.write_text(str(text).rstrip("\n") + "\n", encoding="utf-8")
    return {"status": "saved", "file": path.name}
