import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EditorShell } from "./editor/EditorShell";
import "./app/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EditorShell />
  </StrictMode>,
);
