import { useState, useEffect, useCallback } from "react"
import { fetchRecentCrashPoints, fetchCrashPointsForYear } from "../api/crashes"

export function useCrashPoints(stateFips, placeFips, maxYear) {
    const [crashPoints, setCrashPoints] = useState([])
    const [loadedYears, setLoadedYears] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!stateFips || !placeFips || !maxYear) {
            setCrashPoints([])
            setLoadedYears([])
            return
        }
        setLoading(true)
        fetchRecentCrashPoints(stateFips, placeFips, maxYear)
            .then(points => {
                setCrashPoints(points)
                const years = Array.from({ length: 5 }, (_, i) => maxYear - i)
                setLoadedYears(years)
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [stateFips, placeFips, maxYear])

    const loadYear = useCallback(async (year) => {
        if (loadedYears.includes(year)) return
        setLoading(true)
        try {
            const points = await fetchCrashPointsForYear(stateFips, placeFips, year)
            setCrashPoints(prev => [...prev, ...points])
            setLoadedYears(prev => [...prev, year])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [stateFips, placeFips, loadedYears])

    return { crashPoints, loadedYears, loading, error, loadYear }
}