import { clips, editTimelineTracks, inspectorSliders } from "@cutroom/core";
import type { Track } from "@cutroom/core";
import { Icon } from "../../components/Icon";

const ACCENT = "#4FD1C5";
const POOL_TABS = ["Media", "Effects", "Titles", "Audio"];

function EditLane({ track }: { track: Track }) {
  return (
    <div style={{ display: "flex", height: 38, borderBottom: "1px solid #1D1D1F" }}>
      <div style={{ width: 64, flex: "none", display: "flex", alignItems: "center", padding: "0 12px", borderRight: "1px solid rgba(255,255,255,0.06)", background: "#202022" }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: "#9A9AA0", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>{track.lane}</span>
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

/** The Edit page — pool tabs · source/program dual viewer · inspector · multitrack timeline. */
export function EditPage() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* pool */}
        <div style={{ width: 226, flex: "none", background: "#1A1A1C", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", gap: 14, padding: "13px 14px 11px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 11.5 }}>
            {POOL_TABS.map((t, i) => (
              <span key={t} style={i === 0 ? { color: ACCENT, borderBottom: `2px solid ${ACCENT}`, paddingBottom: 8 } : { color: "#636368" }}>{t}</span>
            ))}
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {clips.map((m) => (
                <div key={m.id} style={{ borderRadius: 9, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#202022" }}>
                  <div style={{ height: 50, position: "relative", background: m.color }}>
                    <span style={{ position: "absolute", bottom: 4, right: 4, background: "rgba(8,10,12,.72)", color: "#fff", fontSize: 9, padding: "1px 5px", borderRadius: 4, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>{m.duration}</span>
                  </div>
                  <div style={{ padding: "5px 7px", fontSize: 10, color: "#9A9AA0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* dual viewers */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#0A0A0B" }}>
          <div style={{ flex: 1, display: "flex", gap: 14, padding: 18, minHeight: 0 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "#9A9AA0", fontWeight: 500 }}>Source</div>
              <div style={{ flex: 1, borderRadius: 10, background: "radial-gradient(120% 130% at 50% 38%,#26303A 0%,#0B0D10 80%)", border: "1px solid rgba(255,255,255,0.06)", position: "relative", minHeight: 0 }}>
                <span style={{ position: "absolute", bottom: 8, left: 10, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10.5, color: "#7FE0D6" }}>CU_Maya · 00:08</span>
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: ACCENT, fontWeight: 500 }}>Program</div>
              <div style={{ flex: 1, borderRadius: 10, background: "radial-gradient(120% 130% at 50% 38%,#20262E 0%,#0B0D10 80%)", border: "1px solid rgba(255,255,255,0.06)", position: "relative", minHeight: 0 }}>
                <span style={{ position: "absolute", bottom: 8, left: 10, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10.5, color: ACCENT }}>00:01:14:08</span>
              </div>
            </div>
          </div>
          <div style={{ height: 46, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 18, borderTop: "1px solid rgba(255,255,255,0.06)", background: "#161618", color: "#C7C7CC" }}>
            <Icon name="skip-back" size={16} />
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#F5F5F7", color: "#0E0E10", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="play" size={14} fill="currentColor" />
            </div>
            <Icon name="skip-forward" size={16} />
          </div>
        </div>

        {/* inspector */}
        <div style={{ width: 290, flex: "none", background: "#1A1A1C", borderLeft: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "13px 15px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Inspector</div>
            <div style={{ fontSize: 11, color: "#636368", marginTop: 2 }}>Cutaway_07 · Video</div>
          </div>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 15 }}>
            <div style={{ fontSize: 11, color: ACCENT, textTransform: "uppercase", letterSpacing: ".1em", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>Transform</div>
            {inspectorSliders.map((s) => (
              <div key={s.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#9A9AA0", marginBottom: 7 }}>
                  <span>{s.label}</span>
                  <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", color: "#C7C7CC" }}>{s.value}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", position: "relative" }}>
                  <span style={{ position: "absolute", top: "50%", left: `${s.position}%`, transform: "translate(-50%,-50%)", width: 13, height: 13, borderRadius: "50%", background: "#F5F5F7", boxShadow: "0 1px 3px rgba(0,0,0,.5)" }} />
                </div>
              </div>
            ))}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, fontSize: 11, color: ACCENT, textTransform: "uppercase", letterSpacing: ".1em", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>Composite</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11.5, color: "#9A9AA0" }}>Blend mode</span>
              <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#202022", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "6px 10px", fontSize: 11.5, color: "#D6D6DB" }}>
                Normal<Icon name="chevron-down" size={12} color="#636368" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* multitrack timeline */}
      <div style={{ height: 240, flex: "none", background: "#161618", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 36, flex: "none", display: "flex", alignItems: "center", gap: 11, padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#79797F" }}>
          <Icon name="mouse-pointer-2" size={15} color={ACCENT} />
          <Icon name="scissors" size={15} />
          <Icon name="type" size={15} />
          <Icon name="magnet" size={15} />
          <span style={{ width: 1, height: 15, background: "rgba(255,255,255,0.08)" }} />
          <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 11.5, color: "#C7C7CC" }}>01:14:08</span>
        </div>
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {editTimelineTracks.map((tr) => <EditLane key={tr.id} track={tr} />)}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "calc(64px + 42% * (100% - 64px) / 100)", width: 2, background: "#FF7A45", pointerEvents: "none" }}>
            <span style={{ position: "absolute", top: -1, left: -4, width: 10, height: 8, background: "#FF7A45", clipPath: "polygon(0 0,100% 0,50% 100%)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
