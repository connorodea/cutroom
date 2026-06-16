import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import {
  outputUrl,
  pollJob,
  submitTranscriptCut,
  transcribeVideo,
  type EditJob,
  type TranscriptWord,
} from "./workerClient";

const ACCENT = "#4FD1C5";
type Phase = "transcribing" | "editing" | "applying" | "done" | "error";

/** Descript-style transcript editing: strike words → they're cut from the video. */
export function TranscriptEditor({ file }: { file: File }) {
  const [phase, setPhase] = useState<Phase>("transcribing");
  const [words, setWords] = useState<TranscriptWord[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [job, setJob] = useState<EditJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = await transcribeVideo(file);
        if (!alive) return;
        setSourceId(t.sourceId);
        setWords(t.words);
        setPhase("editing");
      } catch (err) {
        if (!alive) return;
        setError((err as Error).message);
        setPhase("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [file]);

  const toggle = (i: number) =>
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const apply = async () => {
    setPhase("applying");
    setError(null);
    try {
      const submitted = await submitTranscriptCut(sourceId, [...removed], true);
      setJob(submitted);
      const final = await pollJob(submitted.id);
      setJob(final);
      if (final.status === "done") setPhase("done");
      else {
        setPhase("error");
        setError(final.error || "the edit failed");
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  };

  if (phase === "transcribing") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "30px 6px", color: "#9A9AA0", fontSize: 13 }}>
        <span style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(79,209,197,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
        Transcribing your video…
      </div>
    );
  }

  if (phase === "done" && job?.result) {
    return (
      <>
        <video src={outputUrl(job.result.outputId)} controls autoPlay style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 300 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: ACCENT }}>
            <Icon name="circle-check-big" size={15} />Applied
          </span>
          <span style={{ fontSize: 11.5, color: "#9A9AA0", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>
            −{job.result.removedSec}s · removed {removed.size} words
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={() => { setPhase("editing"); setJob(null); }} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, cursor: "pointer" }}>Keep editing</button>
          <a href={outputUrl(job.result.outputId)} download={`cutroom-${job.result.outputId}.mp4`} style={{ display: "flex", alignItems: "center", gap: 7, background: ACCENT, color: "#0C1012", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
            <Icon name="upload" size={14} />Download
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ fontSize: 11, color: "#79797F", marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>
        <Icon name="captions" size={13} color={ACCENT} />
        Click words to strike them — they'll be cut from the video.
      </div>
      <div style={{ maxHeight: 280, overflowY: "auto", background: "#161618", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", fontSize: 16.5, lineHeight: 2, color: "#D6D6DB" }}>
        {words.map((w, i) => {
          const cut = removed.has(i);
          return (
            <span
              key={i}
              onClick={() => toggle(i)}
              style={{ cursor: "pointer", padding: "1px 3px", borderRadius: 5, color: cut ? "#636368" : "#E7E9ED", textDecoration: cut ? "line-through" : "none", textDecorationColor: "#E0544E", textDecorationThickness: cut ? 2 : undefined, background: cut ? "transparent" : "transparent" }}
            >
              {w.word}{" "}
            </span>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <span style={{ fontSize: 11.5, color: "#79797F", flex: 1 }}>{words.length} words · {removed.size} struck</span>
        {phase === "applying" ? (
          <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: ACCENT }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(79,209,197,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
            Cutting &amp; rendering…
          </span>
        ) : (
          <button
            onClick={apply}
            disabled={removed.size === 0}
            style={{ display: "flex", alignItems: "center", gap: 7, background: removed.size === 0 ? "#2A2A2C" : ACCENT, color: removed.size === 0 ? "#636368" : "#0C1012", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: removed.size === 0 ? "default" : "pointer" }}
          >
            <Icon name="scissors" size={14} />Apply {removed.size > 0 ? `· cut ${removed.size}` : ""}
          </button>
        )}
      </div>
      {phase === "error" && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(224,80,78,0.10)", border: "1px solid rgba(224,80,78,0.3)", borderRadius: 10, fontSize: 12.5, color: "#F2A6A4" }}>
          {error}
        </div>
      )}
    </>
  );
}
