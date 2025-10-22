import React, { useState } from "react";
import { buildGibsUrl } from "../api/nasaGibs";

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
  // Puedes agregar más países, continentes o regiones aquí
];

const LAYERS = [
  { id: "MODIS_Terra_CorrectedReflectance_TrueColor", label: "Color Real" },
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

  // Estados para "Buscar"
  const [currentLayer, setCurrentLayer] = useState(layer);
  const [currentDate, setCurrentDate] = useState(date);
  const [currentBbox, setCurrentBbox] = useState(bbox);

  const url = buildGibsUrl({
    bbox: currentBbox,
    date: currentDate,
    layer: currentLayer,
  });

  const handleBuscar = () => {
    setCurrentLayer(layer);
    setCurrentDate(date);
    setCurrentBbox(bbox);
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
    <div>
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
      <br />
      <label>
        Producto:&nbsp;
        <select value={layer} onChange={e => setLayer(e.target.value)}>
          {LAYERS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </label>
      <br />
      <label>
        Fecha:&nbsp;
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </label>
      <br />
      <label>
        BBOX:&nbsp;
        <input type="text" value={bbox} onChange={e => setBbox(e.target.value)} />
        <small> (long_min,lat_min,long_max,lat_max)</small>
      </label>
      <br />
      <button style={{ margin: "12px 0" }} onClick={handleBuscar}>
        Buscar
      </button>
      {ndviWarning && (
        <div style={{ color: "#b8860b", marginTop: 8, fontSize: "0.95em" }}>
          {ndviWarning}
        </div>
      )}
      <div style={{margin:"20px 0"}}>
        {imgError ? (
          <div style={{color: "red"}}>No se pudo cargar la imagen. Prueba otra fecha, producto o región.</div>
        ) : (
          <img
            src={url}
            alt="NASA GIBS"
            style={{maxWidth: "100%", border: "1px solid #aaa"}}
            onError={() => setImgError(true)}
            onLoad={() => setImgError(false)}
          />
        )}
      </div>
      <div>
        <b>URL:</b>
        <div style={{fontSize: "0.8em", wordBreak: "break-all"}}>{url}</div>
      </div>
    </div>
  );
}