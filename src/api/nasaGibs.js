export function buildGibsUrl({
  bbox = "-56.25,-34.95,-56.15,-34.85",
  date = "2025-10-01",
  layer = "MODIS_Terra_CorrectedReflectance_TrueColor",
  width = 512,
  height = 512,
  format = "image/jpeg"
}) {
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&BBOX=${bbox}&CRS=EPSG:4326&WIDTH=${width}&HEIGHT=${height}&LAYERS=${layer}&STYLES=&FORMAT=${format}&TIME=${date}`;
}