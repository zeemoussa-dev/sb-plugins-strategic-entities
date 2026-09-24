import { useEffect, useState, type ReactNode } from 'react';
import { NoteText } from '../../pluginHost/noteText';
import { fetchChart, type Chart } from './client';

/** A note from the vault, rendered the way the rest of the app renders one.
 *
 *  This used to be ~380 lines of the plugin's own markdown and mermaid
 *  renderers, written because a screen could import neither (framework
 *  `BUG-078`, raised from here). Second Brain 0.7.0 put `NoteText` in the host
 *  contract, so the note, its headings, its wikilinks and its `flowchart TD`
 *  now go through the same component the vault browser uses -- one app, one
 *  note, one rendering.
 *
 *  Since framework 0.8.1 the renderer resolves the note's own `[[wikilinks]]`
 *  itself (`BUG-079`, also raised from here), so nothing has to be handed to it
 *  but the text.
 *
 *  The one thing left here is the entity's own charts. A company note embeds
 *  its picture with `![[ADNOC-profile.svg]]`, which is a vault file rather than
 *  anything markdown can fetch: a plugin screen is handed `apiFetch` and does
 *  not know the backend's address, so the picture comes through this plugin's
 *  own route. The text around it is split at those lines and handed to the host
 *  renderer, so the chart stays exactly where the note put it.
 */
const EMBED = /^!\[\[([^\]]+)\]\]$/;

/** Every file a note embeds, in order -- so a page can tell which of an
 *  entity's charts the note already shows. */
export function embedsIn(text: string): string[] {
  const found: string[] = [];
  for (const match of (text || '').matchAll(/!\[\[([^\]]+)\]\]/g)) {
    const target = match[1].split('|')[0].trim();
    if (target && !found.includes(target)) found.push(target);
  }
  return found;
}

/** A chart, drawn. The vault is not on the web, so the picture comes through
 *  the backend: an SVG as text to put straight into the page, anything else as
 *  a data URL. */
export function ChartCard({ stem, file, caption = true }: {
  stem: string; file: string; caption?: boolean;
}) {
  const [chart, setChart] = useState<Chart | null>(null);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    fetchChart(stem, file).then(setChart, (error) => setFailed(String(error)));
  }, [stem, file]);

  return (
    <figure className="entity-chart">
      {caption && <figcaption className="text-muted">{file}</figcaption>}
      {failed && <p className="text-warning">{failed}</p>}
      {chart?.svg && (
        <div className="entity-chart-svg" dangerouslySetInnerHTML={{ __html: chart.svg }} />
      )}
      {chart?.data_url && <img src={chart.data_url} alt={file} />}
      {!chart && !failed && <p className="text-muted">Loading…</p>}
    </figure>
  );
}

export function NoteBody({ text, stem, charts }: {
  text: string;
  stem: string;
  charts: string[];
}) {
  const blocks: ReactNode[] = [];
  let run: string[] = [];

  const flush = () => {
    if (run.join('\n').trim()) {
      blocks.push(<NoteText key={blocks.length} text={run.join('\n')} />);
    }
    run = [];
  };

  for (const line of (text || '').split('\n')) {
    const embed = EMBED.exec(line.trim());
    const target = embed ? embed[1].split('|')[0].trim() : '';
    // Only this entity's own charts are drawn; anything else the note embeds is
    // left to the host renderer rather than turned into a broken picture.
    if (target && charts.includes(target)) {
      flush();
      blocks.push(<ChartCard key={blocks.length} stem={stem} file={target} caption={false} />);
    } else {
      run.push(line);
    }
  }
  flush();

  if (!blocks.length) return null;
  return <div className="md">{blocks}</div>;
}
