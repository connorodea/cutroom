import { deliverFields, renderPresets, renderQueue } from "@cutroom/core";
import { Icon } from "../../components/Icon";

const ACCENT = "#4FD1C5";

/** The Deliver page — render settings · preview w/ range bar · render queue. Pixel-faithful. */
export function DeliverPage() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* render settings */}
        <div style={{ width: 300, flex: "none", background: "#1A1A1C", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 600 }}>Render Settings</div>
          <div style={{ flex: 1, overflow: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {renderPresets.map((p) => (
                <div key={p.id} style={{ border: `1px solid ${p.active ? "rgba(79,209,197,.3)" : "rgba(255,255,255,0.08)"}`, background: p.active ? "rgba(79,209,197,.1)" : "#202022", borderRadius: 12, padding: "11px 11px", cursor: "pointer" }}>
                  <Icon name={p.icon} size={16} color={p.active ? ACCENT : "#9A9AA0"} />
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "#D6D6DB", marginTop: 8 }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: "#636368", marginTop: 2, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>{p.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {deliverFields.map((f) => (
                <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: 11.5, color: "#79797F" }}>{f.key}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "#D6D6DB", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>
                    {f.value}<Icon name="chevron-down" size={12} color="#636368" />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#79797F", marginBottom: 6 }}>Output</div>
              <div style={{ background: "#202022", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 11px", fontSize: 11, color: "#9A9AA0", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>/Northwind/Exports/Ep04</div>
            </div>
          </div>
          <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: ACCENT, color: "#0C1012", border: "none", borderRadius: 12, padding: "11px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Icon name="plus" size={15} />Add to Render Queue
            </button>
          </div>
        </div>

        {/* preview */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#0A0A0B" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 26, minHeight: 0 }}>
            <div style={{ position: "relative", width: "100%", maxWidth: 820, aspectRatio: "16/9", maxHeight: "100%", borderRadius: 12, overflow: "hidden", background: "radial-gradient(120% 130% at 50% 38%,#20262E 0%,#0B0D10 78%)", boxShadow: "0 0 0 1px #000,0 18px 40px -16px #000" }}>
              <span style={{ position: "absolute", top: 12, right: 14, background: "rgba(8,10,12,.6)", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10.5, color: "#C7C7CC", padding: "2px 8px", borderRadius: 5 }}>2160p · ProRes 422 HQ</span>
            </div>
          </div>
          <div style={{ height: 88, flex: "none", borderTop: "1px solid rgba(255,255,255,0.06)", background: "#161618", padding: "14px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10.5, color: "#79797F", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", marginBottom: 9 }}>
              <span style={{ color: ACCENT }}>RANGE IN 00:00</span>
              <span>Render range · entire timeline</span>
              <span style={{ color: "#F2A65A" }}>OUT 01:48</span>
            </div>
            <div style={{ height: 14, borderRadius: 5, background: "#1D1D1F", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, background: "repeating-linear-gradient(90deg,rgba(79,209,197,.18) 0 6px,transparent 6px 12px)" }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "100%", border: "1px solid rgba(79,209,197,.4)", borderRadius: 5 }} />
            </div>
          </div>
        </div>

        {/* render queue */}
        <div style={{ width: 300, flex: "none", background: "#1A1A1C", borderLeft: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Render Queue</span>
            <span style={{ fontSize: 11, color: ACCENT, cursor: "pointer" }}>Render All</span>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {renderQueue.map((j) => (
              <div key={j.id} style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12, background: "#202022" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#D6D6DB", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.name}</span>
                  <span style={{ fontSize: 10, color: j.color, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", flex: "none", marginLeft: 8 }}>{j.status}</span>
                </div>
                <div style={{ fontSize: 10.5, color: "#636368", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", marginBottom: 9 }}>{j.format}</div>
                <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${j.progress}%`, background: j.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
