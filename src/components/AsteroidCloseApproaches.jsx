import React, { useEffect, useState } from "react";

// Consulta la API de JPL SSD/CNEOS para acercamientos próximos de asteroides
function fetchCloseApproaches({ dateMin, dateMax, distMax = 0.05 }) {
  // Documentación: https://ssd-api.jpl.nasa.gov/doc/cad.html
  const url = `https://ssd-api.jpl.nasa.gov/cad.api?body=Earth&dist-max=${distMax}&date-min=${dateMin}&date-max=${dateMax}&sort=date`;
  return fetch(url)
    .then(res => res.json());
}

function formatDate(dateStr) {
  // Convierte '2025-10-22' a un formato más amigable
  return new Date(dateStr).toLocaleDateString();
}

export default function AsteroidCloseApproaches() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fechas: hoy y 60 días después
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  useEffect(() => {
    setLoading(true);
    fetchCloseApproaches({ dateMin: today, dateMax: future })
      .then(setData)
      .finally(() => setLoading(false));
  }, [today, future]);

  if (loading) return <div>Cargando datos de asteroides...</div>;
  if (!data || !data.count) return <div>No se encontraron acercamientos próximos.</div>;

  return (
    <div>
      <h2>Asteroides que se acercan a la Tierra (próximos 60 días)</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95em" }}>
        <thead>
          <tr>
            <th style={{border:"1px solid #ccc"}}>Nombre/Número</th>
            <th style={{border:"1px solid #ccc"}}>Fecha</th>
            <th style={{border:"1px solid #ccc"}}>Distancia (au)</th>
            <th style={{border:"1px solid #ccc"}}>Tamaño estimado (km)</th>
            <th style={{border:"1px solid #ccc"}}>Velocidad (km/s)</th>
          </tr>
        </thead>
        <tbody>
          {data.data.map(row => (
            <tr key={row[0]+row[3]}>
              <td style={{border:"1px solid #ccc"}}>{row[0]}</td>
              <td style={{border:"1px solid #ccc"}}>{formatDate(row[3])}</td>
              <td style={{border:"1px solid #ccc"}}>{row[4]}</td>
              <td style={{border:"1px solid #ccc"}}>{row[7] ? `${row[7]} - ${row[8]}` : "?"}</td>
              <td style={{border:"1px solid #ccc"}}>{row[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <small>
        Fuente: <a href="https://ssd-api.jpl.nasa.gov/doc/cad.html" target="_blank" rel="noopener noreferrer">JPL SBDB Close Approach API</a>
      </small>
    </div>
  );
}