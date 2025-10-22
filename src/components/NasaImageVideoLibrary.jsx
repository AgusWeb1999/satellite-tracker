import React, { useState } from "react";

export default function NasaImageVideoLibrary() {
  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = () => {
    setLoading(true);
    setError("");
    fetch(`https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=${mediaType}`)
      .then(res => res.json())
      .then(data => {
        if (data.collection && data.collection.items && data.collection.items.length > 0) {
          setResults(data.collection.items.slice(0, 12)); // Solo los primeros 12
        } else {
          setResults([]);
          setError("No se encontraron resultados para esa búsqueda.");
        }
      })
      .catch(() => setError("Ocurrió un error al buscar."))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <h2>NASA Image and Video Library</h2>
      <input
        type="text"
        placeholder="Buscar imágenes o videos..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{width: 220}}
      />
      <select
        value={mediaType}
        onChange={e => setMediaType(e.target.value)}
        style={{marginLeft: 8}}
      >
        <option value="image">Imágenes</option>
        <option value="video">Videos</option>
        <option value="audio">Audio</option>
      </select>
      <button onClick={handleSearch} style={{marginLeft: 8}}>
        Buscar
      </button>
      {loading && <div>Cargando...</div>}
      {error && <div style={{color:"red"}}>{error}</div>}
      <div style={{display:"flex", flexWrap:"wrap", gap:"16px", marginTop: 12}}>
        {results.map(item => {
          const data = item.data[0];
          const thumb = item.links && item.links[0] ? item.links[0].href : "";
          return (
            <div key={item.data[0].nasa_id} style={{width:220, border:"1px solid #ccc", padding:8}}>
              {mediaType === "image" ? (
                <img src={thumb} alt={data.title} width={200} />
              ) : (
                <video width={200} controls poster={thumb}>
                  <source src={thumb.replace("~thumb.jpg", "~orig.mp4")} type="video/mp4" />
                  Tu navegador no soporta video.
                </video>
              )}
              <div style={{fontSize:"0.9em",marginTop:6}}>
                <b>{data.title}</b>
              </div>
              <div style={{fontSize:"0.8em",color:"#555",marginTop:4}}>
                {data.date_created && data.date_created.slice(0,10)}
              </div>
              <a
                href={`https://images.nasa.gov/details-${data.nasa_id}`}
                target="_blank" rel="noopener noreferrer"
                style={{fontSize:"0.8em",color:"#0077cc",marginTop:4,display:"block"}}
              >
                Ver en images.nasa.gov
              </a>
            </div>
          );
        })}
      </div>
      <small>
        Fuente: <a href="https://images.nasa.gov" target="_blank" rel="noopener noreferrer">images.nasa.gov</a>
      </small>
    </div>
  );
}