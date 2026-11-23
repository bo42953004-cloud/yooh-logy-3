import { type FileKey } from "./languages";

export type SnippetLanguage = FileKey;

const STOP_WORDS = new Set([
  "make", "build", "create", "website", "site", "page", "with", "that", "this", "for", "the",
  "and", "a", "an", "my", "our", "please", "write", "code", "modern", "beautiful", "attractive",
  "simple", "web", "some", "about",
]);

/** Picks a short identifier-safe word from the prompt, used to name generated code. */
export function themeFromPrompt(prompt: string): string {
  const words = (prompt.toLowerCase().match(/[a-z]+/g) ?? []).filter(
    (w) => w.length > 2 && !STOP_WORDS.has(w),
  );
  return words[0] ?? "app";
}

function pascal(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Each block number N produces matching code for its language. For HTML, CSS and JS the
 * numbers line up across files: a <section class="{theme}-card-N">, its animated CSS rule, and a
 * script that fills the card. Every block ends with a blank line so deletions snap to whole blocks.
 */
function block(language: FileKey, theme: string, n: number): string[] {
  const title = pascal(theme);
  const cls = `${theme}-card-${n}`;
  const hue = (n * 37) % 360;

  switch (language) {
    case "html":
      return [
        `<section class="${cls}">`,
        `  <h3>${title} #${n}</h3>`,
        `  <p>Auto-written block ${n} for ${theme}. The CSS styles it and the script fills the score.</p>`,
        `  <button type="button">Recompute</button>`,
        `  <output>…</output>`,
        `</section>`,
        ``,
      ];

    case "css":
      return [
        `/* ${title} card ${n} */`,
        `@keyframes ${theme}-in-${n} {`,
        `  from { opacity: 0; transform: translateY(18px) scale(0.97); }`,
        `  to { opacity: 1; transform: none; }`,
        `}`,
        `.${cls} {`,
        `  display: flex;`,
        `  flex-wrap: wrap;`,
        `  align-items: center;`,
        `  gap: 12px;`,
        `  margin: 12px auto;`,
        `  max-width: 720px;`,
        `  padding: ${14 + (n % 5) * 4}px 20px;`,
        `  border-left: 6px solid hsl(${hue} 80% 45%);`,
        `  border-radius: ${6 + (n % 5) * 2}px;`,
        `  background: hsl(${hue} 70% ${92 - (n % 4) * 3}%);`,
        `  color: hsl(${hue} 50% 18%);`,
        `  font-family: system-ui, sans-serif;`,
        `  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);`,
        `  animation: ${theme}-in-${n} 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) ${(n % 6) * 80}ms both;`,
        `  transition: transform 0.3s ease, box-shadow 0.3s ease;`,
        `}`,
        `.${cls}:hover { transform: translateY(-3px); box-shadow: 0 14px 28px rgba(0, 0, 0, 0.14); }`,
        `.${cls} h3 { margin: 0; flex: 1 1 100%; font-size: 1.05rem; }`,
        `.${cls} p { margin: 0; flex: 1 1 240px; font-size: 0.9rem; opacity: 0.85; }`,
        `.${cls} button { border: 0; border-radius: 999px; padding: 6px 14px; background: hsl(${hue} 80% 40%); color: #fff; cursor: pointer; }`,
        `.${cls} output { font-weight: 700; font-variant-numeric: tabular-nums; }`,
        `.${cls}.active { outline: 2px solid hsl(${hue} 80% 45%); }`,
        ``,
      ];

    case "js":
      return [
        `// ${title} card ${n}: compute a score and show it in the card`,
        `(function () {`,
        `  var card = document.querySelector('.${cls}');`,
        `  if (!card) return;`,
        `  var out = card.querySelector('output');`,
        `  var button = card.querySelector('button');`,
        `  var items = [${n}, ${(n * 3) % 17}, ${(n * 7) % 23}, ${(n % 9) + 2}];`,
        `  function score() {`,
        `    var total = 0;`,
        `    for (var i = 0; i < items.length; i++) total += items[i] * ${(n % 5) + 1};`,
        `    return (total / items.length + Math.random() * ${(n % 4) + 1}).toFixed(2);`,
        `  }`,
        `  function render() { if (out) out.textContent = 'score ' + score(); card.classList.toggle('active'); }`,
        `  if (button) button.addEventListener('click', render);`,
        `  render();`,
        `})();`,
        ``,
      ];

    case "ts":
      return [
        `// ${title} card ${n}: typed data helper`,
        `export interface ${title}Item${n} {`,
        `  id: number;`,
        `  title: string;`,
        `  score: number;`,
        `}`,
        ``,
        `export function rank${title}${n}(items: ${title}Item${n}[]): ${title}Item${n}[] {`,
        `  return [...items].sort((a, b) => b.score - a.score).slice(0, ${(n % 5) + 3});`,
        `}`,
        ``,
      ];

    case "json":
      return [
        `{"id": ${n}, "card": "${cls}", "title": "${title} item ${n}", "score": ${(n * 13) % 100}, "tags": ["${theme}", "card-${n}"]}`,
        ``,
      ];

    case "md":
      return [
        `## ${title} note ${n}`,
        ``,
        `A short automatic note about ${theme} number ${n}.`,
        ``,
        `- point one for note ${n}`,
        `- point two for note ${n}`,
        ``,
      ];

    case "py":
      return [
        `def ${theme}_task_${n}(values):`,
        `    """Scaled total for block ${n}."""`,
        `    return sum(values) * ${(n % 7) + 1}`,
        ``,
      ];
  }
}

/** Returns whole blocks until at least `count` lines are produced (never cuts a block in half). */
export function snippetLines(language: SnippetLanguage, prompt: string, count: number, startSeq: number): string[] {
  const theme = themeFromPrompt(prompt);
  const out: string[] = [];
  let n = startSeq;
  while (out.length < count) {
    out.push(...block(language, theme, n));
    n++;
  }
  return out;
}

/** Lines in one block of the given language. */
export function blockSize(language: SnippetLanguage): number {
  return block(language, "x", 1).length;
}

/** Number of blocks `snippetLines` emits for the given request (used to advance counters). */
export function blocksFor(language: SnippetLanguage, count: number): number {
  return Math.ceil(count / blockSize(language));
}

/** Total lines of one matching card across HTML, CSS and JS. */
export const LINES_PER_CARD = blockSize("html") + blockSize("css") + blockSize("js");
