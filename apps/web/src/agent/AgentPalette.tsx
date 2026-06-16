import { useState } from "react";
import { agentWorkflows } from "@cutroom/core";
import { useEditorStore } from "../editor/store";
import { useAgentRun } from "./useAgentRun";
import { Icon } from "../components/Icon";

const ACCENT = "#4FD1C5";

/** The ⌘K AI Agent palette: glassy overlay with an idle composer and a live run view. */
export function AgentPalette() {
  const agentOpen = useEditorStore((s) => s.agentOpen);
  const closeAgent = useEditorStore((s) => s.closeAgent);
  const phase = useEditorStore((s) => s.phase);
  const active = useEditorStore((s) => s.active);
  const steps = useEditorStore((s) => s.steps);
  const title = useEditorStore((s) => s.title);
  const resetRun = useEditorStore((s) => s.resetRun);
  const { run, loading, source } = useAgentRun();
  const [query, setQuery] = useState("");

  if (!agentOpen) return null;

  const isIdle = phase === "idle" && !loading;
  const isDone = phase === "done";
  const total = steps.length || 7;
  const progressPct = isDone ? 100 : phase === "running" ? Math.round((active / total) * 100) : loading ? 6 : 0;
  const statusText = isDone ? "Done" : "Working…";
  const statusColor = isDone ? ACCENT : "#E0A33E";

  const submit = () => run(query.trim() || "Custom workflow");
  const back = () => {
    resetRun();
    setQuery("");
  };

  return (
    <div
      onClick={closeAgent}
      style={{
        position: "absolute", inset: 0, zIndex: 40, background: "rgba(10,10,12,.5)",
        backdropFilter: "blur(26px) saturate(1.5)", display: "flex", alignItems: "flex-start",
        justifyContent: "center", padding: "11vh 24px 24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 600, maxWidth: "100%", background: "rgba(28,28,30,0.82)",
          backdropFilter: "blur(50px) saturate(1.6)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 20, overflow: "hidden", animation: "agentin .18s ease, glow 4s ease-in-out infinite",
          display: "flex", flexDirection: "column", maxHeight: "78vh",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 17px", borderBottom: "1px solid rgba(255,255,255,0.06)", flex: "none" }}>
          <div style={{ width: 30, height: 30, borderRadius: 12, background: "linear-gradient(150deg,#4FD1C5,#2E9C95)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0C1012", flex: "none" }}>
            <Icon name="sparkles" size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-.01em" }}>AI Agent</div>
            <div style={{ fontSize: 11, color: "#79797F" }}>Plans and runs multi-step edits · reversible</div>
          </div>
          <span style={{ fontSize: 11, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", color: "#636368", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 5, padding: "2px 7px" }}>esc</span>
        </div>

        {isIdle ? (
          <>
            {/* composer */}
            <div style={{ padding: "6px 6px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 14px" }}>
                <Icon name="wand-2" size={18} color={ACCENT} />
                <input
                  value={query}
                  autoFocus
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  placeholder="Tell the agent what to make…"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#F5F5F7", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 15 }}
                />
                <button onClick={submit} style={{ display: "flex", alignItems: "center", gap: 6, background: ACCENT, color: "#0C1012", border: "none", borderRadius: 10, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  Run<Icon name="corner-down-left" size={13} />
                </button>
              </div>
            </div>
            <div style={{ padding: "6px 16px 8px" }}>
              <div style={{ fontSize: 11, color: "#636368", textTransform: "uppercase", letterSpacing: ".12em", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", marginBottom: 9 }}>Agentic workflows</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8 }}>
                {agentWorkflows.map((w) => (
                  <button
                    key={w.title}
                    onClick={() => run(w.title)}
                    style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "#202022", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "11px 13px", cursor: "pointer", color: "inherit" }}
                  >
                    <span style={{ width: 30, height: 30, borderRadius: 10, flex: "none", background: "rgba(79,209,197,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: ACCENT }}>
                      <Icon name={w.icon} size={16} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 500 }}>{w.title}</span>
                      <span style={{ display: "block", fontSize: 11, color: "#79797F", marginTop: 2 }}>{w.sub}</span>
                    </span>
                    <Icon name="arrow-up-right" size={15} color="#48484C" />
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* run view */
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 16px 12px", flex: "none" }}>
              <button onClick={back} style={{ width: 26, height: 26, borderRadius: 9, flex: "none", background: "#202022", border: "1px solid rgba(255,255,255,0.08)", color: "#9A9AA0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Icon name="arrow-left" size={14} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title || "Working…"}</div>
              </div>
              {source === "fallback" && (
                <span title="Agent unavailable — showing the scripted pipeline" style={{ fontSize: 9.5, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", color: "#E0A33E", background: "rgba(224,163,62,.12)", border: "1px solid rgba(224,163,62,.28)", borderRadius: 5, padding: "1px 6px" }}>scripted</span>
              )}
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", display: "flex", alignItems: "center", gap: 6, color: statusColor }}>{statusText}</span>
            </div>
            <div style={{ height: 3, flex: "none", margin: "0 16px", borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: ACCENT, borderRadius: 2, transition: "width .4s ease" }} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 6px", display: "flex", flexDirection: "column", gap: 3 }}>
              {loading && steps.length === 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 10px", color: "#9A9AA0", fontSize: 13 }}>
                  <span style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(79,209,197,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
                  Asking the Cutroom Agent…
                </div>
              )}
              {steps.map((s, i) => {
                const done = phase !== "idle" && i < active;
                const running = phase === "running" && i === active;
                const pending = !done && !running;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "9px 10px", borderRadius: 12, opacity: pending ? 0.42 : 1, background: running ? "rgba(79,209,197,0.07)" : "transparent", transition: "opacity .3s, background .3s" }}>
                    <span style={{ width: 24, height: 24, borderRadius: 9, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1, background: done ? "rgba(79,209,197,.16)" : running ? "transparent" : "#1D1D1F", color: done || running ? ACCENT : "#48484C" }}>
                      {running ? (
                        <span style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(79,209,197,.3)", borderTopColor: ACCENT, animation: "spin .7s linear infinite", display: "block" }} />
                      ) : (
                        <Icon name={done ? "check" : "dot"} size={14} />
                      )}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: pending ? "#79797F" : "#F5F5F7" }}>{s.label}</span>
                        <span style={{ fontSize: 9.5, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", color: "#636368", background: "#202022", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4, padding: "1px 5px" }}>{s.tool}</span>
                      </div>
                      {done && (
                        <div style={{ fontSize: 11.5, color: "#79797F", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", marginTop: 3, animation: "rowin .25s ease" }}>{s.result}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {isDone && (
              <div style={{ flex: "none", padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "#202022" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
                  <Icon name="circle-check-big" size={16} color={ACCENT} />
                  <div style={{ fontSize: 12.5, color: "#D6D6DB", lineHeight: 1.4 }}>
                    Built <span style={{ color: ACCENT, fontWeight: 600 }}>{title}</span> on a new timeline — review before you commit.
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <button style={{ display: "flex", alignItems: "center", gap: 7, background: ACCENT, color: "#0C1012", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                    <Icon name="check" size={14} />Apply to timeline
                  </button>
                  <button onClick={back} style={{ background: "transparent", color: "#C7C7CC", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, cursor: "pointer" }}>Discard</button>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: "#636368", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", display: "flex", alignItems: "center", gap: 5 }}>
                    <Icon name="undo-2" size={12} />reversible
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
