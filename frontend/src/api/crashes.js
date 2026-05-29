const BASE_URL = import.meta.env.VITE_R2_PUBLIC_URL

export async function fetchCrashesMeta() {
    const res = await fetch(`${BASE_URL}/crashes_metadata.json`)
    if (!res.ok) throw new Error("Failed to fetch crashes meta")
    return res.json()
}

export async function fetchCrashPointsForYear(stateFips, placeFips, year) {
    const res = await fetch(`${BASE_URL}/crashes/${stateFips}/${placeFips}/${year}.json`)
    if (res.status === 404) {
        console.warn(`Missing crash file: ${stateFips}/${placeFips}/${year}.json`)
        return []
    }
    if (!res.ok) throw new Error(`Failed to fetch crash points for ${year}`)
    return res.json()
}

export async function fetchRecentCrashPoints(stateFips, placeFips, maxYear, count = 5) {
    const years = Array.from({ length: count }, (_, i) => maxYear - i)
    const results = await Promise.all(
        years.map(year => fetchCrashPointsForYear(stateFips, placeFips, year))
    )
    return results.flat()
}
