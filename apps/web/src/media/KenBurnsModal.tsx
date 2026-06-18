import { useRef, useState } from "react";
import { useEditorStore } from "../editor/store";
import { Icon } from "../components/Icon";
import { outputUrl, pollJob, submitKenBurnsJob, type EditJob } from "./workerClient";

const ACCENT = "#E0A552";
const DIRECTIONS: { label: string; value: string }[] = [
  { label: "Zoom in", value: "in" },
  { label: "Zoom out", value: "out" },
  { label: "Pan left", value: "left" },
  { label: "Pan right", value: "right" },
];
const ASPECTS: { label: string; value: string }[] = [
  { label: "Wide", value: "landscape" },
  { label: "Tall", value: "portrait" },
  { label: "Square", value: "square" },
];
type Phase = "idle" | "submitting" | "running" | "done" | "error";

/** Ken Burns: animate an uploaded still image with a slow pan/zoom. */
export function KenBurnsModal() {
  const open = useEditorStore((s) => s.kenBurnsOpen);
  const closeKenBurns = useEditorStore((s) => s.closeKenBurns);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [direction, setDirection] = useState("in");
  const [aspect, setAspect] = useState("landscape");
  const [seconds, setSeconds] = useState("5");
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<EditJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const busy = phase === "submitting" || phase === "running";
  const result = phase === "done" ? job?.result : undefined;
  const dirLabel = DIRECTIONS.find((d) => d.value === direction)?.label ?? direction;

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
    closeKenBurns();
  };

  const run = async () => {
    if (!file) return;
    setPhase("submitting");
    setError(null);
    try {
      const submitted = await submitKenBurnsJob(file, { direction, aspect, seconds: parseFloat(seconds) || 5 });
      setJob(submitted);
      setPhase("running");
      const final = await pollJob(submitted.id, 2500);
      setJob(final);
      if (final.status === "done") setPhase("done");
      else {
        setError(final.error || "ken burns failed");
        setPhase("error");
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  };

  const chips = (options: { label: string; value: string }[], val: string, set: (v: string) => void) =>
    options.map((o) => (
      <button
        key={o.value}
        onClick={() => set(o.value)}
        aria-pressed={val === o.value}
        disabled={busy}
        style={{ background: val === o.value ? ACCENT : "#161618", color: val === o.value ? "#0C1012" : "#C7C7CC", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer" }}
      >
        {o.label}
      </button>
    ));

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
          <div style={{ width: 30, height: 30, borderRadius: 12, background: "linear-gradient(150deg,#E0A552,#B07A2E)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0C1012" }}>
            <Icon name="film" size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Ken Burns</div>
            <div style={{ fontSize: 11, color: "#79797F" }}>Animate a photo with a slow pan or zoom</div>
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
              style={{ border: `1.5px dashed ${dragOver ? ACCENT : "rgba(255,255,255,0.18)"}`, background: dragOver ? "rgba(224,165,82,0.06)" : "#161618", borderRadius: 14, padding: "44px 20px", textAlign: "center", cursor: "pointer" }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(224,165,82,0.12)", color: ACCENT }}>
                <Icon name="film" size={24} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Drop a photo here, or click to choose</div>
              <div style={{ fontSize: 12, color: "#79797F", marginTop: 5 }}>We animate the still into a moving clip</div>
              <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {file && phase !== "done" && (
            <>
              <img src={previewUrl ?? undefined} alt="" style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 300, objectFit: "contain" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#79797F", marginRight: 2 }}>Move</span>
                {chips(DIRECTIONS, direction, setDirection)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#79797F", marginRight: 2 }}>Shape</span>
                {chips(ASPECTS, aspect, setAspect)}
                <label style={{ fontSize: 12, color: "#79797F", display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
                  Seconds
                  <input aria-label="seconds" type="number" min={2} max={15} step={0.5} value={seconds} disabled={busy} onChange={(e) => setSeconds(e.target.value)} style={{ width: 64, background: "#161618", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#EDEDF0", padding: "6px 9px", fontSize: 12.5 }} />
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#9A9AA0", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</span>
                {busy ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: ACCENT }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(224,165,82,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
                    {phase === "submitting" ? "Uploading…" : "Animating…"}
                  </span>
                ) : (
                  <>
                    <button onClick={startOver} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, cursor: "pointer" }}>Change</button>
                    <button onClick={run} style={{ display: "flex", alignItems: "center", gap: 7, background: ACCENT, color: "#0C1012", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                      <Icon name="film" size={14} />Animate
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {phase === "done" && result && (
            <>
              <video src={outputUrl(result.outputId)} controls autoPlay loop style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 360 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: ACCENT }}>
                  <Icon name="circle-check-big" size={15} />{dirLabel} applied
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
              Ken Burns failed: {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
