/* eslint-disable @typescript-eslint/no-explicit-any -- rows are untyped JSON records from any table */
import { generateUUID } from '../db';
import type { Row, VaultStore } from './store';

/**
 * A small stand-in for the Supabase client that reads and writes a local vault.
 *
 * The app talks to Supabase in ~75 places (`supabase.from('tasks').select()…`).
 * Instead of rewriting all of them, vault mode swaps in this client, which
 * implements the subset of the PostgREST query builder Flow actually uses:
 * select / insert / update / upsert / delete, the eq / neq / gt / gte / lt /
 * lte / in / is / not / or / ilike / like / match filters, order, limit,
 * range, single and maybeSingle, plus storage uploads and a local auth session.
 */

type Result = { data: any; error: any; count: number | null; status: number; statusText: string };
type Filter = (row: Row) => boolean;

const ok = (data: any, count: number | null = null, status = 200): Result => ({
  data,
  error: null,
  count,
  status,
  statusText: 'OK',
});

const fail = (message: string, code = 'VAULT', status = 400): Result => ({
  data: null,
  error: { message, code, details: null, hint: null },
  count: null,
  status,
  statusText: 'Error',
});

/** Defaults the Postgres schema would fill in on insert. */
const TABLE_DEFAULTS: Record<string, Row> = {
  dashboards: { emoji: '📝', is_active: false, cover_image: null, parent_id: null },
  folders: { name: 'New Folder', emoji: null, icon_url: null, is_starred: false, parent_id: null, dashboard_id: null },
  notes: { title: 'Untitled Note', content: '', emoji: null, drawing_data: null, is_starred: false, folder_id: null, dashboard_id: null },
  tasks: { priority: 2, completed: false, in_progress: false, completed_at: null, description: null, due_date: null, position: 0, list: 'Inbox' },
};

function coerce(value: unknown): unknown {
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a) < String(b) ? -1 : 1;
}

function likeToRegExp(pattern: string, caseInsensitive: boolean): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, caseInsensitive ? 'is' : 's');
}

/** One PostgREST operator, e.g. ('eq', 5) or ('ilike', '%foo%'). */
function opFilter(column: string, op: string, value: unknown): Filter {
  const v = coerce(value);
  switch (op) {
    case 'eq':
      return (r) => r[column] === v || (r[column] != null && v != null && String(r[column]) === String(v));
    case 'neq':
      return (r) => !(r[column] === v || (r[column] != null && v != null && String(r[column]) === String(v)));
    case 'gt':
      return (r) => r[column] != null && compare(r[column], v) > 0;
    case 'gte':
      return (r) => r[column] != null && compare(r[column], v) >= 0;
    case 'lt':
      return (r) => r[column] != null && compare(r[column], v) < 0;
    case 'lte':
      return (r) => r[column] != null && compare(r[column], v) <= 0;
    case 'is':
      return (r) => (v === null ? r[column] == null : r[column] === v);
    case 'in': {
      const list = Array.isArray(v)
        ? v
        : String(v).replace(/^\(|\)$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
      const set = new Set(list.map(String));
      return (r) => r[column] != null && set.has(String(r[column]));
    }
    case 'like':
      return (r) => r[column] != null && likeToRegExp(String(v), false).test(String(r[column]));
    case 'ilike':
      return (r) => r[column] != null && likeToRegExp(String(v), true).test(String(r[column]));
    case 'contains':
      return (r) => {
        const cell = r[column];
        if (Array.isArray(cell) && Array.isArray(v)) return v.every((x) => cell.includes(x));
        if (cell && typeof cell === 'object' && v && typeof v === 'object') {
          return Object.entries(v as Row).every(([k, x]) => (cell as Row)[k] === x);
        }
        return false;
      };
    default:
      console.warn(`[Vault] Unsupported filter operator "${op}" — ignoring`);
      return () => true;
  }
}

/** Parse `a.eq.1,b.ilike.%x%` (the argument of `.or()`). */
function parseOr(expr: string): Filter {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of expr) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) parts.push(cur);

  const filters = parts.map((part) => {
    const [column, op, ...rest] = part.split('.');
    const value = rest.join('.');
    if (op === 'not') {
      const [innerOp, ...innerRest] = rest;
      const inner = opFilter(column, innerOp, innerRest.join('.'));
      return (r: Row) => !inner(r);
    }
    return opFilter(column, op, value);
  });
  return (r) => filters.some((f) => f(r));
}

function project(row: Row, columns: string): Row {
  const cols = columns.split(',').map((c) => c.trim()).filter(Boolean);
  if (!cols.length || cols.includes('*')) return { ...row };
  const out: Row = {};
  for (const c of cols) {
    const [name, alias] = c.includes(':') ? c.split(':').reverse() : [c, c];
    out[alias.trim()] = row[name.trim()];
  }
  return out;
}

type Action =
  | { kind: 'select' }
  | { kind: 'insert'; rows: Row[] }
  | { kind: 'upsert'; rows: Row[]; onConflict: string; ignoreDuplicates: boolean }
  | { kind: 'update'; patch: Row }
  | { kind: 'delete' };

class QueryBuilder implements PromiseLike<Result> {
  private action: Action = { kind: 'select' };
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean; nullsFirst: boolean }[] = [];
  private rangeFrom = 0;
  private rangeTo: number | null = null;
  private columns = '*';
  private returning = false;
  private countMode: string | null = null;
  private headOnly = false;
  private singleMode: 'single' | 'maybe' | null = null;

  private store: VaultStore;
  private table: string;

  constructor(store: VaultStore, table: string) {
    this.store = store;
    this.table = table;
  }

  // ----------------------------------------------------------------- actions

  select(columns = '*', options?: { count?: string; head?: boolean }) {
    this.columns = columns;
    if (this.action.kind !== 'select') this.returning = true;
    if (options?.count) this.countMode = options.count;
    if (options?.head) this.headOnly = true;
    return this;
  }

  insert(values: Row | Row[]) {
    this.action = { kind: 'insert', rows: Array.isArray(values) ? values : [values] };
    return this;
  }

  upsert(values: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.action = {
      kind: 'upsert',
      rows: Array.isArray(values) ? values : [values],
      onConflict: options?.onConflict || 'id',
      ignoreDuplicates: Boolean(options?.ignoreDuplicates),
    };
    return this;
  }

  update(patch: Row) {
    this.action = { kind: 'update', patch };
    return this;
  }

  delete() {
    this.action = { kind: 'delete' };
    return this;
  }

  // ----------------------------------------------------------------- filters

  eq(c: string, v: unknown) { this.filters.push(opFilter(c, 'eq', v)); return this; }
  neq(c: string, v: unknown) { this.filters.push(opFilter(c, 'neq', v)); return this; }
  gt(c: string, v: unknown) { this.filters.push(opFilter(c, 'gt', v)); return this; }
  gte(c: string, v: unknown) { this.filters.push(opFilter(c, 'gte', v)); return this; }
  lt(c: string, v: unknown) { this.filters.push(opFilter(c, 'lt', v)); return this; }
  lte(c: string, v: unknown) { this.filters.push(opFilter(c, 'lte', v)); return this; }
  is(c: string, v: unknown) { this.filters.push(opFilter(c, 'is', v)); return this; }
  in(c: string, v: unknown[]) { this.filters.push(opFilter(c, 'in', v)); return this; }
  like(c: string, v: string) { this.filters.push(opFilter(c, 'like', v)); return this; }
  ilike(c: string, v: string) { this.filters.push(opFilter(c, 'ilike', v)); return this; }
  contains(c: string, v: unknown) { this.filters.push(opFilter(c, 'contains', v)); return this; }
  filter(c: string, op: string, v: unknown) { this.filters.push(opFilter(c, op, v)); return this; }
  match(query: Row) {
    for (const [c, v] of Object.entries(query)) this.filters.push(opFilter(c, 'eq', v));
    return this;
  }
  not(c: string, op: string, v: unknown) {
    const inner = opFilter(c, op, v);
    this.filters.push((r) => !inner(r));
    return this;
  }
  or(expr: string) { this.filters.push(parseOr(expr)); return this; }

  // ------------------------------------------------------------- modifiers

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    const ascending = options?.ascending ?? true;
    this.orders.push({ column, ascending, nullsFirst: options?.nullsFirst ?? !ascending });
    return this;
  }
  limit(count: number) { this.rangeTo = this.rangeFrom + count - 1; return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }
  abortSignal() { return this; }
  throwOnError() { return this; }
  returns() { return this; }

  // ------------------------------------------------------------- execution

  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private matches(row: Row) {
    return this.filters.every((f) => f(row));
  }

  private shape(rows: Row[], total: number | null): Result {
    let out = rows;
    if (this.orders.length) {
      out = [...out].sort((a, b) => {
        for (const o of this.orders) {
          const av = a[o.column];
          const bv = b[o.column];
          if (av == null || bv == null) {
            if (av == null && bv == null) continue;
            return (av == null) === o.nullsFirst ? -1 : 1;
          }
          const c = compare(av, bv);
          if (c !== 0) return o.ascending ? c : -c;
        }
        return 0;
      });
    }
    if (this.rangeFrom || this.rangeTo !== null) {
      out = out.slice(this.rangeFrom, this.rangeTo === null ? undefined : this.rangeTo + 1);
    }
    const data = out.map((r) => project(r, this.columns));
    const count = this.countMode ? total ?? rows.length : null;

    if (this.headOnly) return ok(null, count);
    if (this.singleMode) {
      if (data.length === 1) return ok(data[0], count);
      if (data.length === 0 && this.singleMode === 'maybe') return ok(null, count);
      return fail(
        data.length === 0 ? 'JSON object requested, multiple (or no) rows returned' : 'Multiple rows returned',
        'PGRST116',
        406,
      );
    }
    return ok(data, count);
  }

  private withDefaults(row: Row): Row {
    const now = new Date().toISOString();
    return {
      ...TABLE_DEFAULTS[this.table],
      id: generateUUID(),
      created_at: now,
      updated_at: now,
      ...row,
    };
  }

  private async execute(): Promise<Result> {
    try {
      const current = this.store.rows(this.table);
      const action = this.action;

      if (action.kind === 'select') {
        const rows = current.filter((r) => this.matches(r));
        return this.shape(rows, rows.length);
      }

      const changed = new Set<string>();
      const deleted = new Set<string>();
      let affected: Row[] = [];
      let next: Row[];

      if (action.kind === 'insert') {
        const fresh = action.rows.map((r) => this.withDefaults(r));
        const ids = new Set(current.map((r) => String(r.id)));
        const dup = fresh.find((r) => ids.has(String(r.id)));
        if (dup) return fail(`duplicate key value violates unique constraint (id ${dup.id})`, '23505', 409);
        fresh.forEach((r) => changed.add(r.id));
        next = [...current, ...fresh];
        affected = fresh;
      } else if (action.kind === 'upsert') {
        const key = action.onConflict.split(',')[0].trim();
        next = [...current];
        for (const incoming of action.rows) {
          const idx = incoming[key] != null ? next.findIndex((r) => String(r[key]) === String(incoming[key])) : -1;
          if (idx >= 0) {
            if (action.ignoreDuplicates) continue;
            next[idx] = { ...next[idx], ...incoming };
            affected.push(next[idx]);
          } else {
            const row = this.withDefaults(incoming);
            next.push(row);
            affected.push(row);
          }
        }
        affected.forEach((r) => changed.add(r.id));
      } else if (action.kind === 'update') {
        next = current.map((r) => {
          if (!this.matches(r)) return r;
          const row = { ...r, ...action.patch };
          affected.push(row);
          changed.add(row.id);
          return row;
        });
      } else {
        next = current.filter((r) => {
          if (!this.matches(r)) return true;
          affected.push(r);
          deleted.add(r.id);
          return false;
        });
      }

      if (changed.size || deleted.size) {
        await this.store.commit(this.table, next, changed, deleted);
      }

      if (!this.returning) {
        return ok(null, this.countMode ? affected.length : null, action.kind === 'insert' ? 201 : 204);
      }
      return this.shape(affected, affected.length);
    } catch (error: any) {
      console.error(`[Vault] ${this.table} query failed:`, error);
      return fail(error?.message || String(error));
    }
  }
}

// ------------------------------------------------------------------ storage

class StorageBucket {
  private store: VaultStore;
  private bucket: string;
  private prefix: string;

  constructor(store: VaultStore, bucket: string, prefix: string) {
    this.store = store;
    this.bucket = bucket;
    this.prefix = prefix;
  }

  private key(path: string) {
    return `${this.bucket}/${path}`.replace(/\.\.+/g, '.').replace(/^\/+/, '');
  }

  async upload(path: string, file: Blob | ArrayBuffer | Uint8Array) {
    try {
      const bytes =
        file instanceof Uint8Array
          ? file
          : file instanceof ArrayBuffer
            ? new Uint8Array(file)
            : new Uint8Array(await (file as Blob).arrayBuffer());
      await this.store.writeAttachment(this.key(path), bytes);
      return { data: { path, id: path, fullPath: this.key(path) }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error?.message || String(error) } };
    }
  }

  getPublicUrl(path: string) {
    const encoded = this.key(path).split('/').map(encodeURIComponent).join('/');
    return { data: { publicUrl: `${this.prefix}attachments/${encoded}` } };
  }

  async remove(paths: string[]) {
    await Promise.all(paths.map((p) => this.store.removeAttachment(this.key(p)).catch(() => {})));
    return { data: paths.map((name) => ({ name })), error: null };
  }
}

// ------------------------------------------------------------------- client

export function createVaultClient(store: VaultStore, user: { id: string; email: string }, attachmentPrefix: string) {
  const session = {
    access_token: 'local-vault',
    token_type: 'bearer',
    user: { id: user.id, email: user.email, aud: 'local', app_metadata: {}, user_metadata: {} },
  };
  const unavailable = async () => ({
    data: { user: null, session: null },
    error: { message: 'Not available for local vaults', status: 400 },
  });

  return {
    from: (table: string) => new QueryBuilder(store, table),
    storage: {
      from: (bucket: string) => new StorageBucket(store, bucket, attachmentPrefix),
    },
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session.user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
      signInWithPassword: unavailable,
      signUp: unavailable,
      resend: unavailable,
      resetPasswordForEmail: unavailable,
      updateUser: unavailable,
    },
    rpc: async (fn: string) => fail(`"${fn}" is only available with Flow Cloud`),
    channel: () => {
      const ch: any = { on: () => ch, subscribe: () => ch, unsubscribe: async () => 'ok' };
      return ch;
    },
    removeChannel: async () => 'ok',
  };
}
