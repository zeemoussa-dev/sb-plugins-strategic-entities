import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../pluginHost/api';
import {
  addNote,
  fetchChart,
  fetchEntity,
  saveCaptures,
  type Chart,
  type EntityDetail,
} from './client';

function reason(error: unknown): string {
  if (error instanceof ApiError) {
    try {
      return JSON.parse(error.message).detail ?? error.message;
    } catch {
      return error.message;
    }
  }
  return String(error);
}

/** A chart, drawn. The vault is not on the web, so the picture comes through
 *  the backend: an SVG as text to put straight into the page, anything else as
 *  a data URL. */
function ChartCard({ stem, file }: { stem: string; file: string }) {
  const [chart, setChart] = useState<Chart | null>(null);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    fetchChart(stem, file).then(setChart, (error) => setFailed(reason(error)));
  }, [stem, file]);

  return (
    <figure className="entity-chart">
      <figcaption className="text-muted">{file}</figcaption>
      {failed && <p className="text-warning">{failed}</p>}
      {chart?.svg && (
        <div className="entity-chart-svg" dangerouslySetInnerHTML={{ __html: chart.svg }} />
      )}
      {chart?.data_url && <img src={chart.data_url} alt={file} />}
      {!chart && !failed && <p className="text-muted">Loading…</p>}
    </figure>
  );
}

/** The captures are the vault's record of what happened, and they can be wrong
 *  in a way only the reader notices. Editable here, saved exactly as given --
 *  nothing rewrites the record. */
function Captures({ entity, onSaved }: { entity: EntityDetail; onSaved: () => void }) {
  const [text, setText] = useState(entity.captures);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');
  const changed = text !== entity.captures;

  function save(event: FormEvent) {
    event.preventDefault();
    setState('saving');
    setError('');
    saveCaptures(entity.stem, text).then(() => {
      setState('saved');
      onSaved();
    }, (e) => { setError(reason(e)); setState('idle'); });
  }

  if (!entity.contents.captures) {
    return <p className="text-muted">Nothing captured for {entity.name} yet.</p>;
  }

  return (
    <form onSubmit={save}>
      <textarea className="input entity-editor" value={text} rows={18}
                onChange={(event) => { setText(event.target.value); setState('idle'); }} />
      {error && <p className="text-warning">{error}</p>}
      <div className="entity-editor-actions">
        <button className="btn btn-primary" type="submit" disabled={!changed || state === 'saving'}>
          {state === 'saving' ? 'Saving…' : 'Save captures'}
        </button>
        {state === 'saved' && <span className="text-muted">Saved as given.</span>}
        <span className="text-muted">{entity.contents.captures}</span>
      </div>
    </form>
  );
}

/** His own notes. Saved as typed, then tidied by the agent -- with what he
 *  typed kept underneath, because a model rewriting somebody's words is only
 *  acceptable while the words are still there. */
function Notes({ entity, onSaved }: { entity: EntityDetail; onSaved: () => void }) {
  const [text, setText] = useState('');
  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState(false);

  function save(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    addNote(entity.stem, text).then((answer) => {
      setText('');
      setSaid(answer.note ?? 'Saved.');
      setBusy(false);
      onSaved();
    }, (error) => { setSaid(reason(error)); setBusy(false); });
  }

  return (
    <>
      {entity.notes
        ? <pre className="entity-notes">{entity.notes}</pre>
        : <p className="text-muted">No notes yet.</p>}
      <form className="entity-note-form" onSubmit={save}>
        <textarea className="input" rows={4} value={text}
                  placeholder="What you want remembered about this company"
                  onChange={(event) => setText(event.target.value)} />
        <div className="entity-editor-actions">
          <button className="btn btn-primary" type="submit" disabled={busy || !text.trim()}>
            {busy ? 'Saving…' : 'Add note'}
          </button>
          {said && <span className="text-muted">{said}</span>}
        </div>
      </form>
    </>
  );
}

const TABS = ['Overview', 'Charts', 'Captures', 'Notes', 'People'] as const;

export function EntityPage() {
  const { stem = '' } = useParams<{ stem: string }>();
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');

  const load = useCallback(() => {
    fetchEntity(stem).then(setEntity, (error) => {
      if (error instanceof ApiError && error.status === 404) setMissing(true);
    });
  }, [stem]);
  useEffect(load, [load]);

  const back = (
    <p className="text-muted">
      <Link className="text-muted" to="/strategic-entities">&larr; Strategic Entities</Link>
    </p>
  );
  if (missing) return <>{back}<div className="card"><p>No entity named "{stem}".</p></div></>;
  if (!entity) return <>{back}<p className="text-muted">Loading…</p></>;

  const { contents } = entity;
  return (
    <>
      {back}
      <div className="card">
        <span className="badge">{entity.kind}</span>
        {entity.strategic && <span className="badge">Strategic</span>}
        <h1>{entity.name}</h1>
        <p className="text-muted">
          {entity.domains.join(', ')}
          {entity.aliases.length ? ` · also ${entity.aliases.join(', ')}` : ''}
          {entity.expert_id ? ` · Expert: ${entity.expert_id}` : ''}
        </p>
        <p className="entity-counts text-muted">
          {contents.people.length} people · {contents.charts.length} charts
          {contents.affiliates.length ? ` · ${contents.affiliates.length} affiliates` : ''}
          {contents.other_files.length ? ` · ${contents.other_files.length} other files` : ''}
        </p>
        <Link className="btn" to={`/browse/${encodeURIComponent(entity.stem)}`}>Open the note</Link>
      </div>

      <div className="entity-tabs">
        {TABS.map((name) => (
          <button key={name} type="button"
                  className={tab === name ? 'is-selected' : undefined}
                  onClick={() => setTab(name)}>
            {name}
            {name === 'Charts' && contents.charts.length ? ` (${contents.charts.length})` : ''}
            {name === 'People' && contents.people.length ? ` (${contents.people.length})` : ''}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'Overview' && (
          entity.note.trim()
            ? <pre className="entity-note">{entity.note}</pre>
            : <p className="text-muted">The hub note is empty.</p>
        )}
        {tab === 'Charts' && (
          contents.charts.length
            ? contents.charts.map((chart) => (
              <ChartCard key={chart.file} stem={entity.stem} file={chart.file} />
            ))
            : <p className="text-muted">No charts in this company&apos;s assets.</p>
        )}
        {tab === 'Captures' && <Captures entity={entity} onSaved={load} />}
        {tab === 'Notes' && <Notes entity={entity} onSaved={load} />}
        {tab === 'People' && (
          contents.people.length
            ? (
              <ul className="entity-people">
                {contents.people.map((person) => (
                  <li key={person}>
                    <Link to={`/browse/${encodeURIComponent(person)}`}>{person}</Link>
                  </li>
                ))}
              </ul>
            )
            : <p className="text-muted">Nobody filed under this company yet.</p>
        )}
      </div>
    </>
  );
}
