import { useState, useEffect, useRef } from "react";
import "../styles/agro.css";

// ─── Config ──────────────────────────────────────────────────────────────────
const FIRMS_MAP_KEY = "df90a23e2cd4f3efc1056add8d904743";
const FIRMS_BBOX = "-62,-37,-52,-28";

// Sentinel Hub requiere registro, acá usamos Copernicus WMS público (gratis)
// Para Sentinel-2 de alta resolución por parcela usamos el endpoint de Copernicus
const SENTINEL_WMS = "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi";

// ─── Modos de composición (anti-nubes) ───────────────────────────────────────
// Cada modo usa una capa diferente de GIBS según el rango temporal.
// Las composiciones de 8/16 días y mensual fusionan múltiples imágenes
// eligiendo el "mejor píxel" sin nubes del período.
const CLOUD_MODES = {
  daily: {
    id: "daily",
    label: "Hoy",
    desc: "Imagen del día seleccionado. Puede tener nubes.",
    icon: "1d",
    // Capas base por módulo — igual que antes
    overrides: {},
  },
  d8: {
    id: "d8",
    label: "8 días",
    desc: "Composición de 8 días sin nubes. Mejor para NDVI.",
    icon: "8d",
    overrides: {
      ndvi:    ["MODIS_Terra_NDVI_8Day"],
      land:    ["MODIS_Terra_CorrectedReflectance_TrueColor"],  // no hay composición de color real 8d en GIBS
      drought: ["MODIS_Terra_Land_Surface_Temp_8Day"],
      fire:    [],  // incendios siempre diario
    },
  },
  d16: {
    id: "d16",
    label: "16 días",
    desc: "Composición 16 días. Máxima cobertura sin nubes.",
    icon: "16d",
    overrides: {
      ndvi:    ["MODIS_Terra_NDVI_16Day"],
      land:    ["MODIS_Terra_CorrectedReflectance_TrueColor"],
      drought: ["MODIS_Terra_Land_Surface_Temp_8Day"],
      fire:    [],
    },
  },
  monthly: {
    id: "monthly",
    label: "Mensual",
    desc: "Composición mensual. Sin nubes, ideal para tendencias.",
    icon: "1m",
    overrides: {
      ndvi:    ["MODIS_Terra_NDVI_8Day"],   // usamos 8d como proxy mensual
      land:    ["BlueMarble_ShadedRelief_Bathymetry"],  // Blue Marble sin nubes
      drought: ["MODIS_Terra_Land_Surface_Temp_8Day"],
      fire:    [],
    },
  },
};

// Capas base diarias por módulo (sin nubes no aplica)
const BASE_LAYERS_DAILY = {
  ndvi:    ["MODIS_Terra_CorrectedReflectance_TrueColor", "MODIS_Terra_NDVI_8Day"],
  fire:    ["MODIS_Terra_CorrectedReflectance_TrueColor", "MODIS_Terra_Thermal_Anomalies_All"],
  drought: ["MODIS_Terra_CorrectedReflectance_TrueColor", "MODIS_Aqua_Land_Surface_Temp_Day"],
  land:    ["MODIS_Terra_CorrectedReflectance_TrueColor"],
};

// Construye lista de capas según módulo + cloudMode
function getActiveLayers(moduleId, cloudMode) {
  if (cloudMode === "daily") {
    return BASE_LAYERS_DAILY[moduleId].map(layer => ({
      url: SENTINEL_WMS, layer, opacity: layer.includes("NDVI") || layer.includes("Temp") || layer.includes("Anomal") ? 0.85 : 1
    }));
  }
  const overrides = CLOUD_MODES[cloudMode].overrides[moduleId];
  if (!overrides || overrides.length === 0) {
    // fallback a diario
    return BASE_LAYERS_DAILY[moduleId].map(layer => ({
      url: SENTINEL_WMS, layer, opacity: layer.includes("NDVI") || layer.includes("Temp") || layer.includes("Anomal") ? 0.85 : 1
    }));
  }
  // composición: base neutra + capa sin nubes
  const baseLayers = moduleId !== "land" ? [{
    url: SENTINEL_WMS, layer: "BlueMarble_ShadedRelief_Bathymetry", opacity: 0.7
  }] : [];
  return [
    ...baseLayers,
    ...overrides.map(layer => ({
      url: SENTINEL_WMS, layer, opacity: layer.includes("NDVI") || layer.includes("Temp") ? 0.9 : 1
    }))
  ];
}

// Detecta nubosidad aproximada intentando cargar la Cloud Mask de MODIS
// Devuelve un porcentaje estimado (0-100). Si falla, devuelve null.
async function estimateCloudCover(bbox, date) {
  try {
    const [lon1, lat1, lon2, lat2] = bbox.split(",");
    const url = `${SENTINEL_WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
      `&BBOX=${lat1},${lon1},${lat2},${lon2}&CRS=EPSG:4326&WIDTH=64&HEIGHT=64` +
      `&LAYERS=MODIS_Terra_Cloud_Mask_Day&FORMAT=image/png&TIME=${date}&TRANSPARENT=true`;
    const res = await fetch(url);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    let cloudy = 0, total = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] > 10) { // pixel no transparente
        total++;
        // píxeles blancos/grises = nubes en Cloud Mask
        if (data[i] > 180 && data[i+1] > 180 && data[i+2] > 180) cloudy++;
      }
    }
    return total > 0 ? Math.round((cloudy / total) * 100) : null;
  } catch {
    return null;
  }
}

// ─── Capas por módulo ─────────────────────────────────────────────────────────
const MODULES = {
  ndvi: {
    id: "ndvi",
    icon: "🌱",
    label: "NDVI / Biomasa",
    sublabel: "Índice de vegetación por parcela",
    color: "#22c55e",
    colorDim: "#14532d",
    layers: [], // dinámico via getActiveLayers()
    legend: [
      { color: "#14532d", label: "Vegetación densa" },
      { color: "#86efac", label: "Vegetación media" },
      { color: "#a16207", label: "Suelo/cultivo seco" },
      { color: "#7c3aed", label: "Agua" },
    ],
    info: "El NDVI mide la densidad de vegetación activa. Valores altos indican pastizales o cultivos en buen estado. Caídas bruscas alertan estrés hídrico o enfermedad.",
  },
  fire: {
    id: "fire",
    icon: "🔥",
    label: "Incendios",
    sublabel: "Focos activos FIRMS · VIIRS",
    color: "#f97316",
    colorDim: "#7c2d12",
    layers: [
      { url: SENTINEL_WMS, layer: "MODIS_Terra_CorrectedReflectance_TrueColor", opacity: 1 },
      { url: SENTINEL_WMS, layer: "MODIS_Terra_Thermal_Anomalies_All", opacity: 1 },
    ],
    legend: [
      { color: "#ef4444", label: "Foco muy intenso" },
      { color: "#f97316", label: "Foco intenso" },
      { color: "#fbbf24", label: "Foco moderado" },
      { color: "#4ade80", label: "Sin anomalía" },
    ],
    info: "Detección en tiempo real de focos de calor usando los satélites VIIRS SNPP y NOAA-20. Actualización cada ~3 horas. Clave para alertas en zonas forestales y ganaderas.",
  },
  drought: {
    id: "drought",
    icon: "💧",
    label: "Estrés hídrico",
    sublabel: "Temperatura superficial LST",
    color: "#38bdf8",
    colorDim: "#0c4a6e",
    layers: [
      { url: SENTINEL_WMS, layer: "MODIS_Terra_CorrectedReflectance_TrueColor", opacity: 1 },
      { url: SENTINEL_WMS, layer: "MODIS_Aqua_Land_Surface_Temp_Day", opacity: 0.75 },
    ],
    legend: [
      { color: "#1e40af", label: "Temperatura baja / agua" },
      { color: "#38bdf8", label: "Temperatura moderada" },
      { color: "#f97316", label: "Temperatura alta" },
      { color: "#dc2626", label: "Estrés térmico severo" },
    ],
    info: "La temperatura superficial (LST) indica estrés hídrico antes de que sea visible. Combinada con NDVI permite detectar campos con riesgo de pérdida de cultivo.",
  },
  land: {
    id: "land",
    icon: "🗺️",
    label: "Uso de suelo",
    sublabel: "Cambios y cobertura",
    color: "#a78bfa",
    colorDim: "#4c1d95",
    layers: [
      { url: SENTINEL_WMS, layer: "MODIS_Terra_CorrectedReflectance_TrueColor", opacity: 1 },
    ],
    legend: [
      { color: "#22c55e", label: "Pastizal / campo" },
      { color: "#a3e635", label: "Cultivo activo" },
      { color: "#78716c", label: "Suelo desnudo" },
      { color: "#38bdf8", label: "Agua" },
    ],
    info: "Imagen en color real de alta resolución para análisis visual de uso de suelo. Comparar fechas permite detectar cambios de cobertura, deforestación o avance agrícola.",
  },
};

// Departamentos de Uruguay con centro aproximado
const DEPARTAMENTOS = [
  { name: "Artigas",     lat: -30.4,  lon: -56.5, bbox: "-57.5,-31.2,-55.0,-29.5" },
  { name: "Canelones",   lat: -34.5,  lon: -56.0, bbox: "-57.0,-35.0,-55.5,-33.8" },
  { name: "Cerro Largo", lat: -32.4,  lon: -54.2, bbox: "-55.5,-33.5,-53.0,-31.5" },
  { name: "Colonia",     lat: -34.1,  lon: -57.8, bbox: "-58.5,-34.7,-57.0,-33.5" },
  { name: "Durazno",     lat: -33.0,  lon: -56.5, bbox: "-57.5,-34.0,-55.5,-32.0" },
  { name: "Flores",      lat: -33.6,  lon: -56.9, bbox: "-57.8,-34.3,-56.0,-33.0" },
  { name: "Florida",     lat: -34.1,  lon: -55.8, bbox: "-56.5,-34.8,-55.0,-33.3" },
  { name: "Lavalleja",   lat: -33.9,  lon: -54.9, bbox: "-55.8,-34.7,-54.0,-33.2" },
  { name: "Maldonado",   lat: -34.5,  lon: -54.7, bbox: "-55.5,-35.0,-53.8,-34.0" },
  { name: "Montevideo",  lat: -34.9,  lon: -56.2, bbox: "-56.5,-35.0,-56.0,-34.7" },
  { name: "Paysandú",    lat: -32.3,  lon: -58.1, bbox: "-59.0,-33.5,-57.0,-31.0" },
  { name: "Rivera",      lat: -30.9,  lon: -55.5, bbox: "-56.5,-31.8,-54.5,-30.0" },
  { name: "Rocha",       lat: -34.0,  lon: -53.9, bbox: "-54.8,-34.7,-53.0,-33.2" },
  { name: "Salto",       lat: -31.4,  lon: -57.9, bbox: "-58.8,-32.5,-57.0,-30.3" },
  { name: "San José",    lat: -34.3,  lon: -56.7, bbox: "-57.5,-34.9,-56.0,-33.8" },
  { name: "Soriano",     lat: -33.5,  lon: -57.8, bbox: "-58.5,-34.2,-56.8,-32.7" },
  { name: "Tacuarembó",  lat: -31.7,  lon: -55.9, bbox: "-57.0,-32.8,-54.5,-30.5" },
  { name: "Treinta y Tres", lat: -33.2, lon: -54.4, bbox: "-55.5,-34.2,-53.5,-32.3" },
  { name: "Uruguay completo", lat: -32.8, lon: -56.0, bbox: "-62,-37,-52,-28" },
];

const DEMO_FIRES = [
  { lat: -31.2, lon: -55.8, brightness: 380, frp: 42.1, confidence: "h", dept: "Rivera" },
  { lat: -32.5, lon: -58.1, brightness: 420, frp: 78.3, confidence: "h", dept: "Paysandú" },
  { lat: -30.8, lon: -57.2, brightness: 310, frp: 18.5, confidence: "n", dept: "Salto" },
  { lat: -33.1, lon: -55.0, brightness: 355, frp: 31.2, confidence: "h", dept: "Durazno" },
  { lat: -34.2, lon: -57.9, brightness: 290, frp: 12.0, confidence: "l", dept: "Soriano" },
];

function getBrightnessColor(b) {
  if (b >= 400) return "#ef4444";
  if (b >= 350) return "#f97316";
  if (b >= 320) return "#fbbf24";
  return "#86efac";
}
function getBrightnessLabel(b) {
  if (b >= 400) return "Muy intenso";
  if (b >= 350) return "Intenso";
  if (b >= 320) return "Moderado";
  return "Débil";
}
function fmtDate(d) {
  const [y, m, day] = d.split("-");
  const m2 = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${m2[parseInt(m)-1]} ${y}`;
}

// ─── Mapa Leaflet puro ────────────────────────────────────────────────────────
function LeafletMap({ module, date, bbox, firePoints, cloudMode }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const gibsRef = useRef([]);
  const markersRef = useRef(null);

  // Init mapa
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const L = window.L;
    if (!L) return;
    const bboxParts = bbox.split(",").map(Number);
    const centerLat = (bboxParts[1] + bboxParts[3]) / 2;
    const centerLon = (bboxParts[0] + bboxParts[2]) / 2;

    const map = L.map(divRef.current, {
      center: [centerLat, centerLon],
      zoom: 8,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19, opacity: 0.5,
    }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19, opacity: 0.9, zIndex: 900,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Actualizar centro/zoom cuando cambia bbox
  useEffect(() => {
    if (!mapRef.current) return;
    const L = window.L;
    const parts = bbox.split(",").map(Number);
    const bounds = L.latLngBounds([[parts[1], parts[0]], [parts[3], parts[2]]]);
    mapRef.current.fitBounds(bounds, { padding: [20, 20] });
  }, [bbox]);

  // Actualizar capas GIBS
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current) return;
    gibsRef.current.forEach(l => mapRef.current.removeLayer(l));
    gibsRef.current = [];
    const activeLayers = getActiveLayers(module, cloudMode);
    activeLayers.forEach(({ url, layer, opacity }) => {
      const wms = L.tileLayer.wms(url, {
        layers: layer, format: "image/png", transparent: true,
        version: "1.3.0", time: date, opacity, zIndex: 500,
      });
      wms.addTo(mapRef.current);
      gibsRef.current.push(wms);
    });
  }, [module, date, cloudMode]);

  // Actualizar marcadores focos
  useEffect(() => {
    const L = window.L;
    if (!L || !markersRef.current) return;
    markersRef.current.clearLayers();
    if (module !== "fire") return;
    firePoints.forEach(p => {
      const c = L.circleMarker([p.lat, p.lon], {
        radius: p.confidence === "h" ? 10 : 6,
        fillColor: getBrightnessColor(p.brightness),
        fillOpacity: 0.9, color: "#fff", weight: 1.5,
      });
      c.bindPopup(`
        <div style="font-family:system-ui;min-width:160px">
          <b style="font-size:13px">🔥 ${getBrightnessLabel(p.brightness)}</b>
          <table style="width:100%;font-size:11px;margin-top:6px;border-collapse:collapse">
            <tr><td style="color:#666;padding:1px 6px 1px 0">Departamento</td><td><b>${p.dept || "—"}</b></td></tr>
            <tr><td style="color:#666;padding:1px 6px 1px 0">Temp.</td><td>${p.brightness} K</td></tr>
            <tr><td style="color:#666;padding:1px 6px 1px 0">Potencia</td><td>${p.frp} MW</td></tr>
            <tr><td style="color:#666;padding:1px 6px 1px 0">Confianza</td><td>${p.confidence === "h" ? "Alta" : p.confidence === "n" ? "Normal" : "Baja"}</td></tr>
          </table>
          <div style="font-size:10px;color:#999;margin-top:6px;border-top:1px solid #eee;padding-top:4px">NASA FIRMS · VIIRS</div>
        </div>
      `);
      markersRef.current.addLayer(c);
    });
  }, [firePoints, module]);

  return <div ref={divRef} style={{ width: "100%", height: "100%" }} />;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AgroMonitor() {
  const [module, setModule] = useState("ndvi");
  const [date, setDate] = useState("2026-04-01");
  const [dept, setDept] = useState(DEPARTAMENTOS[DEPARTAMENTOS.length - 1]);
  const [firePoints, setFirePoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [parcelas, setParcelas] = useState([
    { id: 1, nombre: "Campo Norte", dept: "Rivera", ha: 450, ndvi: 0.72, tendencia: "up", alerta: null },
    { id: 2, nombre: "Estancia Sur", dept: "Soriano", ha: 820, ndvi: 0.41, tendencia: "down", alerta: "Estrés hídrico detectado" },
    { id: 3, nombre: "Chacra Este", dept: "Cerro Largo", ha: 190, ndvi: 0.65, tendencia: "stable", alerta: null },
    { id: 4, nombre: "Potrero Río", dept: "Paysandú", ha: 310, ndvi: 0.58, tendencia: "up", alerta: null },
  ]);
  const [selectedParcela, setSelectedParcela] = useState(null);
  const [cloudMode, setCloudMode] = useState("daily");
  const [cloudCover, setCloudCover] = useState(null); // 0-100 or null
  const [checkingCloud, setCheckingCloud] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  // Detectar nubosidad automáticamente al cambiar fecha o departamento
  useEffect(() => {
    setCloudCover(null);
    setCheckingCloud(true);
    estimateCloudCover(dept.bbox, date).then(pct => {
      setCloudCover(pct);
      setCheckingCloud(false);
      // Auto-sugerir composición si hay >50% nubes y el modo es diario
      if (pct !== null && pct > 50 && cloudMode === "daily") {
        setCloudMode("d8");
      }
    });
  }, [date, dept]);

  // Fetch FIRMS
  useEffect(() => {
    if (module !== "fire") { setFirePoints([]); return; }
    setLoading(true);
    if (!FIRMS_MAP_KEY || FIRMS_MAP_KEY === "TU_MAP_KEY") {
      setTimeout(() => { setFirePoints(DEMO_FIRES); setLoading(false); }, 400);
      return;
    }
    Promise.all(
      ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT"].map(src =>
        fetch(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/${src}/${FIRMS_BBOX}/1/${date}`)
          .then(r => r.text()).catch(() => "")
      )
    ).then(csvs => {
      const parse = csv => {
        const lines = csv.trim().split("\n");
        if (lines.length < 2) return [];
        const h = lines[0].split(",");
        const li = h.indexOf("latitude"), lo = h.indexOf("longitude");
        const bi = h.indexOf("bright_ti4"), fi = h.indexOf("frp"), ci = h.indexOf("confidence");
        return lines.slice(1).map(l => {
          const c = l.split(",");
          const conf = (c[ci] || "").trim().toLowerCase();
          const lat = parseFloat(c[li]), lon = parseFloat(c[lo]);
          const deptMatch = DEPARTAMENTOS.find(d => {
            const [bx1,by1,bx2,by2] = d.bbox.split(",").map(Number);
            return lon >= bx1 && lon <= bx2 && lat >= by1 && lat <= by2;
          });
          return { lat, lon, brightness: parseFloat(c[bi]), frp: parseFloat(c[fi]),
            confidence: conf === "high" ? "h" : conf === "low" ? "l" : "n",
            dept: deptMatch?.name || "Uruguay" };
        }).filter(p => !isNaN(p.lat) && !isNaN(p.lon));
      };
      const all = csvs.flatMap(parse);
      setFirePoints(all.length > 0 ? all : DEMO_FIRES);
      setLoading(false);
    }).catch(() => { setFirePoints(DEMO_FIRES); setLoading(false); });
  }, [module, date]);

  const mod = MODULES[module];
  const highFires = firePoints.filter(p => p.confidence === "h");
  const alertParcelas = parcelas.filter(p => p.alerta);

  return (
    <div className="agro-wrapper">
      {/* Header */}
      <header className="agro-header">
        <div className="agro-header-left">
          <span className="agro-header-icon">🛰</span>
          <div>
            <h1 className="agro-title">AgroSat Uruguay</h1>
            <p className="agro-subtitle">Monitoreo satelital agropecuario · NASA GIBS + FIRMS</p>
          </div>
        </div>
        <div className="agro-header-right">
          <select
            className="agro-select"
            value={dept.name}
            onChange={e => setDept(DEPARTAMENTOS.find(d => d.name === e.target.value))}
          >
            {DEPARTAMENTOS.map(d => <option key={d.name}>{d.name}</option>)}
          </select>
          <input
            type="date" className="agro-date"
            value={date} max={today} min="2020-01-01"
            onChange={e => setDate(e.target.value)}
          />
        </div>
      </header>

      {/* Módulos */}
      <div className="agro-modules">
        {Object.values(MODULES).map(m => (
          <button
            key={m.id}
            className={`agro-module-btn ${module === m.id ? "active" : ""}`}
            style={module === m.id ? { borderColor: m.color, color: m.color } : {}}
            onClick={() => setModule(m.id)}
          >
            <span className="agro-module-icon">{m.icon}</span>
            <div>
              <div className="agro-module-label">{m.label}</div>
              <div className="agro-module-sub">{m.sublabel}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Alertas rápidas */}
      {(alertParcelas.length > 0 || highFires.length > 0) && (
        <div className="agro-alerts">
          {highFires.length > 0 && module === "fire" && (
            <div className="agro-alert agro-alert-fire">
              <span>🔥</span>
              <span><b>{highFires.length} focos de alta confianza</b> detectados hoy sobre Uruguay · {date}</span>
            </div>
          )}
          {alertParcelas.map(p => (
            <div key={p.id} className="agro-alert agro-alert-warn">
              <span>⚠</span>
              <span><b>{p.nombre}</b> — {p.alerta}</span>
            </div>
          ))}
        </div>
      )}

      {/* Contenido principal */}
      <div className="agro-content">
        {/* Mapa */}
        <div className="agro-map-col">
          <div className="agro-map-header">
            <span className="agro-map-title">{mod.icon} {mod.label} — {dept.name}</span>
            <div className="agro-cloud-controls">
              {/* Indicador de nubosidad */}
              {checkingCloud && <span className="agro-cloud-checking">☁ analizando...</span>}
              {!checkingCloud && cloudCover !== null && (
                <span className={`agro-cloud-badge ${cloudCover > 70 ? "high" : cloudCover > 40 ? "mid" : "low"}`}>
                  ☁ {cloudCover}%
                  {cloudCover > 70 && " — muchas nubes"}
                  {cloudCover > 40 && cloudCover <= 70 && " — nubes parciales"}
                  {cloudCover <= 40 && " — cielo claro"}
                </span>
              )}
              {/* Selector de composición */}
              <div className="agro-comp-btns">
                {Object.values(CLOUD_MODES).map(cm => (
                  <button
                    key={cm.id}
                    title={cm.desc}
                    className={`agro-comp-btn ${cloudMode === cm.id ? "active" : ""}`}
                    onClick={() => setCloudMode(cm.id)}
                    disabled={cm.id !== "daily" && module === "fire"}
                  >
                    {cm.icon}
                  </button>
                ))}
              </div>
            </div>
            <span className="agro-map-date">{fmtDate(date)}</span>
            {loading && <span className="agro-loading-dot" />}
          </div>
          {/* Descripción del modo activo */}
          {cloudMode !== "daily" && (
            <div className="agro-comp-desc">
              <span className="agro-comp-desc-icon">🔲</span>
              <span>{CLOUD_MODES[cloudMode].desc}
                {module === "fire" ? " · Incendios siempre usa imagen diaria." : ""}
              </span>
              {cloudCover !== null && cloudCover > 50 && cloudMode === "daily" && (
                <span className="agro-comp-auto"> Auto-activado por alta nubosidad</span>
              )}
            </div>
          )}
          <div className="agro-map-container">
            <LeafletMap
              module={module}
              date={date}
              bbox={dept.bbox}
              firePoints={firePoints}
              cloudMode={cloudMode}
            />
            {/* Leyenda */}
            <div className="agro-legend">
              <div className="agro-legend-title">Referencia</div>
              {mod.legend.map(l => (
                <div key={l.label} className="agro-legend-item">
                  <span className="agro-legend-dot" style={{ background: l.color }} />
                  <span>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="agro-map-info">{mod.info}</div>
        </div>

        {/* Panel derecho */}
        <div className="agro-panel">
          {/* Stats */}
          <div className="agro-stats">
            <div className="agro-stat">
              <div className="agro-stat-num">{parcelas.length}</div>
              <div className="agro-stat-lbl">Parcelas</div>
            </div>
            <div className="agro-stat">
              <div className="agro-stat-num" style={{ color: "#f97316" }}>
                {module === "fire" ? firePoints.length : alertParcelas.length}
              </div>
              <div className="agro-stat-lbl">{module === "fire" ? "Focos" : "Alertas"}</div>
            </div>
            <div className="agro-stat">
              <div className="agro-stat-num" style={{ color: "#22c55e" }}>
                {parcelas.reduce((a, p) => a + p.ha, 0).toLocaleString()}
              </div>
              <div className="agro-stat-lbl">Hectáreas</div>
            </div>
          </div>

          {/* Parcelas */}
          <div className="agro-section-title">MIS PARCELAS</div>
          <div className="agro-parcelas">
            {parcelas.map(p => (
              <div
                key={p.id}
                className={`agro-parcela-card ${selectedParcela?.id === p.id ? "selected" : ""} ${p.alerta ? "with-alert" : ""}`}
                onClick={() => setSelectedParcela(selectedParcela?.id === p.id ? null : p)}
              >
                <div className="agro-parcela-top">
                  <div>
                    <div className="agro-parcela-name">{p.nombre}</div>
                    <div className="agro-parcela-meta">{p.dept} · {p.ha} ha</div>
                  </div>
                  <div className="agro-parcela-ndvi" style={{
                    color: p.ndvi >= 0.6 ? "#22c55e" : p.ndvi >= 0.4 ? "#fbbf24" : "#ef4444"
                  }}>
                    <div className="agro-ndvi-val">{p.ndvi.toFixed(2)}</div>
                    <div className="agro-ndvi-lbl">NDVI</div>
                  </div>
                </div>
                {/* Barra NDVI */}
                <div className="agro-ndvi-bar-bg">
                  <div className="agro-ndvi-bar-fill" style={{
                    width: `${p.ndvi * 100}%`,
                    background: p.ndvi >= 0.6 ? "#22c55e" : p.ndvi >= 0.4 ? "#fbbf24" : "#ef4444",
                  }} />
                </div>
                {p.alerta && (
                  <div className="agro-parcela-alert">⚠ {p.alerta}</div>
                )}
                {selectedParcela?.id === p.id && (
                  <div className="agro-parcela-detail">
                    <div className="agro-detail-row">
                      <span>Tendencia</span>
                      <span>{p.tendencia === "up" ? "↑ Mejorando" : p.tendencia === "down" ? "↓ Bajando" : "→ Estable"}</span>
                    </div>
                    <div className="agro-detail-row">
                      <span>Sup. monitoreada</span>
                      <span>{p.ha} ha</span>
                    </div>
                    <div className="agro-detail-row">
                      <span>Última actualización</span>
                      <span>{fmtDate(date)}</span>
                    </div>
                    <button
                      className="agro-go-btn"
                      onClick={() => {
                        const d = DEPARTAMENTOS.find(d => d.name === p.dept);
                        if (d) setDept(d);
                      }}
                    >
                      Ver en mapa →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Fuentes */}
          <div className="agro-sources">
            <div className="agro-sources-title">FUENTES DE DATOS</div>
            {[
              ["NASA GIBS", "https://worldview.earthdata.nasa.gov"],
              ["NASA FIRMS", "https://firms.modaps.eosdis.nasa.gov"],
              ["Copernicus/ESA", "https://browser.dataspace.copernicus.eu"],
            ].map(([l, h]) => (
              <a key={l} href={h} target="_blank" rel="noopener noreferrer" className="agro-source-link">{l}</a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
