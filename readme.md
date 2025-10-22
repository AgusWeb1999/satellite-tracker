# Astro-Sat-AR

Proyecto MVP para visualizar imágenes reales tomadas por satélites en tiempo real e interactuar con su posición mediante Realidad Aumentada (AR).

## Objetivos
- Selección de satélite (ISS, Landsat, GOES, Sentinel, etc.)
- Visualización de imágenes satelitales en tiempo real.
- Módulo AR: muestra la posición del satélite en el cielo y superpone la imagen tomada en ese momento.

## Stack
- React + Three.js + WebXR (AR)
- APIs satelitales: NASA Earthdata, N2YO, ESA, NOAA

## Primeros pasos

1. Instala dependencias

```bash
npm install
```

2. Consigue tus API Keys:
   - NASA: https://api.nasa.gov/
   - N2YO: https://www.n2yo.com/api/

3. Inicia el proyecto

```bash
npm start
```

## Estructura
- `/src/api`: Funciones para consumir APIs satelitales
- `/src/components`: Componentes UI (Selector, Visualizador de imágenes, AR)
- `/src/pages`: Pantallas principales