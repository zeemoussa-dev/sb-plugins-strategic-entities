import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../pluginHost/api';
import { ChartCard, NoteBody, embedsIn } from './NoteBody';
import { addNote, fetchEntity, saveCaptures, type EntityDetail } from './client';

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

/** This entity's text, through the host renderer, with its own charts drawn
 *  where the note embeds them. */
function Body({ entity, text }: { entity: EntityDetail; text: string }) {
  return (
    <NoteBody text={text} stem={entity.stem}
              charts={entity.contents.charts.map((chart) => chart.file)}
              resolvedStems={entity.resolved_stems} />
  );
}

/** The captures are the vault's record of what happened, and they can be wrong
 *  in a way only the reader notices. Editable here, saved exactly as given --
 *  nothing rewrites the record. */
function Captures({ entity, onSaved }: { entity: EntityDetail; onSaved: () => void }) {
  const [text, setText] = useState(entity.captures);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const changed = text !== entity.captures;

  function save(event: FormEvent) {
    event.preventDefault();
    setState('saving');
    setError('');
    saveCaptures(entity.stem, text).then(() => {
      setState('saved');
      setEditing(false);
      onSaved();
    }, (e) => { setError(reason(e)); setState('idle'); });
  }

  if (!entity.contents.captures) {
    return <p className="text-muted">Nothing captured for {entity.name} yet.</p>;
  }

  // Reading is what this tab is mostly for; editing is a mode you enter, so the
  // record reads as a record rather than as a form.
  if (!editing) {
    return (
      <>
        <div className="entity-editor-actions">
          <button type="button" className="btn" onClick={() => setEditing(true)}>Edit</button>
          <span className="text-muted">{entity.contents.captures}</span>
        </div>
        <Body entity={entity} text={entity.captures} />
      </>
    );
  }

  return (
    <form onSubmit={save}>
      <div className="entity-split">
        <textarea className="input entity-editor" value={text} rows={22}
                  onChange={(event) => { setText(event.target.value); setState('idle'); }} />
        <div className="entity-preview">
          <span className="text-muted">Preview</span>
          <Body entity={entity} text={text} />
        </div>
      </div>
      {error && <p className="text-warning">{error}</p>}
      <div className="entity-editor-actions">
        <button className="btn btn-primary" type="submit" disabled={!changed || state === 'saving'}>
          {state === 'saving' ? 'Saving…' : 'Save captures'}
        </button>
        <button type="button" className="btn" onClick={() => { setText(entity.captures); setEditing(false); }}>
          {changed ? 'Discard' : 'Done'}
        </button>
        {state === 'saved' && <span className="text-muted">Saved as given.</span>}
      </div>
    </form>
  );
}

/** A note the agent tidied keeps what was typed in a `<details>` block, which is
 *  raw HTML and deliberately not rendered as such. Split here instead: the
 *  tidied prose reads as prose, and the original is one click away. */
function WrittenNotes({ text, entity }: { text: string; entity: EntityDetail }) {
  const parts = text.split(/<details><summary>as typed<\/summary>|<\/details>/);
  if (parts.length < 2) return <Body entity={entity} text={text} />;
  const [tidied, original, ...rest] = parts;
  return (
    <>
      <Body entity={entity} text={tidied + rest.join('')} />
      <details className="entity-as-typed">
        <summary>as you typed it</summary>
        <Body entity={entity} text={original} />
      </details>
    </>
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
        ? <WrittenNotes text={entity.notes} entity={entity} />
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

const TABS = ['Overview', 'Captures', 'Notes', 'People'] as const;

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
  const shown = embedsIn(entity.note);
  const unshown = contents.charts.filter((chart) => !shown.includes(chart.file));
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
            {name === 'People' && contents.people.length ? ` (${contents.people.length})` : ''}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'Overview' && (
          <>
            {entity.note.trim()
              ? <Body entity={entity} text={entity.note} />
              : <p className="text-muted">The hub note is empty.</p>}
            {/* The note draws the charts it embeds, where it embeds them. Any
                other picture in _assets still belongs to this company and is
                shown after it rather than nowhere. */}
            {unshown.map((chart) => (
              <ChartCard key={chart.file} stem={entity.stem} file={chart.file} />
            ))}
          </>
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
