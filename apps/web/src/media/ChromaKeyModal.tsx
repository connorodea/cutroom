import { useRef, useState } from "react";
import { useEditorStore } from "../editor/store";
import { Icon } from "../components/Icon";
import { outputUrl, pollJob, submitChromaKeyJob, type EditJob } from "./workerClient";

const ACCENT = "#5BD17A";
const COLORS: { label: string; value: string }[] = [
  { label: "Green", value: "green" },
  { label: "Blue", value: "blue" },
];
type Phase = "idle" | "submitting" | "running" | "done" | "error";

/** Chroma key: key a screen color out of a green-screen clip and composite it over a backdrop. */
export function ChromaKeyModal() {
  const open = useEditorStore((s) => s.chromaKeyOpen);
  const closeChromaKey = useEditorStore((s) => s.closeChromaKey);

  const [subject, setSubject] = useState<File | null>(null);
  const [background, setBackground] = useState<File | null>(null);
  const [color, setColor] = useState("green");
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<EditJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const backgroundRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const busy = phase === "submitting" || phase === "running";
  const result = phase === "done" ? job?.result : undefined;
  const ready = !!subject && !!background;

  const reset = () => {
    setPhase("idle");
    setJob(null);
    setError(null);
  };

  const startOver = () => {
    reset();
    setSubject(null);
    setBackground(null);
  };

  const close = () => {
    if (busy) return;
    startOver();
    closeChromaKey();
  };

  const run = async () => {
    if (!ready) return;
    setPhase("submitting");
    setError(null);
    try {
      const submitted = await submitChromaKeyJob(subject, background, { color });
      setJob(submitted);
      setPhase("running");
      const final = await pollJob(submitted.id, 2500);
      setJob(final);
      if (final.status === "done") setPhase("done");
      else {
        setError(final.error || "chroma key failed");
        setPhase("error");
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  };

  const chip = (active: boolean) => ({
    background: active ? ACCENT : "#161618", color: active ? "#0C1012" : "#C7C7CC",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600,
    cursor: busy ? "default" : "pointer",
  } as const);

  const slot = (label: string, file: File | null, onPick: (f: File | null) => void, ref: React.RefObject<HTMLInputElement | null>) => (
    <div
      onClick={() => ref.current?.click()}
      style={{ flex: 1, minWidth: 0, border: `1.5px dashed ${file ? "rgba(91,209,122,0.5)" : "rgba(255,255,255,0.18)"}`, background: "#161618", borderRadius: 12, padding: "20px 14px", textAlign: "center", cursor: "pointer" }}
    >
      <Icon name={file ? "circle-check-big" : "plus"} size={20} color={file ? ACCENT : "#79797F"} />
      <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#79797F", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file ? file.name : "click to choose"}</div>
      <input ref={ref} type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
    </div>
  );

  return (
    <div
      onClick={close}
      style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(10,10,12,.55)", backdropFilter: "blur(26px) saturate(1.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "9vh 24px 24px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 600, maxWidth: "100%", background: "rgba(28,28,30,0.9)", backdropFilter: "blur(50px) saturate(1.6)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "82vh", boxShadow: "0 30px 80px -20px rgba(0,0,0,.8)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 17px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ width: 30, height: 30, borderRadius: 12, background: "linear-gradient(150deg,#5BD17A,#2F9B4E)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0C1012" }}>
            <Icon name="wand-2" size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Green screen</div>
            <div style={{ fontSize: 11, color: "#79797F" }}>Key out the screen and drop in a new background</div>
          </div>
          {!busy && (
            <button onClick={close} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.10)", color: "#9A9AA0", borderRadius: 8, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          )}
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {phase !== "done" && (
            <>
              <div style={{ display: "flex", gap: 12 }}>
                {slot("Green-screen clip", subject, setSubject, subjectRef)}
                {slot("Background", background, setBackground, backgroundRef)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#79797F", marginRight: 2 }}>Screen color</span>
                {COLORS.map((cOpt) => (
                  <button key={cOpt.value} onClick={() => setColor(cOpt.value)} aria-pressed={color === cOpt.value} disabled={busy} style={chip(color === cOpt.value)}>{cOpt.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                {!ready && <span style={{ fontSize: 11.5, color: "#E0A33E" }}>Add a green-screen clip and a background</span>}
                <div style={{ flex: 1 }} />
                {busy ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: ACCENT }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(91,209,122,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
                    {phase === "submitting" ? "Uploading…" : "Keying…"}
                  </span>
                ) : (
                  <>
                    <button onClick={startOver} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, cursor: "pointer" }}>Clear</button>
                    <button onClick={run} disabled={!ready} style={{ display: "flex", alignItems: "center", gap: 7, background: ready ? ACCENT : "#3A3A3D", color: ready ? "#0C1012" : "#79797F", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: ready ? "pointer" : "default" }}>
                      <Icon name="wand-2" size={14} />Key out
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {phase === "done" && result && (
            <>
              <video src={outputUrl(result.outputId)} controls autoPlay style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 360 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: ACCENT }}>
                  <Icon name="circle-check-big" size={15} />Background replaced
                </span>
                <div style={{ flex: 1 }} />
                <button onClick={startOver} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, cursor: "pointer" }}>Start over</button>
                <a href={outputUrl(result.outputId)} download={`cutroom-${result.outputId}.mp4`} style={{ display: "flex", alignItems: "center", gap: 7, background: ACCENT, color: "#0C1012", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
                  <Icon name="upload" size={14} />Download
                </a>
              </div>
            </>
          )}

          {phase === "error" && (
            <div style={{ marginTop: 14, padding: "11px 13px", background: "rgba(224,80,78,0.10)", border: "1px solid rgba(224,80,78,0.3)", borderRadius: 10, fontSize: 12.5, color: "#F2A6A4" }}>
              Green screen failed: {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
