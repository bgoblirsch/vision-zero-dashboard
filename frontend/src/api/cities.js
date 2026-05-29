const BASE_URL = import.meta.env.VITE_R2_PUBLIC_URL

export async function fetchCities() {
    const res = await fetch(`${BASE_URL}/cities.json`)
    if (!res.ok) throw new Error("Failed to fetch cities")
    return res.json()
}

export async function fetchCityCrashesByYear(stateFips, cityFips) {
    const res = await fetch(`${BASE_URL}/cities/${stateFips}/${cityFips}/annual_fatalities.json`)
    if (!res.ok) throw new Error("Failed to fetch city data")
    return res.json()
}

export async function fetchCityBoundary(stateFips, placeFips) {
    const res = await fetch(`${BASE_URL}/cities/${stateFips}/${placeFips}/boundary.geojson`)
    if (!res.ok) throw new Error("Failed to fetch city boundary")
    return res.json()
}