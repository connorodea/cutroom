/** Pexels stock video search — find a clip URL matching a query. */
export async function findClipUrl(
  query: string,
  orientation: "landscape" | "portrait" = "landscape",
): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5&orientation=${orientation}&size=medium`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) return null;
  const data = (await res.json()) as { videos?: { video_files?: { link: string; file_type: string; width: number; height: number }[] }[] };
  const videos = data.videos ?? [];
  // Pick the first matching video, then the mp4 file closest to 1280px wide.
  for (const v of videos) {
    const files = (v.video_files ?? []).filter((f) => f.file_type === "video/mp4" && f.width);
    if (!files.length) continue;
    files.sort((a, b) => Math.abs(a.width - 1280) - Math.abs(b.width - 1280));
    return files[0].link;
  }
  return null;
}
