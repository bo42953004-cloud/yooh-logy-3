import { LANG, type FileKey } from "@/lib/studio/languages";

/** Language logo: a shield for HTML/CSS, a coloured badge for the rest. */
export function FileIcon({ k, size = 16 }: { k: FileKey; size?: number }) {
  const info = LANG[k];
  if (info.shield) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
        <path d="M2 1h12l-1.2 12.4L8 15l-4.8-1.6L2 1z" fill={info.color} />
        <text x="8" y="10.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill={info.textColor} fontFamily="system-ui, sans-serif">
          {info.glyph}
        </text>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <rect x="1" y="1" width="14" height="14" rx="3" fill={info.color} />
      <text
        x="8"
        y="11"
        textAnchor="middle"
        fontSize={info.glyph.length > 2 ? 5.2 : 7}
        fontWeight="800"
        fill={info.textColor}
        fontFamily="system-ui, sans-serif"
      >
        {info.glyph}
      </text>
    </svg>
  );
}

export type ActivityName =
  | "explorer"
  | "search"
  | "ai"
  | "preview"
  | "output"
  | "run"
  | "fullscreen"
  | "panel"
  | "sidebar";

const PATHS: Record<ActivityName, string[]> = {
  explorer: ["M7 3h7l4 4v13H7z", "M4 7v13h10"],
  search: ["M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z", "M15.5 15.5L20 20"],
  ai: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", "M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"],
  preview: ["M3 5h18v11H3z", "M8 20h8", "M12 16v4"],
  output: ["M4 6h16", "M4 12h16", "M4 18h10"],
  run: ["M13 2L4 14h7l-1 8 9-12h-7z"],
  fullscreen: ["M4 9V4h5", "M20 9V4h-5", "M4 15v5h5", "M20 15v5h-5"],
  panel: ["M3 4h18v16H3z", "M3 14h18"],
  sidebar: ["M3 4h18v16H3z", "M9 4v16"],
};

/** Line icons used in the activity bar and title bar. */
export function ActivityIcon({ name, size = 24 }: { name: ActivityName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
