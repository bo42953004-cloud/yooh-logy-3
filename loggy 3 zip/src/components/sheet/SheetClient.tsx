"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { evaluateSheet, displayValue, isNumeric, type CellValue } from "@/lib/sheet/formula";
import { DEFAULT_ROWS, colToLetter, lastUsedRow, parseAddress, toAddress } from "@/lib/sheet/utils";

const COLS = 26;
const MAX_DISPLAY_ROWS = 2000;

type Cells = Record<string, string>;
type Tone = "you" | "agent" | "error";

interface ChatEntry {
  id: string;
  tone: Tone;
  text: string;
}

interface SheetSummary {
  id: number;
  name: string;
  rowCount: number;
  updatedAt: string;
}

/**
 * Row templates for the non-stop mode. Tokens:
 * {seq} running counter, {rand:a:b} random integer, {r} current row, {r-1}/{r-2} earlier rows.
 * Columns map to letters. Values starting with "=" are formulas.
 */
const TEMPLATES: Record<string, { label: string; columns: Record<string, string> }> = {
  sales: {
    label: "Sales log (units × price)",
    columns: {
      A: "{seq}",
      B: "{rand:1:50}",
      C: "{rand:5:60}",
      D: "=B{r}*C{r}",
      E: "=SUM(D$1:D{r})",
    },
  },
  temperature: {
    label: "Temperature monitor",
    columns: {
      A: "{seq}",
      B: "{rand:-5:38}",
      C: '=IF(B{r}>25,"Hot","Mild")',
      D: "=AVERAGE(B{r-2}:B{r})",
      E: "=MAX(B{r-2}:B{r})",
    },
  },
  squares: {
    label: "Squares & cubes",
    columns: {
      A: "{seq}",
      B: "=A{r}^2",
      C: "=A{r}^3",
      D: "=SUM(B$1:B{r})",
    },
  },
  scores: {
    label: "Scores with rolling average",
    columns: {
      A: "{seq}",
      B: "{rand:40:100}",
      C: "=AVERAGE(B{r-2}:B{r})",
      D: '=IF(C{r}>=70,"Pass","Review")',
    },
  },
};

const QUICK_TASKS = [
  "sum of column A",
  "average of B1:B20",
  "fill column A with numbers 1 to 50",
  "random numbers between 10 and 99 in column B for 30 rows",
  "multiply column A by 3 into column C",
  "squares of column A into column D",
  "running total of column B into column E",
  "clear sheet",
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function expandTemplate(template: string, row: number, seq: number): string {
  return template
    .replace(/\{seq\}/g, String(seq))
    .replace(/\{rand:(-?\d+):(-?\d+)\}/g, (_m, a: string, b: string) =>
      String(randInt(Math.min(Number(a), Number(b)), Math.max(Number(a), Number(b)))),
    )
    .replace(/\{r-(\d+)\}/g, (_m, d: string) => String(Math.max(1, row - Number(d))))
    .replace(/\{r\}/g, String(row));
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

function clamp(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function setOrDelete(cells: Cells, address: string, value: string): Cells {
  const next = { ...cells };
  if (value.trim() === "") delete next[address];
  else next[address] = value;
  return next;
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export default function SheetClient() {
  const [cells, setCells] = useState<Cells>({});
  const cellsRef = useRef(cells);
  const [sheetId, setSheetId] = useState<number | null>(null);
  const [sheetName, setSheetName] = useState("Untitled sheet");
  const [rowCount, setRowCount] = useState(DEFAULT_ROWS);
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [sel, setSel] = useState({ row: 1, col: 0 });
  const [edit, setEdit] = useState<{ addr: string; value: string } | null>(null);
  const [savedAt, setSavedAt] = useState("");

  const [task, setTask] = useState("");
  const [chat, setChat] = useState<ChatEntry[]>([
    {
      id: "intro",
      tone: "agent",
      text: "Hi! Give me a task in plain English, for example \"sum of column A\", or start the non-stop mode below.",
    },
  ]);
  const [agentBusy, setAgentBusy] = useState(false);

  const [running, setRunning] = useState(false);
  const [templateKey, setTemplateKey] = useState("sales");
  const [burst, setBurst] = useState(200);
  const [deletePercent, setDeletePercent] = useState(50);
  const [loopRows, setLoopRows] = useState(300);
  const [speed, setSpeed] = useState(120);
  const [loopStats, setLoopStats] = useState({ cycles: 0, written: 0, cleared: 0 });
  const [phase, setPhase] = useState("Idle");
  const abortRef = useRef<AbortController | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  const values = useMemo(() => evaluateSheet(cells) as Record<string, CellValue>, [cells]);
  const lastRow = useMemo(() => lastUsedRow(cells), [cells]);
  const displayRows = Math.min(MAX_DISPLAY_ROWS, Math.max(rowCount, lastRow + 5));
  const selAddr = toAddress(sel.col, sel.row);

  const pushChat = useCallback((text: string, tone: Tone) => {
    setChat((prev) => [
      ...prev.slice(-150),
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tone, text },
    ]);
  }, []);

  const refreshSheets = useCallback(async () => {
    try {
      const res = await fetch("/api/sheets", { cache: "no-store" });
      const json = (await res.json()) as { sheets?: SheetSummary[]; error?: string };
      if (!res.ok) {
        pushChat(json.error ?? "Could not load saved sheets.", "error");
        return [];
      }
      setSheets(json.sheets ?? []);
      return json.sheets ?? [];
    } catch {
      return [];
    }
  }, [pushChat]);

  const openSheet = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/sheets/${id}`, { cache: "no-store" });
      const json = (await res.json()) as {
        sheet?: { id: number; name: string; data: Cells; rowCount: number };
        error?: string;
      };
      if (!res.ok || !json.sheet) {
        pushChat(json.error ?? "Could not open sheet.", "error");
        return;
      }
      setCells(json.sheet.data ?? {});
      setSheetId(json.sheet.id);
      setSheetName(json.sheet.name);
      setRowCount(json.sheet.rowCount || DEFAULT_ROWS);
      setSel({ row: 1, col: 0 });
      setEdit(null);
      pushChat(`Opened "${json.sheet.name}".`, "agent");
    },
    [pushChat],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await refreshSheets();
      if (!cancelled && list.length > 0) await openSheet(list[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSheets, openSheet]);

  const saveSheet = async () => {
    const payload = { name: sheetName.trim() || "Untitled sheet", data: cellsRef.current, rowCount };
    try {
      const res = await fetch(sheetId ? `/api/sheets/${sheetId}` : "/api/sheets", {
        method: sheetId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { sheet?: { id: number }; error?: string };
      if (!res.ok || !json.sheet) {
        pushChat(json.error ?? "Save failed.", "error");
        return;
      }
      setSheetId(json.sheet.id);
      setSavedAt(new Date().toLocaleTimeString());
      pushChat(`Saved "${payload.name}".`, "agent");
      void refreshSheets();
    } catch {
      pushChat("Save failed: network error.", "error");
    }
  };

  const newSheet = () => {
    if (running) return;
    setCells({});
    setSheetId(null);
    setSheetName("Untitled sheet");
    setRowCount(DEFAULT_ROWS);
    setSel({ row: 1, col: 0 });
    setEdit(null);
    setLoopStats({ cycles: 0, written: 0, cleared: 0 });
    setSavedAt("");
    pushChat("New sheet created.", "agent");
  };

  const deleteSheet = async () => {
    if (!sheetId || running) return;
    await fetch(`/api/sheets/${sheetId}`, { method: "DELETE" });
    newSheet();
    void refreshSheets();
  };

  const exportCsv = () => {
    const lastCol = Math.max(
      0,
      ...Object.keys(cellsRef.current)
        .map((k) => parseAddress(k)?.col ?? 0)
        .map((c) => c),
    );
    const lines: string[] = [];
    for (let r = 1; r <= Math.max(1, lastRow); r++) {
      const row: string[] = [];
      for (let c = 0; c <= lastCol; c++) {
        row.push(csvEscape(displayValue(values[toAddress(c, r)])));
      }
      lines.push(row.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheetName.trim() || "sheet"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const commitEdit = useCallback(() => {
    if (!edit) return;
    const { addr, value } = edit;
    setCells((prev) => setOrDelete(prev, addr, value));
    setEdit(null);
  }, [edit]);

  const beginEdit = (address: string, initial?: string) => {
    setEdit({ addr: address, value: initial ?? cells[address] ?? "" });
  };

  const moveSel = (dRow: number, dCol: number) => {
    setSel((prev) => ({
      row: clamp(prev.row + dRow, 1, displayRows),
      col: clamp(prev.col + dCol, 0, COLS - 1),
    }));
  };

  const selectCell = (row: number, col: number) => {
    if (edit) commitEdit();
    setSel({ row, col });
    gridRef.current?.focus();
  };

  const onGridKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (edit) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveSel(1, 0);
        return;
      case "ArrowUp":
        e.preventDefault();
        moveSel(-1, 0);
        return;
      case "ArrowLeft":
        e.preventDefault();
        moveSel(0, -1);
        return;
      case "ArrowRight":
        e.preventDefault();
        moveSel(0, 1);
        return;
      case "Enter":
      case "F2":
        e.preventDefault();
        beginEdit(selAddr);
        return;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        setCells((prev) => setOrDelete(prev, selAddr, ""));
        return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          beginEdit(selAddr, e.key);
        }
    }
  };

  const onEditKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
      moveSel(1, 0);
      gridRef.current?.focus();
    } else if (e.key === "Tab") {
      e.preventDefault();
      commitEdit();
      moveSel(0, e.shiftKey ? -1 : 1);
      gridRef.current?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEdit(null);
      gridRef.current?.focus();
    }
  };

  /** One-shot natural-language task, executed by the sheet agent route. */
  const runTask = async (text: string) => {
    const clean = text.trim();
    if (!clean || agentBusy) return;
    setAgentBusy(true);
    pushChat(clean, "you");
    try {
      const res = await fetch("/api/sheet-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: clean, data: cellsRef.current }),
      });
      const json = (await res.json()) as { message?: string; cells?: Cells; error?: string };
      if (!res.ok || !json.cells) {
        pushChat(json.error ?? "The agent could not run this task.", "error");
        return;
      }
      const updates = json.cells;
      setCells((prev) => {
        const next = { ...prev };
        for (const [key, value] of Object.entries(updates)) {
          if (value.trim() === "") delete next[key];
          else next[key] = value;
        }
        return next;
      });
      const firstKey = Object.keys(updates)[0];
      if (firstKey) {
        const addr = parseAddress(firstKey);
        if (addr) setSel({ row: addr.row, col: addr.col });
      }
      pushChat(json.message ?? "Done.", "agent");
      setTask("");
    } catch {
      pushChat("Network error while running the task.", "error");
    } finally {
      setAgentBusy(false);
    }
  };

  /**
   * Non-stop mode: writes `burst` rows, clears half of them, then keeps going.
   * Rows wrap back to the top when they reach the row window, so the sheet never grows forever.
   */
  const startLoop = async () => {
    if (running) return;
    const template = TEMPLATES[templateKey];
    const columns = Object.keys(template.columns);
    const size = clamp(burst, 10, 1000);
    const ratio = clamp(deletePercent, 0, 100) / 100;
    const windowRows = clamp(loopRows, 20, 5000);
    const delay = clamp(speed, 0, 5000);
    const firstRow = 4;

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setRowCount((prev) => Math.max(prev, windowRows));
    setLoopStats({ cycles: 0, written: 0, cleared: 0 });
    pushChat(
      `Non-stop mode started: ${template.label}, ${size} rows per burst, clear ${Math.round(ratio * 100)}%, window ${windowRows} rows.`,
      "agent",
    );

    let cycles = 0;
    let written = 0;
    let cleared = 0;
    let seq = 1;
    let row = Math.max(firstRow, lastUsedRow(cellsRef.current) + 1);

    try {
      while (!controller.signal.aborted) {
        cycles++;
        const burstStart = row > windowRows ? firstRow : row;
        row = burstStart;

        for (let i = 0; i < size && !controller.signal.aborted; i++) {
          if (row > windowRows) row = firstRow;
          const r = row;
          const updates: Cells = {};
          for (const col of columns) {
            updates[`${col}${r}`] = expandTemplate(template.columns[col], r, seq);
          }
          seq++;
          written++;
          setCells((prev) => {
            const next = { ...prev };
            for (const [key, value] of Object.entries(updates)) next[key] = value;
            return next;
          });
          setSel({ row: r, col: 0 });
          setPhase(`Cycle ${cycles}: writing row ${r}`);
          setLoopStats({ cycles, written, cleared });
          row++;
          await sleep(delay, controller.signal);
        }
        if (controller.signal.aborted) break;

        const clearRows = Math.floor(size * ratio);
        setPhase(`Cycle ${cycles}: clearing ${clearRows} rows`);
        await sleep(Math.max(150, delay * 4), controller.signal);
        if (controller.signal.aborted) break;

        const from = burstStart;
        const to = from + clearRows;
        setCells((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(next)) {
            const addr = parseAddress(key);
            if (addr && addr.row >= from && addr.row < to) delete next[key];
          }
          return next;
        });
        cleared += clearRows;
        setLoopStats({ cycles, written, cleared });
        await sleep(Math.max(150, delay * 4), controller.signal);
      }
      pushChat("Non-stop mode stopped.", "agent");
    } catch {
      pushChat("Non-stop mode stopped unexpectedly.", "error");
    } finally {
      abortRef.current = null;
      setRunning(false);
      setPhase("Idle");
    }
  };

  const stopLoop = () => abortRef.current?.abort();

  const formulaValue = edit && edit.addr === selAddr ? edit.value : cells[selAddr] ?? "";
  const selValue = values[selAddr];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-300 bg-white px-4">
        <Link href="/" className="font-semibold text-[#217346]">
          ▦ Spreadsheet
        </Link>
        <input
          value={sheetName}
          onChange={(e) => setSheetName(e.target.value)}
          aria-label="Sheet name"
          className="w-48 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-[#217346]"
        />
        <select
          value={sheetId ?? ""}
          onChange={(e) => e.target.value && void openSheet(Number(e.target.value))}
          className="max-w-[220px] rounded border border-slate-300 px-2 py-1 text-sm"
          aria-label="Open saved sheet"
        >
          <option value="">Open saved sheet…</option>
          {sheets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={newSheet} disabled={running} className="rounded px-2.5 py-1 text-sm hover:bg-slate-100 disabled:opacity-50">
          New
        </button>
        <button type="button" onClick={() => void saveSheet()} className="rounded bg-[#217346] px-3 py-1 text-sm font-medium text-white hover:bg-[#1b5e39]">
          Save
        </button>
        <button type="button" onClick={exportCsv} className="rounded px-2.5 py-1 text-sm hover:bg-slate-100">
          Export CSV
        </button>
        {sheetId && (
          <button type="button" onClick={() => void deleteSheet()} disabled={running} className="rounded px-2.5 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
            Delete
          </button>
        )}
        <Link href="/studio" className="ml-auto rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100">
          Code Studio →
        </Link>
        <span className="text-xs text-slate-500">{savedAt ? `Saved ${savedAt}` : ""}</span>
      </header>

      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-slate-300 bg-white px-3">
        <div className="w-20 rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-center text-sm font-medium">
          {selAddr}
        </div>
        <span className="text-sm italic text-slate-500">fx</span>
        <input
          value={formulaValue}
          onChange={(e) => setEdit({ addr: selAddr, value: e.target.value })}
          onFocus={() => {
            if (!edit || edit.addr !== selAddr) beginEdit(selAddr);
          }}
          onBlur={() => commitEdit()}
          onKeyDown={onEditKey}
          placeholder="Type a value or a formula such as =SUM(A1:A10)"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-0.5 font-mono text-sm outline-none focus:border-[#217346]"
        />
        <span className="hidden text-xs text-slate-500 md:inline">
          {selValue !== undefined && selValue !== null ? `= ${displayValue(selValue)}` : ""}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          ref={gridRef}
          tabIndex={0}
          onKeyDown={onGridKey}
          className="min-w-0 flex-1 overflow-auto outline-none"
        >
          <table className="border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 h-7 w-12 border-b border-r border-slate-300 bg-slate-200" />
                {Array.from({ length: COLS }, (_, c) => (
                  <th
                    key={c}
                    className={`sticky top-0 z-20 h-7 min-w-[110px] border-b border-r border-slate-300 bg-slate-200 font-medium text-slate-600 ${
                      sel.col === c ? "bg-[#d2e8d9] text-[#217346]" : ""
                    }`}
                  >
                    {colToLetter(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: displayRows }, (_, i) => i + 1).map((r) => (
                <tr key={r}>
                  <th
                    className={`sticky left-0 z-10 h-7 border-b border-r border-slate-300 bg-slate-200 font-medium text-slate-600 ${
                      sel.row === r ? "bg-[#d2e8d9] text-[#217346]" : ""
                    }`}
                  >
                    {r}
                  </th>
                  {Array.from({ length: COLS }, (_, c) => {
                    const address = toAddress(c, r);
                    const isSel = sel.row === r && sel.col === c;
                    const isEditing = edit !== null && edit.addr === address;
                    const value = values[address];
                    const text = displayValue(value);
                    const isErr = typeof value === "object" && value !== null && "error" in value;
                    return (
                      <td
                        key={c}
                        onMouseDown={() => selectCell(r, c)}
                        onDoubleClick={() => beginEdit(address)}
                        className={`h-7 min-w-[110px] border-b border-r border-slate-200 bg-white p-0 ${
                          isSel ? "outline outline-2 -outline-offset-2 outline-[#217346]" : ""
                        }`}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            value={edit.value}
                            onChange={(e) => setEdit({ addr: address, value: e.target.value })}
                            onKeyDown={onEditKey}
                            onBlur={() => commitEdit()}
                            className="h-full w-full bg-white px-1.5 font-mono text-sm outline-none"
                          />
                        ) : (
                          <div
                            className={`h-full truncate px-1.5 leading-7 ${
                              isNumeric(value) ? "text-right" : "text-left"
                            } ${isErr ? "text-red-600" : ""}`}
                          >
                            {text}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="flex w-[360px] shrink-0 flex-col border-l border-slate-300 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-800">AI sheet agent</div>
            <p className="text-xs text-slate-500">Ask for a task in plain English and it fills in the cells.</p>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-slate-200 px-4 py-2">
            {QUICK_TASKS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void runTask(q)}
                disabled={agentBusy || running}
                className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] text-slate-700 hover:border-[#217346] hover:text-[#217346] disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          <div ref={chatRef} className="min-h-0 flex-1 space-y-2 overflow-auto px-4 py-3 text-xs">
            {chat.map((entry) => (
              <div
                key={entry.id}
                className={`whitespace-pre-line rounded-lg px-3 py-2 ${
                  entry.tone === "you"
                    ? "ml-8 bg-[#217346] text-white"
                    : entry.tone === "error"
                      ? "mr-8 bg-red-50 text-red-700"
                      : "mr-8 bg-slate-100 text-slate-800"
                }`}
              >
                {entry.text}
              </div>
            ))}
          </div>

          <form
            className="flex gap-2 border-t border-slate-200 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void runTask(task);
            }}
          >
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              disabled={agentBusy || running}
              placeholder="e.g. running total of column B into column E"
              className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#217346] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={agentBusy || running || !task.trim()}
              className="rounded bg-[#217346] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1b5e39] disabled:opacity-50"
            >
              {agentBusy ? "…" : "Run"}
            </button>
          </form>

          <div className="border-t border-slate-200 px-4 py-3">
            <div className="mb-2 text-sm font-semibold text-slate-800">Non-stop computing</div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <label className="col-span-2 flex flex-col gap-1">
                Row template
                <select
                  value={templateKey}
                  onChange={(e) => setTemplateKey(e.target.value)}
                  disabled={running}
                  className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-800"
                >
                  {Object.entries(TEMPLATES).map(([key, t]) => (
                    <option key={key} value={key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Rows per burst
                <input type="number" value={burst} min={10} max={1000} disabled={running} onChange={(e) => setBurst(Number(e.target.value))} className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-800" />
              </label>
              <label className="flex flex-col gap-1">
                Clear %
                <input type="number" value={deletePercent} min={0} max={100} disabled={running} onChange={(e) => setDeletePercent(Number(e.target.value))} className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-800" />
              </label>
              <label className="flex flex-col gap-1">
                Row window
                <input type="number" value={loopRows} min={20} max={5000} disabled={running} onChange={(e) => setLoopRows(Number(e.target.value))} className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-800" />
              </label>
              <label className="flex flex-col gap-1">
                Delay (ms/row)
                <input type="number" value={speed} min={0} max={5000} disabled={running} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-800" />
              </label>
            </div>

            {running ? (
              <button type="button" onClick={stopLoop} className="mt-3 w-full rounded bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700">
                ■ Stop non-stop computing
              </button>
            ) : (
              <button type="button" onClick={() => void startLoop()} disabled={agentBusy} className="mt-3 w-full rounded bg-[#217346] py-2 text-sm font-medium text-white hover:bg-[#1b5e39] disabled:opacity-50">
                ▶ Start non-stop computing
              </button>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-600">
              <div className="rounded bg-slate-100 py-1.5">
                <div className="font-semibold text-slate-900">{loopStats.cycles}</div>cycles
              </div>
              <div className="rounded bg-slate-100 py-1.5">
                <div className="font-semibold text-[#217346]">{loopStats.written}</div>rows written
              </div>
              <div className="rounded bg-slate-100 py-1.5">
                <div className="font-semibold text-red-600">{loopStats.cleared}</div>rows cleared
              </div>
            </div>
          </div>
        </aside>
      </div>

      <footer className="flex h-6 shrink-0 items-center gap-4 bg-[#217346] px-3 text-xs text-white">
        <span className="font-medium">{running ? `● ${phase}` : "Ready"}</span>
        <span className="ml-auto">Formulas: SUM, AVERAGE, MIN, MAX, COUNT, IF, ROUND, ABS, SQRT, POWER, MOD, INT, AND, OR, NOT, CONCAT</span>
        <span>
          {Object.keys(cells).length} cells · {lastRow} rows used
        </span>
      </footer>
    </div>
  );
}
