import { clips, colorSliders, colorTimelineTracks, colorWheels } from "@cutroom/core";
import type { Track } from "@cutroom/core";
import { Icon } from "../../components/Icon";
import { useEditorStore } from "../store";

const ACCENT = "#4FD1C5";
const WHEEL_RING = "conic-gradient(from 90deg,#D9586B,#D9A24D,#5FC289,#4DA0CC,#6E6BD0,#BC63BC,#D9586B)";

function RailIcon({ name, active, onClick, title }: { name: string; active?: boolean; onClick?: () => void; title?: string }) {
  return (
    <div
      onClick={onClick}
      title={title}
      style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: onClick ? "pointer" : "default", background: active ? "rgba(79,209,197,0.14)" : "transparent", color: active ? ACCENT : "#79797F" }}
    >
      <Icon name={name} size={20} />
    </div>
  );
}

function TimelineLane({ track }: { track: Track }) {
  return (
    <div style={{ display: "flex", height: 38, borderBottom: "1px solid #1D1D1F" }}>
      <div style={{ width: 98, flex: "none", display: "flex", alignItems: "center", gap: 7, padding: "0 12px", borderRight: "1px solid rgba(255,255,255,0.06)", background: "#202022" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#9A9AA0", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>{track.lane}</span>
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        {track.clips.map((c) => (
          <div key={c.id} style={{ position: "absolute", top: 4, bottom: 4, left: `${c.start}%`, width: `${c.width}%`, borderRadius: 5, overflow: "hidden", background: c.color, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)", display: "flex", alignItems: "center" }}>
            {c.waveform && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 1, padding: "0 4px", opacity: 0.55 }}>
                {c.waveform.map((h, i) => (
                  <div key={i} style={{ flex: 1, height: `${h}%`, background: "#fff", borderRadius: 1, minWidth: 1 }} />
                ))}
              </div>
            )}
            <span style={{ position: "relative", fontSize: 10, color: "#fff", padding: "0 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 2px rgba(0,0,0,.4)", fontWeight: 500 }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The Color page — the screen the handoff opened on. Pixel-faithful to the design. */
export function ColorPage() {
  const openAgent = useEditorStore((s) => s.openAgent);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* body */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* rail */}
        <div style={{ width: 56, flex: "none", background: "#1D1D1F", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", alignItems: "center", padding: "13px 0", gap: 6 }}>
          <RailIcon name="folder" />
          <RailIcon name="scissors" />
          <RailIcon name="palette" active />
          <RailIcon name="sliders-horizontal" />
          <RailIcon name="captions" />
          <div style={{ flex: 1 }} />
          <button onClick={openAgent} title="AI Agent (⌘K)" style={{ width: 40, height: 40, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg,rgba(79,209,197,0.10),#1D1D1F)", border: "1px solid rgba(79,209,197,0.28)", color: ACCENT, cursor: "pointer" }}>
            <Icon name="sparkles" size={20} />
          </button>
        </div>

        {/* media pool */}
        <div style={{ width: 238, flex: "none", background: "#1A1A1C", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "13px 14px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Media Pool</span>
            <span style={{ fontSize: 11, color: "#636368" }}>12 clips</span>
          </div>
          <div style={{ margin: "0 13px 12px", display: "flex", alignItems: "center", gap: 7, background: "#202022", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "7px 10px", color: "#636368" }}>
            <Icon name="search" size={14} />
            <span style={{ fontSize: 12 }}>Search media…</span>
          </div>
          <div style={{ flex: 1, overflow: "hidden", padding: "0 13px 13px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {clips.map((m) => (
                <div key={m.id} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#202022" }}>
                  <div style={{ height: 56, position: "relative", background: m.color }}>
                    <span style={{ position: "absolute", bottom: 5, right: 5, background: "rgba(8,10,12,.72)", color: "#fff", fontSize: 9.5, padding: "1px 6px", borderRadius: 4, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>{m.duration}</span>
                  </div>
                  <div style={{ padding: "6px 8px", fontSize: 11, color: "#9A9AA0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* viewer */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#0A0A0B" }}>
          <div style={{ height: 36, flex: "none", display: "flex", alignItems: "center", gap: 16, padding: "0 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "#79797F" }}>
            <span style={{ color: "#F5F5F7", fontWeight: 500 }}>Viewer</span>
            <span>Interview_A · Clip 14</span>
            <div style={{ flex: 1 }} />
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: ACCENT }}>
              <Icon name="activity" size={13} />Scopes
            </span>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 26, minHeight: 0 }}>
            <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", maxHeight: "100%", borderRadius: 12, overflow: "hidden", background: "radial-gradient(120% 130% at 50% 38%,#20262E 0%,#0B0D10 78%)", boxShadow: "0 0 0 1px #000,0 18px 40px -16px #000" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "7%", background: "#000" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "7%", background: "#000" }} />
              <div style={{ position: "absolute", inset: "7% 0", backgroundImage: "linear-gradient(to right,transparent 33.2%,rgba(255,255,255,.08) 33.2%,rgba(255,255,255,.08) 33.4%,transparent 33.4%,transparent 66.5%,rgba(255,255,255,.08) 66.5%,rgba(255,255,255,.08) 66.7%,transparent 66.7%),linear-gradient(to bottom,transparent 33.2%,rgba(255,255,255,.08) 33.2%,rgba(255,255,255,.08) 33.4%,transparent 33.4%,transparent 66.5%,rgba(255,255,255,.08) 66.5%,rgba(255,255,255,.08) 66.7%,transparent 66.7%)" }} />
              <span style={{ position: "absolute", top: "11%", right: 16, background: "rgba(8,10,12,.6)", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10.5, color: "#C7C7CC", padding: "2px 8px", borderRadius: 5 }}>4K · 23.98</span>
              <span style={{ position: "absolute", bottom: "11%", left: 16, background: "rgba(8,10,12,.6)", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, color: ACCENT, padding: "2px 8px", borderRadius: 5 }}>00:01:14:08</span>
            </div>
          </div>
          <div style={{ height: 54, flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "#161618" }}>
            <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 13.5, color: "#C7C7CC", letterSpacing: ".02em" }}>01:14:08</span>
            <div style={{ display: "flex", alignItems: "center", gap: 20, color: "#C7C7CC" }}>
              <Icon name="skip-back" size={18} />
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F5F5F7", color: "#0E0E10", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="play" size={16} fill="currentColor" />
              </div>
              <Icon name="skip-forward" size={18} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#79797F" }}>
              <Icon name="volume-2" size={16} />
              <Icon name="maximize-2" size={15} />
            </div>
          </div>
        </div>

        {/* inspector / color */}
        <div style={{ width: 290, flex: "none", background: "#1A1A1C", borderLeft: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "13px 15px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Color</div>
            <div style={{ fontSize: 11, color: "#636368", marginTop: 2 }}>Clip 14 · Interview_A</div>
          </div>
          <div style={{ display: "flex", gap: 15, padding: "14px 15px 6px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}>
            <span style={{ color: ACCENT, borderBottom: `2px solid ${ACCENT}`, paddingBottom: 9 }}>Wheels</span>
            <span style={{ color: "#636368", paddingBottom: 9 }}>Curves</span>
            <span style={{ color: "#636368", paddingBottom: 9 }}>HDR</span>
            <span style={{ color: "#636368", paddingBottom: 9 }}>Blur</span>
          </div>
          <div style={{ padding: "18px 15px", display: "flex", justifyContent: "space-between" }}>
            {colorWheels.map((w) => (
              <div key={w.label} style={{ textAlign: "center" }}>
                <div style={{ width: 70, height: 70, borderRadius: "50%", background: WHEEL_RING, padding: 1, margin: "0 auto" }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "radial-gradient(circle at 50% 50%,#1C1C1E 53%,transparent 54%)", position: "relative" }}>
                    <span style={{ position: "absolute", top: `${w.y}%`, left: `${w.x}%`, width: 6, height: 6, borderRadius: "50%", background: "#fff", boxShadow: "0 0 0 1px #000" }} />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#9A9AA0", marginTop: 8 }}>{w.label}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: "4px 17px", display: "flex", flexDirection: "column", gap: 14 }}>
            {colorSliders.map((s) => (
              <div key={s.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#9A9AA0", marginBottom: 7 }}>
                  <span>{s.label}</span>
                  <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", color: "#C7C7CC" }}>{s.value}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: s.track ?? "rgba(255,255,255,0.08)", position: "relative" }}>
                  <span style={{ position: "absolute", top: "50%", left: `${s.position}%`, transform: "translate(-50%,-50%)", width: 13, height: 13, borderRadius: "50%", background: "#F5F5F7", boxShadow: "0 1px 3px rgba(0,0,0,.5)" }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ margin: "auto 15px 16px", background: "#202022", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "11px 13px", display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="sparkles" size={15} color={ACCENT} />
            <div style={{ fontSize: 11.5, lineHeight: 1.45, color: "#9A9AA0" }}>Agent matched this shot to <span style={{ color: ACCENT }}>Wide_set</span> for a consistent grade.</div>
          </div>
        </div>
      </div>

      {/* timeline */}
      <div style={{ height: 224, flex: "none", background: "#161618", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 38, flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, color: "#79797F" }}>
            <Icon name="mouse-pointer-2" size={16} color={ACCENT} />
            <Icon name="scissors" size={16} />
            <Icon name="magnet" size={16} />
            <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.08)", margin: "0 3px" }} />
            <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, color: "#C7C7CC" }}>01:14:08</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#79797F", fontSize: 11 }}>
            <Icon name="zoom-out" size={15} />
            <div style={{ width: 88, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, position: "relative" }}>
              <span style={{ position: "absolute", left: "54%", top: "50%", transform: "translate(-50%,-50%)", width: 10, height: 10, borderRadius: "50%", background: "#9A9AA0" }} />
            </div>
            <Icon name="zoom-in" size={15} />
          </div>
        </div>
        <div style={{ height: 20, flex: "none", display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
          <div style={{ position: "absolute", left: 98, right: 0, top: 0, bottom: 0, display: "flex", justifyContent: "space-between", padding: "0 4px", alignItems: "center", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 9, color: "#48484C" }}>
            {["00:00", "00:20", "00:40", "01:00", "01:20", "01:40", "02:00"].map((t) => <span key={t}>{t}</span>)}
          </div>
        </div>
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {colorTimelineTracks.map((tr) => <TimelineLane key={tr.id} track={tr} />)}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "calc(98px + 38% * (100% - 98px) / 100)", width: 2, background: "#FF7A45", pointerEvents: "none" }}>
            <span style={{ position: "absolute", top: -1, left: -4, width: 10, height: 8, background: "#FF7A45", clipPath: "polygon(0 0,100% 0,50% 100%)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
