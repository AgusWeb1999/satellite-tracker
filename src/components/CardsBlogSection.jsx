import React from "react";
import "../styles/cardsBlogSection.css"; // Crea este archivo de estilos

// Ejemplo de datos, puedes cargar dinámicamente o desde una API luego
const news = [
  {
    title: "Eclipse solar parcial el 2 de noviembre",
    date: "2025-11-02",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Partial_Solar_Eclipse_on_20_March_2015_in_Svalbard%2C_Norway.jpg/640px-Partial_Solar_Eclipse_on_20_March_2015_in_Svalbard%2C_Norway.jpg",
    description: "El próximo eclipse solar parcial será visible desde Sudamérica y el sur de Europa. ¡No te lo pierdas!",
    link: "https://www.timeanddate.com/eclipse/solar/2025-november-2"
  },
  {
    title: "Luna llena y transmisión en vivo",
    date: "2025-10-28",
    img: "https://www.nasa.gov/sites/default/files/thumbnails/image/edu_fullmoon_july2022.jpg",
    description: "Observa la Luna llena en vivo desde el telescopio de la NASA este 28 de octubre.",
    link: "https://moon.nasa.gov/news/live/"
  },
  {
    title: "Lluvia de meteoros: Leónidas",
    date: "2025-11-17",
    img: "https://www.nasa.gov/sites/default/files/thumbnails/image/leonids2015_lwpetersen_flickr_1024.jpg",
    description: "El 17 de noviembre se espera el pico de las Leónidas. El mejor horario para observar es después de la medianoche.",
    link: "https://www.timeanddate.com/astronomy/meteor-shower/leonids.html"
  }
];

export default function CardsBlogSection() {
  return (
    <section className="blog-cards-section">
      <h2 className="blog-cards-title">🌠 Noticias y eventos astronómicos</h2>
      <div className="blog-cards-container">
        {news.map((item, idx) => (
          <article className="blog-card" key={idx}>
            <img src={item.img} alt={item.title} className="blog-card-img" />
            <div className="blog-card-content">
              <span className="blog-card-date">{new Date(item.date).toLocaleDateString()}</span>
              <h3 className="blog-card-head">{item.title}</h3>
              <p className="blog-card-desc">{item.description}</p>
              <a href={item.link} className="blog-card-link" target="_blank" rel="noopener noreferrer">
                Leer más →
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}