import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import App from "./App";
import { loadTools } from "./data";
import { isToolsPath } from "./routes";
import { ToolsPage } from "./ToolsPage";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

if (isToolsPath(window.location.pathname, import.meta.env.BASE_URL)) {
  document.title = "The hackathon toolkit | Hackawon";
  root.render(<main className="p-6 text-sm text-muted">Loading toolkit…</main>);
  void loadTools().then(
    (data) => root.render(<ToolsPage data={data} base={import.meta.env.BASE_URL} />),
    () => root.render(<main className="p-6 text-sm text-muted">Could not load the toolkit.</main>),
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
