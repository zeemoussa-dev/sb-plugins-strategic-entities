# MEMORY.md

What working on this plugin has taught, beyond what the code says.

## Decisions

- **[2026-09-24] Adding an entity here is not a bookmark.** It creates an Expert
  scoped to that company's folder and tags, and removing it deletes that Expert
  (operator's choice, both). The screen says so before it does either, because a
  star that quietly creates an agent is a surprise the second time.

- **[2026-09-24] Notes are tidied by a model; what was typed is kept underneath.**
  The operator asked for the text to be made more appealing. It is saved as typed
  first and rewritten second, and the original stays in the file: rewriting
  somebody's words is only acceptable while the words are still there.

- **[2026-09-24] Captures are never rewritten.** They are the record of what
  happened. The screen can correct one, because the reader is the person who
  notices it is wrong, and it is saved exactly as given.

## Constraints

- **[2026-09-24] A plugin cannot create an agent, and cannot find where agents
  live.** `api.agents` only reads; the data root is in `settings`, not in
  `os.environ`, so `SECOND_BRAIN_DATA_PATH` is not available either. Logged as
  framework `REQ-SB-93`. Until it lands, the install's `SB strategic experts` job
  does the writing and this plugin only asks.

- **[2026-09-24] A plugin screen cannot point an `<img>` at the backend.** It is
  handed `apiFetch` and nothing else, so it never learns the API's address. A
  chart therefore comes back through JSON: an SVG as text, anything else as a
  data URL.
