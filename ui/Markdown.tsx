import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';

/** A note, rendered as the reader expects rather than as a wall of `##`.
 *
 *  Written here rather than with `react-markdown`, which the host app itself
 *  uses: a plugin's screens may import only react, react-router and
 *  `pluginHost`, and the installer refuses anything else (checked, 2026-09-24).
 *  So this is a small renderer for the markdown these notes actually contain --
 *  headings, lists, tables, quotes, code, emphasis, links -- plus the two things
 *  in a vault note that are not CommonMark at all:
 *
 *  - `[[wikilinks]]`, which become in-app links;
 *  - `> [!abstract] …` callouts, which the capture passes put at the top of
 *    every company note and which would otherwise read as a quote starting with
 *    a bracket.
 *
 *  No raw HTML is ever rendered, the same safe-by-omission rule the rest of the
 *  app keeps: unknown markup shows as the text it is.
 */
const WIKILINK = /\[\[([^\]]+)\]\]/;
const LINK = /\[([^\]]*)\]\(([^)]+)\)/;
const BOLD = /\*\*([^*]+)\*\*/;
const ITALIC = /(?:^|[^*])\*([^*]+)\*/;
const CODE = /`([^`]+)`/;
const CALLOUT = /^>\s*\[!(\w+)\]\s*(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const TABLE_DIVIDER = /^\s*\|?[\s:|-]+\|[\s:|-]*$/;

/** Emphasis, code, links and wikilinks, innermost first. Returns React nodes,
 *  never HTML: a note is text from the vault and is treated as such. */
function inline(text: string, key = 0): ReactNode[] {
  if (!text) return [];
  for (const [pattern, render] of [
    [CODE, (m: RegExpExecArray) => <code key={key}>{m[1]}</code>],
    [BOLD, (m: RegExpExecArray) => <strong key={key}>{inline(m[1], key + 1)}</strong>],
    [WIKILINK, (m: RegExpExecArray) => {
      const [target, alias] = m[1].split('|');
      return (
        <Link key={key} to={`/browse/${encodeURIComponent(target.trim())}`}>
          {(alias ?? target).trim()}
        </Link>
      );
    }],
    [LINK, (m: RegExpExecArray) => (m[2].startsWith('/')
      ? <Link key={key} to={m[2]}>{m[1]}</Link>
      : <a key={key} href={m[2]} target="_blank" rel="noreferrer">{m[1]}</a>)],
  ] as const) {
    const match = (pattern as RegExp).exec(text);
    if (match) {
      const before = text.slice(0, match.index);
      const after = text.slice(match.index + match[0].length);
      return [...inline(before, key + 1), render(match), ...inline(after, key + 2)];
    }
  }
  // Italic last: its pattern has to look at the character before the `*` so it
  // does not eat the inside of `**bold**`.
  const italic = ITALIC.exec(text);
  if (italic) {
    const at = text.indexOf(`*${italic[1]}*`);
    return [
      ...inline(text.slice(0, at), key + 1),
      <em key={key}>{italic[1]}</em>,
      ...inline(text.slice(at + italic[1].length + 2), key + 2),
    ];
  }
  return [text];
}

function Table({ rows }: { rows: string[] }) {
  const cells = (line: string) =>
    line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
  const [head, ...body] = rows;
  return (
    <table>
      <thead>
        <tr>{cells(head).map((cell, i) => <th key={i}>{inline(cell)}</th>)}</tr>
      </thead>
      <tbody>
        {body.map((line, r) => (
          <tr key={r}>{cells(line).map((cell, c) => <td key={c}>{inline(cell)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export function Markdown({ children }: { children: string }) {
  const blocks = useMemo(() => parse(children || ''), [children]);
  if (!blocks.length) return null;
  return <div className="md">{blocks}</div>;
}

function parse(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) {
      out.push(<p key={out.length}>{inline(paragraph.join(' '))}</p>);
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (!line.trim()) { flush(); continue; }

    if (line.startsWith('```')) {
      flush();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i += 1; }
      out.push(<pre key={out.length}><code>{code.join('\n')}</code></pre>);
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); out.push(<hr key={out.length} />); continue; }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      const level = Math.min(heading[1].length, 4);
      const Tag = (`h${level}` as 'h1' | 'h2' | 'h3' | 'h4');
      out.push(<Tag key={out.length}>{inline(heading[2])}</Tag>);
      continue;
    }

    // A table: a header row, a divider, then rows until the block ends.
    if (line.includes('|') && TABLE_DIVIDER.test(lines[i + 1] ?? '')) {
      flush();
      const rows = [line];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(lines[i]); i += 1; }
      i -= 1;
      out.push(<Table key={out.length} rows={rows} />);
      continue;
    }

    if (line.trimStart().startsWith('>')) {
      flush();
      const quoted: string[] = [];
      let label = '';
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        const callout = CALLOUT.exec(lines[i].trim());
        if (callout) {
          label = callout[1];
          if (callout[2]) quoted.push(callout[2]);
        } else {
          quoted.push(lines[i].trim().replace(/^>\s?/, ''));
        }
        i += 1;
      }
      i -= 1;
      out.push(
        <blockquote key={out.length} className={label ? `md-callout md-${label.toLowerCase()}` : undefined}>
          {label && <span className="md-callout-kind">{label}</span>}
          <p>{inline(quoted.join(' '))}</p>
        </blockquote>,
      );
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      flush();
      const ordered = Boolean(numbered);
      const items: string[] = [];
      while (i < lines.length) {
        const item = ordered ? NUMBERED.exec(lines[i]) : BULLET.exec(lines[i]);
        if (!item) break;
        items.push(item[1]);
        i += 1;
      }
      i -= 1;
      const List = ordered ? 'ol' : 'ul';
      out.push(
        <List key={out.length}>
          {items.map((item, n) => <li key={n}>{inline(item)}</li>)}
        </List>,
      );
      continue;
    }

    paragraph.push(line.trim());
  }
  flush();
  return out;
}
