import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";

type Lang = "html" | "css" | "js" | "ts" | "json" | "md" | "py";

const LANG_FROM_ID: Record<string, Lang | undefined> = {
  html: "html",
  css: "css",
  javascript: "js",
  typescript: "ts",
  json: "json",
  markdown: "md",
  python: "py",
};

const output = vscode.window.createOutputChannel("AI Studio");
const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
statusItem.command = "aiStudio.stopWriter";
statusItem.tooltip = "Click to stop the AI writer";

let writerController: AbortController | undefined;

function settings() {
  const c = vscode.workspace.getConfiguration("aiStudio");
  return {
    serverUrl: (c.get<string>("serverUrl") || "http://localhost:3000").replace(/\/+$/, ""),
    burstLines: c.get<number>("burstLines", 200),
    deletePercent: c.get<number>("deletePercent", 50),
    delayMs: c.get<number>("delayMs", 30),
    maxLines: c.get<number>("maxLines", 1200),
  };
}

function clamp(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * POSTs to the AI Studio server and hands over complete lines as they stream in.
 * The server writes code line by line, so the editor fills up in real time.
 */
async function streamFromServer(
  endpoint: string,
  body: unknown,
  signal: AbortSignal,
  onLines: (lines: string[]) => Promise<void>,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new Error(`Cannot reach AI Studio at ${endpoint}. Is the app running? Check aiStudio.serverUrl.`);
  }
  if (!res.ok || !res.body) {
    throw new Error(`AI Studio returned HTTP ${res.status}. Check that the app is running.`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const parts = pending.split("\n");
    pending = parts.pop() ?? "";
    if (parts.length) await onLines(parts);
  }
  pending += decoder.decode();
  if (pending) await onLines([pending]);
}

/** Wraps an open editor document so the AI can append and delete lines in it. */
class LiveDocument {
  constructor(readonly doc: vscode.TextDocument) {}

  async append(text: string): Promise<void> {
    const last = this.doc.lineAt(this.doc.lineCount - 1);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(this.doc.uri, last.range.end, text);
    await vscode.workspace.applyEdit(edit);
  }

  /** Makes sure new text starts on a fresh line. */
  async ensureTrailingNewline(): Promise<void> {
    const last = this.doc.lineAt(this.doc.lineCount - 1);
    if (last.text.length > 0) await this.append("\n");
  }

  /** Deletes whole lines [from, from + count). The final empty line is never removed. */
  async deleteLines(from: number, count: number): Promise<void> {
    const start = Math.max(0, Math.min(from, this.doc.lineCount - 1));
    const end = Math.min(this.doc.lineCount - 1, start + Math.max(0, count));
    if (end <= start) return;
    const edit = new vscode.WorkspaceEdit();
    edit.delete(this.doc.uri, new vscode.Range(start, 0, end, 0));
    await vscode.workspace.applyEdit(edit);
  }
}

async function pickLanguage(): Promise<Lang | undefined> {
  const pick = await vscode.window.showQuickPick(
    [
      { label: "HTML", value: "html" as Lang },
      { label: "CSS", value: "css" as Lang },
      { label: "JavaScript", value: "js" as Lang },
      { label: "TypeScript", value: "ts" as Lang },
      { label: "JSON Lines", value: "json" as Lang },
      { label: "Markdown", value: "md" as Lang },
      { label: "Python", value: "py" as Lang },
    ],
    { placeHolder: "What kind of code should the AI write into this file?" },
  );
  return pick?.value;
}

interface WriterTarget {
  lang: Lang;
  live: LiveDocument;
}

async function askTopic(): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt: "What should the code be about? (optional)",
    placeHolder: "e.g. bakery landing page with a menu section",
    ignoreFocusOut: true,
  });
}

/**
 * Core loop shared by both writer commands. Each cycle picks the next target in turn,
 * writes a burst of lines into it, deletes part of that burst, and repeats until stopped.
 */
async function runWriter(targets: WriterTarget[], topic: string): Promise<void> {
  const cfg = settings();
  const burst = clamp(cfg.burstLines, 10, 1000);
  const ratio = clamp(cfg.deletePercent, 0, 100) / 100;
  const maxLines = clamp(cfg.maxLines, 50, 20000);

  const controller = new AbortController();
  writerController = controller;
  statusItem.text = "$(sync~spin) AI writer running";
  statusItem.show();
  output.show(true);
  const names = targets.map((t) => path.basename(t.live.doc.fileName)).join(", ");
  output.appendLine(
    `[writer] ${burst} lines per burst, delete ${Math.round(ratio * 100)}%, repeat in ${names}`,
  );

  let seq = 1;
  let cycles = 0;
  let written = 0;
  let deleted = 0;

  try {
    while (!controller.signal.aborted) {
      cycles++;
      const { lang, live } = targets[(cycles - 1) % targets.length];
      const label = path.basename(live.doc.fileName);
      if (targets.length > 1) {
        await vscode.window.showTextDocument(live.doc, { preview: false, preserveFocus: true });
      }

      await live.ensureTrailingNewline();
      const startLine = live.doc.lineCount - 1;
      let burstWritten = 0;
      statusItem.text = `$(sync~spin) AI writer: cycle ${cycles}, writing ${label}`;

      await streamFromServer(
        `${cfg.serverUrl}/api/generate`,
        {
          kind: "snippet",
          language: lang,
          count: burst,
          seq,
          delayMs: cfg.delayMs,
          prompt: topic.trim() || "app",
        },
        controller.signal,
        async (lines) => {
          burstWritten += lines.length;
          await live.append(lines.join("\n") + "\n");
        },
      );
      seq += Math.ceil(burst / 6) + 1;
      written += burstWritten;
      if (controller.signal.aborted) break;

      const removeCount = Math.floor(burstWritten * ratio);
      statusItem.text = `$(sync~spin) AI writer: cycle ${cycles}, deleting ${removeCount} in ${label}`;
      await sleep(400, controller.signal);
      if (controller.signal.aborted) break;

      await live.deleteLines(startLine, removeCount);
      deleted += removeCount;

      const extra = live.doc.lineCount - maxLines;
      if (extra > 0) await live.deleteLines(0, extra);

      output.appendLine(
        `[writer] cycle ${cycles} (${label}): wrote ${burstWritten}, deleted ${removeCount}, file now ${live.doc.lineCount} lines`,
      );
      await sleep(400, controller.signal);
    }
  } catch (err) {
    if (!controller.signal.aborted) {
      void vscode.window.showErrorMessage(`AI writer stopped: ${errorText(err)}`);
    }
  } finally {
    writerController = undefined;
    statusItem.hide();
    output.appendLine(`[writer] stopped after ${cycles} cycles (${written} written, ${deleted} deleted)`);
    for (const t of targets) {
      try {
        await t.live.doc.save();
      } catch {
        /* the file may have been closed; nothing else to do */
      }
    }
  }
}

/** Non-stop writer in the active file only. */
async function startWriter(): Promise<void> {
  if (writerController) {
    void vscode.window.showInformationMessage("The AI writer is already running. Stop it first.");
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage("Open the file you want the AI to write into first.");
    return;
  }

  const detected: Lang | undefined = LANG_FROM_ID[editor.document.languageId];
  const lang = detected ?? (await pickLanguage());
  if (!lang) return;

  const topic = await askTopic();
  if (topic === undefined) return;

  await runWriter([{ lang, live: new LiveDocument(editor.document) }], topic);
}

/**
 * Non-stop writer across all three languages: rotates through index.html, styles.css and
 * script.js in a folder (created if missing), one burst per file per cycle.
 */
async function startWriterAll(): Promise<void> {
  if (writerController) {
    void vscode.window.showInformationMessage("The AI writer is already running. Stop it first.");
    return;
  }

  const root = await chooseFolder();
  if (!root) return;
  const dir = path.join(root, "ai-writer");
  await fs.mkdir(dir, { recursive: true });

  const topic = await askTopic();
  if (topic === undefined) return;

  const plan: [string, Lang][] = [
    ["index.html", "html"],
    ["styles.css", "css"],
    ["script.js", "js"],
  ];
  const targets: WriterTarget[] = [];
  for (const [name, lang] of plan) {
    const target = path.join(dir, name);
    try {
      await fs.access(target);
    } catch {
      await fs.writeFile(target, "", "utf8");
    }
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
    await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
    targets.push({ lang, live: new LiveDocument(doc) });
  }

  output.appendLine(`[writer] writing all three languages in ${dir}`);
  await runWriter(targets, topic);
}

function stopWriter(): void {
  if (!writerController) {
    void vscode.window.showInformationMessage("The AI writer is not running.");
    return;
  }
  writerController.abort();
  output.appendLine("[writer] stop requested");
}

async function chooseFolder(): Promise<string | undefined> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (workspace) return workspace.uri.fsPath;
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Use this folder",
  });
  return picked?.[0]?.fsPath;
}

/**
 * Website builder: asks the AI for index.html, styles.css and script.js and writes them
 * into an "ai-website" folder, typing each line into the open editor as it arrives.
 */
async function buildWebsite(): Promise<void> {
  const cfg = settings();
  const prompt = await vscode.window.showInputBox({
    prompt: "Describe the website you want",
    placeHolder: "e.g. Modern website for my bakery called Sunrise Bread, warm orange colours",
    ignoreFocusOut: true,
  });
  if (!prompt || !prompt.trim()) return;

  const root = await chooseFolder();
  if (!root) return;
  const dir = path.join(root, "ai-website");
  await fs.mkdir(dir, { recursive: true });

  const controller = new AbortController();
  const documents = new Map<string, LiveDocument>();
  let current: string | null = null;
  output.show(true);
  output.appendLine(`[website] building "${prompt.trim()}" into ${dir}`);

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "AI Studio is building your website…",
        cancellable: true,
      },
      async (_progress, token) => {
        token.onCancellationRequested(() => controller.abort());

        await streamFromServer(
          `${cfg.serverUrl}/api/generate`,
          { kind: "website", prompt: prompt.trim(), delayMs: cfg.delayMs },
          controller.signal,
          async (lines) => {
            for (const line of lines) {
              if (line.startsWith("@@FILE:")) {
                const name = line.slice(7).trim();
                current = name;
                const target = path.join(dir, name);
                await fs.writeFile(target, "", "utf8");
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
                documents.set(name, new LiveDocument(doc));
                await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
                output.appendLine(`[website] writing ${name}`);
              } else if (current) {
                await documents.get(current)?.append(line + "\n");
              }
            }
          },
        );
      },
    );
  } catch (err) {
    if (!controller.signal.aborted) throw err;
    output.appendLine("[website] stopped by user; partial files were kept");
  }

  for (const live of documents.values()) {
    await live.doc.save();
  }

  const indexDoc = await vscode.workspace.openTextDocument(path.join(dir, "index.html"));
  await vscode.window.showTextDocument(indexDoc);
  void vscode.window.showInformationMessage(
    `Website written to ${dir}. Use the Live Server extension or open index.html in your browser to preview it.`,
  );
  output.appendLine("[website] done");
}

async function testConnection(): Promise<void> {
  const cfg = settings();
  try {
    const res = await fetch(`${cfg.serverUrl}/api/health`);
    if (res.ok) {
      void vscode.window.showInformationMessage(`Connected to AI Studio at ${cfg.serverUrl}`);
    } else {
      void vscode.window.showErrorMessage(
        `AI Studio answered HTTP ${res.status} at ${cfg.serverUrl}. Check that the app is running and DATABASE_URL is set.`,
      );
    }
  } catch {
    void vscode.window.showErrorMessage(
      `Cannot reach AI Studio at ${cfg.serverUrl}. Start the app (npm start) or fix aiStudio.serverUrl in settings.`,
    );
  }
}

async function openWebStudio(): Promise<void> {
  const cfg = settings();
  await vscode.env.openExternal(vscode.Uri.parse(`${cfg.serverUrl}/studio`));
}

function guarded(fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    try {
      await fn();
    } catch (err) {
      void vscode.window.showErrorMessage(`AI Studio: ${errorText(err)}`);
    }
  };
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    output,
    statusItem,
    vscode.commands.registerCommand("aiStudio.testConnection", guarded(testConnection)),
    vscode.commands.registerCommand("aiStudio.buildWebsite", guarded(buildWebsite)),
    vscode.commands.registerCommand("aiStudio.startWriter", guarded(startWriter)),
    vscode.commands.registerCommand("aiStudio.startWriterAll", guarded(startWriterAll)),
    vscode.commands.registerCommand("aiStudio.stopWriter", () => stopWriter()),
    vscode.commands.registerCommand("aiStudio.openWebStudio", guarded(openWebStudio)),
  );
}

export function deactivate(): void {
  writerController?.abort();
}
