import { useEffect, useState } from "react"
import { fetchCities } from "../api/places"

export function useCities(minPopulation = 25000) {
    const [cities, setCities] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchCities(minPopulation)
            .then(setCities)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [minPopulation])

    return { cities, loading, error }
}