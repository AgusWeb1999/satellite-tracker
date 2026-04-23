import { useState, useEffect, useRef, useCallback } from "react";
import "../styles/lote.css";

// ─── Config ───────────────────────────────────────────────────────────────────
const GIBS = "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi";
const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

// NDVI simulado por zona del polígono (en producción vendría de Sentinel-2)
// Con Sentinel Hub real se haría via Process API con el polígono como WKT
function simulateNDVI(polygon, date) {
  // Genera valores NDVI realistas basados en la semilla del polígono y fecha
  const seed = polygon.reduce((a, p) => a + p.lat + p.lng, 0);
  const month = parseInt(date.split("-")[1]);
  // Estacionalidad: verano (dic-feb) mejor NDVI en Uruguay
  const seasonal = month >= 11 || month <= 2 ? 0.12 : month >= 6 && month <= 8 ? -0.08 : 0;
  const base = 0.45 + (seed % 0.3) + seasonal;
  const zones = [
    { label: "Zona Norte", ndvi: Math.min(0.92, base + 0.18 + Math.random() * 0.05), pct: 28 },
    { label: "Zona Centro", ndvi: Math.min(0.92, base + 0.06 + Math.random() * 0.05), pct: 35 },
    { label: "Zona Sur",    ndvi: Math.min(0.92, base - 0.04 + Math.random() * 0.05), pct: 22 },
    { label: "Zona Crítica",ndvi: Math.max(0.08, base - 0.22 + Math.random() * 0.04), pct: 15 },
  ];
  const avg = zones.reduce((a, z) => a + z.ndvi * z.pct / 100, 0);
  return { zones, avg: parseFloat(avg.toFixed(3)) };
}

function ndviColor(v) {
  if (v >= 0.7) return "#16a34a";
  if (v >= 0.55) return "#65a30d";
  if (v >= 0.4)  return "#ca8a04";
  if (v >= 0.25) return "#ea580c";
  return "#dc2626";
}

function ndviLabel(v) {
  if (v >= 0.7)  return "Excelente";
  if (v >= 0.55) return "Bueno";
  if (v >= 0.4)  return "Regular";
  if (v >= 0.25) return "Bajo";
  return "Crítico";
}

function ndviStatus(v) {
  if (v >= 0.55) return { icon: "✓", text: "Sin alertas", cls: "ok" };
  if (v >= 0.4)  return { icon: "!", text: "Monitorear", cls: "warn" };
  return { icon: "✕", text: "Acción requerida", cls: "crit" };
}

function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  const ms = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${ms[parseInt(m)-1]} ${y}`;
}

function getDateBefore(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function calcArea(polygon) {
  // Aproximación simple por bounding box en km² para mostrar
  if (polygon.length < 3) return 0;
  const lats = polygon.map(p => p.lat);
  const lngs = polygon.map(p => p.lng);
  const dlat = (Math.max(...lats) - Math.min(...lats)) * 111;
  const dlng = (Math.max(...lngs) - Math.min(...lngs)) * 111 * Math.cos(lats[0] * Math.PI / 180);
  return parseFloat((dlat * dlng).toFixed(1));
}

// ─── Hook: clima Open-Meteo ───────────────────────────────────────────────────
function useClima(center) {
  const [clima, setClima] = useState(null);
  useEffect(() => {
    if (!center) return;
    fetch(`${OPEN_METEO}?latitude=${center.lat}&longitude=${center.lng}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration&timezone=America/Montevideo&past_days=14&forecast_days=1`)
      .then(r => r.json())
      .then(d => {
        const daily = d.daily;
        const last14Precip = daily.precipitation_sum.reduce((a, v) => a + (v || 0), 0);
        const avgMaxTemp = daily.temperature_2m_max.reduce((a, v) => a + v, 0) / daily.temperature_2m_max.length;
        const et0 = daily.et0_fao_evapotranspiration.reduce((a, v) => a + (v || 0), 0);
        const waterBalance = last14Precip - et0;
        setClima({
          precip14: parseFloat(last14Precip.toFixed(1)),
          avgMaxTemp: parseFloat(avgMaxTemp.toFixed(1)),
          et0_14: parseFloat(et0.toFixed(1)),
          waterBalance: parseFloat(waterBalance.toFixed(1)),
          fechas: daily.time,
          precipDays: daily.precipitation_sum,
        });
      })
      .catch(() => setClima(null));
  }, [center?.lat, center?.lng]);
  return clima;
}

// ─── Componente: Mini gráfico de barras ──────────────────────────────────────
function PrecipChart({ days, values }) {
  if (!days || !values) return null;
  const max = Math.max(...values, 1);
  const last7 = days.slice(-7);
  const vals7 = values.slice(-7);
  return (
    <div className="lote-chart">
      {vals7.map((v, i) => (
        <div key={i} className="lote-chart-col">
          <div className="lote-chart-bar-wrap">
            <div className="lote-chart-bar" style={{ height: `${(v / max) * 100}%`, opacity: v > 0 ? 1 : 0.2 }} />
          </div>
          <div className="lote-chart-lbl">{last7[i]?.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Componente: Mapa con dibujo de polígono ─────────────────────────────────
function DrawMap({ polygon, setPolygon, date, cloudMode }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const polyRef = useRef(null);
  const markersRef = useRef([]);
  const gibsRef = useRef([]);
  const [drawing, setDrawing] = useState(false);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const L = window.L;
    if (!L) return;
    const map = L.map(divRef.current, { center: [-32.8, -56.0], zoom: 8 });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19, opacity: 0.5,
    }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19, opacity: 0.9, zIndex: 900,
    }).addTo(map);

    // Agregar NDVI layer
    const ndviLayer = L.tileLayer.wms(GIBS, {
      layers: cloudMode === "daily" ? "MODIS_Terra_NDVI_8Day" : "MODIS_Terra_NDVI_16Day",
      format: "image/png", transparent: true, version: "1.3.0",
      time: date, opacity: 0.8, zIndex: 500,
    });
    ndviLayer.addTo(map);
    gibsRef.current = [ndviLayer];

    map.on("click", (e) => {
      if (!drawingRef.current) return;
      const pt = { lat: parseFloat(e.latlng.lat.toFixed(5)), lng: parseFloat(e.latlng.lng.toFixed(5)) };
      setPolygon(prev => {
        const next = [...prev, pt];
        return next;
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Sync drawing ref
  useEffect(() => { drawingRef.current = drawing; }, [drawing]);

  // Actualizar GIBS cuando cambia fecha
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current) return;
    gibsRef.current.forEach(l => mapRef.current.removeLayer(l));
    const ndviLayer = L.tileLayer.wms(GIBS, {
      layers: cloudMode === "daily" ? "MODIS_Terra_NDVI_8Day" : "MODIS_Terra_NDVI_16Day",
      format: "image/png", transparent: true, version: "1.3.0",
      time: date, opacity: 0.8, zIndex: 500,
    });
    ndviLayer.addTo(mapRef.current);
    gibsRef.current = [ndviLayer];
  }, [date, cloudMode]);

  // Renderizar polígono y marcadores
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current) return;

    markersRef.current.forEach(m => mapRef.current.removeLayer(m));
    markersRef.current = [];
    if (polyRef.current) { mapRef.current.removeLayer(polyRef.current); polyRef.current = null; }

    if (polygon.length === 0) return;

    // Marcadores de vértices
    polygon.forEach((pt, i) => {
      const m = L.circleMarker([pt.lat, pt.lng], {
        radius: 5, fillColor: i === 0 ? "#22c55e" : "#38bdf8",
        fillOpacity: 1, color: "#fff", weight: 2,
      }).addTo(mapRef.current);
      markersRef.current.push(m);
    });

    // Polígono cerrado si hay 3+ puntos
    if (polygon.length >= 3) {
      const poly = L.polygon(polygon.map(p => [p.lat, p.lng]), {
        color: "#22c55e", weight: 2, fillColor: "#22c55e", fillOpacity: 0.15,
      }).addTo(mapRef.current);
      polyRef.current = poly;
      if (polygon.length === 3) {
        mapRef.current.fitBounds(poly.getBounds(), { padding: [40, 40] });
      }
    }
  }, [polygon]);

  const handleClear = () => { setPolygon([]); setDrawing(false); };

  return (
    <div className="lote-draw-wrapper">
      <div ref={divRef} className="lote-draw-map" style={{
        cursor: drawing ? "crosshair" : "grab"
      }} />
      <div className="lote-draw-controls">
        <button
          className={`lote-draw-btn ${drawing ? "active" : ""}`}
          onClick={() => setDrawing(d => !d)}
        >
          {drawing ? "✏ Dibujando… (click para agregar puntos)" : "✏ Dibujar lote"}
        </button>
        {polygon.length > 0 && (
          <>
            <span className="lote-draw-pts">{polygon.length} puntos</span>
            <button className="lote-draw-clear" onClick={handleClear}>✕ Limpiar</button>
          </>
        )}
      </div>
      {drawing && polygon.length < 3 && (
        <div className="lote-draw-hint">Hacé click en el mapa para marcar los bordes del lote. Mínimo 3 puntos.</div>
      )}
    </div>
  );
}

// ─── Generador de PDF con jsPDF (browser) ────────────────────────────────────
async function generatePDF(reporte) {
  // Carga jsPDF dinámicamente
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, M = 18;
  let y = 0;

  // Fondo oscuro header
  doc.setFillColor(8, 12, 20);
  doc.rect(0, 0, W, 42, "F");

  // Logo / título
  doc.setTextColor(34, 197, 94);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("AgroSat Uruguay", M, 18);

  doc.setTextColor(180, 200, 220);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Reporte de Salud de Lote", M, 26);
  doc.text(`Generado: ${new Date().toLocaleDateString("es-UY")}`, M, 32);

  // Badge de estado
  const stColor = reporte.ndviActual >= 0.55 ? [34, 197, 94] : reporte.ndviActual >= 0.4 ? [202, 138, 4] : [220, 38, 38];
  doc.setFillColor(...stColor);
  doc.roundedRect(W - M - 40, 12, 40, 14, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(ndviLabel(reporte.ndviActual).toUpperCase(), W - M - 20, 21, { align: "center" });

  y = 52;

  // ── Sección 1: Info del lote
  doc.setTextColor(34, 197, 94);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("INFORMACIÓN DEL LOTE", M, y);
  y += 2;
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 7;

  const infoRows = [
    ["Nombre del lote", reporte.nombre],
    ["Fecha de análisis", fmtDate(reporte.fecha)],
    ["Fecha comparación", fmtDate(reporte.fechaAnterior)],
    ["Superficie", `${reporte.area} km²`],
    ["Departamento", reporte.dept || "Uruguay"],
    ["Coordenadas (centro)", reporte.centro ? `${reporte.centro.lat.toFixed(4)}, ${reporte.centro.lng.toFixed(4)}` : "—"],
  ];

  doc.setFontSize(9);
  infoRows.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 120, 140);
    doc.text(k, M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(String(v), M + 60, y);
    y += 6;
  });

  y += 4;

  // ── Sección 2: NDVI
  doc.setFillColor(240, 248, 240);
  doc.roundedRect(M, y, W - 2 * M, 28, 3, 3, "F");

  doc.setTextColor(34, 197, 94);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("NDVI PROMEDIO DEL LOTE", M + 6, y + 8);

  // NDVI actual grande
  doc.setFontSize(32);
  doc.setTextColor(...stColor);
  doc.text(reporte.ndviActual.toFixed(3), M + 6, y + 22);

  // NDVI anterior + delta
  const delta = reporte.ndviActual - reporte.ndviAnterior;
  doc.setFontSize(11);
  doc.setTextColor(100, 120, 140);
  doc.text(`Anterior: ${reporte.ndviAnterior.toFixed(3)}`, M + 55, y + 14);
  doc.setTextColor(delta >= 0 ? 34 : 220, delta >= 0 ? 197 : 38, delta >= 0 ? 94 : 38);
  doc.text(`${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}% vs período anterior`, M + 55, y + 22);

  y += 36;

  // ── Sección 3: Zonas
  doc.setTextColor(34, 197, 94);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("ANÁLISIS POR ZONA", M, y);
  y += 2;
  doc.line(M, y, W - M, y);
  y += 7;

  reporte.zones.forEach(z => {
    const barW = 80;
    const filled = barW * z.ndvi;
    const col = ndviColor(z.ndvi);
    const rgb = hexToRgb(col);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text(z.label, M, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${z.pct}% del área`, M + 38, y);

    // Barra
    doc.setFillColor(230, 235, 230);
    doc.roundedRect(M + 65, y - 4, barW, 5, 1, 1, "F");
    doc.setFillColor(...rgb);
    doc.roundedRect(M + 65, y - 4, filled, 5, 1, 1, "F");

    doc.setTextColor(...rgb);
    doc.setFont("helvetica", "bold");
    doc.text(z.ndvi.toFixed(3), M + 65 + barW + 4, y);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(ndviLabel(z.ndvi), M + 65 + barW + 22, y);

    y += 9;
  });

  y += 4;

  // ── Sección 4: Clima (si hay)
  if (reporte.clima) {
    doc.setFillColor(235, 245, 255);
    doc.roundedRect(M, y, W - 2 * M, 32, 3, 3, "F");

    doc.setTextColor(56, 189, 248);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS CLIMÁTICOS (últimos 14 días)", M + 6, y + 8);

    const climaData = [
      ["Precipitación acumulada", `${reporte.clima.precip14} mm`],
      ["Temp. máx. promedio", `${reporte.clima.avgMaxTemp} °C`],
      ["Evapotranspiración (ET₀)", `${reporte.clima.et0_14} mm`],
      ["Balance hídrico", `${reporte.clima.waterBalance > 0 ? "+" : ""}${reporte.clima.waterBalance} mm`],
    ];

    doc.setFontSize(8.5);
    let cx = M + 6, climaY = y + 15;
    climaData.forEach(([k, v], i) => {
      if (i === 2) { cx = M + 90; climaY = y + 15; }
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 100, 120);
      doc.text(k, cx, climaY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(v, cx, climaY + 6);
      climaY += 14;
    });

    y += 40;
  }

  // ── Sección 5: Recomendaciones
  doc.setTextColor(34, 197, 94);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("RECOMENDACIONES", M, y);
  y += 2;
  doc.line(M, y, W - M, y);
  y += 7;

  const recs = getRecomendaciones(reporte);
  recs.forEach(r => {
    doc.setFillColor(r.type === "crit" ? 254 : r.type === "warn" ? 255 : 240,
                     r.type === "crit" ? 242 : r.type === "warn" ? 251 : 248,
                     r.type === "crit" ? 242 : r.type === "warn" ? 215 : 240);
    doc.roundedRect(M, y, W - 2 * M, 10, 2, 2, "F");
    const iconColor = r.type === "crit" ? [220, 38, 38] : r.type === "warn" ? [202, 138, 4] : [34, 197, 94];
    doc.setTextColor(...iconColor);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(r.icon, M + 4, y + 6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(r.text, W - 2 * M - 14);
    doc.text(lines, M + 10, y + 6.5);
    y += 13;
  });

  // Footer
  y = 285;
  doc.setFillColor(8, 12, 20);
  doc.rect(0, y, W, 15, "F");
  doc.setTextColor(60, 80, 100);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("AgroSat Uruguay · Datos: NASA GIBS, FIRMS, Open-Meteo · Uso interno — no constituye asesoramiento agronómico profesional", W / 2, y + 8, { align: "center" });

  doc.save(`AgroSat_${reporte.nombre.replace(/\s+/g, "_")}_${reporte.fecha}.pdf`);
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function getRecomendaciones(reporte) {
  const recs = [];
  const delta = reporte.ndviActual - reporte.ndviAnterior;
  const critZone = reporte.zones?.find(z => z.label === "Zona Crítica");

  if (reporte.ndviActual < 0.35) {
    recs.push({ type: "crit", icon: "✕", text: "NDVI crítico. Verificar presencia de estrés severo, plagas o muerte de cobertura. Visita de campo urgente recomendada." });
  } else if (reporte.ndviActual < 0.5) {
    recs.push({ type: "warn", icon: "!", text: "NDVI por debajo del óptimo. Evaluar fertilización nitrogenada o riego si hay déficit hídrico." });
  } else {
    recs.push({ type: "ok", icon: "✓", text: "NDVI en rango saludable. Continuar monitoreo periódico." });
  }

  if (delta < -0.08) {
    recs.push({ type: "crit", icon: "✕", text: `Caída de NDVI del ${Math.abs((delta * 100)).toFixed(1)}% respecto al período anterior. Investigar causa: posible estrés hídrico, enfermedad o daño por helada.` });
  } else if (delta < -0.04) {
    recs.push({ type: "warn", icon: "!", text: `Tendencia negativa (${(delta * 100).toFixed(1)}%). Monitorear en los próximos 8 días.` });
  }

  if (critZone && critZone.ndvi < 0.35) {
    recs.push({ type: "crit", icon: "!", text: `Zona Crítica (${critZone.pct}% del área) con NDVI ${critZone.ndvi.toFixed(2)}. Priorizar inspección en esa zona del lote.` });
  }

  if (reporte.clima) {
    if (reporte.clima.waterBalance < -25) {
      recs.push({ type: "warn", icon: "!", text: `Déficit hídrico: balance de ${reporte.clima.waterBalance} mm en 14 días. Considerar riego si el cultivo lo permite.` });
    }
    if (reporte.clima.precip14 > 80) {
      recs.push({ type: "warn", icon: "!", text: `Alta precipitación (${reporte.clima.precip14} mm / 14 días). Verificar drenaje y riesgo de enfermedades fúngicas.` });
    }
  }

  return recs;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function LoteMonitor() {
  const [polygon, setPolygon] = useState([]);
  const [loteName, setLoteName] = useState("Mi Lote");
  const [date, setDate] = useState("2026-04-01");
  const [cloudMode, setCloudMode] = useState("d8");
  const [step, setStep] = useState("draw"); // draw | analyze | report
  const [ndviActual, setNdviActual] = useState(null);
  const [ndviAnterior, setNdviAnterior] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const dateAnterior = getDateBefore(date, 16);

  const center = polygon.length >= 3
    ? { lat: polygon.reduce((a, p) => a + p.lat, 0) / polygon.length,
        lng: polygon.reduce((a, p) => a + p.lng, 0) / polygon.length }
    : null;

  const clima = useClima(center);
  const area = calcArea(polygon);

  const handleAnalyze = () => {
    if (polygon.length < 3) return;
    setAnalyzing(true);
    setTimeout(() => {
      const resActual = simulateNDVI(polygon, date);
      const resAnterior = simulateNDVI(polygon, dateAnterior);
      setNdviActual(resActual);
      setNdviAnterior(resAnterior);
      setAnalyzing(false);
      setStep("report");
    }, 1200);
  };

  const handleGeneratePDF = async () => {
    if (!ndviActual) return;
    setGenerating(true);
    try {
      await generatePDF({
        nombre: loteName,
        fecha: date,
        fechaAnterior: dateAnterior,
        area,
        centro: center,
        dept: "Uruguay",
        ndviActual: ndviActual.avg,
        ndviAnterior: ndviAnterior.avg,
        zones: ndviActual.zones,
        clima,
      });
    } finally {
      setGenerating(false);
    }
  };

  const delta = ndviActual && ndviAnterior ? ndviActual.avg - ndviAnterior.avg : null;
  const status = ndviActual ? ndviStatus(ndviActual.avg) : null;
  const recs = ndviActual ? getRecomendaciones({
    ndviActual: ndviActual.avg,
    ndviAnterior: ndviAnterior?.avg || 0,
    zones: ndviActual.zones,
    clima,
  }) : [];

  return (
    <div className="lote-wrapper">
      {/* Header */}
      <div className="lote-header">
        <div className="lote-header-left">
          <span className="lote-header-icon">🌾</span>
          <div>
            <h2 className="lote-title">Reporte de Salud de Lote</h2>
            <p className="lote-subtitle">Dibujá tu lote · Analizá · Descargá el reporte</p>
          </div>
        </div>
        <div className="lote-header-right">
          <input
            className="lote-name-input"
            value={loteName}
            onChange={e => setLoteName(e.target.value)}
            placeholder="Nombre del lote"
          />
          <input
            type="date" className="lote-date"
            value={date} max={today} min="2020-01-01"
            onChange={e => { setDate(e.target.value); setStep("draw"); setNdviActual(null); }}
          />
          <div className="lote-comp-btns">
            {["daily","d8","d16"].map(m => (
              <button key={m} className={`lote-comp-btn ${cloudMode === m ? "active" : ""}`}
                onClick={() => setCloudMode(m)}
                title={m === "daily" ? "Imagen del día" : m === "d8" ? "Composición 8 días" : "Composición 16 días"}>
                {m === "daily" ? "1d" : m === "d8" ? "8d" : "16d"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="lote-steps">
        {[
          { id: "draw",    n: "1", label: "Dibujá el lote" },
          { id: "analyze", n: "2", label: "Analizá" },
          { id: "report",  n: "3", label: "Ver reporte" },
        ].map(s => (
          <div key={s.id} className={`lote-step ${step === s.id ? "active" : ""} ${
            (s.id === "analyze" && (step === "report")) ||
            (s.id === "draw" && step !== "draw") ? "done" : ""
          }`}>
            <span className="lote-step-n">{s.n}</span>
            <span className="lote-step-lbl">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="lote-content">
        {/* Panel izquierdo: mapa */}
        <div className="lote-map-col">
          <DrawMap
            polygon={polygon}
            setPolygon={setPolygon}
            date={date}
            cloudMode={cloudMode}
          />

          {/* Info del polígono dibujado */}
          {polygon.length >= 3 && (
            <div className="lote-poly-info">
              <span>📍 {polygon.length} vértices</span>
              <span>📐 ~{area} km²</span>
              <span>📅 Comparando: {fmtDate(date)} vs {fmtDate(dateAnterior)}</span>
              <button
                className="lote-analyze-btn"
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? "Analizando…" : "🔍 Analizar lote →"}
              </button>
            </div>
          )}

          {polygon.length < 3 && (
            <div className="lote-empty-hint">
              <span>👆 Activá "Dibujar lote" y marcá los bordes de tu campo en el mapa</span>
            </div>
          )}
        </div>

        {/* Panel derecho: reporte */}
        <div className="lote-report-col">
          {!ndviActual && !analyzing && (
            <div className="lote-report-empty">
              <div className="lote-report-empty-icon">🛰</div>
              <div className="lote-report-empty-title">Esperando análisis</div>
              <div className="lote-report-empty-sub">Dibujá tu lote en el mapa y presioná "Analizar lote"</div>
            </div>
          )}

          {analyzing && (
            <div className="lote-report-empty">
              <div className="lote-report-empty-icon lote-spin">🛰</div>
              <div className="lote-report-empty-title">Consultando satélites…</div>
              <div className="lote-report-empty-sub">Procesando NDVI · Comparando fechas · Cruzando clima</div>
            </div>
          )}

          {ndviActual && !analyzing && (
            <div className="lote-report">
              {/* Status badge */}
              <div className={`lote-status-badge lote-status-${status.cls}`}>
                <span className="lote-status-icon">{status.icon}</span>
                <span>{status.text}</span>
              </div>

              {/* NDVI principal */}
              <div className="lote-ndvi-main">
                <div className="lote-ndvi-block">
                  <div className="lote-ndvi-label">NDVI actual</div>
                  <div className="lote-ndvi-value" style={{ color: ndviColor(ndviActual.avg) }}>
                    {ndviActual.avg.toFixed(3)}
                  </div>
                  <div className="lote-ndvi-label-sub">{ndviLabel(ndviActual.avg)}</div>
                </div>
                <div className="lote-ndvi-vs">vs</div>
                <div className="lote-ndvi-block">
                  <div className="lote-ndvi-label">16 días atrás</div>
                  <div className="lote-ndvi-value lote-ndvi-prev">
                    {ndviAnterior.avg.toFixed(3)}
                  </div>
                  <div className="lote-ndvi-label-sub">{ndviLabel(ndviAnterior.avg)}</div>
                </div>
                <div className={`lote-delta ${delta >= 0 ? "up" : "down"}`}>
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}%
                </div>
              </div>

              {/* Zonas */}
              <div className="lote-section-title">ZONAS DEL LOTE</div>
              <div className="lote-zones">
                {ndviActual.zones.map(z => (
                  <div key={z.label} className="lote-zone-row">
                    <div className="lote-zone-info">
                      <span className="lote-zone-name">{z.label}</span>
                      <span className="lote-zone-pct">{z.pct}%</span>
                    </div>
                    <div className="lote-zone-bar-bg">
                      <div className="lote-zone-bar-fill"
                        style={{ width: `${z.ndvi * 100}%`, background: ndviColor(z.ndvi) }} />
                    </div>
                    <span className="lote-zone-val" style={{ color: ndviColor(z.ndvi) }}>
                      {z.ndvi.toFixed(2)}
                    </span>
                    <span className="lote-zone-lbl">{ndviLabel(z.ndvi)}</span>
                  </div>
                ))}
              </div>

              {/* Clima */}
              {clima && (
                <>
                  <div className="lote-section-title">CLIMA · últimos 14 días</div>
                  <div className="lote-clima-grid">
                    <div className="lote-clima-card">
                      <div className="lote-clima-val">{clima.precip14}<span>mm</span></div>
                      <div className="lote-clima-lbl">Precipitación</div>
                    </div>
                    <div className="lote-clima-card">
                      <div className="lote-clima-val">{clima.avgMaxTemp}<span>°C</span></div>
                      <div className="lote-clima-lbl">Temp. máx. prom.</div>
                    </div>
                    <div className="lote-clima-card">
                      <div className="lote-clima-val">{clima.et0_14}<span>mm</span></div>
                      <div className="lote-clima-lbl">ET₀</div>
                    </div>
                    <div className={`lote-clima-card ${clima.waterBalance < -20 ? "warn" : ""}`}>
                      <div className="lote-clima-val">
                        {clima.waterBalance > 0 ? "+" : ""}{clima.waterBalance}<span>mm</span>
                      </div>
                      <div className="lote-clima-lbl">Balance hídrico</div>
                    </div>
                  </div>
                  <PrecipChart days={clima.fechas} values={clima.precipDays} />
                </>
              )}

              {/* Recomendaciones */}
              <div className="lote-section-title">RECOMENDACIONES</div>
              <div className="lote-recs">
                {recs.map((r, i) => (
                  <div key={i} className={`lote-rec lote-rec-${r.type}`}>
                    <span className="lote-rec-icon">{r.icon}</span>
                    <span>{r.text}</span>
                  </div>
                ))}
              </div>

              {/* Botón PDF */}
              <button className="lote-pdf-btn" onClick={handleGeneratePDF} disabled={generating}>
                {generating ? "Generando PDF…" : "📄 Descargar reporte PDF"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
