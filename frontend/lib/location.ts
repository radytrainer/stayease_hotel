/** Cambodia's bounding box, matching the API and database check. */
export const CAMBODIA_BOUNDS={minLat:9.5,maxLat:14.8,minLng:102.2,maxLng:107.8};

export function insideCambodia(lat:number,lng:number){
  const b=CAMBODIA_BOUNDS;return lat>=b.minLat&&lat<=b.maxLat&&lng>=b.minLng&&lng<=b.maxLng;
}

/** Reads "13.3621, 103.8604" as copied from Google Maps (right-click a place) or most other map apps. */
export function parseCoordinates(text:string):{lat:number;lng:number}|null{
  const m=text.trim().match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if(!m)return null;
  const lat=Number(m[1]),lng=Number(m[2]);
  return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
}
