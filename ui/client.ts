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

/** Adding one creates its Expert; removing one deletes it again. */
export function makeStrategic(stem: string): Promise<{ note?: string; expert_id: string }> {
  return send(`${BASE}/strategic/${encodeURIComponent(stem)}`, 'POST');
}

export function dropStrategic(stem: string): Promise<{ note?: string }> {
  return send(`${BASE}/strategic/${encodeURIComponent(stem)}`, 'DELETE');
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
