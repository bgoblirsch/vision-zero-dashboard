const BASE_URL = "http://localhost:8000"


export async function fetchCityByYear(cityId) {
    const res = await fetch(`${BASE_URL}/crashes/city/${cityId}/by-year`)
    if (!res.ok) throw new Error("Failed to fetch city data")
    return res.json()
}


export async function fetchCrashPoints(stateFips, placeFips) {
    const res = await fetch(`${BASE_URL}/crashes/points/${stateFips}/${placeFips}`)
    if (!res.ok) throw new Error("Failed to fetch crash points")
    const data = await res.json()
    return data
}