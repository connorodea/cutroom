import { useRef, useState } from "react";
import { useEditorStore } from "../editor/store";
import { Icon } from "../components/Icon";
import { outputUrl, pollJob, submitSplitJob, type EditJob } from "./workerClient";

const ACCENT = "#A77BD6";
const LAYOUTS: { label: string; value: string }[] = [
  { label: "Side by side", value: "horizontal" },
  { label: "Stacked", value: "vertical" },
];
type Phase = "idle" | "submitting" | "running" | "done" | "error";

/** Place two clips side-by-side or stacked (split-screen). */
export function SplitModal() {
  const open = useEditorStore((s) => s.splitOpen);
  const closeSplit = useEditorStore((s) => s.closeSplit);

  const [left, setLeft] = useState<File | null>(null);
  const [right, setRight] = useState<File | null>(null);
  const [layout, setLayout] = useState("horizontal");
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<EditJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const leftRef = useRef<HTMLInputElement>(null);
  const rightRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const busy = phase === "submitting" || phase === "running";
  const result = phase === "done" ? job?.result : undefined;
  const ready = !!left && !!right;
  const isVertical = layout === "vertical";

  const reset = () => {
    setPhase("idle");
    setJob(null);
    setError(null);
  };

  const startOver = () => {
    reset();
    setLeft(null);
    setRight(null);
  };

  const close = () => {
    if (busy) return;
    startOver();
    closeSplit();
  };

  const run = async () => {
    if (!ready) return;
    setPhase("submitting");
    setError(null);
    try {
      const submitted = await submitSplitJob(left, right, { layout });
      setJob(submitted);
      setPhase("running");
      const final = await pollJob(submitted.id, 2500);
      setJob(final);
      if (final.status === "done") setPhase("done");
      else {
        setError(final.error || "split-screen failed");
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
      style={{ flex: 1, minWidth: 0, border: `1.5px dashed ${file ? "rgba(167,123,214,0.5)" : "rgba(255,255,255,0.18)"}`, background: "#161618", borderRadius: 12, padding: "20px 14px", textAlign: "center", cursor: "pointer" }}
    >
      <Icon name={file ? "circle-check-big" : "plus"} size={20} color={file ? ACCENT : "#79797F"} />
      <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#79797F", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file ? file.name : "click to choose"}</div>
      <input ref={ref} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
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
          <div style={{ width: 30, height: 30, borderRadius: 12, background: "linear-gradient(150deg,#A77BD6,#7B50AC)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0C1012" }}>
            <Icon name="columns-2" size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Split-screen</div>
            <div style={{ fontSize: 11, color: "#79797F" }}>Show two clips side by side or stacked</div>
          </div>
          {!busy && (
            <button onClick={close} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.10)", color: "#9A9AA0", borderRadius: 8, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          )}
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {phase !== "done" && (
            <>
              <div style={{ display: "flex", gap: 12 }}>
                {slot(isVertical ? "Top clip" : "Left clip", left, setLeft, leftRef)}
                {slot(isVertical ? "Bottom clip" : "Right clip", right, setRight, rightRef)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#79797F", marginRight: 2 }}>Layout</span>
                {LAYOUTS.map((l) => (
                  <button key={l.value} onClick={() => setLayout(l.value)} aria-pressed={layout === l.value} disabled={busy} style={chip(layout === l.value)}>{l.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                {!ready && <span style={{ fontSize: 11.5, color: "#E0A33E" }}>Add two clips to combine</span>}
                <div style={{ flex: 1 }} />
                {busy ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: ACCENT }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(167,123,214,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
                    {phase === "submitting" ? "Uploading…" : "Combining…"}
                  </span>
                ) : (
                  <>
                    <button onClick={startOver} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, cursor: "pointer" }}>Clear</button>
                    <button onClick={run} disabled={!ready} style={{ display: "flex", alignItems: "center", gap: 7, background: ready ? ACCENT : "#3A3A3D", color: ready ? "#0C1012" : "#79797F", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: ready ? "pointer" : "default" }}>
                      <Icon name="columns-2" size={14} />Combine
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
                  <Icon name="circle-check-big" size={15} />Split-screen ready
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
              Split-screen failed: {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
