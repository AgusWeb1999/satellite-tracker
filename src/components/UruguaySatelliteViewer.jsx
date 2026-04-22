import { useState, useEffect, useRef } from "react";

// ─── Instalación necesaria ────────────────────────────────────────────────────
// npm install leaflet          ← solo esto, NO react-leaflet
//
// En tu index.html, dentro de <head>, agregar:
// <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
// <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
//
// O importar en main.jsx / App.jsx:
// import L from 'leaflet';
// import 'leaflet/dist/leaflet.css';
// window.L = L;  // hacerlo global para que el componente lo encuentre
// ─────────────────────────────────────────────────────────────────────────────

const URUGUAY_CENTER = [-32.8, -56.0];
const URUGUAY_ZOOM = 7;

// ─── FIRMS API ───────────────────────────────────────────────────────────────
// 1. Registrate gratis en https://firms.modaps.eosdis.nasa.gov/api/
// 2. Una vez que tengas tu API key, obtené tu MAP_KEY con:
//    fetch("https://firms.modaps.eosdis.nasa.gov/api/map_key/TU_API_KEY")
// 3. Pegá la MAP_KEY resultante acá abajo:
const FIRMS_MAP_KEY = "df90a23e2cd4f3efc1056add8d904743";
const FIRMS_BBOX = "-62,-37,-52,-28";
const FIRMS_SOURCES = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT"];

const MODES = {
  fire: {
    id: "fire",
    label: "Incendios",
    icon: "🔥",
    description: "Anomalías térmicas detectadas por MODIS Terra",
    satellite: "MODIS Terra · NASA",
    layers: [
      { url: "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi", layer: "MODIS_Terra_CorrectedReflectance_TrueColor", opacity: 1 },
      { url: "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi", layer: "MODIS_Terra_Thermal_Anomalies_All", opacity: 1 },
    ],
    accent: "#FF5722",
    legendItems: [
      { color: "#FF4500", label: "Foco activo" },
      { color: "#FF8C00", label: "Calor intenso" },
      { color: "#4CAF50", label: "Sin anomalía" },
    ],
  },
  normal: {
    id: "normal",
    label: "Color real",
    icon: "🛰️",
    description: "Imagen en color verdadero — MODIS Terra",
    satellite: "MODIS Terra · NASA",
    layers: [
      { url: "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi", layer: "MODIS_Terra_CorrectedReflectance_TrueColor", opacity: 1 },
    ],
    accent: "#2196F3",
    legendItems: [
      { color: "#228B22", label: "Vegetación" },
      { color: "#8B6914", label: "Suelo / urbano" },
      { color: "#4A90D9", label: "Agua" },
    ],
  },
  ndvi: {
    id: "ndvi",
    label: "Vegetación",
    icon: "🌿",
    description: "Índice NDVI — densidad de vegetación",
    satellite: "MODIS Terra · NASA",
    layers: [
      { url: "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi", layer: "MODIS_Terra_CorrectedReflectance_TrueColor", opacity: 1 },
      { url: "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi", layer: "MODIS_Terra_NDVI_8Day", opacity: 0.8 },
    ],
    accent: "#4CAF50",
    legendItems: [
      { color: "#1B5E20", label: "Vegetación densa" },
      { color: "#8BC34A", label: "Vegetación media" },
      { color: "#795548", label: "Suelo expuesto" },
    ],
  },
  aqua: {
    id: "aqua",
    label: "Temperatura",
    icon: "🌡️",
    description: "Temperatura superficial — MODIS Aqua",
    satellite: "MODIS Aqua · NASA",
    layers: [
      { url: "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi", layer: "MODIS_Aqua_CorrectedReflectance_TrueColor", opacity: 1 },
      { url: "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi", layer: "MODIS_Aqua_Land_Surface_Temp_Day", opacity: 0.7 },
    ],
    accent: "#00BCD4",
    legendItems: [
      { color: "#01579B", label: "Temperatura baja" },
      { color: "#4FC3F7", label: "Temperatura media" },
      { color: "#FF7043", label: "Temperatura alta" },
    ],
  },
};

// Datos demo — reemplazar con fetch real a FIRMS API
const DEMO_FIRE_POINTS = [
  { lat: -31.2, lon: -55.8, brightness: 380, frp: 42.1, confidence: "h" },
  { lat: -32.5, lon: -58.1, brightness: 420, frp: 78.3, confidence: "h" },
  { lat: -30.8, lon: -57.2, brightness: 310, frp: 18.5, confidence: "n" },
  { lat: -33.1, lon: -55.0, brightness: 355, frp: 31.2, confidence: "h" },
  { lat: -34.2, lon: -57.9, brightness: 290, frp: 12.0, confidence: "l" },
];

function getBrightnessColor(b) {
  if (b >= 400) return "#FF1744";
  if (b >= 350) return "#FF5722";
  if (b >= 320) return "#FF9800";
  return "#FFC107";
}

function getBrightnessLabel(b) {
  if (b >= 400) return "Muy intenso";
  if (b >= 350) return "Intenso";
  if (b >= 320) return "Moderado";
  return "Débil";
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

export default function UruguaySatelliteViewer() {
  const [mode, setMode] = useState("fire");
  const [date, setDate] = useState("2026-04-01");
  const [firePoints, setFirePoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const mapDivRef = useRef(null);
  const leafletMapRef = useRef(null);
  const gibsLayersRef = useRef([]);
  const markerGroupRef = useRef(null);

  const today = new Date().toISOString().split("T")[0];
  const currentMode = MODES[mode];

  // Inicializar mapa una sola vez
  useEffect(() => {
    if (!mapDivRef.current || leafletMapRef.current) return;

    const L = window.L;
    if (!L) {
      console.error("Leaflet no disponible. Ver instrucciones de instalación arriba.");
      return;
    }

    const map = L.map(mapDivRef.current, {
      center: URUGUAY_CENTER,
      zoom: URUGUAY_ZOOM,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      opacity: 0.6,
      attribution: "CartoDB",
    }).addTo(map);

    // Etiquetas de ciudades (capa superior)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      opacity: 0.9,
      zIndex: 900,
      attribution: "CartoDB",
    }).addTo(map);

    markerGroupRef.current = L.layerGroup().addTo(map);
    leafletMapRef.current = map;

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  // Actualizar capas GIBS al cambiar modo o fecha
  useEffect(() => {
    const L = window.L;
    if (!L || !leafletMapRef.current) return;

    gibsLayersRef.current.forEach((l) => leafletMapRef.current.removeLayer(l));
    gibsLayersRef.current = [];

    MODES[mode].layers.forEach(({ url, layer, opacity }) => {
      const wms = L.tileLayer.wms(url, {
        layers: layer,
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        time: date,
        opacity,
        zIndex: 500,
        attribution: "NASA GIBS",
      });
      wms.addTo(leafletMapRef.current);
      gibsLayersRef.current.push(wms);
    });
  }, [mode, date]);

  // Actualizar marcadores de focos
  useEffect(() => {
    const L = window.L;
    if (!L || !markerGroupRef.current) return;

    markerGroupRef.current.clearLayers();
    if (mode !== "fire" || firePoints.length === 0) return;

    firePoints.forEach((p) => {
      const color = getBrightnessColor(p.brightness);
      const circle = L.circleMarker([p.lat, p.lon], {
        radius: p.confidence === "h" ? 10 : 6,
        fillColor: color,
        fillOpacity: 0.85,
        color: "#fff",
        weight: 1.5,
      });

      circle.bindPopup(`
        <div style="font-family:system-ui,sans-serif;min-width:170px">
          <div style="font-weight:600;font-size:14px;margin-bottom:8px">🔥 Foco detectado</div>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <tr><td style="color:#666;padding:2px 8px 2px 0">Intensidad</td><td style="font-weight:500">${getBrightnessLabel(p.brightness)}</td></tr>
            <tr><td style="color:#666;padding:2px 8px 2px 0">Temperatura</td><td style="font-weight:500">${p.brightness} K</td></tr>
            <tr><td style="color:#666;padding:2px 8px 2px 0">Potencia rad.</td><td style="font-weight:500">${p.frp} MW</td></tr>
            <tr><td style="color:#666;padding:2px 8px 2px 0">Confianza</td><td style="font-weight:500">${p.confidence === "h" ? "Alta" : p.confidence === "n" ? "Normal" : "Baja"}</td></tr>
            <tr><td style="color:#666;padding:2px 8px 2px 0">Coords</td><td style="font-weight:500;font-family:monospace">${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}</td></tr>
          </table>
          <div style="margin-top:8px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:6px">NASA FIRMS · MODIS/VIIRS</div>
        </div>
      `);

      markerGroupRef.current.addLayer(circle);
    });
  }, [firePoints, mode]);

  // Cargar datos de focos
  useEffect(() => {
    if (mode !== "fire") {
      setFirePoints([]);
      return;
    }
    setLoading(true);

    function parseCSV(csv) {
      const lines = csv.trim().split("");
      if (lines.length < 2) return [];
      const headers = lines[0].split(",");
      const latIdx = headers.indexOf("latitude");
      const lonIdx = headers.indexOf("longitude");
      const brightIdx = headers.indexOf("bright_ti4");
      const frpIdx = headers.indexOf("frp");
      const confIdx = headers.indexOf("confidence");
      return lines.slice(1).map((line) => {
        const cols = line.split(",");
        const conf = (cols[confIdx] || "").trim().toLowerCase();
        return {
          lat: parseFloat(cols[latIdx]),
          lon: parseFloat(cols[lonIdx]),
          brightness: parseFloat(cols[brightIdx]),
          frp: parseFloat(cols[frpIdx]),
          confidence: conf === "high" ? "h" : conf === "low" ? "l" : "n",
        };
      }).filter((p) => !isNaN(p.lat) && !isNaN(p.lon));
    }

    if (!FIRMS_MAP_KEY || FIRMS_MAP_KEY === "TU_MAP_KEY_AQUI") {
      // Sin MAP_KEY configurada: usar datos de demo
      setTimeout(() => {
        setFirePoints(DEMO_FIRE_POINTS);
        setLoading(false);
      }, 400);
      return;
    }

    Promise.all(
      FIRMS_SOURCES.map((source) =>
        fetch(
          `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/${source}/${FIRMS_BBOX}/1/${date}`
        ).then((r) => r.text()).catch(() => "")
      )
    )
      .then((csvResults) => {
        const allPoints = csvResults.flatMap(parseCSV);
        setFirePoints(allPoints.length > 0 ? allPoints : []);
        setLoading(false);
      })
      .catch(() => {
        setFirePoints(DEMO_FIRE_POINTS);
        setLoading(false);
      });
  }, [mode, date]);

  const highConf = firePoints.filter((p) => p.confidence === "h");

  return (
    <div style={s.wrapper}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={{ fontSize: 26 }}>🛰</span>
          <div>
            <h2 style={s.headerTitle}>Monitoreo Satelital · Uruguay</h2>
            <p style={s.headerSub}>{currentMode.satellite}</p>
          </div>
        </div>
        <div style={s.headerRight}>
          <label style={s.dateLabel}>Fecha</label>
          <input
            type="date"
            value={date}
            max={today}
            min="2020-01-01"
            onChange={(e) => setDate(e.target.value)}
            style={s.dateInput}
          />
        </div>
      </div>

      {/* Barra de modos */}
      <div style={s.modeBar}>
        {Object.values(MODES).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            style={{
              ...s.modeBtn,
              ...(mode === m.id ? { borderColor: m.accent, color: m.accent, fontWeight: 600 } : {}),
            }}
          >
            <span style={{ fontSize: 14 }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={s.content}>
        {/* Mapa */}
        <div style={s.mapWrapper}>
          <div ref={mapDivRef} style={{ width: "100%", height: "100%" }} />

          <div style={s.legend}>
            <div style={s.legendTitle}>{currentMode.description}</div>
            {currentMode.legendItems.map((item) => (
              <div key={item.label} style={s.legendItem}>
                <span style={{ ...s.legendDot, background: item.color }} />
                {item.label}
              </div>
            ))}
          </div>

          <div style={s.dateBadge}>{formatDate(date)}</div>

          {loading && (
            <div style={s.loader}>
              <span style={s.loaderDot} />
              Cargando...
            </div>
          )}
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <div style={s.sidebar}>
            <div style={s.sidebarHeader}>
              <span style={s.sidebarTitle}>Panel de datos</span>
              <button onClick={() => setSidebarOpen(false)} style={s.closeBtn}>✕</button>
            </div>

            {mode === "fire" && (
              <>
                <div style={s.statsGrid}>
                  <div style={s.statCard}>
                    <div style={s.statNum}>{firePoints.length}</div>
                    <div style={s.statLbl}>Focos totales</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={{ ...s.statNum, color: "#FF5722" }}>{highConf.length}</div>
                    <div style={s.statLbl}>Alta confianza</div>
                  </div>
                </div>

                <div style={s.sectionTitle}>Focos activos</div>
                <div style={s.fireList}>
                  {firePoints.length === 0 && (
                    <div style={s.empty}>Sin focos detectados para esta fecha.</div>
                  )}
                  {firePoints.map((p, i) => (
                    <div key={i} style={s.fireItem}>
                      <div style={{ ...s.fireDot, background: getBrightnessColor(p.brightness) }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={s.fireName}>{getBrightnessLabel(p.brightness)} · {p.brightness} K</div>
                        <div style={s.fireCoords}>{p.lat.toFixed(3)}, {p.lon.toFixed(3)}</div>
                      </div>
                      <div style={s.fireFrp}>{p.frp} MW</div>
                    </div>
                  ))}
                </div>

                {FIRMS_MAP_KEY === "TU_MAP_KEY_AQUI" ? (
                  <div style={s.apiNote}>
                    <div style={s.apiNoteTitle}>⚠ Datos de demo</div>
                    <div style={s.apiNoteText}>
                      Registrate en{" "}
                      <a href="https://firms.modaps.eosdis.nasa.gov/api/" target="_blank" rel="noopener noreferrer" style={s.link}>
                        firms.modaps.eosdis.nasa.gov
                      </a>
                      , obtené tu MAP_KEY y reemplazá <code style={s.code}>FIRMS_MAP_KEY</code> en el componente.
                    </div>
                  </div>
                ) : (
                  <div style={{...s.apiNote, background: "rgba(76,175,80,0.08)", borderColor: "rgba(76,175,80,0.25)"}}>
                    <div style={{...s.apiNoteTitle, color: "#81C784"}}>✓ FIRMS conectado</div>
                    <div style={s.apiNoteText}>
                      Datos reales de VIIRS SNPP + NOAA-20. Últimas 24 hs sobre Uruguay.
                    </div>
                  </div>
                )}
              </>
            )}

            {mode === "normal" && (
              <div style={s.infoSection}>
                {[
                  ["Satélite", "MODIS Terra (NASA)"],
                  ["Resolución", "250m – 500m"],
                  ["Órbita", "~705 km altitud"],
                  ["Pasadas/día", "2 (mañana / tarde)"],
                  ["Bandas", "1, 4, 3 (RGB)"],
                ].map(([k, v]) => (
                  <div key={k} style={s.infoItem}>
                    <span style={s.infoKey}>{k}</span>
                    <span style={s.infoVal}>{v}</span>
                  </div>
                ))}
                <div style={s.infoCard}>
                  Terra cruza Uruguay ~10:30 AM hora local. La imagen del día puede tener 3-6 hs de demora.
                </div>
              </div>
            )}

            {mode === "ndvi" && (
              <div style={s.infoSection}>
                {[
                  ["Índice", "NDVI"],
                  ["Rango", "-1 (agua) → +1 (veg. densa)"],
                  ["Frecuencia", "Composición 8 días"],
                ].map(([k, v]) => (
                  <div key={k} style={s.infoItem}>
                    <span style={s.infoKey}>{k}</span>
                    <span style={s.infoVal}>{v}</span>
                  </div>
                ))}
                <div style={s.infoCard}>
                  Uruguay tiene ~75% de cobertura vegetal. Útil para monitoreo agropecuario y detección de sequías.
                </div>
              </div>
            )}

            {mode === "aqua" && (
              <div style={s.infoSection}>
                {[
                  ["Satélite", "MODIS Aqua (NASA)"],
                  ["Pasada", "~1:30 PM hora local"],
                  ["Parámetro", "Land Surface Temp"],
                ].map(([k, v]) => (
                  <div key={k} style={s.infoItem}>
                    <span style={s.infoKey}>{k}</span>
                    <span style={s.infoVal}>{v}</span>
                  </div>
                ))}
                <div style={s.infoCard}>
                  La LST es útil para detectar estrés hídrico en cultivos y monitorear el Río de la Plata.
                </div>
              </div>
            )}

            <div style={s.sources}>
              <div style={s.sourcesTitle}>Fuentes</div>
              {[
                ["NASA GIBS / Worldview", "https://worldview.earthdata.nasa.gov"],
                ["NASA FIRMS (incendios)", "https://firms.modaps.eosdis.nasa.gov"],
                ["NASA EONET (eventos)", "https://eonet.gsfc.nasa.gov"],
              ].map(([label, href]) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={s.link}>
                  {label}
                </a>
              ))}
            </div>
          </div>
        )}

        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} style={s.openSidebar}>
            ◀ Datos
          </button>
        )}
      </div>
    </div>
  );
}

const s = {
  wrapper: { fontFamily: "'DM Sans', system-ui, sans-serif", background: "#0D1117", color: "#E6EDF3", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%", minHeight: 620 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "#161B22", borderBottom: "1px solid #21262D", flexWrap: "wrap", gap: 12 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: "#E6EDF3", letterSpacing: "-0.02em" },
  headerSub: { margin: 0, fontSize: 12, color: "#7D8590", marginTop: 2 },
  headerRight: { display: "flex", alignItems: "center", gap: 8 },
  dateLabel: { fontSize: 12, color: "#7D8590" },
  dateInput: { background: "#21262D", border: "1px solid #30363D", borderRadius: 8, color: "#E6EDF3", padding: "6px 10px", fontSize: 13, cursor: "pointer", outline: "none" },
  modeBar: { display: "flex", gap: 6, padding: "10px 16px", background: "#161B22", borderBottom: "1px solid #21262D", overflowX: "auto" },
  modeBtn: { display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 13, fontWeight: 500, border: "1px solid #30363D", borderRadius: 20, background: "transparent", color: "#7D8590", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" },
  content: { display: "flex", flex: 1, overflow: "hidden", position: "relative" },
  mapWrapper: { flex: 1, position: "relative", minHeight: 500 },
  legend: { position: "absolute", bottom: 20, left: 12, background: "rgba(13,17,23,0.92)", border: "1px solid #30363D", borderRadius: 10, padding: "10px 14px", zIndex: 1000, minWidth: 160 },
  legendTitle: { fontSize: 11, color: "#7D8590", marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
  legendItem: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#C9D1D9", marginTop: 4 },
  legendDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  dateBadge: { position: "absolute", top: 12, left: 12, background: "rgba(13,17,23,0.85)", border: "1px solid #30363D", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "#C9D1D9", zIndex: 1000 },
  loader: { position: "absolute", bottom: 20, right: 12, background: "rgba(13,17,23,0.85)", border: "1px solid #30363D", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#7D8590", display: "flex", alignItems: "center", gap: 6, zIndex: 1000 },
  loaderDot: { display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#FF5722" },
  sidebar: { width: 260, background: "#161B22", borderLeft: "1px solid #21262D", overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column" },
  sidebarHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #21262D" },
  sidebarTitle: { fontSize: 13, fontWeight: 600, color: "#C9D1D9", textTransform: "uppercase", letterSpacing: "0.06em" },
  closeBtn: { background: "none", border: "none", color: "#7D8590", cursor: "pointer", fontSize: 14, padding: 2 },
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "12px 14px" },
  statCard: { background: "#0D1117", border: "1px solid #21262D", borderRadius: 10, padding: "10px 12px", textAlign: "center" },
  statNum: { fontSize: 26, fontWeight: 700, color: "#E6EDF3", letterSpacing: "-0.03em", lineHeight: 1 },
  statLbl: { fontSize: 11, color: "#7D8590", marginTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: "#7D8590", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 14px 8px" },
  fireList: { padding: "0 10px 12px", display: "flex", flexDirection: "column", gap: 4 },
  empty: { fontSize: 13, color: "#7D8590", textAlign: "center", padding: "16px 0" },
  fireItem: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#0D1117", borderRadius: 8, border: "1px solid #21262D" },
  fireDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  fireName: { fontSize: 12, fontWeight: 500, color: "#C9D1D9" },
  fireCoords: { fontSize: 11, color: "#7D8590", fontFamily: "monospace" },
  fireFrp: { fontSize: 11, color: "#FF8C00", fontWeight: 600, whiteSpace: "nowrap" },
  apiNote: { margin: "8px 12px", padding: "10px 12px", background: "rgba(255,87,34,0.08)", border: "1px solid rgba(255,87,34,0.25)", borderRadius: 8 },
  apiNoteTitle: { fontSize: 12, fontWeight: 600, color: "#FF8A65", marginBottom: 4 },
  apiNoteText: { fontSize: 11, color: "#7D8590", lineHeight: 1.6 },
  link: { color: "#58A6FF", textDecoration: "none" },
  code: { background: "#21262D", padding: "1px 4px", borderRadius: 4, fontFamily: "monospace", fontSize: 10, color: "#E6EDF3" },
  infoSection: { padding: "8px 14px", display: "flex", flexDirection: "column", gap: 4 },
  infoItem: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid #21262D", gap: 8 },
  infoKey: { fontSize: 12, color: "#7D8590", flexShrink: 0 },
  infoVal: { fontSize: 12, color: "#C9D1D9", textAlign: "right", fontWeight: 500 },
  infoCard: { marginTop: 12, padding: "10px 12px", background: "#0D1117", border: "1px solid #21262D", borderRadius: 8, fontSize: 12, color: "#7D8590", lineHeight: 1.6 },
  sources: { marginTop: "auto", padding: "12px 14px", borderTop: "1px solid #21262D", display: "flex", flexDirection: "column", gap: 6 },
  sourcesTitle: { fontSize: 11, fontWeight: 600, color: "#7D8590", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 },
  openSidebar: { position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", background: "#161B22", border: "1px solid #30363D", borderRight: "none", borderRadius: "8px 0 0 8px", color: "#7D8590", padding: "10px 8px", fontSize: 12, cursor: "pointer", zIndex: 1000 },
};
