# Teams, Projects & Sharing

Heeey boards are organized in **teams** and **projects**, and sharing works like Google Drive: you invite people by e-mail and choose the general access of the link.

```
User ↔ Teams → Projects → Folders → Boards
```

---

## 👥 Teams

- **Personal team**: every account gets a personal team at sign-up, with a default project (**General**). Its owner can't delete or leave it, but it accepts guests like any other team.
- **Create a team**: in the team switcher (top of the sidebar), choose **Create team**. Whoever creates it becomes **owner**.
- **Switch teams**: the same switcher lists all your teams. The dashboard address is `/t/<team>` and, inside a project, `/t/<team>/p/<project>`.

### Team roles

| Role | What they can do |
|---|---|
| **Owner** | Everything an admin does, plus promoting other owners and deleting the team. A team always has at least one owner. |
| **Admin** | Invites and removes people, changes roles (except owners'), sees every project, including private ones, and manages every board. |
| **Member** | Creates projects and boards and edits the boards of projects they can access. |
| **Viewer** | Only views the boards of projects they can access. |

### Team invites

In **Settings › Team**, owners and admins create an **invite link** with the chosen role. Each link works for **one person** and expires in **7 days**. Whoever opens it sees the team name and the role, signs in (or signs up) and accepts. Active links can be revoked.

### Leaving or deleting

- **Leave the team**: boards you created stay in the team.
- **Delete the team**: owners only, and only when the team is empty (no boards, not even in the trash).
- **Deleting an account**: the personal team and its boards are deleted. In teams with other people, ownership goes to an admin (or, if there is none, to the longest-standing member).

---

## 📁 Projects

Projects organize a team's boards. Inside each project you can create folders.

- **Open to the team** (default): every team member sees the boards. Team viewers can only view.
- **Private**: only the people added to the project (as Editor or Viewer) and the team's owners and admins.
- The default project (**General**) is always open to the team and can't be deleted.
- **Moving boards**: from the board menu, **Move to project**. Between projects of the same team, you need to edit both. Between teams, you need to be an owner or admin in both.

---

## 🔗 Sharing (Google Drive style)

The board's **Share** button opens three sections:

### 1. Add people
Type an e-mail, choose **Viewer** or **Editor** and click **Invite**. It works for any e-mail: if the person has no account yet, the invite is kept and applies as soon as they sign up with that e-mail **verified**. The screen never reveals whether an e-mail has an account.

There's no notification e-mail: send the link with **Copy link**. Boards shared with you show up in **Shared with me**.

### 2. People with access
Shows who created the board, the inherited access (the team's or the private project's members) and people invited directly. A direct invite only **adds** access: it never removes what someone has through the team. Guests from outside the team only see that board, not the project or its other boards.

### 3. General access

| Option | Effect |
|---|---|
| **Restricted** | Only people with access through the team, project or an invite can open the board, even with the link. Default for new boards. |
| **Anyone with the link · Viewer** | Anyone with the link sees the board, no account needed. |
| **Anyone with the link · Editor** | Anyone with the link edits along, no account needed. |

Opening a restricted board without access shows **You need access**, with the option to sign in with another account.

### Who can share
By default, **editors** can invite people and change the general access. Team owners and admins can turn that off (the gear in the dialog or **Settings › Team**); then only the board's creator and admins share. People who only have the link never change the access.

---

## ⏳ Old links: migration with notice

Boards that were open by link before teams got **30 days** before becoming restricted. During that time:

- People who can share see the notice in the dialog, with **Keep link open** (for that board only) and **Restrict now**.
- People who only visit through the link see a banner with the date the link stops being public.
- Changing the general access by hand cancels the migration for that board.

A daily job applies the restrictions that are due and records each one in the audit trail.

---

## 📝 Boards created without an account

Without an account, boards stay open for editing by link. After signing in, Heeey asks **which team and project to keep them in** and whether the link **stays open** or becomes **restricted**; nothing is preselected. If you answer **Not now**, a notice in the dashboard lets you save them later.

---

## 🔒 Security

- Every rule is enforced in the database (PostgreSQL RLS and functions), not only in the interface: the API, MCP, Realtime and Storage follow the same permission.
- Changes to teams, roles, invites, projects and sharing go into the audit trail, without storing invited e-mails.
- API keys only reach the teams chosen when they were created (see [Authentication](../api/authentication.md)).
