import { useRef, useState } from "react";
import { useEditorStore } from "../editor/store";
import { Icon } from "../components/Icon";
import { outputUrl, pollJob, submitStitchJob, type EditJob } from "./workerClient";

const ACCENT = "#C57BD6";
type Phase = "idle" | "submitting" | "running" | "done" | "error";

/** Concatenate several uploaded clips into one video. */
export function StitchModal() {
  const open = useEditorStore((s) => s.stitchOpen);
  const closeStitch = useEditorStore((s) => s.closeStitch);

  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<EditJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const busy = phase === "submitting" || phase === "running";
  const result = phase === "done" ? job?.result : undefined;

  const addFiles = (list: FileList | null) => {
    const incoming = Array.from(list ?? []).filter((f) => f.type.startsWith("video/"));
    if (incoming.length) setFiles((prev) => [...prev, ...incoming]);
  };

  const reset = () => {
    setPhase("idle");
    setJob(null);
    setError(null);
  };

  const startOver = () => {
    reset();
    setFiles([]);
  };

  const close = () => {
    if (busy) return;
    startOver();
    closeStitch();
  };

  const run = async () => {
    if (files.length < 2) return;
    setPhase("submitting");
    setError(null);
    try {
      const submitted = await submitStitchJob(files);
      setJob(submitted);
      setPhase("running");
      const final = await pollJob(submitted.id, 2500);
      setJob(final);
      if (final.status === "done") setPhase("done");
      else {
        setError(final.error || "stitch failed");
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
          <div style={{ width: 30, height: 30, borderRadius: 12, background: "linear-gradient(150deg,#C57BD6,#9A50AC)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0C1012" }}>
            <Icon name="combine" size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Stitch</div>
            <div style={{ fontSize: 11, color: "#79797F" }}>Join several clips into one, in order</div>
          </div>
          {!busy && (
            <button onClick={close} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.10)", color: "#9A9AA0", borderRadius: 8, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          )}
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {files.length === 0 && phase !== "done" && (
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              style={{ border: `1.5px dashed ${dragOver ? ACCENT : "rgba(255,255,255,0.18)"}`, background: dragOver ? "rgba(197,123,214,0.06)" : "#161618", borderRadius: 14, padding: "44px 20px", textAlign: "center", cursor: "pointer" }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(197,123,214,0.12)", color: ACCENT }}>
                <Icon name="combine" size={24} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Drop a few videos here, or click to choose</div>
              <div style={{ fontSize: 12, color: "#79797F", marginTop: 5 }}>They join in the order you add them</div>
              <input ref={inputRef} type="file" accept="video/*" multiple style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />
            </div>
          )}

          {files.length > 0 && phase !== "done" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "#161618", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "9px 12px" }}>
                    <span style={{ fontSize: 11.5, color: "#636368", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", width: 18 }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                  </div>
                ))}
              </div>
              <input ref={inputRef} type="file" accept="video/*" multiple style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                {files.length < 2 && <span style={{ fontSize: 11.5, color: "#E0A33E" }}>Add at least one more clip</span>}
                <div style={{ flex: 1 }} />
                {busy ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: ACCENT }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(197,123,214,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
                    {phase === "submitting" ? "Uploading…" : "Stitching…"}
                  </span>
                ) : (
                  <>
                    <button onClick={() => inputRef.current?.click()} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, cursor: "pointer" }}>Add more</button>
                    <button onClick={startOver} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, cursor: "pointer" }}>Clear</button>
                    <button onClick={run} disabled={files.length < 2} style={{ display: "flex", alignItems: "center", gap: 7, background: files.length < 2 ? "#3A3A3D" : ACCENT, color: files.length < 2 ? "#79797F" : "#0C1012", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: files.length < 2 ? "default" : "pointer" }}>
                      <Icon name="combine" size={14} />Stitch {files.length} clips
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
                  <Icon name="circle-check-big" size={15} />Stitched {result.clips} clips
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
              Stitch failed: {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
