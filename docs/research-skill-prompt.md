# The prompt for the research skill

Paste this into Claude (with web search and access to this machine) to create the
scheduled task. It is the other half of the contract in the README: the Strategic
Entities screen writes the brief, this reads it and writes back.

---

Create a scheduled task called **Strategic entity enrichment** that runs every
Monday at 07:00 Asia/Dubai on this machine.

**What it is for.** A Second Brain install keeps a short list of companies that
matter to Core42 and its CBO, Sherif Tawfik. Each one can ask to be watched for
certain things. You do that watching: research on the open web, written back into
the vault where the CBO reads it. Nothing else in this system does web research,
so if you are not sure of something, say so rather than filling the gap.

**Each run, in order:**

1. **Read the brief:**
   `C:\The-Vault\config\Settings\Strategic-Enrichment.md`

   It has a table of companies and then one `### <Company>` section each, giving
   the folder, the hub note, the domains and aliases, the **topics** to watch,
   the **cadence**, anything particular to **watch for**, and when each topic was
   last done. Only companies with topics are jobs.

   The full list of strategic companies — including ones with no brief yet — is
   `C:\The-Vault\config\Settings\Strategic-Entities.md`. Do not enrich a company
   that is not in the brief; if the list has companies the brief does not, say so
   at the end of the run and stop there.

2. **Work out what is due.** Cadence against the "Last …" date for that topic:
   weekly = 7 days, fortnightly = 14, monthly = 30, "on demand" = only if it has
   never been done. Skip everything else. If nothing is due, say so and stop —
   an empty run is a good run.

3. **Research each due topic.** Use the company's domains and aliases so you are
   reading about the right company. Prefer the company's own announcements,
   regulatory filings and established press. Everything you write carries a
   source link and the date of the source. **Twelve months is the horizon**;
   older than that only if it is still the state of play.

   - `news` — results, funding, major contracts, regulatory moves, launches.
   - `opportunities` — what Core42 should look at: where this company's stated
     direction meets sovereign cloud, AI infrastructure, HPC or AI services, and
     what the CBO could raise the next time he speaks to them. Say plainly what
     is inference on your part.
   - `people` — who moved where, new decision-makers, who owns the budget now.
   - `profile` — correct the hub note itself where it is now wrong or stale.

4. **Write what you found**, in the company's folder (the brief gives the exact
   path — do not guess it):

   - `news` → `<Company>-news.md`
   - `opportunities` → `<Company>-opportunities.md`
   - `people` → `<Company>-org-moves.md`
   - `profile` → edit the hub note itself, carefully (see the rules below)

   A findings file starts with frontmatter copying the company's own tags from
   its hub note, then newest section first:

   ```
   ---
   type: "Research"
   name: "ADNOC News"
   parent: "[[ADNOC]]"
   tags: ["customer/adnoc", "kind/research"]
   ---

   ## 2026-09-28

   - ADNOC took final investment decision on … ([Reuters, 2026-09-24](https://…))
   ```

   Append a new dated section above the previous ones; never rewrite what an
   earlier run wrote. At most six bullets per topic per run — this is read by a
   busy person, and a long list is a list nobody reads. If there is genuinely
   nothing new, write nothing and record the run anyway (step 5) so the screen
   shows it was looked at.

5. **Report each topic you did**, so the screen knows when it was last looked at:

   ```
   POST http://127.0.0.1:8001/plugins/strategic-entities/entities/<stem>/enrichment/done
   Content-Type: application/json

   {"topic": "news", "file": "ADNOC-news.md", "summary": "one line about what you found"}
   ```

   `<stem>` is the company as the brief names it, URL-encoded. Topics are exactly
   `news`, `opportunities`, `profile`, `people`. If the backend is not running,
   still write the files and say in your summary that the report could not be
   sent.

**Rules that matter more than finishing:**

- **Never touch** `<Company>-captures.md`, `<Company>-history.md` or
  `<Company>-notes.md`. Those are the record of our own dealings and the CBO's
  own writing; they are not yours to edit.
- **Editing the hub note** (`profile`): keep its frontmatter, keep the
  ` ```mermaid ` group-structure block unless the structure itself has genuinely
  changed, and never remove the `## Personal Notes`, `## Actions` or `##
  Related` sections. Change the sentences that are wrong; leave the rest alone.
- **No invention.** No figure without a source, no "reportedly" standing in for a
  fact you could not find, no rewriting an uncertainty into a claim. Say "I could
  not find" — that is useful.
- **Say when something matters more than it looks**: a leadership change on an
  account we have an open action with, a competitor's win at a company we are
  bidding into. One line, at the top of that run's section.
- This vault writes links as `[[Note Name]]`; use that for companies and people
  that already exist in it, plain text for anyone who does not.

At the end of a run, report: which companies were due, what you wrote, what you
found nothing on, and anything about the brief that looked wrong.
