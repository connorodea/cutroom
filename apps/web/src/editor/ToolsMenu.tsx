import { useState } from "react";
import { Icon } from "../components/Icon";
import { useEditorStore } from "./store";
import { TOOL_GROUPS, filterTools, type ToolDef } from "./toolRegistry";

const ACCENT = "#7C8CF8";

/** Topbar "Tools" dropdown: a searchable, categorised menu of every media-edit tool. */
export function ToolsMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const choose = (tool: ToolDef) => {
    (useEditorStore.getState() as unknown as Record<string, () => void>)[tool.opener]?.();
    setOpen(false);
    setQuery("");
  };

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const row = (tool: ToolDef) => (
    <button
      key={tool.id}
      onClick={() => choose(tool)}
      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", background: "transparent", border: "none", color: "#D6D6DB", borderRadius: 8, padding: "7px 9px", fontSize: 12.5, cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#202022")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <Icon name={tool.icon} size={14} color={ACCENT} />
      {tool.label}
    </button>
  );

  const filtered = filterTools(query);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 7, background: open ? "#2A2A2D" : "#202022", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 13px", fontSize: 12.5, color: "#D6D6DB", cursor: "pointer" }}
      >
        <Icon name="sliders-horizontal" size={14} color={ACCENT} />Tools
        <Icon name="chevron-down" size={13} color="#79797F" />
      </button>

      {open && (
        <>
          <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 41, width: 280, maxHeight: "70vh", overflowY: "auto", background: "rgba(28,28,30,0.96)", backdropFilter: "blur(40px) saturate(1.5)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 8, boxShadow: "0 24px 60px -16px rgba(0,0,0,.8)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#161618", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 9, padding: "6px 10px", marginBottom: 6 }}>
              <Icon name="search" size={14} color="#79797F" />
              <input
                aria-label="Search tools"
                autoFocus
                placeholder="Search tools…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "#EDEDF0", fontSize: 12.5 }}
              />
            </div>

            {query.trim() === "" ? (
              TOOL_GROUPS.map((group) => (
                <div key={group.category} style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: "#79797F", padding: "6px 9px 3px" }}>{group.category}</div>
                  {group.tools.map(row)}
                </div>
              ))
            ) : filtered.length > 0 ? (
              filtered.map(row)
            ) : (
              <div style={{ fontSize: 12, color: "#79797F", padding: "10px 9px" }}>No tools match “{query.trim()}”.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
