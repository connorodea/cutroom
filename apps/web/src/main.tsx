import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EditorShell } from "./editor/EditorShell";
import { LandingPage } from "./app/LandingPage";
import { routeFor } from "./app/route";
import "./app/global.css";

const view = routeFor(window.location.pathname) === "editor" ? <EditorShell /> : <LandingPage />;

createRoot(document.getElementById("root")!).render(<StrictMode>{view}</StrictMode>);
