import { useState, useEffect } from "react"
import { fetchCrashPoints } from "../api/crashes"

export function useCrashPoints(stateFips, placeFips) {
    const [crashPoints, setCrashPoints] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!stateFips || !placeFips) {
            setCrashPoints([])
            return
        }
        setLoading(true)
        fetchCrashPoints(stateFips, placeFips)
            .then(setCrashPoints)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [stateFips, placeFips])

    return { crashPoints, loading, error }
}