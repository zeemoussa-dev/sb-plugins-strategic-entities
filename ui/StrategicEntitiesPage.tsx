import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  dropStrategic,
  fetchEntities,
  fetchStrategic,
  makeStrategic,
  type Entity,
} from './client';

/** The short list, and the way to change it.
 *
 *  Adding a company here is not a bookmark: it creates an Expert scoped to that
 *  company's folder and tags, so there is somebody to ask about it. Removing it
 *  deletes that Expert again (operator, 2026-09-24). The screen says so at the
 *  moment of pressing, because a favourites star that quietly creates an agent
 *  would be a surprise the second time. */
function Row({ entity, onChanged }: { entity: Entity; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');

  function drop() {
    if (!window.confirm(
      `Remove ${entity.name} from Strategic Entities?\n\n`
      + `Its Expert (${entity.expert_id ?? 'none'}) is deleted too. `
      + `Nothing in ${entity.name}'s own folder is touched.`)) return;
    setBusy(true);
    dropStrategic(entity.stem).then((answer) => {
      setSaid(answer.note ?? '');
      setBusy(false);
      onChanged();
    }, () => setBusy(false));
  }

  return (
    <div className="item-row">
      <div className="item-row-main">
        <Link className="item-row-title" to={`/strategic-entities/${encodeURIComponent(entity.stem)}`}>
          {entity.name}
        </Link>
        <span className="item-row-meta">
          {entity.kind}
          {entity.expert_id ? ` · ${entity.expert_id}` : ''}
          {entity.missing ? ' · no longer in the vault' : ''}
          {said ? ` · ${said}` : ''}
        </span>
      </div>
      <button type="button" className="btn" disabled={busy} onClick={drop}>
        {busy ? 'Removing…' : 'Remove'}
      </button>
    </div>
  );
}

function AddOne({ onChanged }: { onChanged: () => void }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Entity[] | null>(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) { setFound(null); return; }
    let live = true;
    fetchEntities(query.trim()).then((rows) => { if (live) setFound(rows.slice(0, 8)); });
    return () => { live = false; };
  }, [query]);

  function add(entity: Entity) {
    if (!window.confirm(
      `Make ${entity.name} strategic?\n\n`
      + `An Expert is created for it, scoped to its folder and tags, and answers `
      + `questions about it in Cockpit.`)) return;
    setBusy(entity.stem);
    makeStrategic(entity.stem).then(() => {
      setBusy('');
      setQuery('');
      setFound(null);
      onChanged();
    }, () => setBusy(''));
  }

  return (
    <div className="card strategic-add">
      <h2>Add one</h2>
      <input className="input" type="search" value={query}
             placeholder="Search customers, partners, affiliates, opportunities"
             onChange={(event) => setQuery(event.target.value)} />
      {found && found.length === 0 && <p className="text-muted">Nothing by that name.</p>}
      {found && found.length > 0 && (
        <div className="item-list">
          {found.map((entity) => (
            <div className="item-row" key={entity.stem}>
              <div className="item-row-main">
                <span className="item-row-title">{entity.name}</span>
                <span className="item-row-meta">
                  {entity.kind}
                  {entity.aliases.length ? ` · also ${entity.aliases.slice(0, 3).join(', ')}` : ''}
                </span>
              </div>
              {entity.strategic
                ? <span className="badge">Already strategic</span>
                : (
                  <button type="button" className="btn btn-primary"
                          disabled={busy === entity.stem} onClick={() => add(entity)}>
                    {busy === entity.stem ? 'Creating the Expert…' : 'Make strategic'}
                  </button>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StrategicEntitiesPage() {
  const [rows, setRows] = useState<Entity[] | null>(null);

  const load = useCallback(() => { fetchStrategic().then(setRows); }, []);
  useEffect(load, [load]);

  return (
    <>
      <h1>Strategic Entities</h1>
      <p className="text-muted">
        The companies that matter enough to have their own Expert. Open one to see
        everything the vault holds on it.
      </p>

      <AddOne onChanged={load} />

      {rows && rows.length > 0 && (
        <div className="card">
          <div className="item-list">
            {rows.map((entity) => (
              <Row key={entity.stem} entity={entity} onChanged={load} />
            ))}
          </div>
        </div>
      )}
      {rows && rows.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">&#9733;</div>
            <p><strong>No strategic entities yet.</strong></p>
            <p className="text-muted">
              Search above for a company. Adding it creates an Expert scoped to it.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
