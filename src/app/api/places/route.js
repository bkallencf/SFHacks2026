import fs from "fs";
import path from "path";
import { calculateWalkability } from "@/lib/calcWalkability";

// Scans in a ~1.5 mile radius for groceries, parks, schools, and shopping centers
export async function POST(request) {
    const { lat, lng } = await request.json();
    const queryLocations = ["grocery_store", "bus_stop", "park", "school", "shopping_mall"];
    const nearbyLocations = {};
    const routesToPoints = {};

    // Sets up the log for the output of Places API and Routes API
    const debugEntry = {
        timestamp: new Date().toISOString(),
        origin: { lat, lng },
        categories: {}
    };

    for (let i = 0; i < queryLocations.length; i++) {
        const placeResponse = await fetch(
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
                    maxResultCount: 10,
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

        debugEntry.categories[queryLocations[i]] = {
            removedDupesPlaces,
            walkingDistancesAlignedByIndex: removedDupesDistances
        };
    }

    // Writes to a place-debug.json file locally for debugging
    const filePath = path.join(process.cwd(), "places-debug.json");

    // Overwrites the file everytime a new origin point is calculated
    fs.writeFileSync(
        filePath,
        JSON.stringify(debugEntry, null, 2),
        "utf-8"
    );

    const scores = calculateWalkability(nearbyLocations, routesToPoints);

    return Response.json({
        nearbyLocations,
        routesToPoints,
        scores,
    });
}

async function computeWalkingDistances(originLat, originLng, places) {
    if (!places.length) return []; // Ensures places isn't empty

    const routesResp = await fetch(
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
    try {
        const json = await resp.json();
        if (Array.isArray(json)) return json;
        return [];
    } catch {
        const raw = await resp.text();
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