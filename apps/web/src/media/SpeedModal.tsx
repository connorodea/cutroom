import { useRef, useState } from "react";
import { useEditorStore } from "../editor/store";
import { Icon } from "../components/Icon";
import { outputUrl, pollJob, submitSpeedJob, type EditJob } from "./workerClient";

const ACCENT = "#A78BFA";
const PRESETS = [0.5, 2, 4] as const;
type Phase = "idle" | "submitting" | "running" | "done" | "error";

/** Retime an uploaded video — slow-motion (<1) or timelapse (>1). */
export function SpeedModal() {
  const open = useEditorStore((s) => s.speedOpen);
  const closeSpeed = useEditorStore((s) => s.closeSpeed);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [factor, setFactor] = useState<number>(2);
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<EditJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const busy = phase === "submitting" || phase === "running";
  const result = phase === "done" ? job?.result : undefined;

  const pickFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  };

  const reset = () => {
    setPhase("idle");
    setJob(null);
    setError(null);
  };

  const startOver = () => {
    reset();
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFile(null);
  };

  const close = () => {
    if (busy) return;
    startOver();
    closeSpeed();
  };

  const run = async () => {
    if (!file) return;
    setPhase("submitting");
    setError(null);
    try {
      const submitted = await submitSpeedJob(file, { factor });
      setJob(submitted);
      setPhase("running");
      const final = await pollJob(submitted.id, 2500);
      setJob(final);
      if (final.status === "done") setPhase("done");
      else {
        setError(final.error || "speed change failed");
        setPhase("error");
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  };

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
          <div style={{ width: 30, height: 30, borderRadius: 12, background: "linear-gradient(150deg,#A78BFA,#7C5CD6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0C1012" }}>
            <Icon name="gauge" size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Speed</div>
            <div style={{ fontSize: 11, color: "#79797F" }}>Slow-motion or timelapse — retime your clip (audio follows)</div>
          </div>
          {!busy && (
            <button onClick={close} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.10)", color: "#9A9AA0", borderRadius: 8, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          )}
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {!file && phase !== "done" && (
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0] ?? null); }}
              style={{ border: `1.5px dashed ${dragOver ? ACCENT : "rgba(255,255,255,0.18)"}`, background: dragOver ? "rgba(167,139,250,0.06)" : "#161618", borderRadius: 14, padding: "44px 20px", textAlign: "center", cursor: "pointer" }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(167,139,250,0.12)", color: ACCENT }}>
                <Icon name="gauge" size={24} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Drop a video here, or click to choose</div>
              <div style={{ fontSize: 12, color: "#79797F", marginTop: 5 }}>We retime the video and audio together</div>
              <input ref={inputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {file && phase !== "done" && (
            <>
              <video src={previewUrl ?? undefined} controls style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 300 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                <span style={{ fontSize: 12, color: "#79797F" }}>Speed</span>
                <div style={{ display: "flex", gap: 4, padding: 3, background: "#161618", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setFactor(p)}
                      aria-pressed={factor === p}
                      disabled={busy}
                      style={{ background: factor === p ? ACCENT : "transparent", color: factor === p ? "#0C1012" : "#C7C7CC", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer" }}
                    >
                      {p}×
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 11.5, color: "#79797F" }}>{factor < 1 ? "slow-motion" : "timelapse"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#9A9AA0", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</span>
                {busy ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: ACCENT }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(167,139,250,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
                    {phase === "submitting" ? "Uploading…" : "Retiming…"}
                  </span>
                ) : (
                  <>
                    <button onClick={startOver} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, cursor: "pointer" }}>Change</button>
                    <button onClick={run} style={{ display: "flex", alignItems: "center", gap: 7, background: ACCENT, color: "#0C1012", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                      <Icon name="gauge" size={14} />Change speed
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
                  <Icon name="circle-check-big" size={15} />{result.factor}× {(result.factor ?? 1) < 1 ? "slower" : "faster"}
                </span>
                <span style={{ fontSize: 11.5, color: "#9A9AA0" }}>{result.hadAudio ? "audio retimed" : "no audio"}</span>
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
              Speed change failed: {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
