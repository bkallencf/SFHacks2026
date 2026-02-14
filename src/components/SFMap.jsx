"use client";
import React, { useEffect, useRef, useState } from "react";
import Script from "next/script";

export default function SFMap({ searchAddress }) {
    const mapRef = useRef(null);      // The map itself
    const mapDiv = useRef(null);      // Box for the map to sit in
    const markerRef = useRef(null);   // Red marker for the user's point
    const boundsRef = useRef(null);   // Bounds of the map for checking address validity
    const geoCoderRef = useRef(null); // Turns addresses into coords

    // Map boundary corners
    const SFBounds = {
        north: 37.83,
        south: 37.67,
        east: -122.35,
        west: -122.525,
    };

    // These are for the nearby locations to a user's given point
    const [placesData, setPlacesData] = useState(null);
    const placeMarkers = useRef([]);

    function initializeMap() {
        if (!window.google || !mapDiv.current) return; // Ensures the website has loaded along with the Google script

        // Calculates the bounds of the map area
        const sw = new window.google.maps.LatLng(SFBounds.south, SFBounds.west);
        const ne = new window.google.maps.LatLng(SFBounds.north, SFBounds.east);
        boundsRef.current = new window.google.maps.LatLngBounds(sw, ne);
        
        // Creates the map
        const map = new window.google.maps.Map(mapDiv.current, {
            center: { lat: 37.7649, lng: -122.4494 }, // Coords for SF
            zoom: 12,
            restriction: { // Set boundaries to the edge of San Francisco
                latLngBounds: SFBounds,
                strictBounds: true,
            }
        });

        mapRef.current = map;
        markerRef.current = new window.google.maps.Marker({ map })
        geoCoderRef.current = new window.google.maps.Geocoder();
    }


    /**
     * Takes in an address from the search bar, converts it into lat & lng, and verifies it's w/in the bounds
     * Then, calculates 20 of each nearby location based on categories (grocery_store, school, park, shopping_mall)
     */
    useEffect(() => {
        if (!searchAddress || !window.google || !geoCoderRef.current || !boundsRef.current) return;

        // Converts the address into lat/lng coords and checks address validity
        geoCoderRef.current.geocode({ address: searchAddress }, (results, status) => {
            if (status !== "OK" || !results || results.length === 0) {
                return;
            }

            const location = results[0].geometry.location; // lat/lng

            // Checks that the given address is w/in the bounds
            if (!boundsRef.current.contains(location)) {
                return;
            }

            // Moves the map to the address
            mapRef.current.setZoom(16);
            mapRef.current.setCenter(location);
            markerRef.current.setPosition(location);

            const lat = location.lat();
            const lng = location.lng();

            // Finds the nearest locations fitting some category - 20 for each
            fetch("/api/places", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({ lat, lng }),
            })
            .then(res => res.json())
            .then((payload) => {
                const points = payload.nearbyLocations;
                const routes = payload.routesToPoints;

                setPlacesData(points);

                // Clear out old markers on the map
                placeMarkers.current.forEach((mark) => mark.setMap(null));
                placeMarkers.current = [];

                const infoWindow = new window.google.maps.InfoWindow();

                // Put each marker on the map
                Object.entries(points).forEach(([category, placesArray]) => {
                    placesArray.forEach((place, idx) => {
                        const lat = place.location?.latitude;
                        const lng = place.location?.longitude;

                        const marker = new window.google.maps.Marker({
                            position: { lat, lng },
                            map: mapRef.current,
                            icon: {
                                url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                            }
                        });

                        const routeObj = routes?.[category]?.distancesAlignedByIndex?.[idx] ?? null;

                        marker.addListener("click", () => {
                            let milesText = "N/A";
                            let timeText = "N/A";

                            if (routeObj && routeObj.ok && typeof routeObj.distanceMeters === "number") {
                                const miles = routeObj.distanceMeters / 1609.344;
                                milesText = miles.toFixed(2);
                                const dur = routeObj.duration;

                                if (typeof dur === "string" && dur.endsWith("s")) {
                                    timeText = dur.slice(0, -1);
                                    let temp = Number(timeText);
                                    let minutes = Math.floor(temp / 60);
                                    let seconds = temp % 60;
                                    timeText = minutes + " min " + seconds + " s";
                                }
                            }

                            const name = place.displayName?.text || category;

                            infoWindow.setContent(
                                `<div>
                                    <div><b>${name}</b></div>
                                    <div>Distance: ${milesText} mi</div>
                                    <div>Time: ${timeText}</div>
                                </div>`
                            );
                            infoWindow.open({ map: mapRef.current, anchor: marker });
                        });

                        placeMarkers.current.push(marker);
                    });
                });
            });
        });

    }, [searchAddress]);

    return (
        <>
            <Script src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_MAPS_KEY}&v=weekly&libraries=places`} strategy="afterInteractive"
            onLoad={initializeMap} />
            {/* Container for the map */}
            <div ref={mapDiv} style={{ width: "100%", height: "91.5vh" }} />
        </>
    );
}