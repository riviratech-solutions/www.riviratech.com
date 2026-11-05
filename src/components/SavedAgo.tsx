import { savedAgoText, useSavedAt } from "../utils/listCache";

/* "Saved 3 min ago" under a list (bottom right, below its pagination): the list on screen is a
   saved copy (see utils/listCache.ts) and refresh loads it fresh. */
export default function SavedAgo({ endpoint }: { endpoint: string }) {
  const at = useSavedAt(endpoint);
  const text = savedAgoText(at);
  if (!text) return null;
  return (
    <span
      className="saved-ago"
      title={`Loaded ${new Date(at as number).toLocaleString()} — press refresh for the latest`}
      style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap", alignSelf: "center" }}
    >
      {text}
    </span>
  );
}
