import React from "react";
import App from "App";

export default function Home() {
  return (
    <div>
      <App />
      <footer style={{ marginTop: 32, textAlign: "center", fontSize: 14 }}>
        <hr />
        <p>
          Proyecto MVP de Astrofotografía Satelital y Realidad Aumentada &mdash; Ubicación: Montevideo, Uruguay
        </p>
      </footer>
    </div>
  );
}