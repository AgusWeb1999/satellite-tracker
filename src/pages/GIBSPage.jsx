import React from "react";
import "../styles/landingBase.css";
import "../styles/gibsLanding.css";
import GibsImageSelector from "../components/GibsImageSelector";

export default function GIBSPage() {
  return (
    <div className="landing-bg">
      <div className="landing-content">
        <h2 className="landing-title landing-gibs-accent">
          🛰️ Visualizador GIBS (NASA Global Imagery Browse Services)
        </h2>
        <p className="landing-desc">
          Explora imágenes globales de la NASA usando el visualizador GIBS.
        </p>
        <GibsImageSelector />
      </div>
    </div>
  );
}