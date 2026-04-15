export function safeParseJson(
  input: string | null | undefined
): { ok: true; value: unknown } | { ok: false; error: Error } {
  if (!input) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return { ok: false, error: err };
  }
}
