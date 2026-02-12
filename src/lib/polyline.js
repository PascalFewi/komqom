/**
 * Decodes a Google Encoded Polyline string into an array of [lat, lng] pairs.
 *
 * Strava's API returns segment geometry as encoded polylines (Google format).
 * Each coordinate is stored as a delta from the previous point, encoded in
 * 5-bit chunks with an ASCII offset of 63.
 *
 * Spec: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 *
 * @param {string} encoded - The encoded polyline string
 * @returns {Array<[number, number]>} Array of [latitude, longitude] pairs
 */
export function decodePolyline(encoded) {
  const coords = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    // Decode latitude delta
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    // Decode longitude delta
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lat / 1e5, lng / 1e5]);
  }

  return coords;
}
