const BASE_URL = "http://localhost:8000"


export async function fetchCities(minPopulation = 100000) {
    const res = await fetch(`${BASE_URL}/cities?min_population=${minPopulation}`)
    if (!res.ok) throw new Error("Failed to fetch cities")
    return res.json()
}