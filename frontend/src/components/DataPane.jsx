import { useState, useMemo } from "react"

import { useCityByYear } from "../hooks/useCityByYear"
import CityChart from "./CityChart"
import "../styles/DataPane.css"

const FATALITY_FILTERS = [
    { value: "all",        label: "All" },
    { value: "motorist",   label: "Motorist & Other" },
    { value: "pedestrian", label: "Pedestrian" },
    { value: "cyclist",    label: "Cyclist" },
]


function TrendIndicator({ slope }) {
    if (slope === null || slope === undefined) {
        return <span className="trend-none">—</span>
    }
    const isImproving = slope <= 0
    const value = Math.abs(slope).toFixed(1)
    return (
        <span className={isImproving ? "trend-improving" : "trend-worsening"}>
            {isImproving ? "▼" : "▲"} {value}%
        </span>
    )
}


function DataPane({
    cities,
    selectedCity,
    selectedCrash,
    view,
    fatalityFilter,
    vzFilter,
    onFatalityFilterChange,
    onVzFilterChange,
    onCitySelect,
    onClearCity
}) {
    const [searchInput, setSearchInput] = useState("")
    const [searchQuery, setSearchQuery] = useState("")

    const { yearData, loading: yearLoading } = useCityByYear(
        selectedCity?.state_fips,
        selectedCity?.place_fips
    )    

    const handleSearchKeyDown = (e) => {
        if (e.key === "Enter") setSearchQuery(searchInput.trim().toLowerCase())
    }

    const filteredCities = useMemo(() => {
        let result = cities
        if (!vzFilter.has("vz"))     result = result.filter(c => !c.is_vision_zero)
        if (!vzFilter.has("non-vz")) result = result.filter(c => c.is_vision_zero)
        if (searchQuery) result = result.filter(city =>
            city.display_name?.toLowerCase().includes(searchQuery) ||
            city.place_name?.toLowerCase().includes(searchQuery) ||
            city.state_name?.toLowerCase().includes(searchQuery)
        )
        return result
    }, [cities, searchQuery, vzFilter])

    // Pick the right stat columns based on active filter
    const avgKey    = fatalityFilter === "all" ? "avg_fatalities_5yr" : `avg_5yr_${fatalityFilter}`
    const perCapKey = fatalityFilter === "all" ? "avg_per_100k_5yr"   : `avg_per_100k_${fatalityFilter}`
    const trendKey  = fatalityFilter === "all" ? "trend_pct_change"        : `trend_pct_change_${fatalityFilter}`

    return (
        <div className="pane">
            <div className="pane-header">
                <h1 className="pane-title">Vision Zero Dashboard</h1>
                {view === "city" ? (
                    <>
                        <p className="pane-subtitle">Lorem Ipsum Lorem Ipsum <br/>E Pluribus Un E Pluribus Un</p>
                        <p className="pane-breadcrumb" onClick={onClearCity}>
                            ← {selectedCity.display_name || selectedCity.place_name}, {selectedCity.state_name}
                        </p>
                    </>
                ) : (
                    <>
                        <p className="pane-subtitle">
                            Select a city to view its <a href="https://www.nhtsa.gov/research-data/fatality-analysis-reporting-system-fars">FARS</a> crash history. Includes all <a href="https://visionzeronetwork.org/">Vision Zero</a> cities and non-Vision Zero cities with &gt; 50K people.
                        </p>
                        <div className="search-row">
                            <input
                                className="search-input"
                                type="text"
                                placeholder="Search cities..."
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                            />
                            <button
                                className="search-button"
                                onClick={() => setSearchQuery(searchInput.trim().toLowerCase())}
                            >
                                Search
                            </button>
                        </div>
                    </>
                )}
                <div className="filter-row">
                    {FATALITY_FILTERS.map(f => (
                        <button
                            key={f.value}
                            className={`filter-btn${fatalityFilter === f.value ? " active" : ""}`}
                            onClick={() => onFatalityFilterChange(f.value)}
                        >
                            {f.label}
                        </button>
                    ))}
                    {view !== "city" && (
                        <>
                            <div className="vz-filter-group">
                                <button
                                    className={`filter-btn${vzFilter.has("vz") ? " vz-active" : ""}`}
                                    onClick={() => onVzFilterChange("vz")}
                                >
                                    Vision Zero
                                </button>
                                <button
                                    className={`filter-btn${vzFilter.has("non-vz") ? " active" : ""}`}
                                    onClick={() => onVzFilterChange("non-vz")}
                                >
                                    Non-VZ
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="content-area">
                {view === "city" ? (
                    <>
                        {yearLoading ? (
                            <div className="chart-placeholder"><span>Loading...</span></div>
                        ) : (
                            <CityChart yearData={yearData} fatalityFilter={fatalityFilter} />
                        )}
                    </>
                ) : (
                    filteredCities.length === 0 ? (
                        <div className="no-results">No cities match "{searchQuery}"</div>
                    ) : (
                        <table className="city-table">
                            <thead>
                                <tr>
                                    <th>City</th>
                                    <th>VZ</th>
                                    <th className="right" title="Avg fatality count over the last 5 yrs">Avg Fatalities</th>
                                    <th className="right" title="Per capita avg fataility rate over the last 5 yrs">Per 100k</th>
                                    <th className="right" title="% change in per-capita fatalities, current 5 yr avg vs prior 5 yr avg&#10;Uses fixed 2023 ACS Population data">Pct Change</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCities.map(city => (
                                    <tr
                                        key={`${city.state_fips}-${city.place_fips}`}
                                        onClick={() => onCitySelect(city)}
                                    >
                                        <td>
                                            <div className="city-name">{city.display_name || city.place_name}</div>
                                            <div className="state-name">{city.state_name}</div>
                                        </td>
                                        <td>
                                            {city.is_vision_zero && (
                                                <span className="vz-badge">VZ</span>
                                            )}
                                        </td>
                                        <td className="right">{city[avgKey] ?? "—"}</td>
                                        <td className="right">{city[perCapKey] ?? "—"}</td>
                                        <td className="right">
                                            <TrendIndicator slope={city[trendKey]} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                )}
            </div>
        </div>
    )
}


export default DataPane