import { Icon } from "../../components/Icon";

/** Temporary body for pages not yet built — keeps tab switching coherent. */
export function PlaceholderPage({ title, subtitle, icon }: { title: string; subtitle: string; icon: string }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0A0B" }}>
      <div style={{ textAlign: "center", color: "#79797F" }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg,rgba(79,209,197,0.10),#1D1D1F)", border: "1px solid rgba(79,209,197,0.20)", color: "#4FD1C5" }}>
          <Icon name={icon} size={28} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, color: "#F5F5F7", marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 12.5 }}>{subtitle}</div>
        <div style={{ fontSize: 11, marginTop: 14, color: "#48484C", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>building next · the Color page is live →</div>
      </div>
    </div>
  );
}
