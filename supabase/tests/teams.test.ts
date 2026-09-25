/**
 * Teams, projects and Drive-style sharing (supabase/migrations/20260927120000_teams_projects_sharing.sql).
 * Every rule is checked as the database enforces it, under RLS, as each kind of user.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestDb, TestDb } from './harness';
import { handleMcpRequest } from '../../src/server/mcpHandler';
import { handleApiRequest, Rpc } from '../../src/server/apiHandler';

const OWNER = '00000000-0000-4000-8000-0000000000a1';
const ADMIN = '00000000-0000-4000-8000-0000000000a2';
const MEMBER = '00000000-0000-4000-8000-0000000000a3';
const VIEWER = '00000000-0000-4000-8000-0000000000a4';
const OUTSIDER = '00000000-0000-4000-8000-0000000000a5';
const GUEST = '00000000-0000-4000-8000-0000000000a6';
const LATE = '00000000-0000-4000-8000-0000000000a7';

const uuid = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let t: TestDb;
let team: { id: string; slug: string };
let general: string; // the team's default project
let secret: string; // a private project

/** Creates a board as `user` in `project` with the given general access */
async function createBoard(user: string, project: string, access = 'restricted', id = crypto.randomUUID()) {
  const r = await t.as(user, `insert into public.boards (id, title, owner_id, project_id, access_level) values ($1, 'Quadro', $2, $3, $4) returning id`, [
    id,
    user,
    project,
    access,
  ]);
  expect(r.error).toBeUndefined();
  return id;
}

const canSee = async (user: string | null, board: string, link: string | null = null) =>
  (await t.as(user, `select id from public.boards where id = $1`, [board], link)).rows.length === 1;

const canWrite = async (user: string | null, board: string, link: string | null = null) =>
  (await t.as(user, `update public.boards set title = 'x' where id = $1 returning id`, [board], link)).rows.length === 1;

const access = async (user: string | null, board: string, link: string | null = null) =>
  (await t.as(user, `select public.get_board_access($1) as a`, [board], link)).rows[0]?.a;

async function invite(by: string, role: string) {
  const r = await t.as(by, `select * from public.create_team_invite($1, $2)`, [team.id, role]);
  expect(r.error).toBeUndefined();
  return r.rows[0].token as string;
}

describe('teams, projects and sharing', () => {
  beforeAll(async () => {
    t = await createTestDb();
    await t.signUp(OWNER, 'owner@acme.test', { name: 'Olívia Dona' });
    await t.signUp(ADMIN, 'admin@acme.test');
    await t.signUp(MEMBER, 'member@acme.test');
    await t.signUp(VIEWER, 'viewer@acme.test');
    await t.signUp(OUTSIDER, 'outsider@other.test');
    await t.signUp(GUEST, 'Guest@Client.test');

    const created = await t.as(OWNER, `select public.create_team('Acme Design') as t`);
    expect(created.error).toBeUndefined();
    team = created.rows[0].t;
    general = (await t.sys(`select id from public.projects where team_id = $1 and is_default`, [team.id]))[0].id;

    for (const [user, role] of [[ADMIN, 'admin'], [MEMBER, 'member'], [VIEWER, 'viewer']] as const) {
      const token = await invite(OWNER, role);
      expect((await t.as(user, `select public.accept_team_invite($1) as t`, [token])).error).toBeUndefined();
    }
    secret = (await t.as(ADMIN, `select public.create_project($1, 'Projeto secreto', 'private') as p`, [team.id])).rows[0].p.id;
  }, 60_000);

  describe('personal team', () => {
    it('is created on sign-up with the user as owner and a default project', async () => {
      const rows = await t.sys(
        `select t.name, t.is_personal, m.role, p.name as project, p.is_default
         from public.teams t join public.team_members m on m.team_id = t.id
         join public.projects p on p.team_id = t.id
         where t.created_by = $1 and t.is_personal`,
        [OWNER]
      );
      expect(rows).toEqual([{ name: 'Olívia Dona', is_personal: true, role: 'owner', project: 'Geral', is_default: true }]);
      // Idempotent: the app calls it on every sign-in
      const first = (await t.as(OWNER, `select public.ensure_personal_team() as id`)).rows[0].id;
      expect((await t.as(OWNER, `select public.ensure_personal_team() as id`)).rows[0].id).toBe(first);
      expect((await t.as(null, `select public.ensure_personal_team()`)).error).toBeDefined();
    });

    it('cannot be deleted or left by its owner, and its owner cannot be demoted', async () => {
      const personal = (await t.sys(`select id from public.teams where created_by = $1 and is_personal`, [OWNER]))[0].id;
      expect((await t.as(OWNER, `select public.delete_team($1)`, [personal])).error).toMatch(/pessoal/);
      expect((await t.as(OWNER, `select public.remove_team_member($1, $2)`, [personal, OWNER])).error).toMatch(/pessoal/);
      expect((await t.as(OWNER, `select public.set_team_member_role($1, $2, 'admin')`, [personal, OWNER])).error).toMatch(/pessoal/);
    });

    it("new boards of a signed-in user land in their personal team's default project", async () => {
      const id = uuid(1);
      expect((await t.as(OUTSIDER, `insert into public.boards (id, title, owner_id) values ($1, 'x', $2)`, [id, OUTSIDER])).error).toBeUndefined();
      const [b] = await t.sys(`select team_id, project_id from public.boards where id = $1`, [id]);
      expect(b.project_id).toBe(await t.personalProject(OUTSIDER));
    });
  });

  describe('membership and invites', () => {
    it('lists members with their roles to members only', async () => {
      const members = (await t.as(VIEWER, `select email, role from public.list_team_members($1)`, [team.id])).rows;
      expect(members).toEqual([
        { email: 'owner@acme.test', role: 'owner' },
        { email: 'admin@acme.test', role: 'admin' },
        { email: 'member@acme.test', role: 'member' },
        { email: 'viewer@acme.test', role: 'viewer' },
      ]);
      expect((await t.as(OUTSIDER, `select * from public.list_team_members($1)`, [team.id])).error).toMatch(/não encontrado/);
      expect((await t.as(OUTSIDER, `select count(*)::int as n from public.teams where id = $1`, [team.id])).rows[0].n).toBe(0);
      expect((await t.as(MEMBER, `select my_role(t) as r from public.teams t where id = $1`, [team.id])).rows[0].r).toBe('member');
    });

    it('invites are single-use links, created by owners and admins, previewable without a session', async () => {
      expect((await t.as(MEMBER, `select * from public.create_team_invite($1, 'member')`, [team.id])).error).toMatch(/owners e admins/);
      const token = await invite(ADMIN, 'viewer');
      const preview = (await t.as(null, `select public.get_team_invite($1) as i`, [token])).rows[0].i;
      expect(preview).toMatchObject({ status: 'valid', team_name: 'Acme Design', role: 'viewer', team_slug: null, is_member: false });
      expect((await t.as(null, `select public.get_team_invite('nope') as i`)).rows[0].i).toEqual({ status: 'invalid' });
      expect((await t.as(null, `select public.accept_team_invite($1)`, [token])).error).toBeDefined();

      // Only the hash is stored, and clients cannot read it
      expect((await t.as(ADMIN, `select token_hash from public.team_invites`)).error).toMatch(/permission denied/);
      expect((await t.as(ADMIN, `select count(*)::int as n from public.team_invites where team_id = $1`, [team.id])).rows[0].n).toBeGreaterThan(0);
      expect((await t.as(MEMBER, `select count(*)::int as n from public.team_invites where team_id = $1`, [team.id])).rows[0].n).toBe(0);

      expect((await t.as(OUTSIDER, `select public.accept_team_invite($1) as t`, [token])).rows[0].t.my_role).toBe('viewer');
      expect((await t.as(GUEST, `select public.accept_team_invite($1)`, [token])).error).toMatch(/expirou ou já foi usado/);
      expect((await t.as(OUTSIDER, `select public.get_team_invite($1) as i`, [token])).rows[0].i.status).toBe('used');

      // Leave again so the outsider stays an outsider for the other tests
      expect((await t.as(OUTSIDER, `select public.remove_team_member($1, $2)`, [team.id, OUTSIDER])).error).toBeUndefined();
    });

    it('revoked and expired invites cannot be used', async () => {
      const revoked = await invite(OWNER, 'member');
      const id = (await t.sys(`select id from public.team_invites order by created_at desc limit 1`))[0].id;
      expect((await t.as(MEMBER, `select public.revoke_team_invite($1)`, [id])).error).toMatch(/não encontrado/);
      expect((await t.as(ADMIN, `select public.revoke_team_invite($1) as ok`, [id])).rows[0].ok).toBe(true);
      expect((await t.as(OUTSIDER, `select public.accept_team_invite($1)`, [revoked])).error).toMatch(/expirou/);

      const expired = await invite(OWNER, 'member');
      await t.sys(`update public.team_invites set expires_at = now() - interval '1 minute' where accepted_at is null and revoked_at is null`);
      expect((await t.as(OUTSIDER, `select public.get_team_invite($1) as i`, [expired])).rows[0].i.status).toBe('expired');
      expect((await t.as(OUTSIDER, `select public.accept_team_invite($1)`, [expired])).error).toMatch(/expirou/);
    });

    it('enforces who can change roles and remove members', async () => {
      expect((await t.as(MEMBER, `select public.set_team_member_role($1, $2, 'admin')`, [team.id, VIEWER])).error).toMatch(/owners e admins/);
      expect((await t.as(ADMIN, `select public.set_team_member_role($1, $2, 'owner')`, [team.id, MEMBER])).error).toMatch(/Apenas owners/);
      expect((await t.as(ADMIN, `select public.remove_team_member($1, $2)`, [team.id, OWNER])).error).toMatch(/Apenas owners/);
      // The last owner can neither leave nor step down
      expect((await t.as(OWNER, `select public.remove_team_member($1, $2)`, [team.id, OWNER])).error).toMatch(/pelo menos um owner/);
      expect((await t.as(OWNER, `select public.set_team_member_role($1, $2, 'admin')`, [team.id, OWNER])).error).toMatch(/pelo menos um owner/);
      // Direct writes are closed: everything goes through the functions
      expect((await t.as(OWNER, `update public.team_members set role = 'owner' where user_id = $1`, [VIEWER])).error).toMatch(/permission denied/);
      expect((await t.as(OUTSIDER, `insert into public.team_members values ($1, $2, 'owner')`, [team.id, OUTSIDER])).error).toMatch(/permission denied/);
      expect((await t.as(OWNER, `update public.teams set is_personal = true where id = $1`, [team.id])).error).toMatch(/permission denied/);
    });

    it('lets admins configure the team, and only owners delete an empty team', async () => {
      expect((await t.as(MEMBER, `select public.update_team($1, 'x')`, [team.id])).error).toMatch(/owners e admins/);
      expect((await t.as(ADMIN, `select public.update_team($1, 'Acme', null) as t`, [team.id])).rows[0].t.name).toBe('Acme');

      const temp = (await t.as(MEMBER, `select public.create_team('Temporário') as t`)).rows[0].t;
      const tempProject = (await t.sys(`select id from public.projects where team_id = $1`, [temp.id]))[0].id;
      const board = await createBoard(MEMBER, tempProject);
      expect((await t.as(MEMBER, `select public.delete_team($1)`, [temp.id])).error).toMatch(/quadros/);
      await t.sys(`delete from public.boards where id = $1`, [board]);
      expect((await t.as(MEMBER, `select public.delete_team($1) as ok`, [temp.id])).rows[0].ok).toBe(true);
    });
  });

  describe('projects and roles', () => {
    let open: string;
    let hidden: string;
    beforeAll(async () => {
      open = await createBoard(MEMBER, general);
      hidden = await createBoard(ADMIN, secret);
    });

    it('team projects are open to every member; viewers only read', async () => {
      for (const user of [OWNER, ADMIN, MEMBER, VIEWER]) expect(await canSee(user, open)).toBe(true);
      expect(await canSee(OUTSIDER, open)).toBe(false);
      expect(await canWrite(MEMBER, open)).toBe(true);
      expect(await canWrite(VIEWER, open)).toBe(false);
      expect((await access(VIEWER, open)).permission).toBe('view');
      expect((await access(MEMBER, open)).permission).toBe('manage'); // its creator
      expect((await access(ADMIN, open)).permission).toBe('manage');
      expect(await access(OUTSIDER, open)).toEqual({ exists: true, permission: null });
      expect(await access(OUTSIDER, uuid(999))).toEqual({ exists: false, permission: null });
    });

    it('private projects are visible to their members and to team owners/admins only', async () => {
      const visible = async (user: string) =>
        (await t.as(user, `select count(*)::int as n from public.projects where id = $1`, [secret])).rows[0].n === 1;
      expect(await visible(OWNER)).toBe(true);
      expect(await visible(ADMIN)).toBe(true);
      expect(await visible(MEMBER)).toBe(false);
      expect(await canSee(MEMBER, hidden)).toBe(false);
      expect(await canSee(OWNER, hidden)).toBe(true);

      expect((await t.as(MEMBER, `select public.set_project_member($1, $2, 'edit')`, [secret, MEMBER])).error).toMatch(/administra/);
      expect((await t.as(ADMIN, `select public.set_project_member($1, $2, 'edit')`, [secret, MEMBER])).error).toBeUndefined();
      expect((await t.as(ADMIN, `select public.set_project_member($1, $2, 'edit')`, [secret, OUTSIDER])).error).toMatch(/membro do time/);
      expect(await canSee(MEMBER, hidden)).toBe(true);
      expect(await canWrite(MEMBER, hidden)).toBe(true);

      // A team viewer added with edit rights still only reads
      await t.as(ADMIN, `select public.set_project_member($1, $2, 'edit')`, [secret, VIEWER]);
      expect(await canSee(VIEWER, hidden)).toBe(true);
      expect(await canWrite(VIEWER, hidden)).toBe(false);
      await t.as(ADMIN, `select public.set_project_member($1, $2, null)`, [secret, VIEWER]);
      expect(await canSee(VIEWER, hidden)).toBe(false);
    });

    it('only editors of the project create boards and folders in it', async () => {
      expect((await t.as(VIEWER, `insert into public.boards (title, owner_id, project_id) values ('x', $1, $2)`, [VIEWER, general])).error).toBeDefined();
      expect((await t.as(OUTSIDER, `insert into public.boards (title, owner_id, project_id) values ('x', $1, $2)`, [OUTSIDER, general])).error).toBeDefined();
      expect((await t.as(null, `insert into public.boards (title, project_id) values ('x', $1)`, [general])).error).toBeDefined();

      const folder = await t.as(MEMBER, `insert into public.folders (owner_id, name, project_id) values ($1, 'Pasta', $2) returning id`, [MEMBER, general]);
      expect(folder.error).toBeUndefined();
      expect((await t.as(VIEWER, `select count(*)::int as n from public.folders where project_id = $1`, [general])).rows[0].n).toBe(1);
      expect((await t.as(VIEWER, `insert into public.folders (owner_id, name, project_id) values ($1, 'x', $2)`, [VIEWER, general])).error).toBeDefined();
      expect((await t.as(VIEWER, `update public.boards set folder_id = $2 where id = $1 returning id`, [open, folder.rows[0].id])).rows).toHaveLength(0);
      expect((await t.as(MEMBER, `update public.boards set folder_id = $2 where id = $1 returning id`, [open, folder.rows[0].id])).rows).toHaveLength(1);
      // A folder of another project is refused
      const other = await t.as(ADMIN, `insert into public.folders (owner_id, name, project_id) values ($1, 'Secreta', $2) returning id`, [ADMIN, secret]);
      expect((await t.as(ADMIN, `update public.boards set folder_id = $2 where id = $1`, [open, other.rows[0].id])).error).toMatch(/Pasta de destino/);
      await t.as(MEMBER, `update public.boards set folder_id = null where id = $1`, [open]);
    });

    it('closes direct changes to creator, team, project and the link schedule', async () => {
      for (const column of ['owner_id', 'team_id', 'project_id', 'restrict_link_at']) {
        const r = await t.as(ADMIN, `update public.boards set ${column} = null where id = $1`, [open]);
        expect(r.error, column).toMatch(/permission denied/);
      }
    });

    it('moves boards between projects (editors of both) and between teams (admins of both)', async () => {
      const board = await createBoard(MEMBER, general);
      expect((await t.as(MEMBER, `select public.move_board($1, $2)`, [board, secret])).error).toBeUndefined(); // member of secret now
      expect((await t.as(VIEWER, `select public.move_board($1, $2)`, [board, general])).error).toBeDefined();
      expect((await t.as(MEMBER, `select public.move_board($1, $2) as r`, [board, general])).rows[0].r.project_id).toBe(general);

      const personal = await t.personalProject(MEMBER);
      expect((await t.as(MEMBER, `select public.move_board($1, $2)`, [board, personal])).error).toMatch(/owner ou admin nos dois/);
      const adminPersonal = await t.personalProject(ADMIN);
      const moved = await t.as(ADMIN, `select public.move_board($1, $2) as r`, [board, adminPersonal]);
      expect(moved.error).toBeUndefined();
      expect(await canSee(MEMBER, board)).toBe(false);
      const events = await t.sys(`select action from public.audit_log where entity_id = $1 order by id`, [board]);
      expect(events.map((e) => e.action)).toEqual(['board.created', 'board.moved', 'board.moved', 'board.moved']);
    });

    it('only owners/admins delete an empty, non-default project; managers rename and close it', async () => {
      const temp = (await t.as(MEMBER, `select public.create_project($1, 'Temp') as p`, [team.id])).rows[0].p;
      expect(temp).toMatchObject({ name: 'Temp', visibility: 'team', my_access: 'edit' });
      expect((await t.as(MEMBER, `select public.update_project($1, 'Temp 2', 'private') as p`, [temp.id])).rows[0].p.visibility).toBe('private');
      expect((await t.as(VIEWER, `select count(*)::int as n from public.projects where id = $1`, [temp.id])).rows[0].n).toBe(0);
      expect((await t.as(VIEWER, `select public.update_project($1, 'x')`, [temp.id])).error).toMatch(/administra/);
      expect((await t.as(MEMBER, `select public.delete_project($1)`, [temp.id])).error).toMatch(/owners e admins/);
      expect((await t.as(ADMIN, `select public.delete_project($1) as ok`, [temp.id])).rows[0].ok).toBe(true);
      expect((await t.as(OWNER, `select public.delete_project($1)`, [general])).error).toMatch(/padrão/);
      expect((await t.as(OWNER, `select public.update_project($1, null, 'private')`, [general])).error).toMatch(/padrão/);
    });
  });

  describe('general access (link)', () => {
    it('restricted boards do not open by link, even with the id', async () => {
      const board = await createBoard(MEMBER, general, 'restricted');
      expect(await canSee(null, board, board)).toBe(false);
      expect(await canSee(OUTSIDER, board, board)).toBe(false);
      expect(await canWrite(null, board, board)).toBe(false);
      expect((await access(null, board, board)).permission).toBeNull();

      // Anyone with the link, as viewer: reads with the header, never lists without it
      expect((await t.as(MEMBER, `update public.boards set access_level = 'view' where id = $1`, [board])).error).toBeUndefined();
      expect(await canSee(null, board, board)).toBe(true);
      expect(await canSee(null, board)).toBe(false);
      expect(await canWrite(null, board, board)).toBe(false);
      expect((await access(null, board, board)).permission).toBe('view');

      await t.as(MEMBER, `update public.boards set access_level = 'edit' where id = $1`, [board]);
      expect(await canWrite(OUTSIDER, board, board)).toBe(true);
    });

    it('only people who can share change the general access; editors lose it when the team turns it off', async () => {
      const board = await createBoard(ADMIN, general, 'edit');
      // Editing by link does not allow changing the access
      expect((await t.as(null, `update public.boards set access_level = 'restricted' where id = $1`, [board], board)).error).toBeDefined();
      expect((await t.as(OUTSIDER, `update public.boards set access_level = 'view' where id = $1`, [board], board)).error).toBeDefined();
      expect((await t.as(VIEWER, `update public.boards set access_level = 'view' where id = $1 returning id`, [board])).rows).toHaveLength(0);
      expect((await t.as(MEMBER, `update public.boards set access_level = 'view' where id = $1`, [board])).error).toBeUndefined();

      await t.as(OWNER, `select public.update_team($1, null, false)`, [team.id]);
      expect((await t.as(MEMBER, `update public.boards set access_level = 'edit' where id = $1`, [board])).error).toMatch(/permissão/);
      expect((await t.as(MEMBER, `select public.share_board($1, 'x@y.test', 'view')`, [board])).error).toMatch(/permissão/);
      expect((await t.as(ADMIN, `update public.boards set access_level = 'edit' where id = $1`, [board])).error).toBeUndefined();
      await t.as(OWNER, `select public.update_team($1, null, true)`, [team.id]);
    });

    it('anonymous boards stay open for editing until someone claims them', async () => {
      const board = uuid(50);
      await t.as(null, `insert into public.boards (id, title) values ($1, 'rascunho')`, [board], board);
      expect((await t.as(null, `update public.boards set access_level = 'view' where id = $1`, [board], board)).error).toMatch(/anônimo/);
      expect((await t.sys(`select public.board_permission($1) as p`, [board]))[0].p).toBe('edit');
    });
  });

  describe('sharing with people', () => {
    let board: string;
    beforeAll(async () => {
      board = await createBoard(MEMBER, secret, 'restricted');
    });

    it('shares with an existing account by e-mail, case-insensitively', async () => {
      expect(await canSee(GUEST, board)).toBe(false);
      const shared = await t.as(MEMBER, `select public.share_board($1, '  guest@CLIENT.test ', 'view') as m`, [board]);
      expect(shared.error).toBeUndefined();
      expect(shared.rows[0].m).toMatchObject({ email: 'guest@client.test', role: 'view' });
      expect(await canSee(GUEST, board)).toBe(true);
      expect(await canWrite(GUEST, board)).toBe(false);
      expect((await access(GUEST, board)).permission).toBe('view');

      // Upgrading the role
      await t.as(MEMBER, `select public.share_board($1, 'guest@client.test', 'edit')`, [board]);
      expect(await canWrite(GUEST, board)).toBe(true);
      // The guest sees only that board: not the project, its folders or other boards
      expect((await t.as(GUEST, `select count(*)::int as n from public.projects where id = $1`, [secret])).rows[0].n).toBe(0);
      expect((await t.as(GUEST, `select count(*)::int as n from public.boards where project_id = $1`, [secret])).rows[0].n).toBe(1);
      expect((await t.as(GUEST, `select count(*)::int as n from public.folders where project_id = $1`, [secret])).rows[0].n).toBe(0);
      const info = await access(GUEST, board);
      expect(info.project).toBeNull();
      expect(info.team.is_member).toBe(false);
    });

    it('keeps pending invites for e-mails without an account and activates them on verified sign-up', async () => {
      await t.as(MEMBER, `select public.share_board($1, 'late@client.test', 'edit')`, [board]);
      // The response and the list never reveal whether an e-mail has an account
      const sharing = (await t.as(MEMBER, `select public.board_sharing($1) as s`, [board])).rows[0].s;
      expect(sharing.members.map((m: any) => Object.keys(m).sort())).toEqual([
        ['email', 'id', 'is_you', 'role'],
        ['email', 'id', 'is_you', 'role'],
      ]);

      await t.signUp(LATE, 'late@client.test', { confirmed: false });
      expect(await canSee(LATE, board)).toBe(false); // e-mail not verified yet
      await t.sys(`update auth.users set email_confirmed_at = now() where id = $1`, [LATE]);
      expect(await canWrite(LATE, board)).toBe(true);
    });

    it('lists who has access to people with access, including inherited access', async () => {
      const sharing = (await t.as(GUEST, `select public.board_sharing($1) as s`, [board])).rows[0].s;
      expect(sharing).toMatchObject({
        my_permission: 'edit',
        access_level: 'restricted',
        creator: { email: 'member@acme.test', is_you: false },
        team: { name: 'Acme', member_count: 4 },
        project: { name: 'Projeto secreto', visibility: 'private', member_count: 2 },
      });
      expect(sharing.members.map((m: any) => m.email)).toEqual(['guest@client.test', 'late@client.test']);
      expect((await t.as(OUTSIDER, `select public.board_sharing($1)`, [board])).error).toMatch(/não encontrado/);
      // The raw table only shows your own invites
      expect((await t.as(GUEST, `select email from public.board_members`)).rows).toEqual([{ email: 'guest@client.test' }]);
    });

    it('guest editors may share when the team allows it; viewers never share', async () => {
      expect((await t.as(GUEST, `select public.share_board($1, 'friend@client.test', 'view')`, [board])).error).toBeUndefined();
      const friend = (await t.sys(`select id from public.board_members where email = 'friend@client.test'`))[0].id;
      await t.as(MEMBER, `select public.update_board_share($1, 'view')`, [
        (await t.sys(`select id from public.board_members where email = 'guest@client.test'`))[0].id,
      ]);
      expect((await t.as(GUEST, `select public.share_board($1, 'other@client.test', 'view')`, [board])).error).toMatch(/permissão/);
      expect((await t.as(GUEST, `select public.remove_board_share($1)`, [friend])).error).toMatch(/não encontrado/);
      expect((await t.as(MEMBER, `select public.remove_board_share($1) as ok`, [friend])).rows[0].ok).toBe(true);
    });

    it('rejects invalid e-mails and roles, and lets a guest remove their own access', async () => {
      expect((await t.as(MEMBER, `select public.share_board($1, 'not-an-email', 'view')`, [board])).error).toMatch(/E-mail inválido/);
      expect((await t.as(MEMBER, `select public.share_board($1, 'a@b.test', 'manage')`, [board])).error).toMatch(/Papel inválido/);
      expect((await t.as(OUTSIDER, `select public.share_board($1, 'a@b.test', 'view')`, [board])).error).toMatch(/permissão/);
      const own = (await t.sys(`select id from public.board_members where user_id = $1`, [LATE]))[0].id;
      expect((await t.as(LATE, `select public.remove_board_share($1) as ok`, [own])).rows[0].ok).toBe(true);
      expect(await canSee(LATE, board)).toBe(false);
    });

    it('records sharing in the audit log without the e-mail', async () => {
      const rows = await t.sys(`select action, details from public.audit_log where entity = 'board' and entity_id = $1 and action like 'board.%share%' order by id`, [board]);
      expect(rows.map((r) => r.action)).toContain('board.shared');
      expect(rows.map((r) => r.action)).toContain('board.unshared');
      expect(JSON.stringify(rows)).not.toContain('@');
    });
  });

  describe('claiming anonymous boards', () => {
    it('moves a board created without an account into a chosen project with the chosen access', async () => {
      const board = uuid(60);
      await t.as(null, `insert into public.boards (id, title) values ($1, 'sem conta')`, [board], board);
      expect((await t.as(MEMBER, `select public.claim_board($1, $2, 'restricted')`, [board, general])).error).toMatch(/não encontrado/); // no link
      expect((await t.as(VIEWER, `select public.claim_board($1, $2, 'restricted')`, [board, general], board)).error).toMatch(/não pode criar/);
      expect((await t.as(MEMBER, `select public.claim_board($1, $2, 'view')`, [board, general], board)).error).toMatch(/aberto por link ou fica restrito/);
      const claimed = await t.as(MEMBER, `select public.claim_board($1, $2, 'restricted') as r`, [board, general], board);
      expect(claimed.rows[0].r).toMatchObject({ project_id: general, access_level: 'restricted' });
      expect(await canSee(null, board, board)).toBe(false);
      expect(await canSee(VIEWER, board)).toBe(true);
      expect((await t.as(ADMIN, `select public.claim_board($1, $2, 'edit')`, [board, general], board)).error).toMatch(/já pertence/);
      const [event] = await t.sys(`select actor_id, details from public.audit_log where entity_id = $1 and action = 'board.claimed'`, [board]);
      expect(event).toMatchObject({ actor_id: MEMBER, details: { access_level: 'restricted', project_id: general } });
    });
  });

  describe('link restriction with notice', () => {
    // As the migration's backfill does: only privileged code schedules a restriction
    const schedule = async (ids: string[], offset: string) => {
      await t.db.exec(`reset role; select set_config('heeey.system', 'on', false);`);
      await t.db.query(`update public.boards set restrict_link_at = now() + $2::interval where id = any($1::uuid[])`, [ids, offset]);
      await t.db.exec(`select set_config('heeey.system', 'off', false);`);
    };

    it('restricts due links daily, unless someone kept the link open', async () => {
      const due = await createBoard(MEMBER, general, 'edit');
      const kept = await createBoard(MEMBER, general, 'view');
      const trashed = await createBoard(MEMBER, general, 'edit');
      await schedule([due, kept, trashed], '-1 minute');
      expect((await t.as(MEMBER, `update public.boards set deleted_at = now() where id = $1`, [trashed])).error).toBeUndefined();

      expect((await t.as(VIEWER, `select public.keep_board_link_open($1)`, [kept])).error).toMatch(/permissão/);
      expect((await t.as(MEMBER, `select public.keep_board_link_open($1)`, [kept])).error).toBeUndefined();
      expect((await t.as(MEMBER, `select public.apply_scheduled_link_restrictions()`)).error).toMatch(/permission denied/);

      expect((await t.sys(`select public.apply_scheduled_link_restrictions() as n`))[0].n).toBe(1);
      const rows = await t.sys(`select id, access_level, restrict_link_at from public.boards where id in ($1, $2, $3)`, [due, kept, trashed]);
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
      expect(byId[due]).toMatchObject({ access_level: 'restricted', restrict_link_at: null });
      expect(byId[kept]).toMatchObject({ access_level: 'view', restrict_link_at: null });
      expect(byId[trashed].access_level).toBe('edit'); // restricted once restored
      const [event] = await t.sys(`select actor_id, details from public.audit_log where entity_id = $1 and action = 'board.link_restricted'`, [due]);
      expect(event).toMatchObject({ actor_id: null, details: { from: 'edit', to: 'restricted', system: true } });
      expect((await t.sys(`select count(*)::int as n from public.audit_log where entity_id = $1 and action = 'board.link_kept_open'`, [kept]))[0].n).toBe(1);
    });

    it('changing the general access by hand cancels the schedule', async () => {
      const board = await createBoard(MEMBER, general, 'edit');
      await schedule([board], '30 days');
      await t.as(MEMBER, `update public.boards set access_level = 'view' where id = $1`, [board]);
      expect((await t.sys(`select restrict_link_at from public.boards where id = $1`, [board]))[0].restrict_link_at).toBeNull();
    });
  });

  describe('realtime and storage follow the same access', () => {
    const allowed = async (user: string | null, topic: string, extension: string) => {
      await t.sys(`select set_config('realtime.topic', '${topic}', false)`);
      const r = await t.as(user, `insert into realtime.messages (topic, extension) values ($1, $2)`, [topic, extension]);
      await t.sys(`select set_config('realtime.topic', '', false)`);
      return !r.error;
    };

    it('people without access cannot join the room of a restricted board', async () => {
      const board = await createBoard(MEMBER, general, 'restricted');
      expect(await allowed(null, `heeey:room:${board}`, 'presence')).toBe(false);
      expect(await allowed(OUTSIDER, `heeey:peers:${board}`, 'broadcast')).toBe(false);
      expect(await allowed(VIEWER, `heeey:room:${board}`, 'presence')).toBe(true);
      expect(await allowed(VIEWER, `heeey:room:${board}`, 'broadcast')).toBe(false);
      expect(await allowed(MEMBER, `heeey:room:${board}`, 'broadcast')).toBe(true);
    });

    it('uploads need edit access; listing needs to manage the board', async () => {
      const board = await createBoard(MEMBER, general, 'restricted');
      const upload = (user: string | null, file: string) =>
        t.as(user, `insert into storage.objects (bucket_id, name) values ('board-media', $1)`, [`${board}/${file}`]);
      expect((await upload(null, 'a.webp')).error).toBeDefined();
      expect((await upload(VIEWER, 'b.webp')).error).toBeDefined();
      expect((await upload(MEMBER, 'c.webp')).error).toBeUndefined();
      const list = async (user: string) =>
        (await t.as(user, `select name from storage.objects where name like $1`, [`${board}/%`])).rows.length;
      expect(await list(MEMBER)).toBe(1); // creator
      expect(await list(ADMIN)).toBe(1);
      expect(await list(VIEWER)).toBe(0);
    });
  });

  describe('search', () => {
    it('finds boards of the chosen team and boards shared with me', async () => {
      const board = await createBoard(MEMBER, general, 'restricted');
      await t.as(MEMBER, `update public.boards set title = 'Mapa de jornada' where id = $1`, [board]);
      const search = (user: string, teamId: string | null) =>
        t.as(user, `select id from public.search_boards('jornada', 20, $1)`, [teamId]);
      expect((await search(VIEWER, team.id)).rows.map((r) => r.id)).toEqual([board]);
      expect((await search(VIEWER, await t.sys(`select id from public.teams where created_by = $1 and is_personal`, [VIEWER]).then((r) => r[0].id))).rows).toEqual([]);
      expect((await search(OUTSIDER, null)).rows).toEqual([]);
      await t.as(MEMBER, `select public.share_board($1, 'outsider@other.test', 'view')`, [board]);
      expect((await search(OUTSIDER, null)).rows.map((r) => r.id)).toEqual([board]);
      expect((await t.as(OUTSIDER, `select id from public.search_candidates(40, null)`)).rows.map((r) => r.id)).toContain(board);
    });
  });

  describe('API keys scoped to teams', () => {
    const call = async (fn: string, args: Record<string, unknown>) => {
      const names = Object.keys(args);
      const r = await t.as(null, `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`, Object.values(args));
      return { data: r.rows[0]?.r, error: r.error };
    };

    it('only reaches the teams chosen at creation', async () => {
      const personalTeam = (await t.sys(`select id from public.teams where created_by = $1 and is_personal`, [MEMBER]))[0].id;
      expect((await t.as(MEMBER, `select * from public.create_api_key('x', array['read','write'], array[$1]::uuid[])`, [
        (await t.sys(`select id from public.teams where created_by = $1 and is_personal`, [OWNER]))[0].id,
      ])).error).toMatch(/participa/);

      const personalKey = (await t.as(MEMBER, `select key from public.create_api_key('pessoal')`)).rows[0].key;
      const teamKey = (await t.as(MEMBER, `select key from public.create_api_key('acme', array['read','write'], array[$1]::uuid[])`, [team.id])).rows[0].key;
      const keyTeams = await t.as(MEMBER, `select k.name, akt.team_id from public.api_keys k join public.api_key_teams akt on akt.api_key_id = k.id order by k.name`);
      expect(keyTeams.rows).toEqual([
        { name: 'acme', team_id: team.id },
        { name: 'pessoal', team_id: personalTeam },
      ]);

      const created = await call('api_create_board', { p_key: teamKey, p_title: 'Pela API' });
      expect(created.error).toBeUndefined();
      expect(created.data).toMatchObject({ team_id: team.id, project_id: general, access_level: 'restricted' });
      expect((await call('api_get_board', { p_key: personalKey, p_board_id: created.data.id })).error).toMatch(/não encontrado/);
      expect((await call('api_list_boards', { p_key: personalKey })).data.map((b: any) => b.id)).not.toContain(created.data.id);
      expect((await call('api_list_boards', { p_key: teamKey, p_project_id: general })).data.map((b: any) => b.id)).toContain(created.data.id);

      const projects = (await call('api_list_projects', { p_key: teamKey })).data;
      expect(projects.map((p: any) => p.name)).toEqual(['Geral', 'Projeto secreto']);
      const inSecret = await call('api_create_board', { p_key: teamKey, p_title: 'Secreto', p_project_id: secret });
      expect(inSecret.data.project_id).toBe(secret);
      expect((await call('api_create_folder', { p_key: teamKey, p_name: 'Via API', p_project_id: secret })).data.project_id).toBe(secret);

      // A viewer's key reads but does not write
      const viewerKey = (await t.as(VIEWER, `select key from public.create_api_key('v', array['read','write'], array[$1]::uuid[])`, [team.id])).rows[0].key;
      expect((await call('api_get_board', { p_key: viewerKey, p_board_id: created.data.id })).error).toBeUndefined();
      expect((await call('api_update_board', { p_key: viewerKey, p_board_id: created.data.id, p_title: 'x' })).error).toMatch(/só pode ler/);
      expect((await call('api_create_board', { p_key: viewerKey, p_title: 'x' })).error).toMatch(/sem permissão/);

      // Leaving the team takes the key's access with it
      const outsiderToken = await invite(OWNER, 'member');
      await t.as(OUTSIDER, `select public.accept_team_invite($1)`, [outsiderToken]);
      const outsiderKey = (await t.as(OUTSIDER, `select key from public.create_api_key('o', array['read'], array[$1]::uuid[])`, [team.id])).rows[0].key;
      expect((await call('api_get_board', { p_key: outsiderKey, p_board_id: created.data.id })).error).toBeUndefined();
      await t.as(OWNER, `select public.remove_team_member($1, $2)`, [team.id, OUTSIDER]);
      expect((await call('api_get_board', { p_key: outsiderKey, p_board_id: created.data.id })).error).toMatch(/não encontrado/);
    });
  });

  describe('REST API and MCP end to end', () => {
    const rpc: Rpc = async (fn, args) => {
      const names = Object.keys(args);
      const r = await t.as(null, `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`, Object.values(args));
      return r.error ? { data: null, error: { message: r.error } } : { data: r.rows[0].r, error: null };
    };

    it('lists projects and creates boards in the chosen project', async () => {
      const key = (await t.as(ADMIN, `select key from public.create_api_key('mcp', array['read','write'], array[$1]::uuid[])`, [team.id])).rows[0].key;
      const res = await handleMcpRequest(
        new Request('https://heeey.click/api/mcp', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_projects', arguments: {} } }),
        }),
        rpc,
        { appOrigin: 'https://heeey.click' }
      );
      const { result } = await res.json();
      expect(result.structuredContent.projects.map((p: any) => [p.name, p.access])).toEqual([
        ['Geral', 'manage'],
        ['Projeto secreto', 'manage'],
      ]);

      const created = await handleApiRequest(
        new Request('https://heeey.click/api/v1/boards', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Via REST', project_id: secret }),
        }),
        rpc,
        { appOrigin: 'https://heeey.click' }
      );
      expect(created.status).toBe(201);
      const { board } = await created.json();
      expect(board).toMatchObject({ project_id: secret, team_id: team.id, access_level: 'restricted' });
      expect(await canSee(MEMBER, board.id)).toBe(true);
      expect(await canSee(VIEWER, board.id)).toBe(false);
    });
  });

  describe('leaving and deleting accounts', () => {
    it('removing a member also removes them from private projects', async () => {
      const token = await invite(OWNER, 'member');
      await t.as(OUTSIDER, `select public.accept_team_invite($1)`, [token]);
      await t.as(ADMIN, `select public.set_project_member($1, $2, 'view')`, [secret, OUTSIDER]);
      await t.as(OUTSIDER, `select public.remove_team_member($1, $2)`, [team.id, OUTSIDER]);
      expect((await t.sys(`select count(*)::int as n from public.project_members where user_id = $1`, [OUTSIDER]))[0].n).toBe(0);
    });

    it('deleting an account deletes the personal team and hands shared teams to someone else', async () => {
      const solo = (await t.as(OUTSIDER, `select public.create_team('Solo') as t`)).rows[0].t;
      const token = (await t.as(OUTSIDER, `select * from public.create_team_invite($1, 'member')`, [solo.id])).rows[0].token;
      await t.as(GUEST, `select public.accept_team_invite($1)`, [token]);
      const personalBoard = await createBoard(OUTSIDER, await t.personalProject(OUTSIDER));

      await t.sys(`delete from auth.users where id = $1`, [OUTSIDER]);
      expect((await t.sys(`select count(*)::int as n from public.teams where created_by is null and is_personal`))[0].n).toBe(0);
      expect((await t.sys(`select count(*)::int as n from public.boards where id = $1`, [personalBoard]))[0].n).toBe(0);
      expect(await t.sys(`select user_id, role from public.team_members where team_id = $1`, [solo.id])).toEqual([{ user_id: GUEST, role: 'owner' }]);
    });
  });

  describe('audit log', () => {
    it('records team, invite, member and project events', async () => {
      const actions = (await t.sys(`select distinct action from public.audit_log where team_id = $1`, [team.id])).map((r) => r.action);
      for (const action of [
        'team.created',
        'team.updated',
        'team.member_added',
        'team.member_removed',
        'team.invite_created',
        'team.invite_accepted',
        'team.invite_revoked',
        'project.created',
        'project.member_added',
        'project.member_removed',
      ]) {
        expect(actions, action).toContain(action);
      }
    });
  });
});
