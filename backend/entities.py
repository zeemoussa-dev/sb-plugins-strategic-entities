"""The companies this vault knows, and everything one of them holds.

An entity is a folder with a hub note in it: `Work/Customers/ADNOC/ADNOC.md`,
`Work/Partners/NVIDIA/NVIDIA.md`, an Affiliate nested under its parent, an
Opportunity. The folder is the entity -- its people, its captures, its history,
its assets -- and the note's own `type` is what says which kind it is. Folders
are not asked, because an Opportunity folder has the identical shape.

This module reads; nothing here writes.
"""
from __future__ import annotations

import re
from pathlib import Path

KINDS = ("Customer", "Partner", "Affiliate", "Opportunity")

# Files that ARE the entity rather than things inside it, and the folders that
# hold its people and pictures.
_HISTORY = "-history.md"
_CAPTURES = "-captures.md"
_ASSETS = "_assets"
_CHART_SUFFIXES = (".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif")


def _text(value) -> str:
    return str(value or "").strip()


def _listed(value) -> list[str]:
    """`aliases` and `domain` are written either as a list or as one
    comma-separated string, depending on which pass wrote them."""
    if isinstance(value, list):
        return [_text(v) for v in value if _text(v)]
    return [part.strip() for part in _text(value).split(",") if part.strip()]


class Entities:
    def __init__(self, api) -> None:
        self._api = api

    def all(self) -> list[dict]:
        """Every entity in the vault, by its hub note. Sorted by name, because
        the only way anybody reads a list of companies is by looking for one."""
        found = []
        for entry in self._api.vault.index().values():
            frontmatter = entry.get("frontmatter") or {}
            kind = _text(frontmatter.get("type"))
            if kind not in KINDS:
                continue
            path = _text(entry.get("path"))
            if not path:
                continue
            note = Path(path)
            found.append({
                "stem": entry.get("stem") or note.stem,
                "name": _text(frontmatter.get("name")) or note.stem,
                "kind": kind,
                "aliases": _listed(frontmatter.get("aliases")),
                "domains": _listed(frontmatter.get("domain")),
                "tags": [t for t in (entry.get("tags") or []) if _text(t)],
                "folder": str(note.parent),
                "note_path": path,
            })
        found.sort(key=lambda e: e["name"].lower())
        return found

    def get(self, stem: str) -> dict | None:
        wanted = _text(stem)
        return next((e for e in self.all() if e["stem"] == wanted), None)

    # -- what one entity holds ------------------------------------------------

    def contents(self, entity: dict) -> dict:
        """Everything in the entity's folder, told apart by what it is: the hub
        note, its captures, its history, the people, the charts, and whatever
        else somebody put there."""
        folder = Path(entity["folder"])
        name = folder.name
        people, charts, others, affiliates = [], [], [], []
        captures = history = None

        for child in sorted(folder.iterdir()) if folder.is_dir() else []:
            if child.is_dir():
                if child.name == "People":
                    people = [p.stem for p in sorted(child.glob("*.md"))]
                elif child.name == _ASSETS:
                    for asset in sorted(child.iterdir()):
                        row = {"file": asset.name, "kind": asset.suffix.lower().lstrip(".")}
                        (charts if asset.suffix.lower() in _CHART_SUFFIXES else others).append(row)
                elif child.name == "Affiliates":
                    affiliates = [a.name for a in sorted(child.iterdir()) if a.is_dir()]
                continue
            if child.name == f"{name}{_CAPTURES}":
                captures = child.name
            elif child.name == f"{name}{_HISTORY}":
                history = child.name
            elif child.name != f"{name}.md":
                others.append({"file": child.name, "kind": child.suffix.lower().lstrip(".")})

        return {"captures": captures, "history": history, "people": people,
                "charts": charts, "affiliates": affiliates, "other_files": others}

    def resolved_stems(self, *texts: str) -> list[str]:
        """Which `[[targets]]` in these texts are really notes in this vault.

        The host renderer links a wikilink only when it is told the target
        exists, so a screen showing note text has to say which ones do --
        otherwise every `[[Name]]` is either a dead link or plain text."""
        index = self._api.vault.index()
        known = {str(stem) for stem in index}
        found: list[str] = []
        for text in texts:
            for match in re.finditer(r"\[\[([^\]]+)\]\]", text or ""):
                target = match.group(1).split("|")[0].strip()
                if target in known and target not in found:
                    found.append(target)
        return found

    def read_file(self, entity: dict, filename: str) -> str:
        """One text file from the entity's folder, by name. The name is matched
        against what is really there rather than joined onto the path, so
        nothing outside the folder can be asked for."""
        folder = Path(entity["folder"])
        for candidate in [folder / filename, folder / _ASSETS / filename]:
            if candidate.is_file() and candidate.parent in (folder, folder / _ASSETS):
                return candidate.read_text(encoding="utf-8", errors="replace")
        raise FileNotFoundError(f"{filename!r} is not in {entity['name']}'s folder")

    def file_path(self, entity: dict, filename: str) -> Path:
        """Where a file of this entity really is -- for serving an image."""
        folder = Path(entity["folder"])
        for candidate in [folder / filename, folder / _ASSETS / filename]:
            if candidate.is_file() and candidate.parent in (folder, folder / _ASSETS):
                return candidate
        raise FileNotFoundError(f"{filename!r} is not in {entity['name']}'s folder")
