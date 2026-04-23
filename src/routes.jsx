import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import LibraryPage from "./pages/LibraryPage";
import GIBSPage from "./pages/GIBSPage";
import UruguayPage from "./pages/UruguayPage";
import AgroPage from "./pages/AgroPage";
import LotePage from "./pages/LotePage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/gibs" element={<GIBSPage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/uruguay" element={<UruguayPage />} />
      <Route path="/agro" element={<AgroPage />} />
      <Route path="/lote" element={<LotePage />} />
    </Routes>
  );
}
