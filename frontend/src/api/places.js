const BASE_URL = "http://localhost:8000"

export async function fetchTigerPlaces() {
    const res = await fetch(`${BASE_URL}/places`)
    if (!res.ok) throw new Error("Failed to fetch city boundaries.")
    return res.json()
}

export async function fetchCities(minPopulation = 25000) {
    const res = await fetch(`${BASE_URL}/places/cities?min_population=${minPopulation}`)
    if (!res.ok) throw new Error("Failed to fetch cities")
    return res.json()
}