// Tests for the local-vault storage layer (src/lib/vault). Run: npm run test:vault
import assert from 'node:assert/strict';
import { MemoryVaultFS } from '../src/lib/vault/fs';
import { VaultStore, layoutNotes, safeFileName, CANONICAL_ATTACHMENT_PREFIX } from '../src/lib/vault/store';
import { createVaultClient } from '../src/lib/vault/localClient';

const USER = { id: 'u-local', email: 'v@x' };
const opts = (prefix = CANONICAL_ATTACHMENT_PREFIX) => ({ userId: USER.id, userEmail: USER.email, attachmentPrefix: prefix });
const noteFiles = (fs: MemoryVaultFS) => [...fs.files.keys()].filter((p) => !p.startsWith('.flow') && !p.startsWith('attachments')).sort();

let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log('✓', name); };

await test('safeFileName', async () => {
  assert.equal(safeFileName('a/b:c?', 'x'), 'a b c');
  assert.equal(safeFileName('  ', 'Untitled'), 'Untitled');
  assert.equal(safeFileName('CON', 'x'), 'CON_');
  assert.equal(safeFileName('.hidden', 'x'), '_hidden');
  assert.equal(safeFileName('attachments', 'x'), 'attachments_');
  assert.equal(safeFileName('trail. ', 'x'), 'trail');
});

const fs = new MemoryVaultFS();
let store = await VaultStore.load(fs, opts());
let sb = createVaultClient(store, USER, CANONICAL_ATTACHMENT_PREFIX);

await test('new vault has marker + profile', async () => {
  assert.ok(fs.files.has('.flow/vault.json'));
  const { data, error } = await sb.from('user_profiles').select('*').eq('id', USER.id).single();
  assert.equal(error, null); assert.equal(data.username, 'You');
});

let dashId = '', folderId = '', subId = '';
await test('insert dashboard + folders with defaults and returning', async () => {
  const d = await sb.from('dashboards').insert({ user_id: 'cloud-user', name: 'Uni' }).select().single();
  assert.equal(d.error, null); dashId = d.data.id; assert.equal(d.data.emoji, '📝'); assert.ok(d.data.created_at);
  const f = await sb.from('folders').insert([{ name: 'Essays', dashboard_id: dashId, user_id: USER.id }]).select().single();
  folderId = f.data.id;
  const s = await sb.from('folders').insert({ name: 'Drafts', dashboard_id: dashId, parent_id: folderId, user_id: USER.id }).select('id').single();
  subId = s.data.id;
  assert.deepEqual(Object.keys(s.data), ['id']);
});

await test('note upsert writes file in Dashboard/Folder/Sub tree', async () => {
  const r = await sb.from('notes').upsert({ id: 'n1', title: 'V8 Feedback', content: '<p>hi <span style="color: orange">x</span></p>', user_id: USER.id, dashboard_id: dashId, folder_id: subId, updated_at: '2026-01-01', created_at: '2026-01-01' });
  assert.equal(r.error, null);
  assert.deepEqual(noteFiles(fs), ['Uni/Essays/Drafts/V8 Feedback.json']);
  const file = JSON.parse(fs.files.get('Uni/Essays/Drafts/V8 Feedback.json') as string);
  assert.equal(file.kind, 'flow-note'); assert.equal(file.user_id, undefined); assert.match(file.content, /orange/);
});

await test('rename note moves file', async () => {
  await sb.from('notes').upsert({ id: 'n1', title: 'V9 Feedback' });
  assert.deepEqual(noteFiles(fs), ['Uni/Essays/Drafts/V9 Feedback.json']);
});

await test('rename parent folder moves notes under it', async () => {
  await sb.from('folders').update({ name: 'Writing' }).eq('id', folderId);
  assert.deepEqual(noteFiles(fs), ['Uni/Writing/Drafts/V9 Feedback.json']);
});

await test('duplicate titles get id suffix, swap titles keeps both files', async () => {
  await sb.from('notes').upsert({ id: 'n2', title: 'V9 Feedback', content: 'second', dashboard_id: dashId, folder_id: subId, created_at: '2026-02-01', updated_at: '2026-02-01', user_id: USER.id });
  assert.deepEqual(noteFiles(fs), ['Uni/Writing/Drafts/V9 Feedback (n2).json', 'Uni/Writing/Drafts/V9 Feedback.json']);
  await sb.from('notes').upsert({ id: 'n1', title: 'A' });
  await sb.from('notes').upsert({ id: 'n2', title: 'B' });
  assert.deepEqual(noteFiles(fs), ['Uni/Writing/Drafts/A.json', 'Uni/Writing/Drafts/B.json']);
  // swap in one batch
  await sb.from('notes').upsert([{ id: 'n1', title: 'B' }, { id: 'n2', title: 'A' }]);
  const a = JSON.parse(fs.files.get('Uni/Writing/Drafts/A.json') as string);
  const b = JSON.parse(fs.files.get('Uni/Writing/Drafts/B.json') as string);
  assert.equal(a.id, 'n2'); assert.equal(b.id, 'n1');
});

await test('delete note removes its file', async () => {
  await sb.from('notes').delete().eq('id', 'n2');
  assert.deepEqual(noteFiles(fs), ['Uni/Writing/Drafts/B.json']);
});

await test('filters: eq/neq/gt/not is null/or ilike/order/range/count/head', async () => {
  for (let i = 0; i < 5; i++) await sb.from('tasks').insert({ title: `Task ${i}`, user_id: USER.id, position: i, completed: i % 2 === 0, completed_at: i % 2 === 0 ? `2026-01-0${i + 1}` : null });
  const done = await sb.from('tasks').select('*').eq('user_id', USER.id).not('completed_at', 'is', null);
  assert.equal(done.data.length, 3);
  const notDone = await sb.from('tasks').select('*').eq('completed', false);
  assert.equal(notDone.data.length, 2);
  const ordered = await sb.from('tasks').select('title').order('position', { ascending: false }).range(1, 2);
  assert.deepEqual(ordered.data.map((t: any) => t.title), ['Task 3', 'Task 2']);
  const gte = await sb.from('tasks').select('*').gte('position', 3).lt('position', 4);
  assert.equal(gte.data.length, 1);
  const c = await sb.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', USER.id);
  assert.equal(c.count, 5); assert.equal(c.data, null);
  const search = await sb.from('notes').select('id, title').or('title.ilike.%b%,content.ilike.%ORANGE%').limit(20);
  assert.deepEqual(search.data, [{ id: 'n1', title: 'B' }]);
  const none = await sb.from('tasks').select('*').eq('id', 'nope').single();
  assert.equal(none.error.code, 'PGRST116');
  const maybe = await sb.from('tasks').select('*').eq('id', 'nope').maybeSingle();
  assert.equal(maybe.error, null); assert.equal(maybe.data, null);
  const upd = await sb.from('tasks').update({ completed: true }).match({ position: 1 }).select();
  assert.equal(upd.data.length, 1);
  const ins = await sb.from('tasks').select('*').in('position', [0, 1]);
  assert.equal(ins.data.length, 2);
});

await test('storage upload + public url', async () => {
  const up = await sb.storage.from('note-images').upload(`${USER.id}/pic 1.png`, new Uint8Array([1, 2, 3]));
  assert.equal(up.error, null);
  assert.ok(fs.files.has(`attachments/note-images/${USER.id}/pic 1.png`));
  const { data } = sb.storage.from('note-images').getPublicUrl(`${USER.id}/pic 1.png`);
  assert.equal(data.publicUrl, `flowvault://localhost/attachments/note-images/${USER.id}/pic%201.png`);
});

await test('rpc + auth behave', async () => {
  const s = await sb.auth.getSession();
  assert.equal(s.data.session.user.id, USER.id);
  const r = await sb.rpc('delete_user_account');
  assert.ok(r.error);
});

await test('reload from disk gives the same data; cloud user ids adopted', async () => {
  const before = { notes: store.rows('notes'), tasks: store.rows('tasks'), dashboards: store.rows('dashboards') };
  store = await VaultStore.load(fs, opts());
  sb = createVaultClient(store, USER, CANONICAL_ATTACHMENT_PREFIX);
  assert.deepEqual(store.rows('notes'), before.notes);
  assert.deepEqual(store.rows('tasks'), before.tasks);
  assert.equal(store.rows('dashboards')[0].user_id, USER.id);
});

await test('windows prefix: stored canonical, read back as windows form', async () => {
  const winPrefix = 'http://flowvault.localhost/';
  const wfs = new MemoryVaultFS();
  const ws = await VaultStore.load(wfs, opts(winPrefix));
  const wsb = createVaultClient(ws, USER, winPrefix);
  const url = wsb.storage.from('note-images').getPublicUrl('a.png').data.publicUrl;
  assert.ok(url.startsWith(winPrefix));
  await wsb.from('notes').upsert({ id: 'w1', title: 'Img', content: `<img src="${url}">`, user_id: USER.id, created_at: '1', updated_at: '1' });
  const disk = wfs.files.get('Unsorted/Img.json') as string;
  assert.ok(disk.includes('flowvault://localhost/attachments/note-images/a.png'), disk);
  const again = await VaultStore.load(wfs, opts(winPrefix));
  assert.ok(again.rows('notes')[0].content.includes(winPrefix));
});

await test('create() from cloud export rows', async () => {
  const efs = new MemoryVaultFS();
  await VaultStore.create(efs, opts(), {
    dashboards: [{ id: 'd', user_id: 'cloud', name: 'Main', created_at: '1' }],
    folders: [{ id: 'f', user_id: 'cloud', name: 'F', dashboard_id: 'd', created_at: '1' }],
    notes: [{ id: 'x', user_id: 'cloud', title: 'Hello', content: 'c', dashboard_id: 'd', folder_id: 'f', created_at: '1', updated_at: '1' }],
    user_profiles: [{ id: 'cloud', username: 'Lucas' }],
  });
  assert.deepEqual(noteFiles(efs), ['Main/F/Hello.json']);
  const loaded = await VaultStore.load(efs, opts());
  assert.equal(loaded.rows('notes')[0].user_id, USER.id);
  assert.equal(loaded.rows('user_profiles')[0].id, USER.id);
  assert.equal(loaded.rows('user_profiles')[0].username, 'Lucas');
});

await test('layout: note in dashboard root and unknown dashboard', async () => {
  const m = layoutNotes([{ id: 'a', title: 'T', dashboard_id: 'gone', created_at: '1' }, { id: 'b', title: 'T', dashboard_id: 'd', created_at: '1' }], [], [{ id: 'd', name: 'D' }]);
  assert.equal(m.get('a'), 'Unsorted/T.json'); assert.equal(m.get('b'), 'D/T.json');
});

await test('a brand-new table survives a reload', async () => {
  const nfs = new MemoryVaultFS();
  const s1 = await VaultStore.load(nfs, opts());
  const c1 = createVaultClient(s1, USER, CANONICAL_ATTACHMENT_PREFIX);
  await c1.from('some_new_table').select('*'); // a read first must not hide it
  await c1.from('some_new_table').insert({ user_id: USER.id, x: 1 });
  await c1.from('learning_gaps').insert({ user_id: USER.id, passage: 'p', confusion: 'c' });
  const s2 = await VaultStore.load(nfs, opts());
  assert.equal(s2.rows('some_new_table').length, 1);
  assert.equal(s2.rows('learning_gaps').length, 1);
});

await test('rows are one file each under .flow/data', async () => {
  const f = new MemoryVaultFS();
  const st = await VaultStore.load(f, opts());
  const c = createVaultClient(st, USER, CANONICAL_ATTACHMENT_PREFIX);
  const { data } = await c.from('learning_cards').insert([{ user_id: USER.id, question: 'q1' }, { user_id: USER.id, question: 'q2' }]).select();
  assert.ok(f.files.has(`.flow/data/learning_cards/${data[0].id}.json`));
  assert.ok(f.files.has(`.flow/data/learning_cards/${data[1].id}.json`));
  await c.from('learning_cards').update({ question: 'q1!' }).eq('id', data[0].id);
  assert.equal(JSON.parse(f.files.get(`.flow/data/learning_cards/${data[0].id}.json`) as string).question, 'q1!');
  await c.from('learning_cards').delete().eq('id', data[1].id);
  assert.ok(!f.files.has(`.flow/data/learning_cards/${data[1].id}.json`));
});

await test('old single-file vaults are migrated', async () => {
  const f = new MemoryVaultFS();
  await f.writeText('.flow/vault.json', JSON.stringify({ app: 'Flow Notes', version: 1, tables: ['tasks', 'learning_gaps'] }));
  await f.writeText('.flow/tasks.json', JSON.stringify([{ id: 't1', user_id: 'x', title: 'Old task', updated_at: '1' }]));
  await f.writeText('.flow/learning_gaps.json', JSON.stringify([{ id: 'g1', user_id: 'x', passage: 'p', confusion: 'c', updated_at: '1' }]));
  await f.writeText('.flow/dashboards.json', JSON.stringify([{ id: 'd1', user_id: 'x', name: 'Main', updated_at: '1' }]));
  const st = await VaultStore.load(f, opts());
  assert.equal(st.rows('tasks')[0].title, 'Old task');
  assert.equal(st.rows('learning_gaps').length, 1);
  assert.equal(st.rows('dashboards')[0].name, 'Main');
  assert.ok(!f.files.has('.flow/tasks.json') && f.files.has('.flow/data/tasks/t1.json'));
  assert.equal(JSON.parse(f.files.get('.flow/vault.json') as string).version, 2);
  const again = await VaultStore.load(f, opts());
  assert.equal(again.rows('tasks').length, 1);
});

await test('sync conflict copies: newest wins, older kept in .flow/conflicts', async () => {
  const f = new MemoryVaultFS();
  await VaultStore.load(f, opts());
  await f.writeText('.flow/data/learning_cards/c1.json', JSON.stringify({ id: 'c1', question: 'older', updated_at: '2026-01-01' }));
  await f.writeText('.flow/data/learning_cards/c1 2.json', JSON.stringify({ id: 'c1', question: 'newer', updated_at: '2026-02-01' }));
  await f.writeText('Unsorted/Note.json', JSON.stringify({ kind: 'flow-note', id: 'n1', title: 'Note', content: 'old', updated_at: '1' }));
  await f.writeText('Unsorted/Note 2.json', JSON.stringify({ kind: 'flow-note', id: 'n1', title: 'Note', content: 'new', updated_at: '2' }));
  const st = await VaultStore.load(f, opts());
  assert.equal(st.rows('learning_cards').length, 1);
  assert.equal(st.rows('learning_cards')[0].question, 'newer');
  assert.equal(JSON.parse(f.files.get('.flow/data/learning_cards/c1.json') as string).question, 'newer');
  assert.ok(!f.files.has('.flow/data/learning_cards/c1 2.json'));
  assert.equal(st.rows('notes').length, 1);
  assert.equal(st.rows('notes')[0].content, 'new');
  const conflicts = [...f.files.keys()].filter((k) => k.startsWith('.flow/conflicts/'));
  assert.equal(conflicts.length, 2, 'both older copies kept');
  assert.ok(conflicts.some((k) => (f.files.get(k) as string).includes('older')));
  assert.ok(conflicts.some((k) => (f.files.get(k) as string).includes('"old"')));
});

await test('refresh picks up edits, new files and deletions from another device', async () => {
  const f = new MemoryVaultFS();
  const st = await VaultStore.load(f, opts());
  const c = createVaultClient(st, USER, CANONICAL_ATTACHMENT_PREFIX);
  await c.from('notes').upsert({ id: 'n1', title: 'Mine', content: 'a', user_id: USER.id, created_at: '1', updated_at: '1' });
  const { data: card } = await c.from('learning_cards').insert({ user_id: USER.id, question: 'q' }).select().single();
  let ch = await st.refresh();
  assert.equal(ch.notes.upserted.length + ch.notes.removedIds.length + ch.tables.size, 0, 'own writes are not changes');
  const notePath = [...f.files.keys()].find((k) => k.endsWith('Mine.json'))!;
  await f.writeText(notePath, JSON.stringify({ kind: 'flow-note', id: 'n1', title: 'Mine', content: 'edited on phone', updated_at: '9' }));
  await f.writeText('Unsorted/Phone.json', JSON.stringify({ kind: 'flow-note', id: 'n2', title: 'Phone', content: 'x', updated_at: '9' }));
  await f.writeText(`.flow/data/learning_cards/${card.id}.json`, JSON.stringify({ ...card, question: 'q from phone', updated_at: '9' }));
  await f.writeText('.flow/data/learning_gaps/g9.json', JSON.stringify({ id: 'g9', passage: 'p', confusion: 'c', updated_at: '9' }));
  ch = await st.refresh();
  assert.deepEqual(ch.notes.upserted.map((n) => n.id).sort(), ['n1', 'n2']);
  assert.equal(st.rows('notes').find((n) => n.id === 'n1')!.content, 'edited on phone');
  assert.ok(ch.tables.has('learning_cards') && ch.tables.has('learning_gaps'));
  assert.equal(st.rows('learning_cards')[0].question, 'q from phone');
  await f.remove('Unsorted/Phone.json');
  await f.remove(`.flow/data/learning_cards/${card.id}.json`);
  ch = await st.refresh();
  assert.deepEqual(ch.notes.removedIds, ['n2']);
  assert.equal(st.rows('learning_cards').length, 0);
  // a note renamed on the other device is moved, not deleted
  await f.remove(notePath);
  await f.writeText('Unsorted/Renamed.json', JSON.stringify({ kind: 'flow-note', id: 'n1', title: 'Renamed', content: 'r', updated_at: '99' }));
  ch = await st.refresh();
  assert.deepEqual(ch.notes.removedIds, []);
  assert.equal(st.rows('notes').find((n) => n.id === 'n1')!.title, 'Renamed');
});

console.log(`\n${passed} tests passed`);
