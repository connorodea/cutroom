import { useEffect } from "react";
import type { PageId } from "@cutroom/core";
import { sampleProject } from "@cutroom/core";
import { useEditorStore } from "./store";
import { Icon } from "../components/Icon";
import { AgentPalette } from "../agent/AgentPalette";
import { ColorPage } from "./pages/ColorPage";
import { MediaPage } from "./pages/MediaPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

const ACCENT = "#4FD1C5";
const TABS: { id: PageId; label: string }[] = [
  { id: "media", label: "Media" },
  { id: "cut", label: "Cut" },
  { id: "edit", label: "Edit" },
  { id: "color", label: "Color" },
  { id: "deliver", label: "Deliver" },
];

function PageBody({ page }: { page: PageId }) {
  switch (page) {
    case "color":
      return <ColorPage />;
    case "media":
      return <MediaPage />;
    case "cut":
      return <PlaceholderPage title="Cut" subtitle="Source tape · viewer · dual timeline" icon="scissors" />;
    case "edit":
      return <PlaceholderPage title="Edit" subtitle="Dual viewer · inspector · multitrack timeline" icon="sliders-horizontal" />;
    case "deliver":
      return <PlaceholderPage title="Deliver" subtitle="Render settings · preview · queue" icon="upload" />;
  }
}

export function EditorShell() {
  const page = useEditorStore((s) => s.page);
  const setPage = useEditorStore((s) => s.setPage);
  const openAgent = useEditorStore((s) => s.openAgent);
  const toggleAgent = useEditorStore((s) => s.toggleAgent);
  const closeAgent = useEditorStore((s) => s.closeAgent);
  const agentOpen = useEditorStore((s) => s.agentOpen);

  // Global ⌘K toggles the agent; Esc closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = (e.key || "").toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        toggleAgent();
      } else if (k === "escape" && agentOpen) {
        closeAgent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleAgent, closeAgent, agentOpen]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", background: "#161618", color: "#F5F5F7", display: "flex", flexDirection: "column" }}>
      {/* topbar */}
      <div style={{ height: 50, flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: "#1D1D1F", borderBottom: "1px solid rgba(255,255,255,0.08)", zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 7 }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#FF5F57" }} />
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#FEBC2E" }} />
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#28C840" }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "-.01em", color: "#F5F5F7" }}>Cutroom</span>
          <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#9A9AA0" }}>
            <Icon name="clapperboard" size={16} />
            <span style={{ fontWeight: 600, fontSize: 13.5, color: "#F5F5F7" }}>{sampleProject.name}</span>
            <span style={{ fontSize: 13.5 }}>/ {sampleProject.episode}</span>
            <Icon name="chevron-down" size={13} />
          </div>
          <span style={{ fontSize: 11, color: ACCENT, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT }} />Saved
          </span>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", gap: 2, background: "#161618", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 3 }}>
          {TABS.map((t) => {
            const on = page === t.id;
            return (
              <span
                key={t.id}
                onClick={() => setPage(t.id)}
                style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12.5, cursor: "pointer", color: on ? "#0A0A0B" : "#9A9AA0", background: on ? ACCENT : "transparent", fontWeight: on ? 600 : 400 }}
              >
                {t.label}
              </span>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={openAgent} style={{ display: "flex", alignItems: "center", gap: 8, background: "#202022", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "7px 11px 7px 12px", cursor: "pointer" }}>
            <Icon name="sparkles" size={15} color={ACCENT} />
            <span style={{ fontSize: 12.5, color: "#D6D6DB" }}>Ask Agent</span>
            <span style={{ fontSize: 11, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", color: "#79797F", background: "#161618", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 5, padding: "1px 6px" }}>⌘K</span>
          </button>
          <div style={{ display: "flex", gap: 6, color: "#79797F" }}>
            <Icon name="undo-2" size={16} />
            <Icon name="redo-2" size={16} />
          </div>
          <div style={{ display: "flex" }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#5B5BD6", border: "2px solid #1D1D1F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#fff" }}>MC</span>
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#E0892B", border: "2px solid #1D1D1F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#fff", marginLeft: -8 }}>JR</span>
          </div>
          <button style={{ display: "flex", alignItems: "center", gap: 7, background: ACCENT, color: "#0C1012", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <Icon name="upload" size={14} />Render
          </button>
        </div>
      </div>

      <PageBody page={page} />
      <AgentPalette />
    </div>
  );
}
