import { useState, type FormEvent } from 'react';
import { saveEnrichment, type EntityDetail, type Enrichment as Brief } from './client';

/** What this company should be watched for, and when it last was.
 *
 *  The research is not done here and not by this install's own agents: Compass
 *  is weak at it (operator, 2026-09-26), so the work goes to a Claude skill on
 *  a schedule of his own making. This screen writes the brief that skill reads
 *  -- `Settings/Strategic-Enrichment.md`, also served as data -- and shows what
 *  came back.
 *
 *  Which is why nothing here has a "run now" button: pressing it would promise
 *  something this plugin cannot do. What it can honestly say is when each topic
 *  was last looked at, and where the skill put what it found.
 */
const TOPICS: [string, string, string][] = [
  ['news', 'News and announcements', 'Results, leadership changes, funding, major contracts.'],
  ['opportunities', 'What Core42 should look at',
    'Where their direction meets what we sell, and what to raise next time.'],
  ['profile', 'Refresh the profile',
    'Correct the hub note itself: group structure, subsidiaries, size, strategy.'],
  ['people', 'People and org moves', 'Who moved where, and who owns the budget now.'],
];

const CADENCES = ['weekly', 'fortnightly', 'monthly', 'on demand'];

function when(run: { at: string; file: string; summary: string }): string {
  const parts = [run.at?.slice(0, 10)];
  if (run.file) parts.push(run.file);
  if (run.summary) parts.push(run.summary);
  return parts.filter(Boolean).join(' · ');
}

export function Enrichment({ entity, onSaved }: {
  entity: EntityDetail; onSaved: (brief: Brief) => void;
}) {
  const brief = entity.enrichment;
  const [topics, setTopics] = useState<string[]>(brief.topics);
  const [cadence, setCadence] = useState(brief.cadence || 'monthly');
  const [watchFor, setWatchFor] = useState(brief.watch_for);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const lastByTopic = new Map(brief.runs.map((run) => [run.topic, run]));
  const changed = topics.join() !== brief.topics.join()
    || cadence !== (brief.cadence || 'monthly') || watchFor !== brief.watch_for;

  function save(event: FormEvent) {
    event.preventDefault();
    setState('saving');
    saveEnrichment(entity.stem, { topics, cadence, watch_for: watchFor }).then((saved) => {
      setState('saved');
      onSaved(saved);
    }, () => setState('idle'));
  }

  return (
    <form onSubmit={save}>
      <p className="text-muted">
        What the research skill should look for. It runs on its own schedule, writes what
        it finds where that kind of finding belongs, and reports back here.
      </p>

      <div className="entity-topics">
        {TOPICS.map(([key, label, about]) => {
          const last = lastByTopic.get(key);
          return (
            <label className="entity-topic" key={key}>
              <input type="checkbox" checked={topics.includes(key)}
                     onChange={(event) => { setState('idle'); setTopics((chosen) => (
                       event.target.checked
                         ? [...chosen, key]
                         : chosen.filter((one) => one !== key))); }} />
              <span>
                <strong>{label}</strong>
                <span className="text-muted"> — {about}</span>
                <span className="entity-topic-last text-muted">
                  {last ? `last: ${when(last)}` : 'never looked at'}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="entity-editor-actions">
        <label className="text-muted">
          How often{' '}
          <select className="input" value={cadence}
                  onChange={(event) => { setCadence(event.target.value); setState('idle'); }}>
            {CADENCES.map((one) => <option key={one} value={one}>{one}</option>)}
          </select>
        </label>
      </div>

      <label className="text-muted entity-watch-for">
        Anything particular to watch for
        <textarea className="input" rows={2} value={watchFor}
                  placeholder="e.g. anything about XRG, or their sovereign cloud tender"
                  onChange={(event) => { setWatchFor(event.target.value); setState('idle'); }} />
      </label>

      <div className="entity-editor-actions">
        <button className="btn btn-primary" type="submit" disabled={!changed || state === 'saving'}>
          {state === 'saving' ? 'Saving…' : 'Save the brief'}
        </button>
        {state === 'saved' && (
          <span className="text-muted">
            Saved to Settings/Strategic-Enrichment.md, which the skill reads.
          </span>
        )}
        {!topics.length && state !== 'saved' && (
          <span className="text-muted">Nothing ticked — this company is off the brief.</span>
        )}
      </div>
    </form>
  );
}
