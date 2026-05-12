const BASE_URL = "http://localhost:8000"

export async function fetchTigerPlaces() {
    const res = await fetch(`${BASE_URL}/places`)
    if (!res.ok) throw new Error("Failed to fetch city boundaries.")
    return res.json()
}