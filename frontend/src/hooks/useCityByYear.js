import { useState, useEffect } from "react"
import { fetchCityCrashesByYear } from "../api/crashes"


function fillYearGaps(data, minYear,maxYear) {
    const byYear = Object.fromEntries(data.map(d => [d.year, d]))
    const result = []
    for (let y = minYear; y <= maxYear; y++) {
        result.push(byYear[y] ?? {
            year: y,
            total_fatalities: 0,
            motorist_fatalities: 0,
            pedestrian_fatalities: 0,
            cyclist_fatalities: 0,
            other_fatalities: 0,
        })
    }
    return result
}


export function useCityByYear(stateFips, placeFips, minYear, maxYear) {
    const [yearData, setYearData] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!stateFips || !placeFips) {
            setYearData([])
            return
        }
        setLoading(true)
        fetchCityCrashesByYear(stateFips, placeFips)
            .then(data => {
                setYearData(minYear && maxYear ? fillYearGaps(data, minYear, maxYear) : data)
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [stateFips, placeFips])

    return { yearData, loading, error }
}