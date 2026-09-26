# CHANGELOG

All notable changes to the Strategic Entities plugin.

## [0.8.1] - 2026-09-26

- fix: the brief could not be written. A plugin may only write data files it registered, and the two new ones were not -- so saving a brief was a 500. Caught on the live install rather than in tests, where the API is stubbed.

## [0.8.0] - 2026-09-26

- feat: **a brief for a research skill** (operator, 2026-09-26). Each strategic company can be ticked for news, what Core42 should look at, a profile refresh or people and org moves, with a cadence and anything particular to watch for. It is written to `Settings/Strategic-Enrichment.md` -- readable off disk without this backend -- and served at `GET /enrichment` with each company's folder, note, domains and aliases, because a skill needs to know where to write, not just what the company is called.
- feat: the skill says what it did (`POST /entities/{stem}/enrichment/done`), and the screen shows when each topic was last looked at and which file it went into. Nothing here fetches anything: the research is a Claude skill on its own schedule, so there is deliberately no "run now" button promising something this plugin cannot do.
- feat: **whatever the skill writes shows up by itself**. Any markdown in a company's folder that is not its note, captures, history or personal notes becomes its own tab, named after the file -- so `<Name>-news.md` appears without the plugin being taught about it.

## [0.7.0] - 2026-09-25

- fix: **a company whose note shares a name with another note is listed again.** The companies were read from the vault index, which keeps one note per filename (framework `BUG-076`), so a company with a thread named after it simply was not there. It walks `entries()` now -- every note -- which is what framework v5 separated the two calls for.
- feat: the plugin stopped resolving wikilinks for the renderer. `NoteText` asks the backend which of a text's own `[[targets]]` exist (framework `BUG-079`, raised from here), so the `resolved_stems` this API computed and shipped with every entity is gone, and a link works the same here as in chat and the vault browser.
- chore: `framework_api` 5.

## [0.6.0] - 2026-09-25

- feat: **the plugin stopped writing its own renderer**. Second Brain 0.7.0 put `NoteText` in the host contract (framework `BUG-078`, raised from here), so a note, its headings, its wikilinks and its `flowchart TD` now render through the same component the vault browser uses. `Markdown.tsx` and `Flowchart.tsx` are deleted -- 380 lines that existed only because a screen could import neither the renderer nor mermaid, and that had begun to draw the same file differently from the rest of the app. ADNOC's group structure is real mermaid on this screen now.
- feat: a wikilink in a company's text links to the note when the note is really here, and reads as plain text when it is not -- the detail response says which targets resolve (`resolved_stems`), because the host renderer refuses to invent a link the vault cannot honour.
- keep: the company's own chart still draws where the note embeds it. A vault file is not something markdown can fetch -- a screen has `apiFetch` and no address -- so the text is split at those lines and the picture comes through this plugin's route.
- chore: `framework_api` 4.

## [Unreleased]

## [0.5.0] - 2026-09-24

- feat: **the charts are in the note, not in a tab** (operator, 2026-09-24: "I need as well charts to be rendered inline this should not be separete tab"). Every company note embeds its own profile chart with `![[ADNOC-profile.svg]]` -- 465 of them in this vault -- and the renderer read that as an exclamation mark followed by a link, so the picture the note was written around ended up in a tab of its own. An embed now draws the chart where the note puts it, and the **Charts** tab is gone.
- feat: an embed that is not a chart of this company stays a link to the file rather than becoming a broken image, and a picture in `_assets` that no note mentions is still shown, under the note -- nothing in the folder goes unseen.

## [0.4.1] - 2026-09-24

- fix: a dotted link is still a link. ADNOC's affiliates hang off `n0 -.- AFFS`, and the first version matched only `-->`, `---`, `===` and `-.->` -- so the whole **Affiliates / JVs / partners** group silently vanished from the drawing. Any run of mermaid's link characters counts now (`-.-`, `==>`, `--o`, `--x` and the rest); only the invisible `~~~` is still ignored, because it forces layout rather than claiming a relationship.

## [0.4.0] - 2026-09-24

- feat: **the group structure is drawn** (operator, 2026-09-24: "Group Structure in Adnoc in strategic Entities is not rendered"). Every company note carries a mermaid `flowchart TD` -- 337 of them in this vault -- and nothing in the app renders mermaid: there is no such dependency, and a plugin's screens may import only react, react-router and `pluginHost`. So the plugin reads the small dialect those notes use (nodes, arrows, `subgraph` groups) and lays it out top-down: what owns the company, the company itself, then the groups hanging off it. Mermaid's invisible `~~~` links are ignored rather than drawn as relationships the note never claimed.
- feat: nothing is lost to the drawing. An edge it cannot place appears under **Other relations**, a diagram with no marked centre falls back to its source, and **Show the diagram source** is always there.

## [0.3.1] - 2026-09-24

- fix: the captures no longer open with their own frontmatter. `type: "Captures"`, `parent`, `tags` are the note's machinery, not the record; they are hidden on screen and written back untouched when he saves, so correcting a capture cannot break the note.

## [0.3.0] - 2026-09-24

- change: notes, captures and the hub note are **rendered as documents**, not dumped as text (operator, 2026-09-24: "The Rendering looks really bad for both editing and Viewing"). Headings, lists, tables, quotes, code and emphasis, styled to match the app; `[[wikilinks]]` become in-app links and `> [!abstract]` callouts become labelled blocks, both being Obsidian syntax that CommonMark renders as punctuation. Written in the plugin rather than with the host's own `react-markdown`: **a plugin's screens may import only react, react-router and `pluginHost`**, and the installer refuses anything else -- which it did, with a clear message, when this was first tried.
- change: editing the captures is a **mode with a live preview beside it**, not a permanent textarea. Reading is the default, because that tab is mostly read; **Edit** opens the two-column view and **Discard** leaves it. Raw HTML is still never rendered.
- change: a tidied note shows the agent's prose, with **as you typed it** collapsed underneath rather than the raw `<details>` markup running through the page.

## [0.2.0] - 2026-09-24

- change: **the Expert is created through the framework's own `POST /agents`**, and deleted with `DELETE /agents/{id}` (operator, 2026-09-24: "the Plugin can use the API for Creating Agents in the framework"). One call makes the Hermes profile and the Registry files together; the plugin decides what the Expert should be -- its name, section, scope and soul -- and the screen makes the call.
- fix: the first version asked a Hermes job to write those files by hand, because `api.plugin_api`'s `AgentsApi` only lists Experts. That facade is for a plugin's backend; a plugin's screen may call the app's own API like any other part of the frontend. The job, its launcher and the four scripts behind it are gone, and framework `REQ-SB-93` is withdrawn.
- fix: an agent written as Registry files alone is invisible. The app lists agents from Hermes profiles, so the half-built Expert from that first attempt never appeared -- which is what the API does properly in one call.

## [0.1.0] - 2026-09-24

- feat: the plugin's first shape. **Strategic Entities** in the side panel: the short list of companies that matter, searchable across customers, partners, affiliates and opportunities. Adding one writes it to `Settings/Strategic-Entities.md` and asks the install's Hermes job for an **Expert scoped to that company's folder and tags**; removing one asks for that Expert to be deleted. The company's own notes are never touched by either.
- feat: an entity's own screen -- the hub note, its **charts drawn** (SVG as text, anything else as a data URL, because a plugin screen cannot point an `<img>` at the backend), its people, its **captures, editable and saved exactly as given**, and the operator's **notes, saved as typed and then tidied by an agent with the original kept underneath**.
- test: 15, against a stubbed Plugin API and a real folder -- that a folder is not an entity (the note's `type` says so), that a Person note is not one either, that a file outside the folder cannot be asked for, that adding twice asks for one Expert, and that removing leaves the company's own files alone.
- docs: `REQ-SB-93` logged in the framework -- a plugin cannot create the Expert its feature is built on, nor find where agents live.
