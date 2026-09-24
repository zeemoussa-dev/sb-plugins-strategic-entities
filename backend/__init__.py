"""Strategic Entities -- a Second Brain plugin (`ADR-022`).

The short list of companies that matter, in the side panel. Adding one creates
an Expert scoped to that company's folder and tags, so there is somebody to ask
about it; removing one deletes the Expert again. Clicking one opens what the
vault holds on it: the hub note, its charts, its people, the captures -- which
can be corrected here -- and the operator's own notes.

WHAT THIS PLUGIN DOES NOT DO ITSELF. It cannot create an agent: `api.agents`
only reads, and a plugin cannot find where agents live (framework `REQ-SB-93`).
Nor can it call a model to tidy a note. Both are asked of the install's own
Hermes jobs, the way the Action Center asks for a chase -- the plugin records
what is wanted, and the agent does it.

Everything it needs from the framework arrives through the Plugin API handed to
`register`; this package imports nothing from the framework itself.
"""
from __future__ import annotations

from .entities import Entities
from .routes import build_router
from .strategic import BOOK, REQUESTS as EXPERT_REQUESTS
from .writing import REQUESTS as NOTE_REQUESTS


def register(api) -> None:
    # The list itself, and the two trays the install's jobs read.
    api.register_seed_data_file(BOOK)
    api.register_seed_data_file(EXPERT_REQUESTS)
    api.register_seed_data_file(NOTE_REQUESTS)
    api.register_router(build_router(Entities(api), api))
