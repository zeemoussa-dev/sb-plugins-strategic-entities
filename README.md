# Strategic Entities

The companies that matter, in the Second Brain side panel.

Adding one creates an **Expert** scoped to that company's folder and tags, so
there is somebody to ask about it. Removing one deletes that Expert again.
Opening one shows what the vault holds: the hub note, its charts, its people,
the captures -- which can be corrected there -- and your own notes, which an
agent tidies while keeping what you typed.

## Enrichment: what this plugin hands to a research skill

The research is not done here. Compass is weak at it (operator, 2026-09-26), so
the work belongs to a Claude skill on its own schedule; this plugin owns the
**brief** and the **record**, and nothing in it fetches anything.

**The brief** is `Settings/Strategic-Enrichment.md` in the App Database Folder --
markdown, so it can be read off disk without this backend running, and edited by
hand. It carries one section per company: the folder, the hub note, the domains
and aliases, the topics ticked on the screen, the cadence, anything particular
to watch for, and when each topic was last done. The same thing as data:

    GET /plugins/strategic-entities/enrichment

**Topics** are `news`, `opportunities` ("what Core42 should look at"), `profile`
(refresh the hub note itself) and `people`. **Cadence** is weekly, fortnightly,
monthly or on demand -- a hint for the schedule, not something this plugin acts
on.

**Where findings go is the skill's decision** -- news in its own file beside the
hub note, a profile refresh into the note itself. Any `.md` file in a company's
folder that is not its note, captures, history or personal notes appears as its
own tab on that company's page, named after the file, so a skill can invent
`<Name>-news.md` without this plugin being taught about it.

**Handing back** what it did, so the screen can say when a topic was last looked
at:

    POST /plugins/strategic-entities/entities/<stem>/enrichment/done
    {"topic": "news", "file": "ADNOC-news.md", "summary": "one line"}

The last run of each topic is kept, because the question it answers is "when was
this last looked at".

## Installing

This plugin installs from this repository (`ADR-024`):

    POST /marketplace/source/install
    {"kind": "git", "location": "https://github.com/zeemoussa-dev/sb-plugins-strategic-entities", "ref": "main"}

It needs `framework_api` 3 (Second Brain 0.5.0 or later). The Expert a strategic
company is given is the framework's own `POST /agents`, which the screen calls
directly. Tidying a note is the install's `SB strategic notes` job, in the agent
repository, because a plugin cannot call a model itself.

A note is rendered through `pluginHost/noteText` -- the same component the vault
browser uses, diagrams included (framework `BUG-078`, fixed in 0.7.0). The plugin
draws only the entity's own charts, which are vault files rather than anything
markdown can fetch.

## Tests

    python -m pytest
