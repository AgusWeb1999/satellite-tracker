import React, { useState } from "react";

const API_KEY = "T0UChvlyi5TLBOFjYr9q92jCSzaqMxSzo3AdF1Ud"; // Tu clave personal

function formatDateForEpic(date) {
  return date.replace(/-/g, "/");
}

export default function EpicEarthImages() {
  const [date, setDate] = useState(() => new Date(Date.now() - 3*24*60*60*1000).toISOString().slice(0,10)); // 3 días atrás
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchImages = () => {
    setLoading(true);
    setError("");
    setImages([]);
    fetch(`https://api.nasa.gov/EPIC/api/natural/date/${date}?api_key=${API_KEY}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setImages(data);
        } else {
          setError("No hay imágenes para esta fecha.");
        }
      })
      .catch(() => setError("No se pudo obtener las imágenes."))
      .finally(() => setLoading(false));
  };

  const imgBaseUrl = (img) => {
    const datePath = formatDateForEpic(date);
    return `https://epic.gsfc.nasa.gov/archive/natural/${datePath}/jpg/${img.image}.jpg`;
  };

  return (
    <div>
      <h2>Imágenes EPIC de la Tierra (NASA DSCOVR)</h2>
      <label>
        Fecha:{" "}
        <input
          type="date"
          value={date}
          max={new Date(Date.now() - 24*60*60*1000).toISOString().slice(0,10)}
          onChange={e => setDate(e.target.value)}
        />
      </label>
      <button onClick={fetchImages} style={{marginLeft:10}}>Buscar imágenes</button>
      {loading && <div>Cargando...</div>}
      {error && <div style={{color:"red"}}>{error}</div>}
      <div style={{display:"flex",flexWrap:"wrap",gap:"12px",marginTop:16}}>
        {images.slice(0,8).map(img => (
          <div key={img.identifier} style={{border:"1px solid #ccc",padding:6}}>
            <img
              src={imgBaseUrl(img)}
              alt={img.caption}
              width={220}
              style={{display:"block"}}
            />
            <div style={{fontSize:"0.85em",marginTop:4}}>
              {img.caption && img.caption.length > 60
                ? img.caption.slice(0,60) + "..."
                : img.caption}
            </div>
            <div style={{fontSize:"0.75em",color:"#666"}}>
              {img.date.replace(" ", " / ")}
            </div>
          </div>
        ))}
      </div>
      <small>
        Fuente: <a href="https://epic.gsfc.nasa.gov" target="_blank" rel="noopener noreferrer">NASA EPIC</a>
      </small>
    </div>
  );
}