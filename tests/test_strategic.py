"""The short list, what adding to it sets off, and what one entity holds.

The tests stub the Plugin API rather than importing the framework: a plugin may
reach only `app.plugin_api`, so its tests must not need more either. The vault
is a real folder, because what this plugin reads IS a folder -- its captures,
its charts, its people.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend import strategic, writing  # noqa: E402
from backend.entities import Entities  # noqa: E402
from backend.routes import build_router  # noqa: E402

_LINE = re.compile(r"^([A-Za-z_]+): (.*)$")


def read_note(path) -> tuple[dict, str]:
    text = Path(path).read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    frontmatter = {}
    for line in text[4:end].splitlines():
        match = _LINE.match(line)
        if not match:
            continue
        key, raw = match.groups()
        if raw.startswith("["):
            frontmatter[key] = re.findall(r'"([^"]*)"', raw)
        else:
            frontmatter[key] = raw.strip('"')
    return frontmatter, text[end + 5:]


class FakeApi:
    """The Plugin API's three surfaces this plugin uses: the vault index, its
    own data files, and asking Hermes to run a job."""

    def __init__(self, vault: Path):
        self.files: dict[str, str] = {}
        self.jobs: list[str] = []
        self._vault = vault
        self.data = SimpleNamespace(
            read_text=lambda name: self.files.get(name),
            write_text=lambda name, text: self.files.__setitem__(name, text),
        )
        self.vault = SimpleNamespace(index=self._index, read_note=read_note)
        self.hermes = SimpleNamespace(
            run_cron_job=lambda name, profile=None: self.jobs.append(name) or True)

    def _index(self) -> dict:
        found = {}
        for note in self._vault.rglob("*.md"):
            frontmatter, _ = read_note(note)
            found[note.stem] = {"path": str(note), "stem": note.stem,
                                "frontmatter": frontmatter,
                                "tags": frontmatter.get("tags", [])}
        return found


def entity_folder(vault: Path, kind: str, name: str, *, charts=(), people=(),
                  captures: str = "") -> Path:
    folder = vault / "Work" / f"{kind}s" / name
    (folder / "_assets").mkdir(parents=True, exist_ok=True)
    (folder / f"{name}.md").write_text(
        f'---\ntype: "{kind}"\nname: "{name}"\naliases: ["{name[:3]}"]\n'
        f'domain: "{name.lower()}.com"\ntags: ["entity/{name.lower()}"]\n---\n\n'
        f"## Who they are\n\n{name} does things.\n", encoding="utf-8")
    if captures:
        (folder / f"{name}-captures.md").write_text(captures, encoding="utf-8")
    for chart in charts:
        (folder / "_assets" / chart).write_text("<svg><title>chart</title></svg>",
                                                encoding="utf-8")
    if people:
        (folder / "People").mkdir(exist_ok=True)
        for person in people:
            (folder / "People" / f"{person}.md").write_text(
                f'---\ntype: "Person"\nemail: "{person}"\n---\n', encoding="utf-8")
    return folder


@pytest.fixture()
def vault(tmp_path):
    entity_folder(tmp_path, "Customer", "ADNOC", charts=["ADNOC-profile.svg"],
                  people=["a@adnoc.ae", "b@adnoc.ae"],
                  captures="## 2026-09-01\n\nThey asked for a proposal.\n")
    entity_folder(tmp_path, "Partner", "NVIDIA")
    return tmp_path


@pytest.fixture()
def api(vault):
    return FakeApi(vault)


@pytest.fixture()
def entities(api):
    return Entities(api)


# ── what the vault holds ─────────────────────────────────────────────────

def test_every_kind_of_entity_is_listed_by_its_hub_note(entities):
    """A folder is not an entity; the note's own type is what says so -- an
    Opportunity folder has the identical shape to a Customer's."""
    found = {e["name"]: e for e in entities.all()}
    assert sorted(found) == ["ADNOC", "NVIDIA"]
    assert found["ADNOC"]["kind"] == "Customer"
    assert found["NVIDIA"]["kind"] == "Partner"
    assert found["ADNOC"]["domains"] == ["adnoc.com"]
    assert found["ADNOC"]["tags"] == ["entity/adnoc"]


def test_a_person_note_is_not_an_entity(vault, api):
    """Every People note carries `type: Person`, and there are hundreds."""
    assert all(e["kind"] != "Person" for e in Entities(api).all())


def test_an_entitys_folder_is_told_apart_by_what_is_in_it(entities):
    adnoc = entities.get("ADNOC")
    contents = entities.contents(adnoc)
    assert contents["captures"] == "ADNOC-captures.md"
    assert [c["file"] for c in contents["charts"]] == ["ADNOC-profile.svg"]
    assert contents["people"] == ["a@adnoc.ae", "b@adnoc.ae"]


def test_a_file_outside_the_folder_cannot_be_asked_for(entities):
    with pytest.raises(FileNotFoundError):
        entities.read_file(entities.get("ADNOC"), "../NVIDIA/NVIDIA.md")


def test_only_wikilinks_that_are_really_notes_are_offered_as_links(entities):
    """The host renderer links a wikilink only when told the target exists, so
    the screen has to say which ones do. A link to a note that is not here
    should read as text rather than lead nowhere."""
    text = "See [[NVIDIA]] and [[Someone Who Left|Sam]] and [[NVIDIA]] again."
    assert entities.resolved_stems(text) == ["NVIDIA"]


# ── the short list ───────────────────────────────────────────────────────

def test_adding_one_writes_the_row_and_the_expert_to_create(api, entities):
    """Adding is not a bookmark: the company gets an Expert. The framework
    creates it -- this says what it should be."""
    result = strategic.add(api, entities.get("ADNOC"))

    assert result["status"] == "added"
    assert result["expert_id"] == "strategic-adnoc"
    assert "ADNOC" in api.files[strategic.BOOK]
    spec = result["expert"]
    assert (spec["id"], spec["type"], spec["section_id"]) ==         ("strategic-adnoc", "expert", "customers")
    assert spec["scope"] == ["Work/Customers/ADNOC", "entity/adnoc"],         "its own folder, vault-relative, and its tags"
    assert "ADNOC" in spec["prompt"] and "never write" in spec["prompt"].lower()


def test_the_soul_is_about_where_to_look_not_what_to_think(api, entities):
    spec = strategic.expert_spec(entities.get("ADNOC"), {"expert_id": "strategic-adnoc"})
    soul = spec["prompt"]
    assert "ADNOC-captures.md" in soul and "ADNOC-notes.md" in soul
    assert "the vault is the only source" in soul.lower()
    assert "out of your scope" in soul


def test_the_book_is_a_table_the_operator_can_read_and_edit(api, entities):
    strategic.add(api, entities.get("ADNOC"))
    strategic.add(api, entities.get("NVIDIA"))
    text = api.files[strategic.BOOK]
    assert text.startswith("# Strategic entities")
    assert "| Entity | Kind | Expert | Added | By |" in text
    assert sorted(strategic.read(api)) == ["ADNOC", "NVIDIA"]


def test_adding_the_same_one_twice_changes_nothing(api, entities):
    strategic.add(api, entities.get("ADNOC"))
    again = strategic.add(api, entities.get("ADNOC"))
    assert again["status"] == "already strategic"
    assert "expert" not in again, "no second Expert asked for"


def test_removing_one_asks_for_its_expert_to_go_too(api, entities):
    """Removing undoes adding (operator, 2026-09-24)."""
    strategic.add(api, entities.get("ADNOC"))
    result = strategic.remove(api, "ADNOC")

    assert result["status"] == "removed"
    assert strategic.read(api) == {}
    assert result["delete_expert"] == "strategic-adnoc", "the screen deletes it"


def test_removing_never_touches_the_company_itself(api, entities, vault):
    strategic.add(api, entities.get("ADNOC"))
    strategic.remove(api, "ADNOC")
    assert (vault / "Work" / "Customers" / "ADNOC" / "ADNOC.md").is_file()
    assert (vault / "Work" / "Customers" / "ADNOC" / "ADNOC-captures.md").is_file()


def test_a_row_whose_entity_vanished_still_shows(api, entities):
    """Or it would disappear silently with its Expert left behind."""
    strategic.add(api, entities.get("ADNOC"))
    api.files[strategic.BOOK] = api.files[strategic.BOOK].replace("| ADNOC |", "| ADNOCX |")
    rows = build_router(entities, api).routes
    listed = next(r for r in rows if r.path == "/strategic").endpoint()
    assert [row["name"] for row in listed] == ["ADNOCX"]
    assert listed[0]["missing"] is True


# ── captures and notes ───────────────────────────────────────────────────

def test_captures_are_saved_exactly_as_given(api, entities):
    """The record of what happened; correcting it is his business and nothing
    rewrites it for him."""
    adnoc = entities.get("ADNOC")
    writing.save_captures(adnoc, "## 2026-09-01\n\nThey asked for a proposal (signed).\n")
    assert "(signed)" in writing.read_captures(adnoc)
    assert api.jobs == [], "no model is asked about a capture"


def test_captures_cannot_be_emptied_by_accident(entities):
    with pytest.raises(ValueError):
        writing.save_captures(entities.get("ADNOC"), "   ")


def test_a_note_is_saved_as_typed_and_then_handed_to_the_agent(api, entities):
    """Saved first, tidied second: what he typed is never lost to a model."""
    adnoc = entities.get("ADNOC")
    result = writing.add_note(api, adnoc, "they want pricing by thursday, talk to maiyas")

    assert result["status"] == "saved" and result["tidying"] is True
    assert "talk to maiyas" in writing.read_notes(adnoc)
    assert api.jobs == [writing.JOB]
    queued = json.loads(api.files[writing.REQUESTS])["notes"][0]
    assert queued["entity"] == "ADNOC"


def test_a_note_with_nothing_in_it_is_refused(api, entities):
    with pytest.raises(ValueError):
        writing.add_note(api, entities.get("ADNOC"), "   ")


def test_notes_live_with_the_company_not_in_the_plugin(api, entities, vault):
    """They are about the company, so they belong in its folder -- where the
    Expert scoped to that folder can read them."""
    writing.add_note(api, entities.get("ADNOC"), "first note")
    assert (vault / "Work" / "Customers" / "ADNOC" / "ADNOC-notes.md").is_file()


def test_the_captures_frontmatter_is_hidden_and_kept(api, entities, vault):
    """`type: "Captures"` above the record is noise on screen, and editing it by
    hand is a way to break the note."""
    path = vault / "Work" / "Customers" / "ADNOC" / "ADNOC-captures.md"
    path.write_text('---\ntype: "Captures"\nparent: "ADNOC"\n---\n\n'
                    "## 2026-09-01\n\nThey asked for a proposal.\n", encoding="utf-8")
    adnoc = entities.get("ADNOC")

    shown = writing.read_captures(adnoc)
    assert shown.startswith("## 2026-09-01"), "the frontmatter is not on screen"

    writing.save_captures(adnoc, shown + "\n\n## 2026-09-20\n\nAnd again.\n")

    saved = path.read_text(encoding="utf-8")
    assert saved.startswith('---\ntype: "Captures"\nparent: "ADNOC"\n---'), "and it is still there"
    assert "And again." in saved
