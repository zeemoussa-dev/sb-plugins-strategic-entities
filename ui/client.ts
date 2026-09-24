import { apiFetch } from '../../pluginHost/api';

const BASE = '/plugins/strategic-entities';

export interface Entity {
  stem: string;
  name: string;
  kind: string;
  aliases: string[];
  domains: string[];
  tags: string[];
  folder: string;
  strategic: boolean;
  expert_id: string | null;
  missing?: boolean;
}

export interface EntityFile {
  file: string;
  kind: string;
}

export interface EntityDetail extends Entity {
  note: string;
  facts: Record<string, unknown>;
  contents: {
    captures: string | null;
    history: string | null;
    people: string[];
    charts: EntityFile[];
    affiliates: string[];
    other_files: EntityFile[];
  };
  captures: string;
  notes: string;
  /** Wikilink targets in this entity's text that are real notes here; the host
   *  renderer links those and leaves the rest as plain text. */
  resolved_stems: string[];
}

function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function fetchStrategic(): Promise<Entity[]> {
  return apiFetch<Entity[]>(`${BASE}/strategic`);
}

export function fetchEntities(q = ''): Promise<Entity[]> {
  return apiFetch<Entity[]>(`${BASE}/entities${q ? `?q=${encodeURIComponent(q)}` : ''}`);
}

export function fetchEntity(stem: string): Promise<EntityDetail> {
  return apiFetch<EntityDetail>(`${BASE}/entities/${encodeURIComponent(stem)}`);
}

/** What `POST /agents` wants for this company's Expert. The plugin decides what
 *  it should be; the framework creates it. */
export interface ExpertSpec {
  id: string;
  name: string;
  section_id: string;
  type: string;
  depends_on: string[];
  description: string;
  prompt: string;
  scope: string[];
  clone_from: string;
}

export function makeStrategic(stem: string): Promise<{
  status: string; expert_id: string; expert?: ExpertSpec;
}> {
  return send(`${BASE}/strategic/${encodeURIComponent(stem)}`, 'POST');
}

export function dropStrategic(stem: string): Promise<{
  status: string; expert_id?: string; delete_expert?: string;
}> {
  return send(`${BASE}/strategic/${encodeURIComponent(stem)}`, 'DELETE');
}

/** The framework's own agents API. Creating an agent is its job -- one call
 *  makes the Hermes profile and the Registry files together, and the delete
 *  undoes both. A plugin's screen may call it like any other part of the app. */
export function createExpert(spec: ExpertSpec): Promise<{ id: string }> {
  return send('/agents', 'POST', spec);
}

export function deleteExpert(id: string): Promise<unknown> {
  return send(`/agents/${encodeURIComponent(id)}`, 'DELETE');
}

export function saveCaptures(stem: string, text: string): Promise<{ status: string }> {
  return send(`${BASE}/entities/${encodeURIComponent(stem)}/captures`, 'PUT', { text });
}

export function addNote(stem: string, text: string): Promise<{ status: string; note?: string }> {
  return send(`${BASE}/entities/${encodeURIComponent(stem)}/notes`, 'POST', { text });
}

export interface Chart {
  file: string;
  type: string;
  svg?: string;
  data_url?: string;
}

/** The picture itself, not a link to it: a plugin screen is handed `apiFetch`
 *  and nothing else, so it cannot know the backend's address to point an
 *  `<img>` at. */
export function fetchChart(stem: string, file: string): Promise<Chart> {
  return apiFetch<Chart>(`${BASE}/entities/${encodeURIComponent(stem)}/chart/${encodeURIComponent(file)}`);
}
