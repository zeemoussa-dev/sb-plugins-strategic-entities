"""The Strategic Entities HTTP surface, mounted at `/plugins/strategic-entities/`."""
from __future__ import annotations

import base64
import mimetypes

from fastapi import APIRouter, Body, HTTPException

from . import strategic, writing
from .entities import Entities


def build_router(entities: Entities, api) -> APIRouter:
    router = APIRouter()

    def _entity(stem: str) -> dict:
        found = entities.get(stem)
        if found is None:
            raise HTTPException(status_code=404, detail=f"no entity named {stem!r}")
        return found

    @router.get("/entities")
    def list_entities(q: str | None = None, kind: str | None = None,
                      strategic_only: bool = False) -> list[dict]:
        """Every entity, each saying whether it is strategic. One list, because
        adding one is a property of the entity, not a separate catalogue."""
        chosen = strategic.read(api)
        rows = []
        for entity in entities.all():
            if kind and entity["kind"].lower() != kind.lower():
                continue
            if q and q.lower() not in (entity["name"] + " " + " ".join(entity["aliases"])).lower():
                continue
            row = {**entity, "strategic": entity["stem"] in chosen,
                   "expert_id": (chosen.get(entity["stem"]) or {}).get("expert_id")}
            if strategic_only and not row["strategic"]:
                continue
            rows.append(row)
        return rows

    @router.get("/strategic")
    def list_strategic() -> list[dict]:
        """The short list itself, in the order the side panel shows it."""
        chosen = strategic.read(api)
        rows = []
        for entity in entities.all():
            row = chosen.get(entity["stem"])
            if row:
                rows.append({**entity, **row, "strategic": True})
        # A row whose entity has since been renamed or removed still shows, or
        # it would vanish silently with its Expert left behind.
        known = {e["stem"] for e in entities.all()}
        rows += [{**row, "name": row["entity"], "strategic": True, "missing": True}
                 for stem, row in chosen.items() if stem not in known]
        return rows

    @router.post("/strategic/{stem}")
    def make_strategic(stem: str) -> dict:
        return strategic.add(api, _entity(stem))

    @router.delete("/strategic/{stem}")
    def drop_strategic(stem: str) -> dict:
        return strategic.remove(api, stem)

    @router.get("/entities/{stem}")
    def entity_detail(stem: str) -> dict:
        entity = _entity(stem)
        chosen = strategic.read(api)
        frontmatter, body = api.vault.read_note(entity["note_path"])
        captures = writing.read_captures(entity)
        notes = writing.read_notes(entity)
        return {
            **entity,
            "strategic": stem in chosen,
            "expert_id": (chosen.get(stem) or {}).get("expert_id"),
            "note": body,
            "facts": {k: v for k, v in (frontmatter or {}).items()
                      if k not in ("type", "name", "aliases", "domain", "tags")},
            "contents": entities.contents(entity),
            "captures": captures,
            "notes": notes,
            "resolved_stems": entities.resolved_stems(body, captures, notes),
        }

    @router.get("/entities/{stem}/files/{filename}")
    def entity_file(stem: str, filename: str) -> dict:
        """One text file, read. Charts are served by the route below."""
        entity = _entity(stem)
        try:
            return {"file": filename, "text": entities.read_file(entity, filename)}
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.get("/entities/{stem}/chart/{filename}")
    def entity_chart(stem: str, filename: str) -> dict:
        """A chart, as something the screen can actually put on the page.

        Not a URL: a plugin's screen is handed `apiFetch` and nothing else, so
        it cannot know the backend's own address to point an `<img>` at. An SVG
        comes back as text to drop into the page; anything else comes back as a
        data URL. Both are the picture itself, which is what a chart is."""
        entity = _entity(stem)
        try:
            path = entities.file_path(entity, filename)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        kind = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if path.suffix.lower() == ".svg":
            return {"file": filename, "type": kind,
                    "svg": path.read_text(encoding="utf-8", errors="replace")}
        raw = base64.b64encode(path.read_bytes()).decode("ascii")
        return {"file": filename, "type": kind, "data_url": f"data:{kind};base64,{raw}"}

    @router.put("/entities/{stem}/captures")
    def edit_captures(stem: str, payload: dict = Body(...)) -> dict:
        entity = _entity(stem)
        try:
            return writing.save_captures(entity, payload.get("text", ""))
        except (ValueError, FileNotFoundError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/entities/{stem}/notes")
    def add_note(stem: str, payload: dict = Body(...)) -> dict:
        entity = _entity(stem)
        try:
            return writing.add_note(api, entity, payload.get("text", ""),
                                    tidy=payload.get("tidy", True))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
