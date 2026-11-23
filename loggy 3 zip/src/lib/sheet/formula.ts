import { parseAddress, toAddress } from "./utils";

export type CellError = { error: string };
export type CellValue = number | string | boolean | null | CellError;
type Scalar = number | string | boolean | null;
type Ev = CellValue | CellValue[];

export function isCellError(v: unknown): v is CellError {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "error" in v;
}

class FormulaError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

const NUM_RE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

type TokKind = "num" | "str" | "ref" | "id" | "op";
interface Tok {
  k: TokKind;
  s: string;
  n: number;
  col: number;
  row: number;
}

type Expr =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "ref"; col: number; row: number }
  | { t: "range"; a: { col: number; row: number }; b: { col: number; row: number } }
  | { t: "neg"; e: Expr }
  | { t: "bin"; op: string; l: Expr; r: Expr }
  | { t: "func"; name: string; args: Expr[] };

function tk(k: TokKind, s: string, n: number): Tok {
  return { k, s, n, col: 0, row: 0 };
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const rest = src.slice(i);

    let m = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(rest);
    if (m) {
      toks.push(tk("num", m[0], Number(m[0])));
      i += m[0].length;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let out = "";
      while (j < src.length) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            out += '"';
            j += 2;
            continue;
          }
          break;
        }
        out += src[j];
        j++;
      }
      if (j >= src.length) throw new FormulaError("#ERR!");
      toks.push(tk("str", out, 0));
      i = j + 1;
      continue;
    }

    m = /^\$?[A-Za-z]{1,3}\$?\d+(?![A-Za-z0-9_(])/.exec(rest);
    if (m) {
      const addr = parseAddress(m[0]);
      if (!addr) throw new FormulaError("#REF!");
      toks.push({ k: "ref", s: m[0], n: 0, col: addr.col, row: addr.row });
      i += m[0].length;
      continue;
    }

    m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(rest);
    if (m) {
      toks.push(tk("id", m[0].toUpperCase(), 0));
      i += m[0].length;
      continue;
    }

    m = /^(<>|<=|>=|[-+*/^&=<>(),:])/.exec(rest);
    if (m) {
      toks.push(tk("op", m[0], 0));
      i += m[0].length;
      continue;
    }

    throw new FormulaError("#ERR!");
  }
  return toks;
}

/** Recursive-descent parser with Excel-like operator precedence. */
class Parser {
  private i = 0;
  private readonly toks: Tok[];

  constructor(toks: Tok[]) {
    this.toks = toks;
  }

  parse(): Expr {
    const e = this.comparison();
    if (this.i !== this.toks.length) throw new FormulaError("#ERR!");
    return e;
  }

  private atOp(v: string): boolean {
    const t = this.toks[this.i];
    return t !== undefined && t.k === "op" && t.s === v;
  }

  private expectOp(v: string): void {
    if (!this.atOp(v)) throw new FormulaError("#ERR!");
    this.i++;
  }

  private level(ops: string[], next: () => Expr): Expr {
    let left = next();
    for (;;) {
      const t = this.toks[this.i];
      if (t && t.k === "op" && ops.includes(t.s)) {
        this.i++;
        left = { t: "bin", op: t.s, l: left, r: next() };
      } else {
        return left;
      }
    }
  }

  private comparison(): Expr {
    return this.level(["=", "<>", "<", "<=", ">", ">="], () => this.concat());
  }

  private concat(): Expr {
    return this.level(["&"], () => this.additive());
  }

  private additive(): Expr {
    return this.level(["+", "-"], () => this.multiplicative());
  }

  private multiplicative(): Expr {
    return this.level(["*", "/"], () => this.power());
  }

  private power(): Expr {
    return this.level(["^"], () => this.unary());
  }

  private unary(): Expr {
    if (this.atOp("-")) {
      this.i++;
      return { t: "neg", e: this.unary() };
    }
    if (this.atOp("+")) {
      this.i++;
      return this.unary();
    }
    return this.primary();
  }

  private primary(): Expr {
    const t = this.toks[this.i];
    if (!t) throw new FormulaError("#ERR!");
    this.i++;

    if (t.k === "num") return { t: "num", v: t.n };
    if (t.k === "str") return { t: "str", v: t.s };

    if (t.k === "ref") {
      const a = { col: t.col, row: t.row };
      if (this.atOp(":")) {
        const b = this.toks[this.i + 1];
        if (b && b.k === "ref") {
          this.i += 2;
          return { t: "range", a, b: { col: b.col, row: b.row } };
        }
        throw new FormulaError("#ERR!");
      }
      return { t: "ref", col: t.col, row: t.row };
    }

    if (t.k === "id") {
      if (t.s === "TRUE" || t.s === "FALSE") return { t: "bool", v: t.s === "TRUE" };
      if (!this.atOp("(")) throw new FormulaError("#NAME?");
      this.i++;
      const args: Expr[] = [];
      if (!this.atOp(")")) {
        for (;;) {
          args.push(this.comparison());
          if (this.atOp(",")) {
            this.i++;
            continue;
          }
          break;
        }
      }
      this.expectOp(")");
      return { t: "func", name: t.s, args };
    }

    if (t.k === "op" && t.s === "(") {
      const e = this.comparison();
      this.expectOp(")");
      return e;
    }

    throw new FormulaError("#ERR!");
  }
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(12)));
}

function rank(v: Scalar): number {
  if (typeof v === "number") return 0;
  if (typeof v === "string") return 1;
  return 2;
}

function compare(a: Scalar, b: Scalar): number {
  let x = a;
  let y = b;
  if (x === null) x = typeof y === "number" ? 0 : typeof y === "boolean" ? false : "";
  if (y === null) y = typeof x === "number" ? 0 : typeof x === "boolean" ? false : "";
  if (typeof x === "number" && typeof y === "number") return x - y;
  if (typeof x === "string" && typeof y === "string") {
    return x.toLowerCase().localeCompare(y.toLowerCase());
  }
  if (typeof x === "boolean" && typeof y === "boolean") return Number(x) - Number(y);
  return rank(x) - rank(y);
}

function roundHalfAway(x: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.sign(x) * Math.round(Math.abs(x) * f + Number.EPSILON) / f;
}

function arity(args: unknown[], min: number, max: number): void {
  if (args.length < min || args.length > max) throw new FormulaError("#VALUE!");
}

function scalarOf(v: Ev): Scalar {
  if (Array.isArray(v)) throw new FormulaError("#VALUE!");
  if (isCellError(v)) throw new FormulaError(v.error);
  return v;
}

function toNum(v: Ev): number {
  const s = scalarOf(v);
  if (s === null) return 0;
  if (typeof s === "number") return s;
  if (typeof s === "boolean") return s ? 1 : 0;
  if (NUM_RE.test(s.trim())) return Number(s.trim());
  throw new FormulaError("#VALUE!");
}

function toText(v: Ev): string {
  const s = scalarOf(v);
  if (s === null) return "";
  if (typeof s === "boolean") return s ? "TRUE" : "FALSE";
  if (typeof s === "number") return formatNumber(s);
  return s;
}

function toBool(v: Ev): boolean {
  const s = scalarOf(v);
  if (s === null) return false;
  if (typeof s === "boolean") return s;
  if (typeof s === "number") return s !== 0;
  const up = s.trim().toUpperCase();
  if (up === "TRUE") return true;
  if (up === "FALSE") return false;
  throw new FormulaError("#VALUE!");
}

/** Numbers from ranges (ignores text/blank) and from direct arguments. */
function numbersFrom(args: Ev[]): number[] {
  const out: number[] = [];
  for (const a of args) {
    if (Array.isArray(a)) {
      for (const x of a) {
        if (isCellError(x)) throw new FormulaError(x.error);
        if (typeof x === "number") out.push(x);
      }
    } else {
      out.push(toNum(a));
    }
  }
  return out;
}

/** Evaluates every non-empty cell of a sparse sheet, with memoisation and cycle detection. */
export function evaluateSheet(data: Record<string, string>): Record<string, CellValue> {
  const cache = new Map<string, CellValue>();
  const visiting = new Set<string>();

  function literal(text: string): CellValue {
    const t = text.trim();
    if (NUM_RE.test(t)) return Number(t);
    const up = t.toUpperCase();
    if (up === "TRUE") return true;
    if (up === "FALSE") return false;
    return text;
  }

  function cell(key: string): CellValue {
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const text = data[key];
    if (text === undefined || text.trim() === "") return null;
    if (text.trim().startsWith("=")) {
      if (visiting.has(key)) return { error: "#CIRC!" };
      visiting.add(key);
      const result = evalFormula(text);
      visiting.delete(key);
      cache.set(key, result);
      return result;
    }
    const value = literal(text);
    cache.set(key, value);
    return value;
  }

  function scalarRef(col: number, row: number): CellValue {
    const v = cell(toAddress(col, row));
    if (isCellError(v)) throw new FormulaError(v.error);
    return v;
  }

  function rangeValues(
    a: { col: number; row: number },
    b: { col: number; row: number },
  ): CellValue[] {
    const r1 = Math.min(a.row, b.row);
    const r2 = Math.max(a.row, b.row);
    const c1 = Math.min(a.col, b.col);
    const c2 = Math.max(a.col, b.col);
    const out: CellValue[] = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) out.push(cell(toAddress(c, r)));
    }
    return out;
  }

  function binary(op: string, l: Ev, r: Ev): CellValue {
    if (op === "&") return toText(l) + toText(r);
    if (["=", "<>", "<", "<=", ">", ">="].includes(op)) {
      const c = compare(scalarOf(l), scalarOf(r));
      switch (op) {
        case "=":
          return c === 0;
        case "<>":
          return c !== 0;
        case "<":
          return c < 0;
        case "<=":
          return c <= 0;
        case ">":
          return c > 0;
        default:
          return c >= 0;
      }
    }
    const a = toNum(l);
    const b = toNum(r);
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        if (b === 0) throw new FormulaError("#DIV/0!");
        return a / b;
      case "^":
        return Math.pow(a, b);
      default:
        throw new FormulaError("#ERR!");
    }
  }

  function callFunc(name: string, argExprs: Expr[]): Ev {
    if (name === "IF") {
      arity(argExprs, 2, 3);
      const cond = toBool(evalExpr(argExprs[0]));
      if (cond) return evalExpr(argExprs[1]);
      return argExprs.length > 2 ? evalExpr(argExprs[2]) : false;
    }

    const args = argExprs.map(evalExpr);
    switch (name) {
      case "SUM":
        return numbersFrom(args).reduce((s, x) => s + x, 0);
      case "AVERAGE":
      case "AVG": {
        const nums = numbersFrom(args);
        if (nums.length === 0) throw new FormulaError("#DIV/0!");
        return nums.reduce((s, x) => s + x, 0) / nums.length;
      }
      case "MIN": {
        const nums = numbersFrom(args);
        return nums.length ? Math.min(...nums) : 0;
      }
      case "MAX": {
        const nums = numbersFrom(args);
        return nums.length ? Math.max(...nums) : 0;
      }
      case "COUNT": {
        let n = 0;
        for (const a of args) {
          if (Array.isArray(a)) {
            for (const x of a) if (typeof x === "number") n++;
          } else if (typeof a === "number") {
            n++;
          }
        }
        return n;
      }
      case "ROUND":
        arity(args, 1, 2);
        return roundHalfAway(toNum(args[0]), args.length > 1 ? toNum(args[1]) : 0);
      case "ABS":
        arity(args, 1, 1);
        return Math.abs(toNum(args[0]));
      case "SQRT": {
        arity(args, 1, 1);
        const x = toNum(args[0]);
        if (x < 0) throw new FormulaError("#NUM!");
        return Math.sqrt(x);
      }
      case "POWER":
        arity(args, 2, 2);
        return Math.pow(toNum(args[0]), toNum(args[1]));
      case "MOD": {
        arity(args, 2, 2);
        const a = toNum(args[0]);
        const b = toNum(args[1]);
        if (b === 0) throw new FormulaError("#DIV/0!");
        return a - b * Math.floor(a / b);
      }
      case "INT":
        arity(args, 1, 1);
        return Math.floor(toNum(args[0]));
      case "AND":
        return args.every((a) => toBool(a));
      case "OR":
        return args.some((a) => toBool(a));
      case "NOT":
        arity(args, 1, 1);
        return !toBool(args[0]);
      case "CONCAT":
      case "CONCATENATE":
        return args
          .map((a) => (Array.isArray(a) ? a.map((x) => toText(x)).join("") : toText(a)))
          .join("");
      default:
        throw new FormulaError("#NAME?");
    }
  }

  function evalExpr(e: Expr): Ev {
    switch (e.t) {
      case "num":
        return e.v;
      case "str":
        return e.v;
      case "bool":
        return e.v;
      case "ref":
        return scalarRef(e.col, e.row);
      case "range":
        return rangeValues(e.a, e.b);
      case "neg":
        return -toNum(evalExpr(e.e));
      case "bin":
        return binary(e.op, evalExpr(e.l), evalExpr(e.r));
      case "func":
        return callFunc(e.name, e.args);
    }
  }

  function evalFormula(text: string): CellValue {
    try {
      const expr = new Parser(tokenize(text.trim().slice(1))).parse();
      const v = evalExpr(expr);
      if (Array.isArray(v)) return { error: "#VALUE!" };
      if (typeof v === "number" && !Number.isFinite(v)) return { error: "#NUM!" };
      return v;
    } catch (e) {
      return { error: e instanceof FormulaError ? e.code : "#ERR!" };
    }
  }

  const out: Record<string, CellValue> = {};
  for (const key of Object.keys(data)) {
    if (data[key] && data[key].trim() !== "") out[key] = cell(key);
  }
  return out;
}

/** Text shown inside a grid cell. */
export function displayValue(v: CellValue | undefined): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return formatNumber(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (isCellError(v)) return v.error;
  return v;
}

/** True when the value should be right-aligned like a number. */
export function isNumeric(v: CellValue | undefined): boolean {
  return typeof v === "number" || typeof v === "boolean";
}
