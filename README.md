# Strategic Entities

The companies that matter, in the Second Brain side panel.

Adding one creates an **Expert** scoped to that company's folder and tags, so
there is somebody to ask about it. Removing one deletes that Expert again.
Opening one shows what the vault holds: the hub note, its charts, its people,
the captures -- which can be corrected there -- and your own notes, which an
agent tidies while keeping what you typed.

## Installing

This plugin installs from this repository (`ADR-024`):

    POST /marketplace/source/install
    {"kind": "git", "location": "https://github.com/zeemoussa-dev/sb-plugins-strategic-entities", "ref": "main"}

It needs `framework_api` 3 (Second Brain 0.5.0 or later). The Expert a strategic
company is given is the framework's own `POST /agents`, which the screen calls
directly. Tidying a note is the install's `SB strategic notes` job, in the agent
repository, because a plugin cannot call a model itself.

A note's mermaid diagram is drawn by the plugin's own small renderer: the app has
no mermaid (framework `REQ-SB-94`), and this deletes itself the day it does.

## Tests

    python -m pytest
