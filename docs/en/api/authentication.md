# Authentication & API Keys

Heeey uses **Personal API Keys** to authorize requests to the REST API (`/api/v1`) and the MCP server (`/api/mcp`).

---

## 🔑 Getting an API Key

1. Go to [heeey.click](https://heeey.click) and sign in to your account (via Magic Link).
2. On the dashboard, click the key icon (**API keys**) in the header.
3. Click **"New key"**:
   - Set an identifying name (e.g. `backup-script`, `claude-code`, `github-actions`).
   - Select the scopes you need:
     - **Read (`read`)**: Lets the key list boards and folders and read scene content.
     - **Write (`write`)**: Lets the key create, change, move and trash boards.
4. **Store your key safely**: The full key, in the `hk_<prefix>_<secret>` format, is shown **only once**, when it's created.

---

## 🔒 Key Format & Secure Storage

- **Format**: `hk_` followed by an 8-character hexadecimal prefix and a 40-character cryptographic secret generated with `gen_random_bytes(24)`.
  Example: `hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4`
- **Database storage**: The raw secret is **never** written to the database. Supabase stores only:
  - The `prefix` (e.g. `hk_1a2b3c4d`), shown in the interface so you know which key is which.
  - The `key_hash`: a cryptographic digest computed with `sha256(key)`.
- **Per-account limit**: Each user can have up to **20 active keys at the same time**.
- **Teams the key reaches**: When you create a key you choose which teams it reads and changes boards in (by default, only your personal team). Older keys keep reaching your personal team. If you leave a team, the key loses access to it right away.

---

## 📤 Sending the Key with Requests

You can send the key in the standard `Authorization` header or in the custom `X-API-Key` header:

### Option 1: Authorization Bearer header (recommended)
```http
GET /api/v1/boards HTTP/1.1
Host: heeey.click
Authorization: Bearer hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
```

### Option 2: X-API-Key header
```http
GET /api/v1/boards HTTP/1.1
Host: heeey.click
X-API-Key: hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
```

---

## 🚫 Revoking a Key

If your key has leaked or you want to turn off an old integration:
1. Open the **API keys** dialog on the dashboard.
2. Find the key by its prefix or name.
3. Click **"Revoke"**.
4. The key is marked with `revoked_at = now()` and stops working immediately. Revoking is permanent and can't be undone.
