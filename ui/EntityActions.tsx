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
  /** Empty when the action is this company's own; otherwise the relative whose
   *  thread it came from. */
  whose?: string;
  relation?: string;
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

/** The whole family's actions, each labelled with whose it is.
 *
 *  A strategic company is often an affiliate -- TAQA Distribution lives under
 *  TAQA -- and a thread is tagged with whichever company the mail was about,
 *  usually the parent. Asking only for the entity's own tag showed nothing
 *  while nine actions sat on TAQA (operator, 2026-09-29). So the parent's and
 *  the affiliates' are fetched too, and a row says whose it is rather than
 *  quietly reading as this company's own. */
async function ask(entity: EntityDetail, status: string): Promise<Action[]> {
  const family = entity.family?.length
    ? entity.family
    : [{ name: entity.name, stem: entity.stem, entity_tag: entity.entity_tag ?? '',
         relation: 'self' as const }];
  const lists = await Promise.all(family.map(async (member) => {
    const by = member.entity_tag
      ? `entity_tag=${encodeURIComponent(member.entity_tag)}`
      : `entity=${encodeURIComponent(member.name)}`;
    const rows = await apiFetch<Action[]>(`${ACTION_CENTER}/actions?status=${status}&${by}`);
    return rows.map((row) => ({
      ...row,
      whose: member.relation === 'self' ? '' : member.name,
      relation: member.relation,
    }));
  }));
  const seen = new Set<string>();
  return lists.flat().filter((row) => !seen.has(row.stem) && seen.add(row.stem));
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
      {action.whose && (
        <span className="badge" title={`Filed under ${action.whose}, the ${action.relation}`}>
          {action.whose}
        </span>
      )}
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
  const related = open.filter((action) => action.whose).length;
  return (
    <>
      <p className="text-muted">
        {open.length
          ? `${open.length} open · ${overdue} overdue · ${done?.length ?? 0} closed`
          : 'Nothing open with this company.'}
        {related > 0 && ` — ${related} of them filed under `}
        {related > 0 && [...new Set(open.filter((a) => a.whose).map((a) => a.whose))].join(', ')}
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
