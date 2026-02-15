import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { makeGrid } from "./heatmapGrid.js";
import { calculateWalkability } from "./calcWalkability.js";

if (!process.env.GOOGLE_SERVER_KEY) {
  throw new Error("Missing GOOGLE_SERVER_KEY in env for CLI run.");
}

const BOUNDS = { north: 37.83, south: 37.67, east: -122.35, west: -122.525 };
const STEP_DEG = 0.003;
const MAX_POINTS = 4000;     // or 100 / 500 / 1500 depending on run
const FLUSH_EVERY = 25;      // write partial file every N points

function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}

export async function generateHeatmap() {
    const grid = makeGrid(BOUNDS, STEP_DEG);

    let points = [];
    const filePath = path.join(process.cwd(), "public", "heatmap.json");

    if (fs.existsSync(filePath)) {
        try {
            const existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            if (Array.isArray(existing.points)) points = existing.points;
        } catch {}
    }

    for (let idx = points.length; idx < grid.length && points.length < MAX_POINTS; idx++) {
        const { lat, lng } = grid[idx];

        const { scores } = await computeForOrigin(lat, lng);
        const total = typeof scores?.total === "number" ? scores.total : 0;
        points.push({ lat, lng, weight: clamp01(total) });

        if (points.length % FLUSH_EVERY === 0) {
            const payload = {
                meta: { bounds: BOUNDS, stepDeg: STEP_DEG, generatedAt: new Date().toISOString(), partial: true, count: points.length },
                points,
            };
            fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
            console.log("wrote", points.length);

            await sleep(300)
        }
    }

    const payload = {
        meta: { bounds: BOUNDS, stepDeg: STEP_DEG, generatedAt: new Date().toISOString() },
        points,
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");

    return { count: points.length };
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function computeForOrigin(lat, lng) {
  
    // Scans in a ~1.5 mile radius for groceries, parks, schools, and shopping centers
    const queryLocations = ["grocery_store", "park", "bus_stop", "school", "shopping_mall"];
    const nearbyLocations = {};
    const routesToPoints = {};
    
    for (let i = 0; i < queryLocations.length; i++) {
        const placeResponse = await fetchWithRetry(
            "https://places.googleapis.com/v1/places:searchNearby",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": process.env.GOOGLE_SERVER_KEY,
                    "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.types",
                },
                body: JSON.stringify({
                    includedTypes: queryLocations[i],
                    maxResultCount: 8,
                    locationRestriction: {
                        circle: {
                            center: { latitude: lat, longitude: lng },
                            radius: 2400, // A little over 1.5 miles = ~2400 m, but we account for walking distance
                        },
                    },
                    rankPreference: "DISTANCE",
                }),
            }
        );
        if (!placeResponse.ok) {
            const err = await placeResponse.text();
            throw new Error(`Places ${queryLocations[i]} ${placeResponse.status}: ${err}`);
        }
        const locationInfo = await placeResponse.json();
        const candidates = locationInfo.places || [];
        let distances = await computeWalkingDistances(lat, lng, candidates);
                
        // Removes duplicates w/ the same name
        const {
            places: removedDupesPlaces,
            distances: removedDupesDistances,
        } = removeDuplicates(candidates, distances);
                
        nearbyLocations[queryLocations[i]] = removedDupesPlaces;
                
        routesToPoints[queryLocations[i]] = {
            candidatesCount: removedDupesPlaces.length,
            distancesAlignedByIndex: removedDupesDistances
        };
    }
    
    const scores = calculateWalkability(nearbyLocations, routesToPoints);
    
    async function computeWalkingDistances(originLat, originLng, places) {
        if (!places.length) return []; // Ensures places isn't empty
    
        const routesResp = await fetchWithRetry(
            "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": process.env.GOOGLE_SERVER_KEY,
                    "X-Goog-FieldMask": "destinationIndex,status,condition,distanceMeters,duration",
                },
                body: JSON.stringify({
                    origins: [{
                        waypoint: {
                            location: { latLng: { latitude: originLat, longitude: originLng } },
                        },
                    }],
                    destinations: places.map((p) => ({
                        waypoint: {
                            location: {
                                latLng: {
                                    latitude: p.location.latitude,
                                    longitude: p.location.longitude,
                                },
                            },
                        },
                    })),
                    travelMode: "WALK",
                }),
            }
        );
    
        if (!routesResp.ok) {
            const err = await routesResp.text();
            throw new Error(err);
        }
    
        const elements = await readRouteMatrixElements(routesResp);
    
        const distances = new Array(places.length).fill(null);
    
        for (const el of elements) {
            const idx = el.destinationIndex;
            if (typeof idx !== "number" || idx < 0 || idx >= places.length) continue;
    
            const ok = el.condition === "ROUTE_EXISTS";
            if (!ok) {
                distances[idx] = { ok: false };
                continue;
            }
    
            distances[idx] = {
                ok: true,
                distanceMeters: el.distanceMeters,
                duration: el.duration,
            };
        }
    
        return distances;
    }
    
    async function readRouteMatrixElements(resp) {
        const raw = await resp.text();

        try {
            const json = JSON.parse(raw);
            return Array.isArray(json) ? json : [];
        } catch {
            return raw
                .trim()
                .split("\n")
                .filter(Boolean)
                .map((line) => JSON.parse(line));
        }
    }

    function removeDuplicates(places, distances) {
        const seen = new Set();
        const newPlaces = [];
        const newDistances = [];

        for (let i = 0; i < places.length; i++) {
            const name = (places[i]?.displayName?.text || "").trim().toLowerCase();
            if (!name) continue;
            if (seen.has(name)) continue;

            seen.add(name);
            newPlaces.push(places[i]);
            newDistances.push(distances[i]);
        }

        return { places: newPlaces, distances: newDistances };
    }

  
    return { nearbyLocations, routesToPoints, scores };
}

async function fetchWithRetry(url, options, { retries = 6, baseDelayMs = 500 } = {}) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const resp = await fetch(url, options);

        if (resp.status !== 429) return resp;

        // Respect Retry-After if present
        const ra = resp.headers.get("retry-after");
        const retryAfterMs = ra ? Number(ra) * 1000 : null;

        const delay = retryAfterMs ?? Math.min(30000, baseDelayMs * 2 ** attempt);
        await new Promise((r) => setTimeout(r, delay));
    }

    throw new Error("Too many 429s; aborting.");
}