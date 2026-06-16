import { bins, clips, filmstrip, keywords, metaFields, selectedClipId } from "@cutroom/core";
import { Icon } from "../../components/Icon";

const ACCENT = "#4FD1C5";

/** The Media page — bins · 4-col browser · metadata · source strip. Pixel-faithful to the design. */
export function MediaPage() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* bins */}
        <div style={{ width: 208, flex: "none", background: "#1A1A1C", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "13px 15px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Bins</span>
            <Icon name="plus" size={15} color="#79797F" />
          </div>
          <div style={{ padding: "0 9px", display: "flex", flexDirection: "column", gap: 2, overflow: "auto" }}>
            {bins.map((b) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 9px", borderRadius: 10, background: b.active ? "rgba(79,209,197,0.12)" : "transparent", cursor: "pointer" }}>
                <Icon name="folder" size={16} color={b.color} />
                <span style={{ flex: 1, fontSize: 12.5, color: "#D6D6DB" }}>{b.name}</span>
                <span style={{ fontSize: 10.5, color: "#636368", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>{b.count}</span>
              </div>
            ))}
          </div>
          <div style={{ margin: "auto 12px 14px", background: "#202022", border: "1px solid rgba(79,209,197,0.20)", borderRadius: 12, padding: "11px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Icon name="sparkles" size={14} color={ACCENT} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#D6D6DB" }}>Smart import</span>
            </div>
            <div style={{ fontSize: 11, color: "#79797F", lineHeight: 1.45 }}>Transcribe, detect scenes &amp; auto-tag on ingest.</div>
          </div>
        </div>

        {/* browser */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#0E0E10" }}>
          <div style={{ height: 44, flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "#9A9AA0" }}>
            <Icon name="folder" size={15} />
            <span style={{ color: "#F5F5F7" }}>Footage</span>
            <span style={{ color: "#48484C" }}>/ Northwind / Episode 04</span>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#202022", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "6px 10px", color: "#636368" }}>
              <Icon name="search" size={13} />
              <span style={{ fontSize: 11.5 }}>Search</span>
            </div>
            <span style={{ fontSize: 11.5, color: "#79797F" }}>Sort: Scene</span>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
              {clips.map((m) => (
                <div key={m.id} style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${m.id === selectedClipId ? ACCENT : "rgba(255,255,255,0.08)"}`, background: "#202022", cursor: "pointer" }}>
                  <div style={{ height: 92, position: "relative", background: m.color }}>
                    <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(8,10,12,.66)", color: "#D6D6DB", fontSize: 9, padding: "1px 6px", borderRadius: 4, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>{m.resolution}</span>
                    <span style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(8,10,12,.72)", color: "#fff", fontSize: 9.5, padding: "1px 6px", borderRadius: 4, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>{m.duration}</span>
                  </div>
                  <div style={{ padding: "8px 9px" }}>
                    <div style={{ fontSize: 11.5, color: "#D6D6DB", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: "#636368", marginTop: 3, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>{m.codec} · {m.fps}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* metadata */}
        <div style={{ width: 298, flex: "none", background: "#1A1A1C", borderLeft: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "13px 15px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 600 }}>Metadata</div>
          <div style={{ padding: "15px 15px 12px" }}>
            <div style={{ aspectRatio: "16/9", borderRadius: 12, background: "radial-gradient(120% 130% at 50% 38%,#3a4150 0%,#171a20 80%)", position: "relative", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ position: "absolute", bottom: 8, left: 10, fontSize: 11, color: "#D6D6DB", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>Interview_A · Clip 14</span>
            </div>
          </div>
          <div style={{ padding: "0 15px", display: "flex", flexDirection: "column" }}>
            {metaFields.map((f) => (
              <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 11.5, color: "#79797F" }}>{f.key}</span>
                <span style={{ fontSize: 11.5, color: "#D6D6DB", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>{f.value}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "14px 15px" }}>
            <div style={{ fontSize: 11, color: "#636368", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 9, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>Keywords</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {keywords.map((k) => (
                <span key={k} style={{ fontSize: 11, color: "#7FE0D6", background: "rgba(79,209,197,.1)", border: "1px solid rgba(79,209,197,.22)", borderRadius: 6, padding: "3px 9px" }}>{k}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* source strip */}
      <div style={{ height: 152, flex: "none", background: "#161618", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 18, padding: "0 18px" }}>
        <div style={{ height: 112, aspectRatio: "16/9", borderRadius: 10, background: "radial-gradient(120% 130% at 50% 38%,#20262E 0%,#0B0D10 78%)", border: "1px solid rgba(255,255,255,0.08)", position: "relative", flex: "none" }}>
          <span style={{ position: "absolute", bottom: 7, left: 9, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, color: ACCENT }}>Source · 00:00:14:02</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9, fontSize: 11, color: "#79797F", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>
            <span style={{ color: ACCENT }}>IN 00:12</span>
            <span>Interview_A.mov</span>
            <span style={{ color: "#F2A65A" }}>OUT 00:48</span>
          </div>
          <div style={{ position: "relative", display: "flex", gap: 2, height: 46, borderRadius: 6, overflow: "hidden" }}>
            {filmstrip.map((c, i) => (
              <div key={i} style={{ flex: 1, background: c }} />
            ))}
            <div style={{ position: "absolute", top: 0, bottom: 0, left: "18%", right: "24%", border: `2px solid ${ACCENT}`, borderRadius: 4, background: "rgba(79,209,197,.08)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
