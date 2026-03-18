import { createRoot } from "react-dom/client";
import { ChatApp } from "./components/Chat/ChatApp";
import "./i18n";

const mountNode = document.getElementById("root");
if (!mountNode) {
  throw new Error("Renderer mount node #root not found.");
}

createRoot(mountNode).render(<ChatApp />);
