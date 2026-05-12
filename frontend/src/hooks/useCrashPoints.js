import { useEffect, useState } from "react"
import { fetchCrashPoints } from "../api/crashes"

export function useCrashPoints() {
    const [crashPoints, setCrashPoints] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchCrashPoints()
            .then(setCrashPoints)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    return { crashPoints, loading, error }
}