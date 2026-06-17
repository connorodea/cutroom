import { useState } from "react";
import { useEditorStore } from "../editor/store";
import { Icon } from "../components/Icon";
import { submitCreateJob, pollJob, outputUrl, type EditJob } from "./workerClient";

const ACCENT = "#4FD1C5";
type Phase = "idle" | "submitting" | "running" | "done" | "error";

/** AI Create: a prompt → narration script → footage + voiceover + captions + graphics → MP4. */
export function CreateModal() {
  const open = useEditorStore((s) => s.createOpen);
  const closeCreate = useEditorStore((s) => s.closeCreate);

  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<"landscape" | "portrait">("landscape");
  const [source, setSource] = useState<"stock" | "generative">("stock");
  const [captions, setCaptions] = useState(true);
  const [graphics, setGraphics] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<EditJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const busy = phase === "submitting" || phase === "running";
  const result = phase === "done" ? job?.result : undefined;

  const reset = () => {
    setPhase("idle");
    setJob(null);
    setError(null);
  };

  const close = () => {
    if (busy) return;
    reset();
    setPrompt("");
    closeCreate();
  };

  const run = async () => {
    if (!prompt.trim()) return;
    setPhase("submitting");
    setError(null);
    try {
      const submitted = await submitCreateJob({ prompt: prompt.trim(), aspect, source, captions, autoGraphics: graphics });
      setJob(submitted);
      setPhase("running");
      const final = await pollJob(submitted.id, 2500);
      setJob(final);
      if (final.status === "done") setPhase("done");
      else {
        setError(final.error || "render failed");
        setPhase("error");
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  };

  const seg = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "7px 10px",
    borderRadius: 8,
    fontSize: 12.5,
    textAlign: "center",
    cursor: "pointer",
    color: active ? "#0A0A0B" : "#9A9AA0",
    background: active ? ACCENT : "transparent",
    fontWeight: active ? 600 : 400,
  });
  const segWrap: React.CSSProperties = { display: "flex", gap: 3, background: "#161618", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 11, padding: 3 };
  const toggle = (on: boolean, set: (v: boolean) => void, label: string) => (
    <button
      onClick={() => set(!on)}
      style={{ display: "flex", alignItems: "center", gap: 7, background: on ? "rgba(79,209,197,0.10)" : "#161618", border: `1px solid ${on ? "rgba(79,209,197,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "8px 12px", fontSize: 12.5, color: on ? ACCENT : "#9A9AA0", cursor: "pointer" }}
    >
      <span style={{ width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${on ? ACCENT : "#5A5A60"}`, background: on ? ACCENT : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {on && <Icon name="check" size={10} color="#0A0A0B" />}
      </span>
      {label}
    </button>
  );

  return (
    <div
      onClick={close}
      style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(10,10,12,.55)", backdropFilter: "blur(26px) saturate(1.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "9vh 24px 24px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 640, maxWidth: "100%", background: "rgba(28,28,30,0.9)", backdropFilter: "blur(50px) saturate(1.6)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "82vh", boxShadow: "0 30px 80px -20px rgba(0,0,0,.8)" }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 17px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ width: 30, height: 30, borderRadius: 12, background: "linear-gradient(150deg,#4FD1C5,#2E9C95)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0C1012" }}>
            <Icon name="wand-2" size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Create with AI</div>
            <div style={{ fontSize: 11, color: "#79797F" }}>A prompt → script, footage, voiceover, captions &amp; graphics — a finished video</div>
          </div>
          {!busy && (
            <button onClick={close} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.10)", color: "#9A9AA0", borderRadius: 8, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          )}
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {phase !== "done" && (
            <>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={busy}
                placeholder="Describe the video. e.g. “a 15-second teaser for an AI video editor called Cutroom”"
                style={{ width: "100%", minHeight: 92, resize: "vertical", background: "#161618", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 14px", color: "#F5F5F7", fontSize: 13.5, lineHeight: 1.45, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#79797F", marginBottom: 6 }}>Aspect</div>
                  <div style={segWrap}>
                    <span onClick={() => !busy && setAspect("landscape")} style={seg(aspect === "landscape")}>16:9</span>
                    <span onClick={() => !busy && setAspect("portrait")} style={seg(aspect === "portrait")}>9:16</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#79797F", marginBottom: 6 }}>Footage</div>
                  <div style={segWrap}>
                    <span onClick={() => !busy && setSource("stock")} style={seg(source === "stock")}>Stock</span>
                    <span onClick={() => !busy && setSource("generative")} style={seg(source === "generative")}>Generative</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                {toggle(captions, setCaptions, "Captions")}
                {toggle(graphics, setGraphics, "AI graphics")}
              </div>

              {source === "generative" && (
                <div style={{ marginTop: 12, padding: "9px 12px", background: "rgba(254,188,46,0.08)", border: "1px solid rgba(254,188,46,0.25)", borderRadius: 10, fontSize: 11.5, color: "#E7C06A" }}>
                  Generative footage uses Higgsfield and requires account credits; it falls back to stock if unavailable.
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
                <div style={{ flex: 1 }} />
                {busy ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: ACCENT }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(79,209,197,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
                    {phase === "submitting" ? "Starting…" : job?.step || "Scripting · footage · voiceover · captions · graphics…"}
                  </span>
                ) : (
                  <button
                    onClick={run}
                    disabled={!prompt.trim()}
                    style={{ display: "flex", alignItems: "center", gap: 7, background: prompt.trim() ? ACCENT : "#2A2A2C", color: prompt.trim() ? "#0C1012" : "#6A6A70", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 12.5, fontWeight: 600, cursor: prompt.trim() ? "pointer" : "default" }}
                  >
                    <Icon name="wand-2" size={14} />Generate
                  </button>
                )}
              </div>
            </>
          )}

          {phase === "done" && result && (
            <>
              <video src={outputUrl(result.outputId)} controls autoPlay style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 340 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: ACCENT }}>
                  <Icon name="circle-check-big" size={15} />Done
                </span>
                <span style={{ fontSize: 11.5, color: "#9A9AA0", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>
                  {result.durationSec}s · {result.segments} scenes
                  {result.usedGenerative ? ` · ${result.usedGenerative} generative` : result.usedStock ? ` · ${result.usedStock} stock` : ""}
                  {result.overlaysApplied ? ` · ${result.overlaysApplied} graphics` : ""}
                  {result.captionsApplied ? " · captions" : ""}
                </span>
                <div style={{ flex: 1 }} />
                <button onClick={reset} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, cursor: "pointer" }}>New</button>
                <a href={outputUrl(result.outputId)} download={`cutroom-${result.outputId}.mp4`} style={{ display: "flex", alignItems: "center", gap: 7, background: ACCENT, color: "#0C1012", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
                  <Icon name="upload" size={14} />Download
                </a>
              </div>
            </>
          )}

          {phase === "error" && (
            <div style={{ marginTop: 14, padding: "11px 13px", background: "rgba(224,80,78,0.10)", border: "1px solid rgba(224,80,78,0.3)", borderRadius: 10, fontSize: 12.5, color: "#F2A6A4" }}>
              Create failed: {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
