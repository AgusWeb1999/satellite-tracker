import axios from "axios";

export async function getISSPosition(lat, lon) {
  const apiKey = "TU_API_KEY_DE_N2YO";
  const url = `https://api.n2yo.com/rest/v1/satellite/positions/25544/${lat}/${lon}/0/1/&apiKey=${apiKey}`;
  const res = await axios.get(url);
  return res.data;
}