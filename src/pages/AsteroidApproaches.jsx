import React from "react";
import AsteroidCloseApproaches from "../components/AsteroidCloseApproaches";

export default function AsteroidsPage() {
  return (
    <div>
      <h2>Asteroides - Acercamientos Cercanos a la Tierra</h2>
      <p>Consulta los asteroides que han pasado cerca de la Tierra recientemente.</p>
      <AsteroidCloseApproaches />
    </div>
  );
}