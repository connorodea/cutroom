import { useState } from "react";
import { Icon } from "../components/Icon";
import { outputUrl, pollJob, submitChainJob, type EditJob } from "./workerClient";

const ACCENT = "#4FD1C5";
type Phase = "idle" | "running" | "done" | "error";

/**
 * Follow-up actions for a rendered output: chain a reframe ("Make vertical") or captions onto it
 * without re-uploading. Drop into any result view with the produced output id.
 */
export function ChainActions({ outputId }: { outputId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [chained, setChained] = useState<EditJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  type ChainOp = "reframe" | "captions" | "speed" | "color" | "fade" | "reverse" | "gif";

  const optsFor = (op: ChainOp) => {
    if (op === "reframe") return { aspect: "portrait", mode: "blur" } as const;
    if (op === "speed") return { factor: 2 };
    if (op === "color") return { preset: "vivid" };
    if (op === "fade") return { kind: "both" };
    if (op === "reverse") return { mode: "boomerang" };
    if (op === "gif") return { width: 480 };
    return {};
  };

  const runChain = async (op: ChainOp) => {
    setPhase("running");
    setError(null);
    try {
      const submitted = await submitChainJob(outputId, op, optsFor(op));
      const final = await pollJob(submitted.id, 2500);
      if (final.status === "done") {
        setChained(final);
        setPhase("done");
      } else {
        setError(final.error || "chain failed");
        setPhase("error");
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  };

  const btn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "#202022", border: "1px solid rgba(255,255,255,0.10)", color: "#D6D6DB", borderRadius: 9, padding: "6px 11px", fontSize: 11.5, cursor: "pointer" };

  if (phase === "done" && chained?.result) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: ACCENT }}>
          <Icon name="circle-check-big" size={14} />Chained
        </span>
        <a href={outputUrl(chained.result.outputId)} download={`cutroom-${chained.result.outputId}.mp4`} style={{ ...btn, textDecoration: "none" }}>
          <Icon name="upload" size={13} color={ACCENT} />Download
        </a>
        <button onClick={() => { setPhase("idle"); setChained(null); }} style={btn}>More</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
      {phase === "running" ? (
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: ACCENT }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(79,209,197,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
          Working…
        </span>
      ) : (
        <>
          <span style={{ fontSize: 11, color: "#79797F" }}>Then:</span>
          <button onClick={() => runChain("reframe")} style={btn}>
            <Icon name="smartphone" size={13} color={ACCENT} />Make vertical
          </button>
          <button onClick={() => runChain("captions")} style={btn}>
            <Icon name="captions" size={13} color={ACCENT} />Add captions
          </button>
          <button onClick={() => runChain("speed")} style={btn}>
            <Icon name="gauge" size={13} color={ACCENT} />2× speed
          </button>
          <button onClick={() => runChain("color")} style={btn}>
            <Icon name="palette" size={13} color={ACCENT} />Grade
          </button>
          <button onClick={() => runChain("fade")} style={btn}>
            <Icon name="contrast" size={13} color={ACCENT} />Fade ends
          </button>
          <button onClick={() => runChain("reverse")} style={btn}>
            <Icon name="rewind" size={13} color={ACCENT} />Boomerang
          </button>
          <button onClick={() => runChain("gif")} style={btn}>
            <Icon name="film" size={13} color={ACCENT} />GIF
          </button>
        </>
      )}
      {phase === "error" && <span style={{ fontSize: 11.5, color: "#F2A6A4" }}>Chain failed: {error}</span>}
    </div>
  );
}
