import { clips, cutMainWave, cutOverviewClips, cutTools } from "@cutroom/core";
import { Icon } from "../../components/Icon";

const ACCENT = "#4FD1C5";

/** The Cut page — source tape · viewer · dual timeline overview. Pixel-faithful to the design. */
export function CutPage() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* source ribbon */}
      <div style={{ height: 108, flex: "none", background: "#1A1A1C", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 12, padding: "0 16px" }}>
        <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Source tape</span>
          <span style={{ fontSize: 10.5, color: "#636368" }}>12 clips</span>
        </div>
        <div style={{ flex: 1, display: "flex", gap: 8, overflow: "hidden" }}>
          {clips.map((m) => (
            <div key={m.id} style={{ width: 124, flex: "none", height: 72, borderRadius: 9, position: "relative", background: m.color, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)", cursor: "pointer" }}>
              <span style={{ position: "absolute", bottom: 5, right: 6, background: "rgba(8,10,12,.7)", color: "#fff", fontSize: 9, padding: "1px 5px", borderRadius: 4, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>{m.duration}</span>
              <span style={{ position: "absolute", bottom: 5, left: 6, color: "#fff", fontSize: 9.5, textShadow: "0 1px 2px #000" }}>{m.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* viewer */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#0A0A0B" }}>
        <div style={{ height: 42, flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {cutTools.map((t) => (
            <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1D1D1F", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "6px 11px", color: "#D6D6DB", cursor: "pointer" }}>
              <Icon name={t.icon} size={14} color={ACCENT} />
              <span style={{ fontSize: 11.5 }}>{t.label}</span>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(79,209,197,0.10)", border: "1px solid rgba(79,209,197,0.28)", borderRadius: 10, padding: "6px 12px", color: "#7FE0D6", cursor: "pointer" }}>
            <Icon name="sparkles" size={14} color={ACCENT} />
            <span style={{ fontSize: 11.5 }}>Auto-assemble selects</span>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, minHeight: 0 }}>
          <div style={{ position: "relative", width: "100%", maxWidth: 880, aspectRatio: "16/9", maxHeight: "100%", borderRadius: 12, overflow: "hidden", background: "radial-gradient(120% 130% at 50% 38%,#20262E 0%,#0B0D10 78%)", boxShadow: "0 0 0 1px #000,0 18px 40px -16px #000" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "7%", background: "#000" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "7%", background: "#000" }} />
            <span style={{ position: "absolute", bottom: "11%", left: 16, background: "rgba(8,10,12,.6)", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, color: ACCENT, padding: "2px 8px", borderRadius: 5 }}>00:00:31:12</span>
          </div>
        </div>
        <div style={{ height: 48, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 20, borderTop: "1px solid rgba(255,255,255,0.06)", background: "#161618", color: "#C7C7CC" }}>
          <Icon name="skip-back" size={17} />
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#F5F5F7", color: "#0E0E10", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="play" size={15} fill="currentColor" />
          </div>
          <Icon name="skip-forward" size={17} />
        </div>
      </div>

      {/* dual timeline */}
      <div style={{ height: 208, flex: "none", background: "#161618", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 66, flex: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ fontSize: 10.5, color: "#636368", textTransform: "uppercase", letterSpacing: ".1em", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>Timeline overview</div>
          <div style={{ position: "relative", flex: 1, display: "flex", gap: 2, borderRadius: 5, overflow: "hidden" }}>
            {cutOverviewClips.map((c, i) => (
              <div key={i} style={{ width: `${c.width}%`, background: c.color, opacity: 0.8 }} />
            ))}
            <div style={{ position: "absolute", top: -2, bottom: -2, left: "30%", width: "24%", border: `2px solid ${ACCENT}`, borderRadius: 5, background: "rgba(79,209,197,.1)" }} />
          </div>
        </div>
        <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", gap: 5 }}>
          <div style={{ display: "flex", height: 40 }}>
            <div style={{ width: 64, flex: "none", borderRight: "1px solid rgba(255,255,255,0.06)", background: "#202022", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, color: "#9A9AA0", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>V1</div>
            <div style={{ flex: 1, position: "relative" }}>
              <div style={{ position: "absolute", top: 4, bottom: 4, left: "4%", width: "40%", borderRadius: 5, background: "#5B8DEF", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)", display: "flex", alignItems: "center", padding: "0 9px", fontSize: 10, color: "#fff" }}>Interview_A · CU</div>
              <div style={{ position: "absolute", top: 4, bottom: 4, left: "46%", width: "30%", borderRadius: 5, background: "#43C59E", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)", display: "flex", alignItems: "center", padding: "0 9px", fontSize: 10, color: "#fff" }}>Cutaway_07</div>
            </div>
          </div>
          <div style={{ display: "flex", height: 34 }}>
            <div style={{ width: 64, flex: "none", borderRight: "1px solid rgba(255,255,255,0.06)", background: "#202022", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, color: "#9A9AA0", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>A1</div>
            <div style={{ flex: 1, position: "relative" }}>
              <div style={{ position: "absolute", top: 4, bottom: 4, left: "4%", width: "72%", borderRadius: 5, background: "#2F6F63", overflow: "hidden", display: "flex", alignItems: "center", gap: 1, padding: "0 4px" }}>
                {cutMainWave.map((h, i) => (
                  <div key={i} style={{ flex: 1, height: `${h}%`, background: "rgba(255,255,255,.5)", borderRadius: 1, minWidth: 1 }} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "calc(64px + 42% * (100% - 64px) / 100)", width: 2, background: "#FF7A45" }}>
            <span style={{ position: "absolute", top: -1, left: -4, width: 10, height: 8, background: "#FF7A45", clipPath: "polygon(0 0,100% 0,50% 100%)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
