/**
 * supabase-js hides an edge function's error body.
 *
 * On any non-2xx the invoke() call returns `data: null` and a generic
 * `FunctionsHttpError` whose message is always "Edge Function returned a
 * non-2xx status code" — the function's own `{ error: "..." }` payload is left
 * on the `Response` hanging off `error.context`. These read it back so a toast
 * can say what actually went wrong.
 */

/** The parsed JSON body of a failed edge function response, or null. */
export async function readFunctionError(error: unknown): Promise<any | null> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (!ctx || typeof ctx.json !== "function") return null;
  try {
    // Clone so the caller can still read the response if it wants to.
    return await ctx.clone().json();
  } catch {
    return null;
  }
}

/** The function's own error text, falling back to the generic message. */
export async function functionErrorMessage(
  error: unknown,
  fallback = "Something went wrong",
): Promise<string> {
  const body = await readFunctionError(error);
  if (body?.error) return String(body.error);
  const msg = (error as { message?: string } | null)?.message;
  return msg || fallback;
}
