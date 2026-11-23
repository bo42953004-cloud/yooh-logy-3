"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { OnMount } from "@monaco-editor/react";
import { ALL_KEYS, LANG, STARTER_FILES, WEB_KEYS, type FileKey } from "@/lib/studio/languages";
import { LINES_PER_CARD } from "@/lib/studio/snippets";
import { ActivityIcon, FileIcon, type ActivityName } from "./icons";

const CodeEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-[#858585]">Loading editor…</div>,
});

type EditorInstance = Parameters<OnMount>[0];
type Files = Record<FileKey, string>;
type Tone = "info" | "success" | "error";
type WriterMode = "web" | "all" | FileKey;
type PanelTab = "output" | "stats";

interface LogEntry {
  id: string;
  time: string;
  text: string;
  tone: Tone;
}

interface ProjectSummary {
  id: number;
  name: string;
  prompt: string;
  updatedAt: string;
}

type CmdId =
  | "file.new"
  | "file.save"
  | "file.openBrowser"
  | "file.spreadsheet"
  | "view.explorer"
  | "view.ai"
  | "view.preview"
  | "view.previewMax"
  | "view.panel"
  | "view.fullscreen"
  | "view.palette"
  | "view.closeTab"
  | "view.nextTab"
  | "view.prevTab"
  | "run.build"
  | "run.startWriter"
  | "run.stopWriter"
  | "run.clearOutput"
  | "help.shortcuts";

const COMMANDS: Record<CmdId, { label: string; sc?: string }> = {
  "file.new": { label: "File: New Project" },
  "file.save": { label: "File: Save", sc: "Ctrl+S" },
  "file.openBrowser": { label: "File: Open Preview in Browser" },
  "file.spreadsheet": { label: "File: Open Spreadsheet" },
  "view.explorer": { label: "View: Toggle Explorer", sc: "Ctrl+B" },
  "view.ai": { label: "View: Toggle AI Assistant" },
  "view.preview": { label: "View: Toggle Live Preview", sc: "Ctrl+Shift+V" },
  "view.previewMax": { label: "View: Maximize Live Preview" },
  "view.panel": { label: "View: Toggle Panel", sc: "Ctrl+J" },
  "view.fullscreen": { label: "View: Toggle Full Screen", sc: "F11" },
  "view.palette": { label: "View: Command Palette", sc: "Ctrl+Shift+P" },
  "view.closeTab": { label: "View: Close Editor", sc: "Ctrl+W" },
  "view.nextTab": { label: "Go: Next Editor", sc: "Ctrl+Tab" },
  "view.prevTab": { label: "Go: Previous Editor", sc: "Ctrl+Shift+Tab" },
  "run.build": { label: "Run: Build Website" },
  "run.startWriter": { label: "Run: Start Non-stop Writer" },
  "run.stopWriter": { label: "Run: Stop Writer" },
  "run.clearOutput": { label: "Terminal: Clear Output" },
  "help.shortcuts": { label: "Help: Keyboard Shortcuts" },
};

const MENUS: { title: string; items: (CmdId | "-")[] }[] = [
  { title: "File", items: ["file.new", "file.save", "-", "file.openBrowser", "file.spreadsheet"] },
  { title: "View", items: ["view.palette", "-", "view.explorer", "view.ai", "view.preview", "view.previewMax", "view.panel", "-", "view.fullscreen"] },
  { title: "Go", items: ["view.nextTab", "view.prevTab", "view.closeTab"] },
  { title: "Run", items: ["run.build", "run.startWriter", "run.stopWriter"] },
  { title: "Terminal", items: ["run.clearOutput"] },
  { title: "Help", items: ["help.shortcuts"] },
];

const SITE_TYPES: { id: string; label: string; icon: string }[] = [
  { id: "", label: "Auto", icon: "✦" },
  { id: "Landing", label: "Landing", icon: "🚀" },
  { id: "Portfolio", label: "Portfolio", icon: "🎨" },
  { id: "Shop", label: "Online shop", icon: "🛍️" },
  { id: "Cafe", label: "Café", icon: "☕" },
  { id: "Blog", label: "Blog", icon: "📝" },
  { id: "Fitness", label: "Fitness", icon: "💪" },
  { id: "Education", label: "Courses", icon: "🎓" },
  { id: "Event", label: "Event", icon: "🎉" },
  { id: "Agency", label: "Agency", icon: "🏢" },
  { id: "SaaS", label: "SaaS app", icon: "⚙️" },
];

const WRITER_OPTIONS: { value: WriterMode; label: string }[] = [
  { value: "web", label: "Web: HTML + CSS + JS wired together" },
  { value: "all", label: "Every language (rotating)" },
  ...ALL_KEYS.map((k) => ({ value: k as WriterMode, label: `${LANG[k].label} only` })),
];

const EXTRA_KEYS: FileKey[] = ["ts", "json", "md", "py"];
const DEFAULT_PROMPT = "Modern website for my coffee shop called Sunrise Coffee, warm orange colours";
const EMPTY_SEQ: Record<FileKey, number> = { html: 1, css: 1, js: 1, ts: 1, json: 1, md: 1, py: 1 };

function clamp(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function linesOf(text: string): string[] {
  const parts = text.split("\n");
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function joinLines(lines: string[]): string {
  return lines.length ? lines.join("\n") + "\n" : "";
}

function countLines(text: string): number {
  return linesOf(text).length;
}

/**
 * Removes about `count` lines beginning at line index `start`, extending to the next blank line
 * so whole code blocks are removed. The remaining code stays valid.
 */
function removeLines(text: string, start: number, count: number): string {
  const lines = linesOf(text);
  const from = Math.min(Math.max(0, start), lines.length);
  let to = Math.min(lines.length, from + Math.max(0, count));
  while (to < lines.length && lines[to - 1] !== "") to++;
  lines.splice(from, to - from);
  return joinLines(lines);
}

/** Keeps only the newest `maxLines` lines, snapping the cut to a block boundary. */
function trimTop(text: string, maxLines: number): string {
  const lines = linesOf(text);
  if (lines.length <= maxLines) return text;
  let start = lines.length - maxLines;
  while (start < lines.length && lines[start - 1] !== "") start++;
  return joinLines(lines.slice(start));
}

type Op = { type: "reset"; key: FileKey } | { type: "append"; key: FileKey; line: string };

function applyOps(prev: Files, ops: Op[]): Files {
  const next: Files = { ...prev };
  for (const op of ops) {
    if (op.type === "reset") {
      next[op.key] = "";
      continue;
    }
    const current = next[op.key];
    const base = current === "" || current.endsWith("\n") ? current : current + "\n";
    next[op.key] = base + op.line + "\n";
  }
  return next;
}

/** Wires the three web files into one document: CSS goes into <head>, JS at the end of <body>. */
function buildPreview(files: Files): string {
  const styleTag = `<style>\n${files.css}\n</style>`;
  const scriptTag = `<script>\n${files.js.replace(/<\/script/gi, "<\\/script")}\n</script>`;
  const linkRe = /<link[^>]*href=["']\.?\/?styles\.css["'][^>]*>/i;
  const scriptRe = /<script[^>]*src=["']\.?\/?script\.js["'][^>]*>\s*<\/script>/i;

  let html = files.html;
  const isFragment = !/<html[\s>]/i.test(html) && !/<body[\s>]/i.test(html);
  if (isFragment) {
    html =
      `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />\n` +
      `<link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n${html}\n` +
      `<script src="script.js"></script>\n</body>\n</html>`;
  }

  if (linkRe.test(html)) {
    html = html.replace(linkRe, () => styleTag);
  } else if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, () => `${styleTag}\n</head>`);
  } else {
    html = styleTag + html;
  }

  if (scriptRe.test(html)) {
    html = html.replace(scriptRe, () => scriptTag);
  } else if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, () => `${scriptTag}\n</body>`);
  } else {
    html = html + scriptTag;
  }
  return html;
}

/** Reads a streamed text response and hands over complete lines as they arrive. */
async function readLines(res: Response, onLines: (lines: string[]) => void): Promise<void> {
  if (!res.body) throw new Error("Empty response from generator");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const parts = pending.split("\n");
    pending = parts.pop() ?? "";
    if (parts.length) onLines(parts);
  }
  pending += decoder.decode();
  if (pending) onLines([pending]);
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  disabled: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-[#9d9d9d]">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-sm bg-[#313131] px-2 py-1 text-[12px] text-[#cccccc] outline-none ring-1 ring-[#3c3c3c] focus:ring-[#0078d4] disabled:opacity-50"
      />
    </label>
  );
}

function ActivityButton({
  name,
  label,
  on,
  onClick,
  badge,
}: {
  name: ActivityName;
  label: string;
  on: boolean;
  onClick: () => void;
  badge?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={on}
      className={`relative flex h-12 w-12 items-center justify-center ${on ? "text-white" : "text-[#858585] hover:text-white"}`}
    >
      {on && <span className="absolute left-0 top-0 h-full w-[2px] bg-white" />}
      <ActivityIcon name={name} size={24} />
      {badge && <span className="studio-pulse-dot absolute right-2 top-2 h-2 w-2 rounded-full bg-[#89d185]" />}
    </button>
  );
}

export default function StudioClient() {
  const router = useRouter();
  const [files, setFiles] = useState<Files>(STARTER_FILES);
  const filesRef = useRef(files);
  const [openTabs, setOpenTabs] = useState<FileKey[]>(["html", "css", "js"]);
  const [active, setActive] = useState<FileKey>("html");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState("Untitled project");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [siteType, setSiteType] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [busy, setBusy] = useState<null | "website" | "writer">(null);
  const [phase, setPhase] = useState("Idle");
  const [writerMode, setWriterMode] = useState<WriterMode>("web");
  const [burst, setBurst] = useState(200);
  const [deletePercent, setDeletePercent] = useState(50);
  const [maxLines, setMaxLines] = useState(1200);
  const [speed, setSpeed] = useState(12);
  const [stats, setStats] = useState({ cycles: 0, written: 0, deleted: 0 });
  const [log, setLog] = useState<LogEntry[]>([]);
  const [panelTab, setPanelTab] = useState<PanelTab>("output");
  const [showExplorer, setShowExplorer] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [showAi, setShowAi] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [previewMax, setPreviewMax] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [previewDoc, setPreviewDoc] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [keepAwake, setKeepAwake] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef<Record<FileKey, number>>({ ...EMPTY_SEQ });
  const previewUrlRef = useRef<string | null>(null);
  const editorRef = useRef<EditorInstance | null>(null);
  const logBoxRef = useRef<HTMLDivElement | null>(null);
  const runRef = useRef<(id: CmdId) => void>(() => {});

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    const el = logBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewDoc(buildPreview(files)), busy ? 600 : 120);
    return () => window.clearTimeout(timer);
  }, [files, busy]);

  // While the writer runs, keep the newest line visible in the editor.
  useEffect(() => {
    if (busy !== "writer" || !editorRef.current) return;
    const editor = editorRef.current;
    const count = editor.getModel()?.getLineCount();
    if (count) editor.revealLine(count);
  }, [files, busy]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const pushLog = useCallback((text: string, tone: Tone = "info") => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      time: new Date().toLocaleTimeString(),
      text,
      tone,
    };
    setLog((prev) => [...prev.slice(-199), entry]);
  }, []);

  // Keep awake: asks the browser to keep the screen on while the studio is open (Screen Wake Lock API).
  // It does not move the cursor or fake any input; it only stops the display from sleeping.
  useEffect(() => {
    if (!keepAwake) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) void sentinel.release();
        else pushLog("Keep awake is on: the screen will stay on while this tab is open.", "success");
      } catch (err) {
        pushLog(`Could not keep the screen awake: ${err instanceof Error ? err.message : "unknown error"}`, "error");
        setKeepAwake(false);
      }
    };

    // Browsers release the lock when the tab is hidden, so take it again when it becomes visible.
    const onVisibility = () => {
      if (document.visibilityState === "visible" && (!sentinel || sentinel.released)) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel && !sentinel.released) void sentinel.release();
    };
  }, [keepAwake, pushLog]);

  const toggleKeepAwake = () => {
    if (!keepAwake && !("wakeLock" in navigator)) {
      pushLog("This browser cannot keep the screen awake (Screen Wake Lock is not supported).", "error");
      return;
    }
    setKeepAwake((v) => !v);
  };

  const openFile = (key: FileKey) => {
    setOpenTabs((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setActive(key);
  };

  const closeTab = (key: FileKey) => {
    const idx = openTabs.indexOf(key);
    const next = openTabs.filter((k) => k !== key);
    setOpenTabs(next);
    if (key === active && next.length) setActive(next[Math.max(0, idx - 1)]);
  };

  const cycleTab = (dir: 1 | -1) => {
    if (!openTabs.length) return;
    const idx = openTabs.indexOf(active);
    const next = openTabs[(idx + dir + openTabs.length) % openTabs.length];
    setActive(next);
  };

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const json = (await res.json()) as { projects?: ProjectSummary[]; error?: string };
      if (!res.ok) {
        pushLog(json.error ?? "Could not load saved projects.", "error");
        return [];
      }
      setProjects(json.projects ?? []);
      return json.projects ?? [];
    } catch {
      return [];
    }
  }, [pushLog]);

  const openProject = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
      const json = (await res.json()) as {
        project?: {
          id: number;
          name: string;
          prompt: string;
          html: string;
          css: string;
          js: string;
          extra?: Partial<Record<FileKey, string>>;
        };
        error?: string;
      };
      if (!res.ok || !json.project) {
        pushLog(json.error ?? "Could not open project.", "error");
        return;
      }
      const p = json.project;
      const next: Files = { ...STARTER_FILES, html: p.html, css: p.css, js: p.js };
      for (const key of EXTRA_KEYS) {
        const value = p.extra?.[key];
        if (typeof value === "string") next[key] = value;
      }
      setFiles(next);
      setProjectId(p.id);
      setProjectName(p.name);
      setPrompt(p.prompt || DEFAULT_PROMPT);
      setOpenTabs(["html", "css", "js"]);
      setActive("html");
      pushLog(`Opened "${p.name}".`, "success");
    },
    [pushLog],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await refreshProjects();
      if (!cancelled && list.length > 0) await openProject(list[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshProjects, openProject]);

  const saveProject = async () => {
    const current = filesRef.current;
    const payload = {
      name: projectName.trim() || "Untitled project",
      prompt,
      html: current.html,
      css: current.css,
      js: current.js,
      extra: { ts: current.ts, json: current.json, md: current.md, py: current.py },
    };
    try {
      const res = await fetch(projectId ? `/api/projects/${projectId}` : "/api/projects", {
        method: projectId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { project?: { id: number }; error?: string };
      if (!res.ok || !json.project) {
        pushLog(json.error ?? "Save failed.", "error");
        return;
      }
      setProjectId(json.project.id);
      setSavedAt(new Date().toLocaleTimeString());
      pushLog(`Saved "${payload.name}".`, "success");
      void refreshProjects();
    } catch {
      pushLog("Save failed: network error.", "error");
    }
  };

  const newProject = () => {
    if (busy) return;
    setFiles(STARTER_FILES);
    setProjectId(null);
    setProjectName("Untitled project");
    setPrompt(DEFAULT_PROMPT);
    setOpenTabs(["html", "css", "js"]);
    setActive("html");
    setStats({ cycles: 0, written: 0, deleted: 0 });
    seqRef.current = { ...EMPTY_SEQ };
    setSavedAt("");
    pushLog("Started a new project.");
  };

  const deleteProject = async () => {
    if (!projectId || busy) return;
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    pushLog("Project deleted.");
    newProject();
    void refreshProjects();
  };

  const stop = () => abortRef.current?.abort();

  /** Full-screen the whole studio in the browser (Esc or F11 also leaves it). */
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      pushLog("Full screen is not available in this browser.", "error");
    }
  };

  /** Opens the wired preview (HTML + CSS + JS) in its own browser tab. */
  const openPreviewTab = () => {
    const blob = new Blob([buildPreview(filesRef.current)], { type: "text/html" });
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    window.open(url, "_blank", "noopener");
  };

  const typeLabel = SITE_TYPES.find((t) => t.id === siteType)?.label ?? "Auto";
  const topicFor = () => {
    const base = prompt.trim() || "app";
    return siteType ? `${siteType} ${base}` : base;
  };

  /** Website builder: streams index.html, styles.css and script.js into the editor. */
  const buildWebsite = async () => {
    const text = prompt.trim();
    if (busy) return;
    if (!text) {
      pushLog("Describe what you want to build first.", "error");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy("website");
    setPhase(`Designing ${siteType ? typeLabel : "your"} website…`);
    pushLog(`Building ${siteType ? typeLabel : "auto-detected"} website: "${text.slice(0, 80)}"`);

    const markerMap: Record<string, FileKey> = { "index.html": "html", "styles.css": "css", "script.js": "js" };

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "website", prompt: text, siteType: siteType || undefined, delayMs: 4 }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Generator returned ${res.status}`);

      let current: FileKey | null = null;
      await readLines(res, (lines) => {
        const ops: Op[] = [];
        for (const line of lines) {
          if (line.startsWith("@@FILE:")) {
            current = markerMap[line.slice(7).trim()] ?? null;
            if (current) ops.push({ type: "reset", key: current });
          } else if (current) {
            ops.push({ type: "append", key: current, line });
          }
        }
        if (ops.length) setFiles((prev) => applyOps(prev, ops));
      });

      setOpenTabs(["html", "css", "js"]);
      setActive("html");
      seqRef.current = { ...EMPTY_SEQ };
      pushLog("Website ready: index.html, styles.css and script.js. Press Save to keep it.", "success");
    } catch (err) {
      if (controller.signal.aborted) pushLog("Website generation stopped.");
      else pushLog(`Error: ${err instanceof Error ? err.message : "unknown error"}`, "error");
    } finally {
      abortRef.current = null;
      setBusy(null);
      setPhase("Idle");
    }
  };

  /** Streams one burst into `key` and returns how many lines and blocks arrived. */
  const writeBurst = async (
    key: FileKey,
    request: { count?: number; blocks?: number },
    topic: string,
    delay: number,
    signal: AbortSignal,
  ): Promise<{ lines: number; blocks: number }> => {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "snippet",
        language: key,
        ...request,
        seq: seqRef.current[key],
        delayMs: delay,
        prompt: topic,
      }),
      signal,
    });
    if (!res.ok) throw new Error(`Generator returned ${res.status}`);
    const blocks = Number(res.headers.get("X-Blocks")) || 0;
    let lines = 0;
    await readLines(res, (chunk) => {
      lines += chunk.length;
      setFiles((prev) => applyOps(prev, chunk.map((line) => ({ type: "append" as const, key, line }))));
    });
    seqRef.current[key] += blocks;
    return { lines, blocks };
  };

  /**
   * Non-stop writer: writes a burst, deletes part of it, then continues until Stop.
   * - "web": each cycle writes the same N cards to HTML, CSS and JS, so they stay wired together.
   * - "all": every language gets a burst each cycle.
   * - a single language: bursts of lines in that file.
   */
  const startWriter = async () => {
    if (busy) return;
    const wired = writerMode === "web";
    const keys: FileKey[] = writerMode === "web" ? WEB_KEYS : writerMode === "all" ? ALL_KEYS : [writerMode];
    const size = clamp(burst, 10, 1000);
    const ratio = clamp(deletePercent, 0, 100) / 100;
    const limit = clamp(maxLines, 50, 20000);
    const delay = clamp(speed, 0, 500);
    const topic = topicFor();
    const cards = Math.max(1, Math.round(size / LINES_PER_CARD));

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy("writer");
    setStats({ cycles: 0, written: 0, deleted: 0 });
    setPanelTab("output");
    openFile(keys[0]);

    if (wired) {
      // Start from a clean, linked page so the cards, styles and scripts are the only content.
      seqRef.current = { ...EMPTY_SEQ };
      const title = (prompt.trim() || "My page").replace(/[<>&"]/g, "").slice(0, 60);
      setOpenTabs(["html", "css", "js"]);
      setActive("html");
      setFiles((prev) => ({
        ...prev,
        html:
          '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n' +
          '  <meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
          `  <title>${title}</title>\n  <link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n` +
          `  <h1>${title}</h1>\n\n`,
        css:
          "body {\n  margin: 0;\n  padding: 24px;\n  background: #f4f6fb;\n  font-family: system-ui, sans-serif;\n}\n" +
          "h1 {\n  text-align: center;\n  color: #1f2937;\n}\n\n",
        js: "// Each script below finds its card in index.html and fills in a value.\n\n",
      }));
      await sleep(50);
      pushLog(
        `Non-stop writer started: ${cards} cards per cycle (≈${cards * LINES_PER_CARD} lines across HTML, CSS and JS) → delete ${Math.round(ratio * 100)}% → repeat.`,
        "success",
      );
    } else {
      const names = keys.map((k) => LANG[k].name).join(", ");
      pushLog(`Non-stop writer started: ${size} lines per burst → delete ${Math.round(ratio * 100)}% → repeat in ${names}.`, "success");
    }

    let cycles = 0;
    let written = 0;
    let deleted = 0;

    try {
      while (!controller.signal.aborted) {
        cycles++;
        const startAt = {} as Record<FileKey, number>;
        const wrote = {} as Record<FileKey, number>;

        for (const key of keys) {
          if (controller.signal.aborted) break;
          openFile(key);
          setPhase(`Cycle ${cycles}: writing ${wired ? `${cards} cards` : `${size} lines`} of ${LANG[key].label}`);
          startAt[key] = countLines(filesRef.current[key]);
          const result = await writeBurst(key, wired ? { blocks: cards } : { count: size }, topic, delay, controller.signal);
          wrote[key] = result.lines;
          written += result.lines;
        }
        if (controller.signal.aborted) break;

        const removeCards = Math.floor(cards * ratio);
        const counts = {} as Record<FileKey, number>;
        for (const key of keys) {
          const w = wrote[key] ?? 0;
          counts[key] = wired ? Math.round((w / cards) * removeCards) : Math.floor(w * ratio);
        }
        const removedTotal = keys.reduce((sum, k) => sum + (counts[k] ?? 0), 0);

        setPhase(`Cycle ${cycles}: deleting ${removedTotal} lines`);
        await sleep(350, controller.signal);
        if (controller.signal.aborted) break;

        setFiles((prev) => {
          const next: Files = { ...prev };
          for (const key of keys) {
            next[key] = trimTop(removeLines(next[key], startAt[key] ?? 0, counts[key] ?? 0), limit);
          }
          return next;
        });
        deleted += removedTotal;
        setStats({ cycles, written, deleted });
        pushLog(
          `Cycle ${cycles}: wrote ${keys.map((k) => `${wrote[k] ?? 0} ${LANG[k].label}`).join(", ")} · deleted ${removedTotal} lines.`,
        );
        await sleep(350, controller.signal);
      }
      pushLog("Non-stop writer stopped.");
    } catch (err) {
      if (controller.signal.aborted) pushLog("Non-stop writer stopped.");
      else pushLog(`Writer error: ${err instanceof Error ? err.message : "unknown error"}`, "error");
    } finally {
      abortRef.current = null;
      setBusy(null);
      setPhase("Idle");
    }
  };

  const runCommand = (id: CmdId) => {
    switch (id) {
      case "file.new":
        newProject();
        break;
      case "file.save":
        void saveProject();
        break;
      case "file.openBrowser":
        openPreviewTab();
        break;
      case "file.spreadsheet":
        router.push("/sheet");
        break;
      case "view.explorer":
        setShowExplorer((v) => !v);
        break;
      case "view.ai":
        setShowAi((v) => !v);
        break;
      case "view.preview":
        setShowPreview((v) => !v);
        break;
      case "view.previewMax":
        setShowPreview(true);
        setPreviewMax((v) => !v);
        break;
      case "view.panel":
        setShowPanel((v) => !v);
        break;
      case "view.fullscreen":
        void toggleFullscreen();
        break;
      case "view.palette":
        setPaletteOpen((v) => !v);
        setPaletteQuery("");
        setPaletteIndex(0);
        break;
      case "view.closeTab":
        closeTab(active);
        break;
      case "view.nextTab":
        cycleTab(1);
        break;
      case "view.prevTab":
        cycleTab(-1);
        break;
      case "run.build":
        void buildWebsite();
        break;
      case "run.startWriter":
        void startWriter();
        break;
      case "run.stopWriter":
        stop();
        break;
      case "run.clearOutput":
        setLog([]);
        break;
      case "help.shortcuts":
        pushLog(
          "Ctrl+Shift+P command palette · Ctrl+S save · Ctrl+B explorer · Ctrl+J panel · Ctrl+Shift+V preview · Ctrl+W close editor",
        );
        break;
    }
  };

  useEffect(() => {
    runRef.current = runCommand;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setOpenMenu(null);
        return;
      }
      if (mod && e.shiftKey && k === "p") {
        e.preventDefault();
        runRef.current("view.palette");
      } else if (mod && e.shiftKey && k === "v") {
        e.preventDefault();
        runRef.current("view.preview");
      } else if (mod && e.shiftKey && e.key === "Tab") {
        e.preventDefault();
        runRef.current("view.prevTab");
      } else if (mod && k === "s") {
        e.preventDefault();
        runRef.current("file.save");
      } else if (mod && k === "b") {
        e.preventDefault();
        runRef.current("view.explorer");
      } else if (mod && k === "j") {
        e.preventDefault();
        runRef.current("view.panel");
      } else if (mod && k === "w") {
        e.preventDefault();
        runRef.current("view.closeTab");
      } else if (mod && e.key === "Tab") {
        e.preventDefault();
        runRef.current("view.nextTab");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const paletteList = (Object.keys(COMMANDS) as CmdId[]).filter((id) =>
    COMMANDS[id].label.toLowerCase().includes(paletteQuery.trim().toLowerCase()),
  );

  const onPaletteKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPaletteIndex((i) => Math.min(paletteList.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPaletteIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const id = paletteList[paletteIndex];
      if (id) {
        setPaletteOpen(false);
        runCommand(id);
      }
    } else if (e.key === "Escape") {
      setPaletteOpen(false);
    }
  };

  const currentText = files[active];
  const tabInfo = LANG[active];
  const totalLines = countLines(currentText);
  const showEditor = !(showPreview && previewMax);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#1e1e1e] text-[#cccccc]">
      {/* Title bar with the menu bar, like VS Code */}
      <header className="relative flex h-[30px] shrink-0 select-none items-center border-b border-[#2b2b2b] bg-[#3c3c3c] px-2 text-[12px]">
        {openMenu && <div className="fixed inset-0 z-[90]" onClick={() => setOpenMenu(null)} />}
        <div className="mr-2 grid h-4 w-4 place-items-center rounded-sm bg-[#0078d4] text-[9px] font-bold text-white">◆</div>
        <nav className="relative z-[95] flex items-center">
          {MENUS.map((menu) => (
            <div key={menu.title} className="relative" onMouseEnter={() => openMenu && setOpenMenu(menu.title)}>
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === menu.title ? null : menu.title)}
                className={`rounded-sm px-2 py-[3px] ${openMenu === menu.title ? "bg-[#505050] text-white" : "hover:bg-[#505050]"}`}
              >
                {menu.title}
              </button>
              {openMenu === menu.title && (
                <div className="studio-scale-in absolute left-0 top-full z-[100] mt-px min-w-[280px] rounded-[5px] border border-[#454545] bg-[#252526] py-1 shadow-2xl">
                  {menu.items.map((item, i) =>
                    item === "-" ? (
                      <div key={`sep-${i}`} className="my-1 border-t border-[#454545]" />
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setOpenMenu(null);
                          runCommand(item);
                        }}
                        className="flex w-full items-center justify-between gap-10 px-3 py-[3px] text-left text-[13px] hover:bg-[#0078d4] hover:text-white"
                      >
                        <span>{COMMANDS[item].label}</span>
                        {COMMANDS[item].sc && <span className="text-[11px] text-[#a0a0a0]">{COMMANDS[item].sc}</span>}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => runCommand("view.palette")}
          className="absolute left-1/2 top-1/2 flex h-[22px] w-[min(38%,460px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md bg-[#2b2b2b] text-[12px] text-[#cccccc] ring-1 ring-[#505050] hover:ring-[#0078d4]"
          title="Command palette (Ctrl+Shift+P)"
        >
          {projectName} — Code Studio
        </button>

        <div className="relative z-[95] ml-auto flex items-center gap-0.5">
          <Link href="/" className="rounded-sm px-2 py-[3px] hover:bg-[#505050]">Home</Link>
          <Link href="/sheet" className="rounded-sm px-2 py-[3px] hover:bg-[#505050]">Spreadsheet</Link>
          <button type="button" onClick={() => runCommand("view.explorer")} className={`rounded-sm p-1 ${showExplorer ? "text-white" : "text-[#858585]"} hover:bg-[#505050]`} title="Toggle primary side bar (Ctrl+B)">
            <ActivityIcon name="sidebar" size={16} />
          </button>
          <button type="button" onClick={() => runCommand("view.panel")} className={`rounded-sm p-1 ${showPanel ? "text-white" : "text-[#858585]"} hover:bg-[#505050]`} title="Toggle panel (Ctrl+J)">
            <ActivityIcon name="panel" size={16} />
          </button>
          <button type="button" onClick={() => runCommand("view.ai")} className={`rounded-sm p-1 ${showAi ? "text-white" : "text-[#858585]"} hover:bg-[#505050]`} title="Toggle AI assistant">
            <ActivityIcon name="ai" size={16} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Activity bar */}
        <nav className="flex w-12 shrink-0 flex-col items-center justify-between bg-[#333333]">
          <div className="flex flex-col">
            <ActivityButton name="explorer" label="Explorer" on={showExplorer} onClick={() => runCommand("view.explorer")} />
            <ActivityButton name="search" label="Search (Ctrl+Shift+P)" on={paletteOpen} onClick={() => runCommand("view.palette")} />
            <ActivityButton name="run" label="Run: start non-stop writer" on={busy === "writer"} onClick={() => (busy === "writer" ? stop() : void startWriter())} badge={busy === "writer"} />
            <ActivityButton name="ai" label="AI Assistant" on={showAi} onClick={() => runCommand("view.ai")} badge={busy === "website"} />
          </div>
          <div className="flex flex-col">
            <ActivityButton name="preview" label="Live preview" on={showPreview} onClick={() => runCommand("view.preview")} />
            <ActivityButton name="output" label="Output" on={showPanel} onClick={() => runCommand("view.panel")} />
            <ActivityButton name="fullscreen" label={isFullscreen ? "Exit full screen" : "Full screen"} on={isFullscreen} onClick={() => void toggleFullscreen()} />
          </div>
        </nav>

        {/* Primary side bar: Explorer */}
        {showExplorer && (
          <aside className="studio-fade-in flex w-60 shrink-0 flex-col bg-[#252526]">
            <div className="flex h-[35px] shrink-0 items-center justify-between px-5 text-[11px] text-[#bbbbbb]">
              <span className="tracking-wide">EXPLORER</span>
              <button type="button" onClick={() => setShowExplorer(false)} className="rounded-sm px-1 hover:bg-[#3c3c3c]" title="Hide explorer">
                ⋯
              </button>
            </div>
            <button type="button" onClick={() => setShowProjects((v) => !v)} className="flex items-center gap-1 px-2 py-[3px] text-left text-[11px] font-bold uppercase text-[#cccccc] hover:bg-[#2a2d2e]">
              <span className="text-[10px]">{showProjects ? "▾" : "▸"}</span>
              <span className="truncate">{projectName}</span>
            </button>
            <ul className="pb-1">
              {ALL_KEYS.map((key) => {
                const empty = files[key].trim() === "";
                const isOpen = openTabs.includes(key);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => openFile(key)}
                      className={`flex w-full items-center gap-2 py-[3px] pl-6 pr-3 text-left text-[13px] ${
                        active === key && isOpen ? "bg-[#37373d] text-white" : "hover:bg-[#2a2d2e]"
                      } ${empty ? "text-[#8a8a8a]" : "text-[#cccccc]"}`}
                    >
                      <FileIcon k={key} size={16} />
                      <span className="flex-1 truncate">{LANG[key].name}</span>
                      <span className="text-[10px] text-[#858585]">{countLines(files[key])}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <button type="button" onClick={() => setShowProjects((v) => !v)} className="flex items-center gap-1 px-2 py-[3px] text-left text-[11px] font-bold uppercase text-[#cccccc] hover:bg-[#2a2d2e]">
              <span className="text-[10px]">{showProjects ? "▾" : "▸"}</span>
              <span>Saved projects</span>
              {projectId && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteProject();
                  }}
                  className="ml-auto mr-2 text-[10px] font-normal normal-case text-[#f48771] hover:underline"
                >
                  delete current
                </span>
              )}
            </button>
            {showProjects && (
              <ul className="min-h-0 flex-1 overflow-auto pb-2">
                {projects.length === 0 && <li className="px-6 py-1 text-[12px] text-[#858585]">No saved projects yet.</li>}
                {projects.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => void openProject(p.id)}
                      disabled={!!busy}
                      className={`w-full py-1 pl-6 pr-3 text-left text-[13px] disabled:opacity-60 ${projectId === p.id ? "bg-[#37373d] text-white" : "hover:bg-[#2a2d2e]"}`}
                    >
                      <div className="truncate">{p.name}</div>
                      <div className="text-[10px] text-[#858585]">{new Date(p.updatedAt).toLocaleString()}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        {/* Editor area: tabs, breadcrumb, editor, preview, bottom panel */}
        <main className="flex min-w-0 flex-1 flex-col bg-[#1e1e1e]">
          <div className="flex h-[35px] shrink-0 overflow-x-auto bg-[#252526]">
            {openTabs.map((key) => {
              const on = key === active;
              return (
                <div
                  key={key}
                  role="tab"
                  aria-selected={on}
                  tabIndex={0}
                  onClick={() => setActive(key)}
                  onKeyDown={(e) => e.key === "Enter" && setActive(key)}
                  onAuxClick={(e) => {
                    if (e.button === 1) closeTab(key);
                  }}
                  className={`studio-fade-in group flex h-full shrink-0 cursor-pointer items-center gap-2 border-r border-[#252526] px-3 text-[13px] ${
                    on ? "border-t-2 border-t-[#0078d4] bg-[#1e1e1e] text-white" : "border-t-2 border-t-transparent bg-[#2d2d2d] text-[#969696] hover:bg-[#2a2d2e]"
                  }`}
                >
                  <FileIcon k={key} size={14} />
                  <span>{LANG[key].name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(key);
                    }}
                    className={`ml-1 rounded-sm px-1 text-[15px] leading-none hover:bg-[#444] ${on ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    aria-label={`Close ${LANG[key].name}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex h-[22px] shrink-0 items-center gap-1 px-3 text-[12px] text-[#a9a9a9]">
            <span>{projectName}</span>
            <span>›</span>
            {openTabs.length > 0 && (
              <>
                <FileIcon k={active} size={12} />
                <span>{tabInfo.name}</span>
              </>
            )}
          </div>

          <div className="flex min-h-0 flex-1">
            {showEditor && (
              <div className="min-w-0 flex-1">
                {openTabs.length === 0 ? (
                  <div className="grid h-full place-items-center text-center text-[#858585]">
                    <div className="studio-fade-in">
                      <div className="mb-2 text-[28px] font-light text-[#cccccc]">Code Studio</div>
                      <p className="text-[13px]">Open a file from the Explorer, or press Ctrl+Shift+P.</p>
                    </div>
                  </div>
                ) : (
                  <CodeEditor
                    height="100%"
                    path={tabInfo.name}
                    language={tabInfo.monaco}
                    theme="vs-dark"
                    value={currentText}
                    onChange={(value) => {
                      if (busy) return;
                      setFiles((prev) => ({ ...prev, [active]: value ?? "" }));
                    }}
                    onMount={(editor) => {
                      editorRef.current = editor;
                    }}
                    options={{
                      minimap: { enabled: true },
                      fontSize: 14,
                      fontFamily: "Consolas, 'Cascadia Code', 'Droid Sans Mono', monospace",
                      wordWrap: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      smoothScrolling: true,
                      cursorBlinking: "smooth",
                      guides: { indentation: true },
                      tabSize: 2,
                      readOnly: busy === "writer",
                    }}
                  />
                )}
              </div>
            )}

            {showPreview ? (
              <section className={`studio-fade-in flex min-w-0 flex-col border-l border-[#2b2b2b] ${previewMax ? "flex-1" : "w-[46%]"}`}>
                <div className="flex h-[35px] shrink-0 items-center gap-2 bg-[#252526] px-2 text-[12px] text-[#cccccc]">
                  <button type="button" onClick={() => setShowPreview(false)} className="rounded-sm px-1.5 hover:bg-[#3c3c3c]" title="Minimize preview">
                    ▶
                  </button>
                  <span className="font-semibold">Preview</span>
                  <span className="text-[#858585]">index.html + styles.css + script.js</span>
                  <span className={`ml-2 text-[11px] ${busy ? "text-[#89d185]" : "text-[#858585]"}`}>{busy ? "● live" : "up to date"}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button type="button" onClick={openPreviewTab} className="rounded-sm px-1.5 hover:bg-[#3c3c3c]" title="Open in a new browser tab">
                      ↗
                    </button>
                    <button type="button" onClick={() => runCommand("view.previewMax")} className="rounded-sm px-1.5 hover:bg-[#3c3c3c]" title={previewMax ? "Restore editor" : "Maximize preview"}>
                      {previewMax ? "🗗" : "🗖"}
                    </button>
                  </div>
                </div>
                <iframe
                  title="Live preview"
                  srcDoc={previewDoc}
                  sandbox="allow-scripts allow-forms allow-modals"
                  className="min-h-0 flex-1 bg-white"
                />
              </section>
            ) : (
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="flex w-8 shrink-0 flex-col items-center gap-2 border-l border-[#2b2b2b] bg-[#252526] pt-2 text-[11px] text-[#bbbbbb] hover:bg-[#2d2d2d] hover:text-white"
                title="Show preview"
              >
                <span>◀</span>
                <span className="[writing-mode:vertical-rl] tracking-wider">PREVIEW</span>
              </button>
            )}
          </div>

          {/* Bottom panel */}
          {showPanel && (
            <section className="studio-fade-in flex h-[210px] shrink-0 flex-col border-t border-[#2b2b2b] bg-[#1e1e1e]">
              <div className="flex h-[35px] shrink-0 items-center gap-4 px-4 text-[11px] text-[#9d9d9d]">
                <button type="button" onClick={() => setPanelTab("output")} className={`h-full border-b-2 uppercase tracking-wide ${panelTab === "output" ? "border-[#e7e7e7] text-[#e7e7e7]" : "border-transparent hover:text-[#e7e7e7]"}`}>
                  Output
                </button>
                <button type="button" onClick={() => setPanelTab("stats")} className={`h-full border-b-2 uppercase tracking-wide ${panelTab === "stats" ? "border-[#e7e7e7] text-[#e7e7e7]" : "border-transparent hover:text-[#e7e7e7]"}`}>
                  Writer
                </button>
                <div className="ml-auto flex items-center gap-1">
                  <button type="button" onClick={() => setLog([])} className="rounded-sm px-1.5 hover:bg-[#3c3c3c]" title="Clear output">⌫</button>
                  <button type="button" onClick={() => setShowPanel(false)} className="rounded-sm px-1.5 hover:bg-[#3c3c3c]" title="Hide panel">✕</button>
                </div>
              </div>
              {panelTab === "output" ? (
                <div ref={logBoxRef} className="min-h-0 flex-1 space-y-0.5 overflow-auto px-4 pb-2 font-mono text-[12px]">
                  {log.length === 0 && <div className="text-[#858585]">Nothing yet. Build a website or start the writer.</div>}
                  {log.map((entry) => (
                    <div key={entry.id} className={entry.tone === "success" ? "text-[#89d185]" : entry.tone === "error" ? "text-[#f48771]" : "text-[#cccccc]"}>
                      <span className="text-[#858585]">[{entry.time}]</span> {entry.text}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 px-4 text-center">
                  <div className="rounded-md bg-[#252526] py-3">
                    <div className="text-2xl font-semibold text-white">{stats.cycles}</div>
                    <div className="text-[11px] text-[#9d9d9d]">cycles</div>
                  </div>
                  <div className="rounded-md bg-[#252526] py-3">
                    <div className="text-2xl font-semibold text-[#89d185]">{stats.written}</div>
                    <div className="text-[11px] text-[#9d9d9d]">lines written</div>
                  </div>
                  <div className="rounded-md bg-[#252526] py-3">
                    <div className="text-2xl font-semibold text-[#f48771]">{stats.deleted}</div>
                    <div className="text-[11px] text-[#9d9d9d]">lines deleted</div>
                  </div>
                </div>
              )}
            </section>
          )}
        </main>

        {/* Secondary side bar: AI assistant */}
        {showAi && (
          <aside className="studio-fade-in flex w-[330px] shrink-0 flex-col border-l border-[#2b2b2b] bg-[#252526]">
            <div className="flex h-[35px] shrink-0 items-center justify-between px-4 text-[11px] text-[#bbbbbb]">
              <span className="tracking-wide">AI ASSISTANT</span>
              <button type="button" onClick={() => setShowAi(false)} className="rounded-sm px-1 hover:bg-[#3c3c3c]" title="Hide">✕</button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-auto px-4 pb-5">
              <section>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#cccccc]">What do you want to build?</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {SITE_TYPES.map((t) => (
                    <button
                      key={t.id || "auto"}
                      type="button"
                      onClick={() => setSiteType(t.id)}
                      disabled={!!busy}
                      className={`studio-scale-in flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[11px] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50 ${
                        siteType === t.id
                          ? "border-[#0078d4] bg-[#094771] text-white shadow-[0_0_0_1px_#0078d4]"
                          : "border-[#3c3c3c] bg-[#1e1e1e] text-[#bbbbbb] hover:border-[#6b6b6b]"
                      }`}
                    >
                      <span className="text-[18px] leading-none">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#cccccc]">Describe it</div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={!!busy}
                  rows={4}
                  placeholder="e.g. warm, modern site for a bakery called Sunrise Bread with a menu section"
                  className="w-full resize-none rounded-sm bg-[#313131] px-3 py-2 text-[13px] text-[#cccccc] outline-none ring-1 ring-[#3c3c3c] focus:ring-[#0078d4] disabled:opacity-60"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void buildWebsite()}
                    disabled={!!busy}
                    className="flex-1 rounded-sm bg-[#0e639c] px-3 py-2 text-[13px] font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1177bb] hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    ✨ Build {siteType ? typeLabel : "attractive"} website
                  </button>
                  {busy === "website" && (
                    <button type="button" onClick={stop} className="rounded-sm bg-[#a1260d] px-3 py-2 text-[13px] text-white">
                      Stop
                    </button>
                  )}
                </div>
                {busy === "website" && <div className="studio-shimmer h-1 w-full rounded-full" />}
              </section>

              <section className="space-y-2 border-t border-[#3c3c3c] pt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#cccccc]">Non-stop writer</div>
                <label className="flex flex-col gap-1 text-[11px] text-[#9d9d9d]">
                  Write into
                  <select
                    value={writerMode}
                    onChange={(e) => setWriterMode(e.target.value as WriterMode)}
                    disabled={!!busy}
                    className="rounded-sm bg-[#313131] px-2 py-1 text-[12px] text-[#cccccc] outline-none ring-1 ring-[#3c3c3c] disabled:opacity-50"
                  >
                    {WRITER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="Lines per burst" value={burst} onChange={setBurst} min={10} max={1000} disabled={!!busy} />
                  <NumField label="Delete %" value={deletePercent} onChange={setDeletePercent} min={0} max={100} disabled={!!busy} />
                  <NumField label="Max file lines" value={maxLines} onChange={setMaxLines} min={50} max={20000} disabled={!!busy} />
                  <NumField label="Speed (ms/line)" value={speed} onChange={setSpeed} min={0} max={500} disabled={!!busy} />
                </div>
                {busy === "writer" ? (
                  <button type="button" onClick={stop} className="w-full rounded-sm bg-[#a1260d] px-3 py-2 text-[13px] font-medium text-white hover:bg-[#c42b1c]">
                    ■ Stop writer
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void startWriter()}
                    disabled={!!busy}
                    className="w-full rounded-sm bg-[#16825d] px-3 py-2 text-[13px] font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1a9b6f] disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    ▶ Start non-stop writing
                  </button>
                )}
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="rounded-sm bg-[#1e1e1e] py-2">
                    <div className="text-[15px] font-semibold text-white">{stats.cycles}</div>cycles
                  </div>
                  <div className="rounded-sm bg-[#1e1e1e] py-2">
                    <div className="text-[15px] font-semibold text-[#89d185]">{stats.written}</div>written
                  </div>
                  <div className="rounded-sm bg-[#1e1e1e] py-2">
                    <div className="text-[15px] font-semibold text-[#f48771]">{stats.deleted}</div>deleted
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-[#858585]">
                  In &quot;Web&quot; mode each card written in HTML gets a matching CSS animation rule and a script, so the preview
                  shows animated, clickable cards. Other languages are written as standalone, valid blocks.
                </p>
              </section>
            </div>
          </aside>
        )}
      </div>

      {/* Command palette */}
      {paletteOpen && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/30 pt-[12vh]" onMouseDown={() => setPaletteOpen(false)}>
          <div className="studio-scale-in w-[600px] max-w-[92vw] overflow-hidden rounded-md border border-[#454545] bg-[#252526] shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={paletteQuery}
              onChange={(e) => {
                setPaletteQuery(e.target.value);
                setPaletteIndex(0);
              }}
              onKeyDown={onPaletteKey}
              placeholder="Type the name of a command to run"
              className="w-full bg-[#313131] px-3 py-2 text-[13px] text-white outline-none placeholder:text-[#8a8a8a]"
            />
            <ul className="max-h-[360px] overflow-auto py-1">
              {paletteList.map((id, i) => (
                <li key={id}>
                  <button
                    type="button"
                    onMouseEnter={() => setPaletteIndex(i)}
                    onClick={() => {
                      setPaletteOpen(false);
                      runCommand(id);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1 text-left text-[13px] ${i === paletteIndex ? "bg-[#04395e] text-white" : "text-[#cccccc]"}`}
                  >
                    <span>{COMMANDS[id].label}</span>
                    {COMMANDS[id].sc && <span className="text-[11px] text-[#a0a0a0]">{COMMANDS[id].sc}</span>}
                  </button>
                </li>
              ))}
              {paletteList.length === 0 && <li className="px-3 py-2 text-[12px] text-[#858585]">No matching commands</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Status bar */}
      <footer className="flex h-[22px] shrink-0 items-center gap-3 bg-[#007acc] px-2 text-[12px] text-white">
        <span className="flex items-center gap-1">
          {busy ? <span className="studio-pulse-dot">●</span> : "✓"} {busy ? phase : "Ready"}
        </span>
        <span className="text-white/80">{projectId ? `project #${projectId}` : "unsaved"}</span>
        <span className="text-white/80">{savedAt ? `saved ${savedAt}` : ""}</span>
        <span className="ml-auto">Ln {totalLines}</span>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
        <span>{openTabs.length ? tabInfo.label : "—"}</span>
        <span>{showPreview ? "Preview on" : "Preview off"}</span>
        <button
          type="button"
          onClick={toggleKeepAwake}
          className="rounded-sm px-1.5 hover:bg-white/15"
          aria-pressed={keepAwake}
          title="Keep the screen on while the studio is open (does not move the cursor)"
        >
          {keepAwake ? "☕ Keep awake: on" : "☕ Keep awake: off"}
        </button>
        <span>{isFullscreen ? "Full screen" : "Windowed"}</span>
        <span className="text-white/80">{ALL_KEYS.length} languages · {WEB_KEYS.length} wired</span>
      </footer>
    </div>
  );
}
