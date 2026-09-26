"""Strategic Entities -- a Second Brain plugin (`ADR-022`).

The short list of companies that matter, in the side panel. Adding one creates
an Expert scoped to that company's folder and tags, so there is somebody to ask
about it; removing one deletes the Expert again. Clicking one opens what the
vault holds on it: the hub note, its charts, its people, the captures -- which
can be corrected here -- and the operator's own notes.

THE EXPERT IS THE FRAMEWORK'S OWN JOB. `POST /agents` creates the Hermes
profile and the Registry files together, and `DELETE /agents/{id}` undoes both;
the screen calls them. This backend decides WHAT the Expert should be -- its
scope, its soul -- and writes the list.

Tidying a note does need the install's own agent, because a plugin cannot call a
model: the note is queued in a data file and a Hermes job rewrites it.

Everything it needs from the framework arrives through the Plugin API handed to
`register`; this package imports nothing from the framework itself.
"""
from __future__ import annotations

from .enrichment import BRIEF, STATE
from .entities import Entities
from .routes import build_router
from .strategic import BOOK
from .writing import REQUESTS as NOTE_REQUESTS


def register(api) -> None:
    # The list itself, the tray the note-tidying job reads, and the enrichment
    # brief -- markdown for the research skill to read off disk, plus the state
    # behind it. A data file this plugin has not registered cannot be written.
    api.register_seed_data_file(BOOK)
    api.register_seed_data_file(NOTE_REQUESTS)
    api.register_seed_data_file(BRIEF)
    api.register_seed_data_file(STATE)
    api.register_router(build_router(Entities(api), api))
