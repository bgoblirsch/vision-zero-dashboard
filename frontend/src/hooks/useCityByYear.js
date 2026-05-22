import { useState, useEffect } from "react"
import { fetchCityByYear } from "../api/crashes"

export function useCityByYear(stateFips, placeFips) {
    const [yearData, setYearData] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!stateFips || !placeFips) {
            setYearData([])
            return
        }
        setLoading(true)
        fetchCityByYear(stateFips, placeFips)
            .then(setYearData)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [stateFips, placeFips])

    return { yearData, loading, error }
}