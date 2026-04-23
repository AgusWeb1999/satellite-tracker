import React from "react";
import { Link } from "react-router-dom";
import "../styles/home.css";

const CARDS = [
  {
    to: "/gibs",
    icon: "🌍",
    label: "Visualizador GIBS",
    desc: "Imágenes globales NASA en tiempo real. Color real, incendios, aerosoles y más.",
    accent: "#a259ff",
  },
  {
    to: "/uruguay",
    icon: "🛰️",
    label: "Uruguay Satélite",
    desc: "Monitor satelital de Uruguay: incendios, vegetación, temperatura superficial.",
    accent: "#2196F3",
  },
  {
    to: "/agro",
    icon: "🌱",
    label: "AgroSat",
    desc: "Monitoreo agropecuario por departamento. NDVI, estrés hídrico, alertas de incendio.",
    accent: "#22c55e",
  },
  {
    to: "/lote",
    icon: "🌾",
    label: "Reporte de Lote",
    desc: "Dibujá tu campo, analizá el NDVI por zona, compará fechas y descargá el reporte PDF.",
    accent: "#a3e635",
    featured: true,
  },
  {
    to: "/library",
    icon: "🎞️",
    label: "Librería NASA",
    desc: "Buscador de imágenes y videos del archivo multimedia de la NASA.",
    accent: "#ec4899",
  },
];

export default function Home() {
  return (
    <div className="space-home-bg">
      <div className="space-home-overlay">
        <div className="space-stars"></div>
        <div className="space-stars2"></div>
        <div className="space-stars3"></div>

        <header className="space-home-header">
          <h1>
            <span role="img" aria-label="rocket" style={{
              filter: "drop-shadow(0 0 8px #39ff14cc)",
              fontSize: "2.6rem", verticalAlign: "middle", marginRight: "0.5rem",
            }}>🚀</span>
            <span style={{
              background: "linear-gradient(90deg, #2ffcff 30%, #a259ff 80%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              textShadow: "0 0 16px #2ffcff88", fontWeight: 800,
              fontSize: "2.7rem", verticalAlign: "middle",
            }}>SatView</span>
          </h1>
          <p className="space-home-subtitle">
            Plataforma satelital NASA · Monitoreo ambiental y agropecuario para Uruguay
          </p>
        </header>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          maxWidth: 1000,
          margin: "0 auto",
          padding: "0 24px",
          width: "100%",
        }}>
          {CARDS.map(card => (
            <Link key={card.to} to={card.to} style={{ textDecoration: "none" }}>
              <div style={{
                background: card.featured ? "rgba(34,197,94,0.07)" : "rgba(10,15,25,0.85)",
                border: `1px solid ${card.featured ? "rgba(34,197,94,0.3)" : "#1e2d40"}`,
                borderRadius: 16,
                padding: "22px 20px",
                transition: "all 0.2s",
                cursor: "pointer",
                height: "100%",
                position: "relative",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = card.accent + "66"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = card.featured ? "rgba(34,197,94,0.3)" : "#1e2d40"; e.currentTarget.style.transform = "none"; }}
              >
                {card.featured && (
                  <div style={{
                    position: "absolute", top: 12, right: 12,
                    background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
                    borderRadius: 99, padding: "2px 8px",
                    fontSize: 10, fontWeight: 700, color: "#22c55e", letterSpacing: "0.05em",
                  }}>NUEVO</div>
                )}
                <div style={{ fontSize: 30, marginBottom: 10 }}>{card.icon}</div>
                <div style={{
                  fontSize: 15, fontWeight: 700, color: "#e2e8f0",
                  marginBottom: 7, letterSpacing: "-0.02em",
                }}>{card.label}</div>
                <div style={{ fontSize: 12, color: "#4b6080", lineHeight: 1.6 }}>{card.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        <footer className="space-home-footer" style={{ marginTop: 48 }}>
          Hecho por AgusWeb1999 🚀
        </footer>
      </div>
    </div>
  );
}
