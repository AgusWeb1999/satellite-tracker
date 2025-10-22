import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import EpicPage from "./pages/EpicPage";
import RoverPage from "./pages/RoverPage";
import LibraryPage from "./pages/LibraryPage";
import GIBSPage from "./pages/GIBSPage"; 
import AsteroidCloseApproaches from "./pages/AsteroidApproaches"; 

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/epic" element={<EpicPage />} />
      <Route path="/rover" element={<RoverPage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/gibs" element={<GIBSPage />} />
      <Route path="/asteroid" element={<AsteroidCloseApproaches />} />

    </Routes>
  );
}