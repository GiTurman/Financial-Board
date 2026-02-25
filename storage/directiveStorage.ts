import { DirectiveSnapshot } from '../types';

const STORAGE_KEY = 'dispatched_directives';

export function loadDispatchedDirectives(): DirectiveSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveDispatchedDirectives(data: DirectiveSnapshot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event('storage'));
}

export function addDirective(snapshot: DirectiveSnapshot) {
  const existing = loadDispatchedDirectives();
  saveDispatchedDirectives([snapshot, ...existing]);
}

export function markDirectiveProcessed(
  id: string,
  processedByUserId: string
) {
  const all = loadDispatchedDirectives();
  const updated = all.map(d =>
    d.id === id
      ? {
          ...d,
          status: 'processed' as const,
          processedAt: new Date().toISOString(),
          processedByUserId,
        }
      : d
  );

  saveDispatchedDirectives(updated);
}
