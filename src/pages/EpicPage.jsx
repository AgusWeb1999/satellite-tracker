import React from "react";
import "../styles/landingBase.css";
import "../styles/epicLanding.css";

export default function EpicPage() {
  return (
    <div className="landing-bg">
      <div className="landing-content">
        <h2 className="landing-title landing-epic-accent">
          🌍 EPIC: Imágenes de la Tierra en alta resolución
        </h2>
        <p className="landing-desc">
          Explora imágenes diarias de la Tierra tomadas por el satélite DSCOVR EPIC.
        </p>
        {/* ...tu contenido específico acá... */}
      </div>
    </div>
  );
}