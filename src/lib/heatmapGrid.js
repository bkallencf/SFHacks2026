export function makeGrid({ north, south, east, west }, stepDeg) {
    const pts = [];
    for (let lat = south; lat <= north; lat += stepDeg) {
        for (let lng = west; lng <= east; lng += stepDeg) {
            pts.push({ lat, lng });
        }
    }
    return pts;
}