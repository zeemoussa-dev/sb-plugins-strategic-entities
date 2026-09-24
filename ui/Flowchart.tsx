import { useMemo, useState } from 'react';

/** A `flowchart TD` from a vault note, drawn as the structure it describes.
 *
 *  Every company note the capture passes write carries one of these -- 337 of
 *  them in this vault, all `flowchart TD` -- and nothing in the app renders
 *  mermaid: there is no such dependency, and a plugin's screens may import only
 *  react, react-router and `pluginHost` anyway. Shown as a code fence, ADNOC's
 *  group structure was thirty lines of `n4["ADNOC Drilling"]`.
 *
 *  So this reads the small dialect those notes actually use -- nodes, arrows
 *  and `subgraph` groups -- and lays it out top-down: what points AT the
 *  company, the company, then the groups hanging off it. It is not a graph
 *  layout engine and does not pretend to be; it is the same information as a
 *  list of boxes, which is what the diagram is for.
 *
 *  Anything it cannot place is shown under "other relations" rather than
 *  dropped, and the source is always one click away -- a diagram that silently
 *  loses an edge would be worse than the code fence it replaced.
 */
const NODE = /^\s*([A-Za-z_][\w-]*)\s*(?:\[\s*"?([^"\]]*)"?\s*\]|\(\s*"?([^")]*)"?\s*\)|\{\s*"?([^"}]*)"?\s*\})\s*(:::[\w-]+)?\s*$/;
const EDGE = /^\s*([A-Za-z_][\w-]*)\s*(-->|---|===|~~~|-\.->)\s*(?:\|\s*([^|]*)\s*\|\s*)?([A-Za-z_][\w-]*)\s*$/;
const SUBGRAPH = /^\s*subgraph\s+([A-Za-z_][\w-]*)\s*(?:\[\s*"?([^"\]]*)"?\s*\])?\s*$/;

interface Node { id: string; label: string; self: boolean; group?: string }
interface Edge { from: string; to: string; label: string }
interface Group { id: string; title: string; members: string[] }

/** Labels carry a little HTML from Obsidian's own mermaid: `<br/>` for a line
 *  break and `<i>` for the kind of relationship. Rendered as text, never as
 *  markup. */
function readable(label: string): string[] {
  return label
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parse(source: string) {
  const nodes = new Map<string, Node>();
  const edges: Edge[] = [];
  const groups = new Map<string, Group>();
  let openGroup: Group | null = null;

  const noteNode = (id: string, label?: string, self = false) => {
    const existing = nodes.get(id);
    if (existing) {
      if (label) existing.label = label;
      if (self) existing.self = true;
      return existing;
    }
    const node: Node = { id, label: label ?? id, self, group: openGroup?.id };
    nodes.set(id, node);
    if (openGroup) openGroup.members.push(id);
    return node;
  };

  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line || /^(flowchart|graph)\b/i.test(line) || /^direction\b/i.test(line)
      || /^classDef\b/i.test(line) || /^class\b/i.test(line) || line.startsWith("%%")) continue;

    if (line === "end") { openGroup = null; continue; }

    const group = SUBGRAPH.exec(line);
    if (group) {
      openGroup = { id: group[1], title: group[2] || group[1], members: [] };
      groups.set(openGroup.id, openGroup);
      continue;
    }

    const edge = EDGE.exec(line);
    if (edge) {
      const [, from, kind, label, to] = edge;
      noteNode(from);
      noteNode(to);
      // `~~~` is mermaid's invisible link -- it only forces layout, and drawing
      // it would invent a relationship the note does not claim.
      if (kind !== "~~~") edges.push({ from, to, label: (label ?? "").trim() });
      continue;
    }

    const node = NODE.exec(line);
    if (node) {
      const [, id, square, round, curly, klass] = node;
      noteNode(id, square ?? round ?? curly ?? id, (klass ?? "").includes("self"));
    }
  }
  return { nodes, edges, groups };
}

function Box({ node, kind }: { node: Node; kind?: string }) {
  const lines = readable(node.label);
  return (
    <span className={`fc-node${node.self ? ' fc-self' : ''}`}>
      <span className="fc-node-label">{lines[0] ?? node.id}</span>
      {lines.slice(1).map((line, i) => <span key={i} className="fc-node-sub">{line}</span>)}
      {kind && <span className="fc-node-sub">{kind}</span>}
    </span>
  );
}

export function Flowchart({ source }: { source: string }) {
  const { nodes, edges, groups } = useMemo(() => parse(source), [source]);
  const [showSource, setShowSource] = useState(false);

  const self = [...nodes.values()].find((n) => n.self);
  if (!self) {
    // Without a marked centre this is somebody else's kind of diagram; the
    // source is the honest thing to show.
    return <pre className="fc-source"><code>{source}</code></pre>;
  }

  const labelOf = (id: string) => groups.get(id)?.title ?? nodes.get(id)?.label ?? id;
  const above = edges.filter((e) => e.to === self.id);
  const below = edges.filter((e) => e.from === self.id);
  const placed = new Set<string>([self.id, ...above.map((e) => e.from), ...below.map((e) => e.to)]);
  const others = edges.filter((e) => !(e.to === self.id || e.from === self.id));

  return (
    <div className="fc">
      {above.length > 0 && (
        <div className="fc-row">
          {above.map((edge) => (
            <Box key={edge.from} node={nodes.get(edge.from) ?? { id: edge.from, label: labelOf(edge.from), self: false }}
                 kind={edge.label} />
          ))}
        </div>
      )}
      {above.length > 0 && <div className="fc-arrow">&darr;</div>}

      <div className="fc-row"><Box node={self} /></div>

      {below.length > 0 && <div className="fc-arrow">&darr;</div>}
      <div className="fc-groups">
        {below.map((edge) => {
          const group = groups.get(edge.to);
          if (!group) {
            return (
              <div className="fc-group" key={edge.to}>
                <Box node={nodes.get(edge.to) ?? { id: edge.to, label: labelOf(edge.to), self: false }}
                     kind={edge.label} />
              </div>
            );
          }
          return (
            <div className="fc-group" key={group.id}>
              <span className="fc-group-title">{group.title}</span>
              <div className="fc-members">
                {group.members.map((id) => {
                  placed.add(id);
                  const member = nodes.get(id);
                  return member ? <Box key={id} node={member} /> : null;
                })}
              </div>
            </div>
          );
        })}
      </div>

      {others.length > 0 && (
        <div className="fc-others">
          <span className="fc-group-title">Other relations</span>
          <ul>
            {others.map((edge, i) => (
              <li key={i}>
                {readable(labelOf(edge.from))[0]} &rarr; {readable(labelOf(edge.to))[0]}
                {edge.label ? ` (${edge.label})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" className="fc-toggle" onClick={() => setShowSource((v) => !v)}>
        {showSource ? 'Hide the diagram source' : 'Show the diagram source'}
      </button>
      {showSource && <pre className="fc-source"><code>{source}</code></pre>}
    </div>
  );
}
