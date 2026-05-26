import { useEffect, useState } from "react"
import { fetchCrashesMeta } from "../api/crashes"

export function useCrashesMeta() {
    const [meta, setMeta] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchCrashesMeta()
            .then(setMeta)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    return { meta, loading, error }
}