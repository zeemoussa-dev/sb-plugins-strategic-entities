import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiFetch } from '../../pluginHost/api';
import type { EntityDetail } from './client';

/** What is outstanding with this company, on the company's own page.
 *
 *  The actions live in the Action Center and stay there -- this asks it for
 *  the ones tagged with this company and shows them, rather than keeping a
 *  second copy of anybody's commitments (operator, 2026-09-29: "include
 *  Actions Related to them ... will simplify things a lot"). Every row opens
 *  the action itself, where it can be chased, closed or reassigned.
 *
 *  Matched on the thread's own company TAG, not on the name: a company gets
 *  renamed and its tag does not.
 */
interface Action {
  stem: string;
  subject: string;
  owner: string;
  owner_email: string | null;
  due: string | null;
  overdue: boolean;
  status: string;
  asked_at: string | null;
  completed_at: string | null;
  evidence: string | null;
}

const ACTION_CENTER = '/plugins/action-center';

function ask(entity: EntityDetail, status: string): Promise<Action[]> {
  // The tag first; the name is the fallback for an action linked before the
  // tag was written, or by hand.
  const by = entity.entity_tag
    ? `entity_tag=${encodeURIComponent(entity.entity_tag)}`
    : `entity=${encodeURIComponent(entity.name)}`;
  return apiFetch<Action[]>(`${ACTION_CENTER}/actions?status=${status}&${by}`);
}

function Row({ action }: { action: Action }) {
  const meta = [
    action.owner || 'Unassigned',
    action.due ? `due ${action.due}` : null,
    action.asked_at ? `asked ${action.asked_at.slice(0, 10)}` : null,
  ].filter(Boolean);
  return (
    <Link className="item-row action-row-link"
          to={`/action-center/action/${encodeURIComponent(action.stem)}`}>
      <div className="item-row-main">
        <span className="item-row-title">{action.subject}</span>
        <span className="item-row-meta">{meta.join(' · ')}</span>
      </div>
      {action.overdue && <span className="badge badge-warning">Overdue</span>}
    </Link>
  );
}

export function EntityActions({ entity }: { entity: EntityDetail }) {
  const [open, setOpen] = useState<Action[] | null>(null);
  const [done, setDone] = useState<Action[] | null>(null);
  const [failed, setFailed] = useState('');
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    setOpen(null);
    setFailed('');
    ask(entity, 'Open').then(setOpen, (error) => {
      // The Action Center is a separate plugin: it may not be installed, and
      // saying so is better than an empty tab that looks like no work.
      setFailed(String(error).includes('404')
        ? 'The Action Center is not installed on this vault.'
        : String(error));
      setOpen([]);
    });
    ask(entity, 'Completed').then(setDone, () => setDone([]));
  }, [entity.stem, entity.entity_tag]);

  if (failed) return <p className="text-warning">{failed}</p>;
  if (open === null) return <p className="text-muted">Loading…</p>;

  const overdue = open.filter((action) => action.overdue).length;
  return (
    <>
      <p className="text-muted">
        {open.length
          ? `${open.length} open · ${overdue} overdue · ${done?.length ?? 0} closed`
          : 'Nothing open with this company.'}
        {' '}
        <Link to={`/action-center?entity=${encodeURIComponent(entity.name)}`}>
          open the Action Center
        </Link>
      </p>

      {open.length > 0 && <div className="item-list">
        {open.map((action) => <Row key={action.stem} action={action} />)}
      </div>}

      {(done?.length ?? 0) > 0 && (
        <div className="entity-editor-actions">
          <button type="button" className="btn" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Hide what was closed' : `Show ${done!.length} closed`}
          </button>
        </div>
      )}
      {showDone && done && (
        <div className="item-list">
          {done.map((action) => (
            <Link className="item-row action-row-link" key={action.stem}
                  to={`/action-center/action/${encodeURIComponent(action.stem)}`}>
              <div className="item-row-main">
                <span className="item-row-title">{action.subject}</span>
                <span className="item-row-meta">
                  {[action.owner || 'Unassigned',
                    action.completed_at ? `closed ${action.completed_at.slice(0, 10)}` : null,
                    action.evidence || 'no evidence recorded'].filter(Boolean).join(' · ')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
