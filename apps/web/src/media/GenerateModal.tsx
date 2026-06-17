import { useState } from "react";
import { useEditorStore } from "../editor/store";
import { Icon } from "../components/Icon";
import { submitImageGenJob, submitVideoGenJob, pollJob, outputUrl, type EditJob } from "./workerClient";

const ACCENT = "#4FD1C5";
type Phase = "idle" | "submitting" | "running" | "done" | "error";
type Mode = "image" | "video";
type Aspect = "16:9" | "9:16";
type ImageModel = "soul" | "reve";
type VideoModel = "dop" | "kling" | "seedance";

const IMAGE_MODELS: { id: ImageModel; label: string }[] = [
  { id: "soul", label: "Soul" },
  { id: "reve", label: "Reve" },
];
const VIDEO_MODELS: { id: VideoModel; label: string }[] = [
  { id: "dop", label: "DoP" },
  { id: "kling", label: "Kling" },
  { id: "seedance", label: "Seedance" },
];

/** Generate: a text prompt → a Higgsfield image or video clip, previewed & downloadable. */
export function GenerateModal() {
  const open = useEditorStore((s) => s.generateOpen);
  const closeGenerate = useEditorStore((s) => s.closeGenerate);
  const addCreatedOutput = useEditorStore((s) => s.addCreatedOutput);

  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [imageModel, setImageModel] = useState<ImageModel>("soul");
  const [videoModel, setVideoModel] = useState<VideoModel>("dop");
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<EditJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const busy = phase === "submitting" || phase === "running";
  const result = phase === "done" ? job?.result : undefined;
  const resultKind: Mode = result?.kind || mode;

  const reset = () => {
    setPhase("idle");
    setJob(null);
    setError(null);
  };

  const close = () => {
    if (busy) return;
    reset();
    setPrompt("");
    closeGenerate();
  };

  const run = async () => {
    const p = prompt.trim();
    if (!p) return;
    setPhase("submitting");
    setError(null);
    try {
      const submitted =
        mode === "image"
          ? await submitImageGenJob({ prompt: p, aspect, model: imageModel })
          : await submitVideoGenJob({ prompt: p, aspect, model: videoModel });
      setJob(submitted);
      setPhase("running");
      const final = await pollJob(submitted.id, 2500);
      setJob(final);
      if (final.status === "done") {
        // Videos become library outputs; images are previewed/downloaded only.
        if (final.result && (final.result.kind || mode) === "video") addCreatedOutput(final.result.outputId);
        setPhase("done");
      } else {
        setError(final.error || "generation failed");
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
    cursor: busy ? "default" : "pointer",
    color: active ? "#0A0A0B" : "#9A9AA0",
    background: active ? ACCENT : "transparent",
    fontWeight: active ? 600 : 400,
  });
  const segWrap: React.CSSProperties = { display: "flex", gap: 3, background: "#161618", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 11, padding: 3 };

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
            <Icon name="sparkles" size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Generate</div>
            <div style={{ fontSize: 11, color: "#79797F" }}>A prompt → an AI image or video clip, powered by Higgsfield</div>
          </div>
          {!busy && (
            <button onClick={close} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.10)", color: "#9A9AA0", borderRadius: 8, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          )}
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {phase !== "done" && (
            <>
              {/* mode toggle */}
              <div style={segWrap}>
                <span onClick={() => !busy && setMode("image")} style={seg(mode === "image")}>Image</span>
                <span onClick={() => !busy && setMode("video")} style={seg(mode === "video")}>Video</span>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={busy}
                placeholder={mode === "image" ? "Describe the image. e.g. “a neon-lit control room, cinematic, wide”" : "Describe the clip. e.g. “a drone shot pulling back over a foggy coastline”"}
                style={{ width: "100%", minHeight: 92, resize: "vertical", background: "#161618", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 14px", color: "#F5F5F7", fontSize: 13.5, lineHeight: 1.45, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginTop: 12 }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#79797F", marginBottom: 6 }}>Aspect</div>
                  <div style={segWrap}>
                    <span onClick={() => !busy && setAspect("16:9")} style={seg(aspect === "16:9")}>16:9</span>
                    <span onClick={() => !busy && setAspect("9:16")} style={seg(aspect === "9:16")}>9:16</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#79797F", marginBottom: 6 }}>Model</div>
                  <div style={segWrap}>
                    {mode === "image"
                      ? IMAGE_MODELS.map((m) => (
                          <span key={m.id} onClick={() => !busy && setImageModel(m.id)} style={seg(imageModel === m.id)}>{m.label}</span>
                        ))
                      : VIDEO_MODELS.map((m) => (
                          <span key={m.id} onClick={() => !busy && setVideoModel(m.id)} style={seg(videoModel === m.id)}>{m.label}</span>
                        ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, padding: "9px 12px", background: "rgba(254,188,46,0.08)", border: "1px solid rgba(254,188,46,0.25)", borderRadius: 10, fontSize: 11.5, color: "#E7C06A" }}>
                Generative features require Higgsfield account credits.
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
                <div style={{ flex: 1 }} />
                {busy ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: ACCENT }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(79,209,197,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
                    {phase === "submitting" ? "Starting…" : job?.step || `Generating ${mode}…`}
                  </span>
                ) : (
                  <button
                    onClick={run}
                    disabled={!prompt.trim()}
                    style={{ display: "flex", alignItems: "center", gap: 7, background: prompt.trim() ? ACCENT : "#2A2A2C", color: prompt.trim() ? "#0C1012" : "#6A6A70", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 12.5, fontWeight: 600, cursor: prompt.trim() ? "pointer" : "default" }}
                  >
                    <Icon name="sparkles" size={14} />Generate
                  </button>
                )}
              </div>
            </>
          )}

          {phase === "done" && result && (
            <>
              {resultKind === "image" ? (
                <img src={outputUrl(result.outputId)} alt="Generated image" style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 340, objectFit: "contain" }} />
              ) : (
                <video src={outputUrl(result.outputId)} controls autoPlay style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 340 }} />
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: ACCENT }}>
                  <Icon name="circle-check-big" size={15} />Done
                </span>
                <span style={{ fontSize: 11.5, color: "#9A9AA0", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>
                  {resultKind}
                </span>
                <div style={{ flex: 1 }} />
                <button onClick={reset} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, cursor: "pointer" }}>New</button>
                <a href={outputUrl(result.outputId)} download={`cutroom-${result.outputId}.${resultKind === "image" ? "png" : "mp4"}`} style={{ display: "flex", alignItems: "center", gap: 7, background: ACCENT, color: "#0C1012", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
                  <Icon name="upload" size={14} />Download
                </a>
              </div>
            </>
          )}

          {phase === "error" && (
            <>
              <div style={{ marginTop: 14, padding: "11px 13px", background: "rgba(224,80,78,0.10)", border: "1px solid rgba(224,80,78,0.3)", borderRadius: 10, fontSize: 12.5, color: "#F2A6A4" }}>
                Generation failed: {error}
              </div>
              <div style={{ marginTop: 10, padding: "9px 12px", background: "rgba(254,188,46,0.08)", border: "1px solid rgba(254,188,46,0.25)", borderRadius: 10, fontSize: 11.5, color: "#E7C06A" }}>
                Generative features require Higgsfield account credits.
              </div>
              <div style={{ display: "flex", marginTop: 14 }}>
                <div style={{ flex: 1 }} />
                <button onClick={reset} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, cursor: "pointer" }}>Try again</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
