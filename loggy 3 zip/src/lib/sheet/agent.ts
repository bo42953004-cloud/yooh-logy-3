import { letterToCol, lastUsedRow, toAddress } from "./utils";

export interface AgentResult {
  message: string;
  /** Cells to write, e.g. { "C1": "=SUM(A1:A5)" }. Empty string clears a cell. */
  cells: Record<string, string>;
}

const HELP =
  "I understood the task, but not this exact wording. Try one of these:\n" +
  "- sum of column A\n" +
  "- average of B1:B20\n" +
  "- fill column A with numbers 1 to 50\n" +
  "- random numbers between 10 and 99 in column B for 30 rows\n" +
  "- multiply column A by 3 into column C\n" +
  "- squares of column A into column D\n" +
  "- running total of column B into column E\n" +
  "- count / min / max of column A\n" +
  "- clear sheet";

/** Converts "column A", "A", "B1:B20" or "C" into a column letter. */
function columnOf(text: string): string | null {
  const named = /\bcolumn\s+([A-Za-z]{1,2})\b/i.exec(text);
  if (named) return named[1].toUpperCase();
  // Otherwise use the last capital-letter token, e.g. "sum of A" -> A
  const tokens = [...text.matchAll(/\b([A-Z]{1,2})\b/g)];
  return tokens.length ? tokens[tokens.length - 1][1] : null;
}

/** Finds the column in "into column X" / "into X" / "in column X". */
function targetColumn(text: string): string | null {
  const m = /\b(?:into|in|to)\s+(?:column\s+)?([A-Za-z]{1,2})\b/i.exec(text);
  return m ? m[1].toUpperCase() : null;
}

function parseRange(text: string): { col: string; from: number; to: number } | null {
  const m = /\b([A-Za-z]{1,2})(\d+)\s*:\s*[A-Za-z]{1,2}(\d+)\b/.exec(text);
  if (!m) return null;
  return { col: m[1].toUpperCase(), from: Number(m[2]), to: Number(m[3]) };
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Rule-based sheet assistant. It reads a plain-English task and returns the cells to write.
 * It runs on the server and can later be replaced by an LLM without changing the UI.
 */
export function runSheetTask(task: string, data: Record<string, string>): AgentResult {
  const text = task.trim();
  const lower = text.toLowerCase();

  if (!text) return { message: "Type a task first.", cells: {} };

  if (/\bclear\s+(the\s+)?(sheet|everything|all)\b/.test(lower)) {
    const cells: Record<string, string> = {};
    for (const key of Object.keys(data)) cells[key] = "";
    return { message: "Cleared the sheet.", cells };
  }

  const last = lastUsedRow(data);
  const range = parseRange(text);

  // Aggregates: sum / average / count / min / max
  const rowWise = /\b(running|cumulative|multiply|times|double|triple|squares?|squared|cubes?|cubed)\b/.test(lower);
  const agg = /\b(sum|total|average|avg|mean|count|min|minimum|max|maximum)\b/.exec(lower);
  if (agg && !rowWise) {
    const fnMap: Record<string, string> = {
      sum: "SUM",
      total: "SUM",
      average: "AVERAGE",
      avg: "AVERAGE",
      mean: "AVERAGE",
      count: "COUNT",
      min: "MIN",
      minimum: "MIN",
      max: "MAX",
      maximum: "MAX",
    };
    const fn = fnMap[agg[1]];
    const col = range ? range.col : columnOf(text.replace(agg[0], ""));
    if (!col) return { message: HELP, cells: {} };
    const from = range ? range.from : 1;
    const to = range ? range.to : Math.max(1, last);
    const target = targetColumn(text) ?? col;
    const dest = toAddress(letterToCol(target), Math.max(1, last) + 2);
    const formula = `=${fn}(${col}${from}:${col}${to})`;
    return {
      message: `Wrote ${fn} of ${col}${from}:${col}${to} into ${dest}.`,
      cells: { [dest]: formula },
    };
  }

  // Fill a column with a sequence
  const seq = /\b(?:fill|numbers?|sequence)\b.*?\b(\d+)\s*(?:to|-|through)\s*(\d+)\b/.exec(lower);
  if (seq) {
    const from = Number(seq[1]);
    const to = Number(seq[2]);
    const col = targetColumn(text) ?? columnOf(text) ?? "A";
    const step = from <= to ? 1 : -1;
    const cells: Record<string, string> = {};
    let row = 1;
    for (let n = from; step > 0 ? n <= to : n >= to; n += step) {
      cells[`${col}${row}`] = String(n);
      row++;
    }
    return { message: `Filled ${col}1:${col}${row - 1} with ${from} to ${to}.`, cells };
  }

  // Random integers
  const rnd = /\brandom\b.*?\b(\d+)\s*(?:to|-|and)\s*(\d+)\b/.exec(lower);
  if (rnd) {
    const min = Math.min(Number(rnd[1]), Number(rnd[2]));
    const max = Math.max(Number(rnd[1]), Number(rnd[2]));
    const countM = /\bfor\s+(\d+)\s+rows?\b/.exec(lower);
    const count = Math.min(500, countM ? Number(countM[1]) : 20);
    const col = targetColumn(text) ?? columnOf(text) ?? "A";
    const start = last + 1;
    const cells: Record<string, string> = {};
    for (let r = 0; r < count; r++) cells[`${col}${start + r}`] = String(randomInt(min, max));
    return {
      message: `Wrote ${count} random numbers (${min}-${max}) into ${col}${start}:${col}${start + count - 1}.`,
      cells,
    };
  }

  // Row-wise transforms: "multiply column A by 3 into column C", "squares of A into D", "running total of B into E"
  const multiply = /\b(multiply|times|double|triple)\b/.exec(lower);
  const squares = /\b(square|squares|squared)\b/.exec(lower);
  const cubes = /\b(cube|cubes|cubed)\b/.exec(lower);
  const running = /\b(running\s+total|cumulative|running\s+sum)\b/.exec(lower);

  if (multiply || squares || cubes || running) {
    const source = range ? range.col : columnOf(text.replace(/into\s+.*$/i, ""));
    const dest = targetColumn(text);
    if (!source || !dest) return { message: HELP, cells: {} };

    const from = range ? range.from : 1;
    const to = range ? range.to : Math.max(1, last);
    const cells: Record<string, string> = {};
    let count = 0;

    if (running) {
      for (let r = from; r <= to; r++) {
        cells[`${dest}${r}`] = `=SUM(${source}$${from}:${source}${r})`;
        count++;
      }
      return { message: `Running total of ${source} written into ${dest}${from}:${dest}${to}.`, cells };
    }

    let factor = 1;
    const by = /\bby\s+(-?\d+(\.\d+)?)/.exec(lower);
    if (by) factor = Number(by[1]);
    else if (/\btriple\b/.test(lower)) factor = 3;
    else if (/\bdouble\b/.test(lower)) factor = 2;

    for (let r = from; r <= to; r++) {
      const src = `${source}${r}`;
      if (!data[src] || data[src].trim() === "") continue;
      if (cubes) cells[`${dest}${r}`] = `=${src}^3`;
      else if (squares) cells[`${dest}${r}`] = `=${src}^2`;
      else cells[`${dest}${r}`] = `=${src}*${factor}`;
      count++;
    }
    if (count === 0) return { message: `Column ${source} has no values to use.`, cells: {} };
    const what = cubes ? "cubes" : squares ? "squares" : `${source} x ${factor}`;
    return { message: `Wrote ${count} formulas (${what}) into column ${dest}.`, cells };
  }

  return { message: HELP, cells: {} };
}

export const agentHelp = HELP;
