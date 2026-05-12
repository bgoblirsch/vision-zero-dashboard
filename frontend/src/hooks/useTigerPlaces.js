import { useEffect, useState } from "react"
import { fetchTigerPlaces } from "../api/places"

export function useTigerPlaces() {
    const [tigerPlaces, setTigerPlaces] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchTigerPlaces()
            .then(setTigerPlaces)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    return { tigerPlaces, loading, error }
}