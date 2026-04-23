import React from "react";
import { BrowserRouter, Link } from "react-router-dom";
import AppRoutes from "./routes";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
window.L = L;

export default function App() {
  return (
    <BrowserRouter>
      <nav className="space-nav">
        <Link to="/" className="space-nav-link">Home</Link>
        <Link to="/gibs" className="space-nav-link">GIBS</Link>
        <Link to="/uruguay" className="space-nav-link">Uruguay Satélite</Link>
        <Link to="/agro" className="space-nav-link">AgroSat</Link>
        <Link to="/lote" className="space-nav-link">Reporte Lote</Link>
        <Link to="/library" className="space-nav-link">Imágenes/Video</Link>
      </nav>
      <div className="space-content" style={{ padding: 0, margin: 0 }}>
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}
