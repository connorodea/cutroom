import { useRef, useState } from "react";
import { useEditorStore } from "../editor/store";
import { Icon } from "../components/Icon";
import { outputUrl, pollJob, submitRotateJob, type EditJob } from "./workerClient";

const ACCENT = "#5B9BD5";
const ORIENTATIONS: { label: string; value: string }[] = [
  { label: "Right 90°", value: "cw" },
  { label: "Left 90°", value: "ccw" },
  { label: "180°", value: "180" },
  { label: "Flip H", value: "flip-h" },
  { label: "Flip V", value: "flip-v" },
];
type Phase = "idle" | "submitting" | "running" | "done" | "error";

/** Rotate or flip an uploaded video (fix sideways footage / mirror). */
export function RotateModal() {
  const open = useEditorStore((s) => s.rotateOpen);
  const closeRotate = useEditorStore((s) => s.closeRotate);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [orientation, setOrientation] = useState("cw");
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<EditJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const busy = phase === "submitting" || phase === "running";
  const result = phase === "done" ? job?.result : undefined;
  const orientationLabel = ORIENTATIONS.find((o) => o.value === orientation)?.label ?? orientation;

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
    closeRotate();
  };

  const run = async () => {
    if (!file) return;
    setPhase("submitting");
    setError(null);
    try {
      const submitted = await submitRotateJob(file, { orientation });
      setJob(submitted);
      setPhase("running");
      const final = await pollJob(submitted.id, 2500);
      setJob(final);
      if (final.status === "done") setPhase("done");
      else {
        setError(final.error || "rotate failed");
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
          <div style={{ width: 30, height: 30, borderRadius: 12, background: "linear-gradient(150deg,#5B9BD5,#3B73A8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0C1012" }}>
            <Icon name="rotate-cw" size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Rotate</div>
            <div style={{ fontSize: 11, color: "#79797F" }}>Fix sideways footage or mirror your clip</div>
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
              style={{ border: `1.5px dashed ${dragOver ? ACCENT : "rgba(255,255,255,0.18)"}`, background: dragOver ? "rgba(91,155,213,0.06)" : "#161618", borderRadius: 14, padding: "44px 20px", textAlign: "center", cursor: "pointer" }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(91,155,213,0.12)", color: ACCENT }}>
                <Icon name="rotate-cw" size={24} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Drop a video here, or click to choose</div>
              <div style={{ fontSize: 12, color: "#79797F", marginTop: 5 }}>Rotate it upright or mirror it</div>
              <input ref={inputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {file && phase !== "done" && (
            <>
              <video src={previewUrl ?? undefined} controls style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 300 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#79797F", marginRight: 4 }}>Turn</span>
                {ORIENTATIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setOrientation(o.value)}
                    aria-pressed={orientation === o.value}
                    disabled={busy}
                    style={{ background: orientation === o.value ? ACCENT : "#161618", color: orientation === o.value ? "#0C1012" : "#C7C7CC", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer" }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#9A9AA0", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</span>
                {busy ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: ACCENT }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(91,155,213,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
                    {phase === "submitting" ? "Uploading…" : "Rotating…"}
                  </span>
                ) : (
                  <>
                    <button onClick={startOver} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, cursor: "pointer" }}>Change</button>
                    <button onClick={run} style={{ display: "flex", alignItems: "center", gap: 7, background: ACCENT, color: "#0C1012", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                      <Icon name="rotate-cw" size={14} />Rotate
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
                  <Icon name="circle-check-big" size={15} />{orientationLabel} applied
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
              Rotate failed: {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
