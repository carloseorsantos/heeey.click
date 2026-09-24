# Getting Started with Heeey (Quick Start)

This guide shows how to start using **Heeey**, from your first visit in the browser all the way to programmatic automation through the API and AI agents.

---

## 🚀 First Visit: Creating Your First Board

Heeey is designed with zero friction: you don't need to create an account or fill in any forms to start drawing.

1. Go to [heeey.click](https://heeey.click).
2. Click **"Blank board"** or pick one of the available templates:
   - **Brainstorming**: Sticky notes and themed cards for quick ideation.
   - **Flowchart**: A basic structure with decision blocks and directed arrows.
   - **Wireframe**: Basic screens and components for prototyping.
3. You'll be taken to the URL `/b/<board-id>`.
4. Start drawing right away! Your work is saved locally in real time and synced to the cloud.

---

## 👥 Collaborating with Other People

To invite colleagues to the same board:

1. In the board's top bar, click the **"Share"** button.
2. Choose the permission level:
   - **Can edit** (`edit`): Anyone with the link can draw, add notes and change the content.
   - **View only** (`view`): Anyone with the link can view the board and follow the live cursors, but can't change the canvas.
3. Click **"Copy link"** and send it to your team.
4. When other people open the link, you'll see their cursors in real time, each with their own name and identifying color.

---

## 🔐 Connecting Your Account (Magic Link)

Anonymous use is supported, but signing in to your account brings key advantages:

- **Your boards on any device**: Open your dashboard from any browser.
- **Guest boards carried over automatically**: Boards you created as a guest in the browser move to your account automatically when you sign in.
- **Cloud libraries**: The items saved in your component library are available on all your boards.
- **API key creation**: Enable integrations with the public REST API and the MCP server for AI.

### How to create your account:
1. On the home page, click **"Create a free account"**.
2. Enter your email address and confirm that you are 16 or older and agree to the Terms of Use and the Privacy Policy.
3. Click **"Send sign-in link"** and open the link you receive by email in this same browser. That's it! No passwords to remember.

### How to sign in:
1. On the home page, on the dashboard or in your avatar menu, click **"Sign in"**.
2. Enter your account's email and click **"Send sign-in link"**.
3. Open the link you receive by email in this same browser.

---

## 🤖 Automation in 3 Minutes: Claude Code & MCP

If you use **Claude Code**, **Cursor** or another MCP-compatible agent:

1. Open the dashboard while signed in to your account.
2. Click the key icon (**API keys**).
3. Type a name (e.g. `claude-code`) and click **"Create"**.
4. Copy the generated key (`hk_...`). The app already shows the command formatted for your terminal:

```bash
claude mcp add --transport http heeey https://heeey.click/api/mcp --header "Authorization: Bearer hk_YOUR_TOKEN_HERE"
```

5. Open your terminal and run the command above.
6. Your AI assistant can now create entire diagrams, search your whiteboards and organize your boards straight from the prompt!

---

## 💻 Quick Example with cURL (REST API)

You can also create boards from scripts or CI/CD automations:

```bash
curl -X POST https://heeey.click/api/v1/boards \
  -H "Authorization: Bearer hk_YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Approval Flow",
    "elements": [
      { "id": "req", "type": "rectangle", "x": 100, "y": 100, "label": "Request Sent", "backgroundColor": "#a5d8ff" },
      { "id": "dec", "type": "diamond", "x": 380, "y": 85, "label": "Approved?", "backgroundColor": "#ffec99" },
      { "type": "arrow", "start": { "id": "req" }, "end": { "id": "dec" } }
    ]
  }'
```

Heeey responds with the created board's data and a direct link (`url`) to open it in the browser.
