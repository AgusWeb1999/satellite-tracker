import React, { useState } from "react";

const API_KEY = "T0UChvlyi5TLBOFjYr9q92jCSzaqMxSzo3AdF1Ud"; // Tu NASA API Key personal

export default function MarsRoverPhotos() {
  const [earthDate, setEarthDate] = useState(() => new Date(Date.now() - 5*24*60*60*1000).toISOString().slice(0,10)); // 5 días atrás por defecto
  const [rover, setRover] = useState("curiosity");
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchPhotos = () => {
    setLoading(true);
    setError("");
    setPhotos([]);
    fetch(`https://api.nasa.gov/mars-photos/api/v1/rovers/${rover}/photos?earth_date=${earthDate}&api_key=${API_KEY}`)
      .then(async (res) => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          throw new Error("La API devolvió una respuesta inesperada o está caída.");
        }
      })
      .then(data => {
        if (Array.isArray(data.photos) && data.photos.length > 0) {
          setPhotos(data.photos.slice(0, 12)); // Solo las primeras 12 fotos
        } else {
          setError("No hay fotos para esta fecha y rover.");
        }
      })
      .catch((err) => setError("No se pudo obtener las fotos: " + err.message))
      .finally(() => setLoading(false));
  };

  // Fechas sugeridas para probar, suelen tener resultados:
  const suggested = [
    { rover: "curiosity", date: "2022-10-01" },
    { rover: "perseverance", date: "2021-03-01" },
    { rover: "opportunity", date: "2010-08-01" },
    { rover: "spirit", date: "2005-02-01" },
  ];

  return (
    <div>
      <h2>Fotos del Rover en Marte</h2>
      <label>
        Rover:&nbsp;
        <select value={rover} onChange={e => setRover(e.target.value)}>
          <option value="curiosity">Curiosity</option>
          <option value="perseverance">Perseverance</option>
          <option value="opportunity">Opportunity</option>
          <option value="spirit">Spirit</option>
        </select>
      </label>
      <label style={{marginLeft: 16}}>
        Fecha Tierra:&nbsp;
        <input
          type="date"
          value={earthDate}
          max={new Date(Date.now() - 24*60*60*1000).toISOString().slice(0,10)}
          onChange={e => setEarthDate(e.target.value)}
        />
      </label>
      <button onClick={fetchPhotos} style={{marginLeft: 10}}>Buscar fotos</button>
      {loading && <div>Cargando...</div>}
      {error && (
        <div style={{color:"red", marginTop:5}}>
          {error}
          <div style={{fontSize:"0.8em", marginTop:4}}>
            <b>Prueba con una de estas combinaciones:</b>
            <ul style={{margin: "4px 0 0 16px", padding: 0}}>
              {suggested.map(s => (
                <li key={s.rover+s.date}>
                  Rover: <b>{s.rover}</b>, Fecha: <b>{s.date}</b>
                  <button
                    style={{marginLeft:6, fontSize:"0.8em"}}
                    onClick={() => { setRover(s.rover); setEarthDate(s.date); }}
                  >
                    Usar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div style={{display:"flex",flexWrap:"wrap",gap:"12px",marginTop:16}}>
        {photos.map(photo => (
          <div key={photo.id} style={{border:"1px solid #ccc",padding:6, width:230}}>
            <img
              src={photo.img_src}
              alt={photo.camera.full_name}
              width={210}
              style={{display:"block", marginBottom:6}}
            />
            <div style={{fontSize:"0.85em",marginBottom:2}}>
              <b>Cámara:</b> {photo.camera.full_name}
            </div>
            <div style={{fontSize:"0.8em"}}>
              <b>Sol:</b> {photo.sol} &nbsp; <b>Fecha:</b> {photo.earth_date}
            </div>
          </div>
        ))}
      </div>
      <small>
        Fuente: <a href="https://mars.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA Mars Exploration Program</a>
      </small>
    </div>
  );
}