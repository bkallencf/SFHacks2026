"use client";
import { useState } from "react";
import SFMap from "./SFMap";

export default function SearchBar() {
    const [address, setAddress] = useState("");

    function lookUpAddress(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const input = formData.get("search")?.toString() || "";
        setAddress(input);
        event.target.reset();
    }

    return (
        <>
            <form onSubmit={lookUpAddress} style={{ display: "flex", gap: 8, padding: 12 }}>
                <input
                    name="search"
                    placeholder="Type an address"
                    style={{ flex: 1, padding: 10 }}
                />
                <button type="submit" style={{ padding: "10px 12px" }}>Search</button>
            </form>

            <SFMap searchAddress={address} />
        </>
    );
}