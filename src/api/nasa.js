import axios from "axios";

// NASA Earth Imagery API
export async function getEarthImage(lat, lon, date) {
  const apiKey = "T0UChvlyi5TLBOFjYr9q92jCSzaqMxSzo3AdF1Ud";
  const url = `https://api.nasa.gov/planetary/earth/imagery?lon=${lon}&lat=${lat}&date=${date}&dim=0.1&api_key=${apiKey}`;
  const res = await axios.get(url);
  return res.data;
}