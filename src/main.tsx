import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "framer-motion";
import App from "./App";
import "./styles.css";
import "./home.css";
import "./language.css";
import "./senior.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="always"><App /></MotionConfig>
  </React.StrictMode>
);
