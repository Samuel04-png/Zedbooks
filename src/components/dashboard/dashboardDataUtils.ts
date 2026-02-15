type Row = Record<string, unknown>;

const normalizeToken = (value: string) => value.toLowerCase().replace(/[_\s-]/g, "");

const normalizeRow = (row: Row) => {
  const map = new Map<string, unknown>();
  Object.entries(row).forEach(([key, value]) => {
    map.set(normalizeToken(key), value);
  });
  return map;
};

const lookup = (row: Row, key: string): unknown => {
  const direct = row[key];
  if (direct !== undefined) return direct;
  const normalized = normalizeRow(row);
  return normalized.get(normalizeToken(key));
};

export const readValue = (row: Row, keys: string[], fallback: unknown = null): unknown => {
  for (const key of keys) {
    const value = lookup(row, key);
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return fallback;
};

export const readString = (row: Row, keys: string[], fallback = ""): string => {
  const value = readValue(row, keys);
  return typeof value === "string" ? value : fallback;
};

export const readNumber = (row: Row, keys: string[], fallback = 0): number => {
  const value = readValue(row, keys);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const readBoolean = (row: Row, keys: string[], fallback = false): boolean => {
  const value = readValue(row, keys);
  return typeof value === "boolean" ? value : fallback;
};

export const readArray = <T = unknown>(value: unknown): T[] => {
  return Array.isArray(value) ? (value as T[]) : [];
};
