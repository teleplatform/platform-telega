export function toJsonString(value: unknown): string { return JSON.stringify(value); }
export function fromJsonString<T>(value: string): T { return JSON.parse(value) as T; }
