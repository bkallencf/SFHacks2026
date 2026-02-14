"use client";
import React, { useEffect, useRef } from "react";
import Script from "next/script";

export default function SFMap({ searchAddress }) {
    const mapRef = useRef(null);
    const mapDiv = useRef(null);
    const markerRef = useRef(null); // TODO: red marker
    const boundsRef = useRef(null);
    const geoCoderRef = useRef(null);

    const SFBounds = {
        north: 37.83,
        south: 37.67,
        east: -122.35,
        west: -122.525,
    };

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


    // Takes in an address from the search bar, converts it into lat & lng, and verifies it's w/in the bounds
    useEffect(() => {
        if (!searchAddress || !window.google || !geoCoderRef.current || !boundsRef.current) return;

        // Converts the address
        geoCoderRef.current.geocode({ address: searchAddress }, (results, status) => {
            if (status !== "OK" || !results || results.length === 0) {
                return;
            }

            const location = results[0].geometry.location; // lat/lng

            // Checks that the given address is w/in the bounds
            const inside = boundsRef.current.contains(location);
            if (!inside) {
                return;
            }

            // Moves the map to the address
            mapRef.current.setCenter(location);
            markerRef.current.setPosition(location);
            mapRef.current.setZoom(16);
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