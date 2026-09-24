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

It needs `framework_api` 3 (Second Brain 0.5.0 or later), and the install's own
`SB strategic experts` and `SB strategic notes` jobs, which live in the agent
repository: a plugin can neither create an agent nor call a model
(framework `REQ-SB-93`).

## Tests

    python -m pytest
