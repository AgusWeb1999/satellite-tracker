import React from "react";
import { Link } from "react-router-dom";
import "../styles/home.css";
import CardsBlogSection from "../components/CardsBlogSection";

export default function Home() {
  return (
    <div className="space-home-bg">
      <div className="space-home-overlay">
        <div className="space-stars"></div>
        <div className="space-stars2"></div>
        <div className="space-stars3"></div>
        <header className="space-home-header">
          <h1>
            <span
              role="img"
              aria-label="rocket"
              style={{
                filter: "drop-shadow(0 0 8px #39ff14cc)",
                fontSize: "2.6rem",
                verticalAlign: "middle",
                marginRight: "0.5rem",
              }}
            >
              🚀
            </span>
            <span
              style={{
                background: "linear-gradient(90deg, #2ffcff 30%, #a259ff 80%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 0 16px #2ffcff88",
                fontWeight: 800,
                fontSize: "2.7rem",
                verticalAlign: "middle",
              }}
            >
              ESPACIO Blog
            </span>
          </h1>
          <p className="space-home-subtitle">
            Explora distintas APIs de la NASA con ejemplos interactivos.
          </p>
        </header>
        <nav className="space-home-nav">
          <Link to="/epic" className="space-btn neon-blue">
            Blog Noticias
          </Link>
          <Link to="/gibs" className="space-btn neon-purple">
            Visualizador GIBS
          </Link>
          <Link to="/rover" className="space-btn neon-orange">
            Fotos de Rovers en Marte
          </Link>
          <Link to="/asteroids" className="space-btn neon-green">
            Asteroides Cercanos
          </Link>
          <Link to="/library" className="space-btn neon-pink">
            Librería Imágenes/Video
          </Link>
        </nav>

        {/* AQUÍ las cards debajo de los links */}
        <CardsBlogSection />

        <footer className="space-home-footer">
          Hecho por AgusWeb1999 🚀
        </footer>
      </div>
    </div>
  );
}