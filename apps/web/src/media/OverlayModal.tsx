import { useRef, useState } from "react";
import { useEditorStore } from "../editor/store";
import { Icon } from "../components/Icon";
import { submitOverlayJob, pollJob, outputUrl, type EditJob } from "./workerClient";
import {
  defaultElement,
  normalizeForSubmit,
  OVERLAY_TYPES,
  type BadgeCorner,
  type OverlaySpec,
  type OverlayType,
} from "./overlaySpec";

const ACCENT = "#4FD1C5";
type Phase = "idle" | "submitting" | "running" | "done" | "error";

const CORNERS: { value: BadgeCorner; label: string }[] = [
  { value: "tl", label: "Top left" },
  { value: "tr", label: "Top right" },
  { value: "bl", label: "Bottom left" },
  { value: "br", label: "Bottom right" },
];

const inputStyle: React.CSSProperties = {
  background: "#161618",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "6px 9px",
  color: "#F5F5F7",
  fontSize: 12.5,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

/** Overlay graphics: upload a video, add title/lower-third/callout/badge elements, composite via the worker. */
export function OverlayModal() {
  const open = useEditorStore((s) => s.overlayOpen);
  const closeOverlay = useEditorStore((s) => s.closeOverlay);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [elements, setElements] = useState<OverlaySpec[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<EditJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
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

  const clearFile = () => {
    setFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const reset = () => {
    setPhase("idle");
    setJob(null);
    setError(null);
  };

  const startOver = () => {
    reset();
    clearFile();
    setElements([]);
    setAddOpen(false);
  };

  const close = () => {
    if (busy) return;
    startOver();
    closeOverlay();
  };

  const addElement = (type: OverlayType) => {
    setElements((els) => [...els, defaultElement(type)]);
    setAddOpen(false);
  };

  const updateElement = (id: string, patch: Partial<OverlaySpec>) =>
    setElements((els) => els.map((el) => (el.id === id ? ({ ...el, ...patch } as OverlaySpec) : el)));

  const removeElement = (id: string) => setElements((els) => els.filter((el) => el.id !== id));

  const canSubmit = !!file && elements.length > 0 && !busy;

  const run = async () => {
    if (!file) return;
    const wire = normalizeForSubmit(elements);
    if (wire.length === 0) {
      setError("Add at least one element with text.");
      setPhase("error");
      return;
    }
    setPhase("submitting");
    setError(null);
    try {
      const submitted = await submitOverlayJob(file, wire);
      setJob(submitted);
      setPhase("running");
      const final = await pollJob(submitted.id, 2000);
      setJob(final);
      if (final.status === "done") setPhase("done");
      else {
        setError(final.error || "composite failed");
        setPhase("error");
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  };

  return (
    <div
      onClick={busy ? undefined : close}
      style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(10,10,12,.55)", backdropFilter: "blur(26px) saturate(1.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "9vh 24px 24px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 640, maxWidth: "100%", background: "rgba(28,28,30,0.9)", backdropFilter: "blur(50px) saturate(1.6)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "82vh", boxShadow: "0 30px 80px -20px rgba(0,0,0,.8)" }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 17px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ width: 30, height: 30, borderRadius: 12, background: "linear-gradient(150deg,#4FD1C5,#2E9C95)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0C1012" }}>
            <Icon name="layers" size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Overlay graphics</div>
            <div style={{ fontSize: 11, color: "#79797F" }}>Add titles, lower thirds, callouts &amp; badges — composited onto your video</div>
          </div>
          {!busy && (
            <button onClick={close} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.10)", color: "#9A9AA0", borderRadius: 8, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          )}
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {/* DROPZONE */}
          {!file && phase !== "done" && (
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0] ?? null); }}
              style={{ border: `1.5px dashed ${dragOver ? ACCENT : "rgba(255,255,255,0.18)"}`, background: dragOver ? "rgba(79,209,197,0.06)" : "#161618", borderRadius: 14, padding: "44px 20px", textAlign: "center", cursor: "pointer" }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(79,209,197,0.12)", color: ACCENT }}>
                <Icon name="upload" size={24} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Drop a video here, or click to choose</div>
              <div style={{ fontSize: 12, color: "#79797F", marginTop: 5 }}>Graphics are burned in at the times you set</div>
              <input ref={inputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {/* EDITOR (file chosen, not yet done) */}
          {file && phase !== "done" && (
            <>
              <video src={previewUrl ?? undefined} controls style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 280 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: "#9A9AA0", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</span>
                {!busy && (
                  <button onClick={() => { clearFile(); }} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "7px 12px", fontSize: 12, cursor: "pointer" }}>Change</button>
                )}
              </div>

              {/* element list */}
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {elements.map((el) => (
                  <ElementRow key={el.id} el={el} disabled={busy} onChange={(p) => updateElement(el.id, p)} onRemove={() => removeElement(el.id)} />
                ))}
                {elements.length === 0 && (
                  <div style={{ fontSize: 12, color: "#79797F", textAlign: "center", padding: "10px 0" }}>No graphics yet — add a title, lower third, callout or badge.</div>
                )}
              </div>

              {/* add control */}
              {!busy && (
                <div style={{ position: "relative", marginTop: 12 }}>
                  <button
                    onClick={() => setAddOpen((v) => !v)}
                    style={{ display: "flex", alignItems: "center", gap: 7, background: "#202022", border: "1px dashed rgba(255,255,255,0.18)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, color: "#D6D6DB", cursor: "pointer", width: "100%", justifyContent: "center" }}
                  >
                    <Icon name="plus" size={14} color={ACCENT} />Add graphic
                  </button>
                  {addOpen && (
                    <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, background: "rgba(34,34,36,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 5, display: "flex", flexDirection: "column", gap: 2, boxShadow: "0 18px 40px -16px rgba(0,0,0,.8)", zIndex: 2 }}>
                      {OVERLAY_TYPES.map((t) => (
                        <button key={t.type} onClick={() => addElement(t.type)} style={{ textAlign: "left", background: "transparent", border: "none", color: "#D6D6DB", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, cursor: "pointer" }}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* submit row */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
                <div style={{ flex: 1 }} />
                {busy ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: ACCENT }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(79,209,197,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
                    {phase === "submitting" ? "Uploading…" : "Compositing graphics…"}
                  </span>
                ) : (
                  <button
                    onClick={run}
                    disabled={!canSubmit}
                    style={{ display: "flex", alignItems: "center", gap: 7, background: canSubmit ? ACCENT : "#2A2A2C", color: canSubmit ? "#0C1012" : "#6A6A70", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 12.5, fontWeight: 600, cursor: canSubmit ? "pointer" : "default" }}
                  >
                    <Icon name="layers" size={14} />Composite
                  </button>
                )}
              </div>
            </>
          )}

          {/* RESULT */}
          {phase === "done" && result && (
            <>
              <video src={outputUrl(result.outputId)} controls autoPlay style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 340 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: ACCENT }}>
                  <Icon name="circle-check-big" size={15} />Done
                </span>
                <span style={{ fontSize: 11.5, color: "#9A9AA0", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>
                  {result.overlaysApplied ?? 0} graphic{(result.overlaysApplied ?? 0) === 1 ? "" : "s"} applied
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
              Overlay failed: {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** One editable overlay element row. Pure-presentational; lives with the modal. */
function ElementRow({
  el,
  disabled,
  onChange,
  onRemove,
}: {
  el: OverlaySpec;
  disabled: boolean;
  onChange: (patch: Partial<OverlaySpec>) => void;
  onRemove: () => void;
}) {
  const label = OVERLAY_TYPES.find((t) => t.type === el.type)?.label ?? el.type;
  const num = (v: string): number => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <div style={{ background: "#1B1B1D", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</span>
        <div style={{ flex: 1 }} />
        <button onClick={onRemove} disabled={disabled} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.10)", color: "#9A9AA0", borderRadius: 7, width: 22, height: 22, cursor: disabled ? "default" : "pointer", fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>

      <input
        value={el.text}
        disabled={disabled}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder={el.type === "badge" ? "Badge text (e.g. NEW)" : "Text"}
        style={{ ...inputStyle, width: "100%" }}
      />

      {(el.type === "title" || el.type === "lower_third") && (
        <input
          value={el.subtitle ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ subtitle: e.target.value } as Partial<OverlaySpec>)}
          placeholder="Subtitle (optional)"
          style={{ ...inputStyle, width: "100%", marginTop: 7 }}
        />
      )}

      {el.type === "callout" && (
        <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
          <label style={{ flex: 1, fontSize: 10.5, color: "#79797F", display: "flex", flexDirection: "column", gap: 3 }}>
            X (0–1)
            <input type="number" step="0.05" min={0} max={1} value={el.x} disabled={disabled} onChange={(e) => onChange({ x: num(e.target.value) } as Partial<OverlaySpec>)} style={{ ...inputStyle, width: "100%" }} />
          </label>
          <label style={{ flex: 1, fontSize: 10.5, color: "#79797F", display: "flex", flexDirection: "column", gap: 3 }}>
            Y (0–1)
            <input type="number" step="0.05" min={0} max={1} value={el.y} disabled={disabled} onChange={(e) => onChange({ y: num(e.target.value) } as Partial<OverlaySpec>)} style={{ ...inputStyle, width: "100%" }} />
          </label>
        </div>
      )}

      {el.type === "badge" && (
        <label style={{ fontSize: 10.5, color: "#79797F", display: "flex", flexDirection: "column", gap: 3, marginTop: 7 }}>
          Corner
          <select value={el.corner} disabled={disabled} onChange={(e) => onChange({ corner: e.target.value as BadgeCorner } as Partial<OverlaySpec>)} style={{ ...inputStyle, width: "100%" }}>
            {CORNERS.map((c) => (
              <option key={c.value} value={c.value} style={{ background: "#1B1B1D" }}>{c.label}</option>
            ))}
          </select>
        </label>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
        <label style={{ flex: 1, fontSize: 10.5, color: "#79797F", display: "flex", flexDirection: "column", gap: 3 }}>
          Start (s)
          <input type="number" step="0.5" min={0} value={el.start} disabled={disabled} onChange={(e) => onChange({ start: num(e.target.value) })} style={{ ...inputStyle, width: "100%" }} />
        </label>
        <label style={{ flex: 1, fontSize: 10.5, color: "#79797F", display: "flex", flexDirection: "column", gap: 3 }}>
          End (s)
          <input type="number" step="0.5" min={0} value={el.end} disabled={disabled} onChange={(e) => onChange({ end: num(e.target.value) })} style={{ ...inputStyle, width: "100%" }} />
        </label>
      </div>
    </div>
  );
}
