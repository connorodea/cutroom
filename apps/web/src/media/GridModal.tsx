import { useRef, useState } from "react";
import { useEditorStore } from "../editor/store";
import { Icon } from "../components/Icon";
import { outputUrl, pollJob, submitGridJob, type EditJob } from "./workerClient";

const ACCENT = "#56C2C2";
const LABELS = ["Top-left", "Top-right", "Bottom-left", "Bottom-right"];
type Phase = "idle" | "submitting" | "running" | "done" | "error";

/** Tile four clips into a 2×2 mosaic. */
export function GridModal() {
  const open = useEditorStore((s) => s.gridOpen);
  const closeGrid = useEditorStore((s) => s.closeGrid);

  const [files, setFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<EditJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  if (!open) return null;

  const busy = phase === "submitting" || phase === "running";
  const result = phase === "done" ? job?.result : undefined;
  const ready = files.every((f) => !!f);

  const setSlot = (i: number, f: File | null) => setFiles((prev) => prev.map((p, idx) => (idx === i ? f : p)));

  const reset = () => {
    setPhase("idle");
    setJob(null);
    setError(null);
  };

  const startOver = () => {
    reset();
    setFiles([null, null, null, null]);
  };

  const close = () => {
    if (busy) return;
    startOver();
    closeGrid();
  };

  const run = async () => {
    if (!ready) return;
    setPhase("submitting");
    setError(null);
    try {
      const submitted = await submitGridJob(files as File[]);
      setJob(submitted);
      setPhase("running");
      const final = await pollJob(submitted.id, 2500);
      setJob(final);
      if (final.status === "done") setPhase("done");
      else {
        setError(final.error || "grid failed");
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
          <div style={{ width: 30, height: 30, borderRadius: 12, background: "linear-gradient(150deg,#56C2C2,#2E8B8B)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0C1012" }}>
            <Icon name="grid-2x2" size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>2×2 grid</div>
            <div style={{ fontSize: 11, color: "#79797F" }}>Tile four clips into one frame</div>
          </div>
          {!busy && (
            <button onClick={close} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.10)", color: "#9A9AA0", borderRadius: 8, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          )}
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {phase !== "done" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {LABELS.map((label, i) => (
                  <div
                    key={label}
                    onClick={() => refs[i].current?.click()}
                    style={{ border: `1.5px dashed ${files[i] ? "rgba(86,194,194,0.5)" : "rgba(255,255,255,0.18)"}`, background: "#161618", borderRadius: 12, padding: "18px 12px", textAlign: "center", cursor: "pointer" }}
                  >
                    <Icon name={files[i] ? "circle-check-big" : "plus"} size={18} color={files[i] ? ACCENT : "#79797F"} />
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 5 }}>{label}</div>
                    <div style={{ fontSize: 10.5, color: "#79797F", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{files[i] ? files[i]!.name : "click to choose"}</div>
                    <input ref={refs[i]} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => setSlot(i, e.target.files?.[0] ?? null)} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                {!ready && <span style={{ fontSize: 11.5, color: "#E0A33E" }}>Add four clips to build the grid</span>}
                <div style={{ flex: 1 }} />
                {busy ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: ACCENT }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(86,194,194,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
                    {phase === "submitting" ? "Uploading…" : "Tiling…"}
                  </span>
                ) : (
                  <>
                    <button onClick={startOver} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, cursor: "pointer" }}>Clear</button>
                    <button onClick={run} disabled={!ready} style={{ display: "flex", alignItems: "center", gap: 7, background: ready ? ACCENT : "#3A3A3D", color: ready ? "#0C1012" : "#79797F", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: ready ? "pointer" : "default" }}>
                      <Icon name="grid-2x2" size={14} />Build grid
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
                  <Icon name="circle-check-big" size={15} />Grid ready
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
              Grid failed: {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
