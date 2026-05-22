const BASE_URL = "http://localhost:8000"


export async function fetchCityByYear(stateFips, cityFips) {
    const res = await fetch(`${BASE_URL}/crashes/${stateFips}/${cityFips}/by-year`)
    if (!res.ok) throw new Error("Failed to fetch city data")
    return res.json()
}


export async function fetchCrashPoints(stateFips, placeFips) {
    const res = await fetch(`${BASE_URL}/crashes/${stateFips}/${placeFips}`)
    if (!res.ok) throw new Error("Failed to fetch crash points")
    const data = await res.json()
    return data
}