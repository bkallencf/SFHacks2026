"use client";
import { useState } from "react";

export default function SideBar({ scores }) {
    const [open, setOpen] = useState(true);

    return (
        <>
            {/* Hamburger button */}
            <button type="button" onClick={() => setOpen(true)}
                style={{ position: "fixed", top: 170, left: 12, zIndex: 1000, width: 44, height: 44,
                         borderRadius: 10, border: "1px solid #000000", background: "white", cursor: "pointer",
                         display: "flex", alignItems: "center", justifyContent: "center", }}
                aria-label="Open sidebar">
                <div style={{ display: "grid", gap: 5 }}>
                    <div style={{ width: 20, height: 2, background: "#111" }} />
                    <div style={{ width: 20, height: 2, background: "#111" }} />
                    <div style={{ width: 20, height: 2, background: "#111" }} />
                </div>
            </button>

            {/* Sidebar */}
            <div style={{ position: "fixed", top: 68, left: 0, height: "100vh", width: "25vw", minWidth: 260, 
                          maxWidth: 420, background: "black", borderRight: "1px solid #ddd", zIndex: 1001,
                          transform: open ? "translateX(0)" : "translateX(-105%)", transition: "transform 200ms ease", padding: 16,
                          boxSizing: "border-box", fontFamily: "Courier New" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 600, color: "white" }}>[Placeholder_Name]</div>
                    <button type="button" onClick={() => setOpen(false)} style={{ border: "1px solid #ccc",
                            background: "white", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}
                            aria-label="Close sidebar">
                        X
                    </button>
                </div>
                <div style={{ marginTop: 12, color: "white" }}>
                    {scores == null ? (
                        <p>Welcome to [Placeholder]! Use the search bar above to find alternative locales close to home, 
                            or view scores to see how walkable your future home is.
                        </p>
                    ) : (
                    <>
                        {/* Prints out scores for each category, starting w/ total */}
                        <div style={{ fontWeight: 600, color: "white" }}>Walkability Scores</div>
                        {Object.keys(scores).map((key) => (
                            <div key={key}>
                                {key.replace(/(^|_)([a-z])/g, (_, sep, l) => (sep ? " " : "") + l.toUpperCase())}: {Number(scores[key]).toFixed(5)}
                                <br />
                                <br />
                            </div>
                        ))}
                    </>
                    )}
                </div>
            </div>
        </>
    );
}

// {scores && (
// <div>
//     <div>Total: {typeof scores.total === "number" ? scores.total.toFixed(2) : String(scores.total)}</div>
//         {Object.entries(scores).filter(([k])=>k!=="total").map(([k,v]) => (
//                                     <div key={k}>{k}: {typeof v === "number" ? v.toFixed(2) : String(v)}</div>
//                                 ))}
//                             </div>
//                         )}