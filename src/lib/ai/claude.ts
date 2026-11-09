import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude client for the Learning features (desktop app only).
 *
 * The API key never reaches this code: it lives in the OS keychain, and every
 * request goes through the desktop app's `anthropic_fetch` command, which adds
 * the key in Rust. The SDK is given a placeholder key and that custom fetch.
 */

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const core = await import('@tauri-apps/api/core');
  return core.invoke<T>(cmd, args);
}

export const hasApiKey = () => invoke<boolean>('ai_key_status');
export const saveApiKey = (key: string) => invoke<void>('ai_key_set', { key });
export const removeApiKey = () => invoke<void>('ai_key_remove');

interface ProxyResponse {
  status: number;
  headers: [string, string][];
  body: string;
}

async function keychainFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const headers: [string, string][] = [];
  new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).forEach((value, name) => {
    headers.push([name, value]);
  });
  let body: string | undefined;
  if (typeof init?.body === 'string') body = init.body;
  else if (init?.body != null) body = await new Response(init.body).text();

  const res = await invoke<ProxyResponse>('anthropic_fetch', {
    url,
    method: init?.method ?? 'GET',
    headers,
    body: body ?? null,
  });
  return new Response(res.body, { status: res.status, headers: res.headers });
}

let client: Anthropic | null = null;

export function claude(): Anthropic {
  client ??= new Anthropic({
    apiKey: 'stored-in-os-keychain', // replaced by the desktop app
    fetch: keychainFetch as typeof fetch,
    // Requests leave the page through the desktop app, not the browser's network.
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
  });
  return client;
}

/** A friendly message for an API error. */
export function describeAiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'Your API key was rejected. Replace it in the key settings.';
  if (error instanceof Anthropic.PermissionDeniedError) return "Your API key isn't allowed to use this model.";
  if (error instanceof Anthropic.RateLimitError) return 'Rate limited by Anthropic. Wait a minute and try again.';
  if (error instanceof Anthropic.InternalServerError) return 'Anthropic is having trouble right now. Try again shortly.';
  if (error instanceof Anthropic.APIConnectionError) {
    // Errors from the desktop app (e.g. no key saved) arrive as the cause.
    const cause = String((error as { cause?: unknown }).cause ?? '');
    if (/No Anthropic API key/i.test(cause)) return 'Add your Anthropic API key first.';
    if (/keychain/i.test(cause)) return cause;
    return "Couldn't reach Anthropic. Check your internet connection.";
  }
  if (error instanceof Anthropic.APIError) return `Claude API error ${error.status ?? ''}: ${error.message}`;
  const msg = error instanceof Error ? error.message : String(error);
  if (/No Anthropic API key/i.test(msg)) return 'Add your Anthropic API key first.';
  return msg;
}
