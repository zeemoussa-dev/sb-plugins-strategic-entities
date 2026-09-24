import { useMemo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router';

/** A note, rendered as the reader expects rather than as a wall of `##`.
 *
 *  `react-markdown` + `remark-gfm` are the host app's own dependencies and its
 *  own way of doing this (`features/vault-browser/NoteBody.tsx`); this file
 *  uses the same libraries rather than a second, subtly different renderer.
 *  What it must not do is import that component: a plugin's screen may call the
 *  app's API, but its code is its own.
 *
 *  Two things in these notes are not CommonMark and would otherwise render as
 *  punctuation:
 *
 *  - `[[wikilinks]]`, Obsidian's syntax, which become in-app links.
 *  - `> [!abstract] …` callouts, which the capture passes write at the top of
 *    every company note; rendered as a labelled block rather than a quote
 *    beginning with a bracket.
 *
 *  Raw HTML is deliberately NOT enabled (no `rehype-raw`, no
 *  `dangerouslySetInnerHTML`) -- the same safe-by-omission rule the rest of the
 *  app keeps. The one place this plugin does inject HTML is a chart's own SVG,
 *  which it fetched from this vault itself.
 */
const WIKILINK = /\[\[([^\]]+)\]\]/g;
const CALLOUT = /^>\s*\[!(\w+)\]\s*(.*)$/;

function wikilinksToLinks(text: string): string {
  return text.replace(WIKILINK, (_match, inner: string) => {
    const [target, alias] = String(inner).split('|');
    const name = (alias ?? target).trim();
    return `[${name}](/browse/${encodeURIComponent(target.trim())})`;
  });
}

/** `> [!abstract] Big summary` -> a real block with its kind as a label.
 *  Done before markdown, because a blockquote whose first characters are
 *  `[!abstract]` renders as exactly that text. */
function calloutsToBlocks(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const match = CALLOUT.exec(line);
    if (!match) {
      out.push(line);
      continue;
    }
    const [, kind, rest] = match;
    out.push(`> **${kind[0].toUpperCase()}${kind.slice(1)}**`, ">", `> ${rest}`.trimEnd());
  }
  return out.join("\n");
}

export function Markdown({ children }: { children: string }) {
  const text = useMemo(() => wikilinksToLinks(calloutsToBlocks(children || "")), [children]);
  if (!text.trim()) return null;
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // An in-app link navigates without a page reload; a real URL opens
          // where a real URL should.
          a({ href, children: inner }: { href?: string; children?: ReactNode }) {
            const target = href ?? "";
            if (target.startsWith("/")) return <Link to={target}>{inner}</Link>;
            return <a href={target} target="_blank" rel="noreferrer">{inner}</a>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
