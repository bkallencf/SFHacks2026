// Calculates the scores for a given locations walkability; aiming for values btwn 0-2
export function calculateWalkability(nearbyLocations, routesToPoints) {
    const distances = buildDistanceMap(nearbyLocations, routesToPoints);
    const weights = {grocery_store: 2, shopping_mall: 1.3, school: 1.2, parks: 1}
    const scores = {total: 0};

    Object.entries(distances).forEach(([category, distanceArray]) => {
        distanceArray.sort((a, b) => a - b);
        let sectionScore = 0;

        // Takes in the 5 closest locations at most and ignores the rest
        for (let i = 0; i < distanceArray.length && i < 5; i++) {
            sectionScore += distanceArray[i];
        }
        
        // Dividing by 5 rewards areas that are close to many things
        sectionScore = (sectionScore / 5) / 100;
        scores[category] = sectionScore;
    });
    
    // Calculates aggregate score
    Object.keys(scores).forEach((category) => {
        if (weights[category] == null) {
            scores.total += scores[category];
        } else {
            scores.total += scores[category]*weights[category];
        }
    });
    scores.total = scores.total / scores.length;

    return scores;
}

// Creates an easy map between the categories and an array of the distances
export function buildDistanceMap(nearbyLocations, routesToPoints) {
    const categories = {};

    for (const [type, placesArray] of Object.entries(nearbyLocations)) {
        const aligned = routesToPoints?.[type]?.distancesAlignedByIndex || [];

        const distances = [];

        for (let i = 0; i < placesArray.length; i++) {
            const route = aligned[i];

            if (route && route.ok === true && typeof route.distanceMeters === "number") {
                distances.push(route.distanceMeters);
            }
        }

        categoryDistanceMap[type] = distances;
    }

    return categoryDistanceMap;
}