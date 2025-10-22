import React from "react";
import { BrowserRouter, Link } from "react-router-dom";
import AppRoutes from "./routes";

export default function App() {
  return (
    <BrowserRouter>
  <nav className="space-nav">
    <Link to="/" className="space-nav-link">Home</Link>
    <Link to="/epic" className="space-nav-link">Blog Noticias</Link>
    <Link to="/gibs" className="space-nav-link">GIBS</Link>
    <Link to="/rover" className="space-nav-link">Rover</Link>
    <Link to="/library" className="space-nav-link">Imágenes/Video</Link>
    <Link to="/asteroids" className="space-nav-link">Acercamientos de Asteroides</Link>
  </nav>
  <div className="space-content" style={{padding:0, margin:0}}>
    <AppRoutes />
  </div>
</BrowserRouter>
  );
}