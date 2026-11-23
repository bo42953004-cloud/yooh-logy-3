# AI Code Studio for VS Code

This extension connects VS Code on your computer to the AI Code Studio web app.
Run a command from the Command Palette and the AI writes code straight into your editor
or builds a whole website into your project folder.

## Commands

| Command | What it does |
| --- | --- |
| **AI Studio: Test Connection** | Checks that the app is reachable at `aiStudio.serverUrl`. |
| **AI Studio: Build Website from Prompt** | Asks for a description, then writes `index.html`, `styles.css` and `script.js` into an `ai-website` folder while you watch. |
| **AI Studio: Start Non-stop Writer in Active File** | Writes a burst of HTML, CSS or JavaScript into the open file, deletes part of it, and repeats until stopped. |
| **AI Studio: Start Non-stop Writer for HTML + CSS + JS** | Creates `ai-writer/index.html`, `styles.css` and `script.js` in your workspace and rotates through them, one burst per file, until stopped. |
| **AI Studio: Stop Writer** | Stops the non-stop writer. You can also click the status-bar item. |
| **AI Studio: Open Web Studio in Browser** | Opens the full web studio. |

## Step 1: Run the AI Code Studio app

Pick one option.

**Option A: use the hosted preview.** Copy the preview URL from the app and set
`aiStudio.serverUrl` to it (see Step 3). This is quickest, but preview links can expire.

**Option B: run it on your computer (recommended).** You need Node.js 20 or newer and a PostgreSQL database.

```bash
cd path/to/the/app          # the folder that contains package.json
npm install
# set DATABASE_URL in .env to your PostgreSQL database, then:
npx drizzle-kit push        # creates the tables
npm run build
npm start                   # serves the app on http://localhost:3000
```

The writer and website endpoints do not need the database, but the health check and the saved
projects do.

## Step 2: Install the extension

You need Node.js 20+ and VS Code 1.85+.

**Run it in development mode**

```bash
cd vscode-extension
npm install
npm run compile
```

Open the `vscode-extension` folder in VS Code and press **F5**. A second VS Code window
(the "Extension Development Host") opens with the extension loaded. Use that window for your work.

**Or install it permanently as a `.vsix` package**

```bash
cd vscode-extension
npm install
npm run compile
npm run package             # creates ai-code-studio-0.1.0.vsix
```

In VS Code, open the Extensions view, click the `...` menu, choose **Install from VSIX…**, and
select the file.

## Step 3: Point the extension at your app

Open Settings (Ctrl+,) and search for `AI Studio`, or add this to `settings.json`:

```json
{
  "aiStudio.serverUrl": "http://localhost:3000",
  "aiStudio.burstLines": 200,
  "aiStudio.deletePercent": 50,
  "aiStudio.delayMs": 30,
  "aiStudio.maxLines": 1200
}
```

Then run **AI Studio: Test Connection** from the Command Palette (Ctrl+Shift+P).

## How the non-stop writer works

1. Open a file (for example `script.js`). If the language is not HTML, CSS or JavaScript, you pick one.
2. Run **Start Non-stop Writer in Active File** and optionally describe the topic.
3. The AI writes `burstLines` lines at the end of the file, one by one.
4. It deletes `deletePercent` of that burst, waits, and writes again.
5. It keeps going until you run **Stop Writer**. The file is saved on stop.

Avoid typing in the same file while the writer runs. Lines are removed by position, so your
edits can shift them.

## Troubleshooting

- **Cannot reach AI Studio**: the app is not running, or `aiStudio.serverUrl` is wrong.
- **HTTP 500 on Test Connection**: the app cannot reach PostgreSQL. Check `DATABASE_URL` in `.env`.
- **Nothing happens on Build Website**: open the *AI Studio* output panel (View → Output) for details.
