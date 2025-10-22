function ImageViewer({ imageUrl, meta }) {
  return (
    <div>
      <h2>Imagen Satelital</h2>
      <img src={imageUrl} alt="Imagen satélite" style={{ maxWidth: "100%" }} />
      {meta && <div>
        <p>Fecha: {meta.date}</p>
        <p>Satélite: {meta.satellite}</p>
      </div>}
    </div>
  );
}

export default ImageViewer;