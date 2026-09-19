const KEY = 'secret-table:name';

export function loadName(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(KEY, name.trim().slice(0, 40));
  } catch {
    /* yut */
  }
}
