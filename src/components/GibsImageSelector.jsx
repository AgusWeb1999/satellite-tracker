import React, { useState } from "react";
import { buildGibsUrl } from "../api/nasaGibs";
import "../styles/formElements.css"; // ¡IMPORTANTE! Para estilos oscuros y modernos

// Lista de ubicaciones predefinidas (países o regiones)
const LOCATIONS = [
  { name: "Seleccionar ubicación...", bbox: "" },
  { name: "Amazonas", bbox: "-66.0,-5.0,-59.0,0.0" },
  { name: "Chile", bbox: "-75.0,-56.0,-66.0,-17.5" },
  { name: "Uruguay", bbox: "-58.5,-35.0,-53.0,-30.0" },
  { name: "Argentina", bbox: "-73.5,-55.0,-53.5,-21.8" },
  { name: "España", bbox: "-9.5,36.0,3.5,43.8" },
  { name: "Europa Occidental", bbox: "-10.0,35.0,15.0,55.0" },
  { name: "África Central", bbox: "15,-5,25,5" },
  { name: "Australia", bbox: "140,-37,150,-27" },
];

const LAYERS = [
  { id: "MODIS_Terra_CorrectedReflectance_TrueColor", label: "Color Real (MODIS)" },
  { id: "VIIRS_SNPP_CorrectedReflectance_TrueColor", label: "Color Real (VIIRS)" },
  { id: "MODIS_Terra_Thermal_Anomalies_All", label: "Incendios" },
  { id: "MODIS_Terra_Cloud_Mask_Day", label: "Nubes (día)" },
  { id: "MODIS_Terra_Aerosol", label: "Polvo/Aerosol" },
  { id: "MODIS_Terra_NDVI_8Day", label: "NDVI (Vegetación, 8 días)" },
  { id: "MODIS_Terra_NDVI_16Day", label: "NDVI (Vegetación, 16 días)" },
];

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function GibsImageSelector() {
  const [layer, setLayer] = useState(LAYERS[0].id);
  const [date, setDate] = useState(getToday());
  const [bbox, setBbox] = useState("-56.25,-34.95,-56.15,-34.85");
  const [imgError, setImgError] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(LOCATIONS[0].name);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);

  // Estados para "Buscar"
  const [currentLayer, setCurrentLayer] = useState(layer);
  const [currentDate, setCurrentDate] = useState(date);
  const [currentBbox, setCurrentBbox] = useState(bbox);
  const [currentWidth, setCurrentWidth] = useState(width);
  const [currentHeight, setCurrentHeight] = useState(height);

  const url = buildGibsUrl({
    bbox: currentBbox,
    date: currentDate,
    layer: currentLayer,
    width: currentWidth,
    height: currentHeight,
  });

  const handleBuscar = () => {
    setCurrentLayer(layer);
    setCurrentDate(date);
    setCurrentBbox(bbox);
    setCurrentWidth(width);
    setCurrentHeight(height);
    setImgError(false);
  };

  // Cuando el usuario selecciona una ubicación, se actualiza el BBOX
  const handleLocationChange = (e) => {
    const locationName = e.target.value;
    setSelectedLocation(locationName);
    const locationObj = LOCATIONS.find(loc => loc.name === locationName);
    if (locationObj && locationObj.bbox) {
      setBbox(locationObj.bbox);
    }
  };

  // Advertencias para productos NDVI
  const ndviSelected = layer === "MODIS_Terra_NDVI_8Day" || layer === "MODIS_Terra_NDVI_16Day";
  const ndviWarning = ndviSelected
    ? "El NDVI solo está disponible para fechas pasadas, usualmente cada 8 ó 16 días y con retraso de varios días. Si no se carga, prueba con fechas anteriores."
    : null;

  return (
    <form
      className="gibs-form"
      style={{
        background: "rgba(19,25,40,0.94)",
        borderRadius: "18px",
        padding: "24px 18px",
        maxWidth: 500,
        margin: "32px auto",
        boxShadow: "0 0 24px #2ffcff22, 0 1px 40px #000a",
        border: "1.5px solid #222942",
        color: "#fff"
      }}
      onSubmit={e => { e.preventDefault(); handleBuscar(); }}
    >
      <label>
        Ubicación:&nbsp;
        <select value={selectedLocation} onChange={handleLocationChange}>
          {LOCATIONS.map(loc => (
            <option key={loc.name} value={loc.name}>
              {loc.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Producto:&nbsp;
        <select value={layer} onChange={e => setLayer(e.target.value)}>
          {LAYERS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </label>
      <label>
        Fecha:&nbsp;
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </label>
      <label>
        BBOX:&nbsp;
        <input type="text" value={bbox} onChange={e => setBbox(e.target.value)} style={{width: "280px"}} />
        <span className="form-helper"> (long_min,lat_min,long_max,lat_max)</span>
      </label>
      <label>
        Tamaño:&nbsp;
        <input type="number" min={256} max={2048} value={width} onChange={e => setWidth(Number(e.target.value))} style={{width: "70px"}} /> x
        <input type="number" min={256} max={2048} value={height} onChange={e => setHeight(Number(e.target.value))} style={{width: "70px", marginLeft: "3px"}} /> px
        <span className="form-helper"> (a mayor tamaño, más detalle visual)</span>
      </label>
      <button type="submit" style={{ margin: "18px 0 0 0" }}>
        Buscar
      </button>
      {ndviWarning && (
        <div className="form-helper" style={{ color: "#ffe066", marginTop: 8 }}>
          {ndviWarning}
        </div>
      )}
      <div style={{margin:"30px 0 10px 0"}}>
        {imgError ? (
          <div className="form-error">No se pudo cargar la imagen. Prueba otra fecha, producto o región.</div>
        ) : (
          <img
            src={url}
            alt="NASA GIBS"
            style={{
              maxWidth: "100%",
              border: "1px solid #2ffcff44",
              borderRadius: "12px",
              boxShadow: "0 0 16px #2ffcff22"
            }}
            onError={() => setImgError(true)}
            onLoad={() => setImgError(false)}
          />
        )}
      </div>
      <div className="form-helper" style={{marginTop: 10}}>
        <b>URL:</b>
        <div style={{fontSize: "0.8em", wordBreak: "break-all"}}>{url}</div>
      </div>
    </form>
  );
}