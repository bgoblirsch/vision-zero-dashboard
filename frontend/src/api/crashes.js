const BASE_URL = "http://localhost:8000"

export async function fetchCities() {
    const res = await fetch(`${BASE_URL}/crashes/cities`)
    if (!res.ok) throw new Error("Failed to fetch cities")
    return res.json()
}

export async function fetchCityByYear(cityId) {
    const res = await fetch(`${BASE_URL}/crashes/city/${cityId}/by-year`)
    if (!res.ok) throw new Error("Failed to fetch city data")
    return res.json()
}

export async function fetchCrashPoints() {
    console.log("Fetching crash points...")
    const res = await fetch(`${BASE_URL}/crashes/points`)
    if (!res.ok) throw new Error("Failed to fetch crash points")
    console.log("Response received, parsing JSON...")
    const data = await res.json()
    console.log(`Parsed ${data.length} crash points`)
    return data
}