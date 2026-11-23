/** Every language the studio can write. Keep this list in sync with the generator and the UI. */
export type FileKey = "html" | "css" | "js" | "ts" | "json" | "md" | "py";

export const ALL_KEYS: FileKey[] = ["html", "css", "js", "ts", "json", "md", "py"];

/** The three languages that are wired together into the live preview. */
export const WEB_KEYS: FileKey[] = ["html", "css", "js"];

export interface LanguageInfo {
  /** File name shown in the explorer and tabs. */
  name: string;
  /** Display name. */
  label: string;
  /** Monaco editor language id (used for syntax colouring). */
  monaco: string;
  /** Logo colour. */
  color: string;
  /** Text colour drawn on top of the logo. */
  textColor: string;
  /** Short text drawn on the logo. */
  glyph: string;
  /** Web logos are drawn as a shield; the rest as rounded badges. */
  shield?: boolean;
  /** Whether the code runs in the live preview. */
  runsInPreview: boolean;
}

export const LANG: Record<FileKey, LanguageInfo> = {
  html: { name: "index.html", label: "HTML", monaco: "html", color: "#e34f26", textColor: "#ffffff", glyph: "5", shield: true, runsInPreview: true },
  css: { name: "styles.css", label: "CSS", monaco: "css", color: "#1572b6", textColor: "#ffffff", glyph: "3", shield: true, runsInPreview: true },
  js: { name: "script.js", label: "JavaScript", monaco: "javascript", color: "#f7df1e", textColor: "#000000", glyph: "JS", runsInPreview: true },
  ts: { name: "app.ts", label: "TypeScript", monaco: "typescript", color: "#3178c6", textColor: "#ffffff", glyph: "TS", runsInPreview: false },
  json: { name: "data.jsonl", label: "JSON Lines", monaco: "json", color: "#cbcb41", textColor: "#000000", glyph: "{}", runsInPreview: false },
  md: { name: "README.md", label: "Markdown", monaco: "markdown", color: "#519aba", textColor: "#ffffff", glyph: "MD", runsInPreview: false },
  py: { name: "main.py", label: "Python", monaco: "python", color: "#3572a5", textColor: "#ffd43b", glyph: "Py", runsInPreview: false },
};

export const STARTER_FILES: Record<FileKey, string> = {
  html:
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <title>My page</title>\n' +
    '  <link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n  <h1>Hello, Code Studio!</h1>\n' +
    "  <p>Describe a website in the AI panel, or start typing here.</p>\n" +
    '  <script src="script.js"></script>\n</body>\n</html>\n',
  css: "body {\n  font-family: system-ui, sans-serif;\n  margin: 40px;\n}\n",
  js: 'console.log("Hello from script.js");\n',
  ts: "// TypeScript module\n\nexport type Item = { id: number; title: string };\n",
  json: '{"id": 0, "note": "JSON Lines: one object per line"}\n',
  md: "# My project\n\nDescribe your project here.\n",
  py: "# Python helper\n\nprint(\"hello from main.py\")\n",
};

export function isFileKey(value: unknown): value is FileKey {
  return typeof value === "string" && (ALL_KEYS as string[]).includes(value);
}
