import { useState, useMemo, useEffect } from "react"

import { useCityByYear } from "../hooks/useCityByYear"

import CityMetricsPanel from "./CityMetricsPanel"
import TrendIndicator from "./TrendIndicator"
import CityChart from "./CityChart"

import "../styles/DataPane.css"

const FATALITY_FILTERS = [
    { value: "all",        label: "All" },
    { value: "motorist",   label: "Motorist & Other" },
    { value: "pedestrian", label: "Pedestrian" },
    { value: "cyclist",    label: "Cyclist" },
]

const COLUMN_TOOLTIPS = {
    avgFatalities: "Avg annual fatality count over the last 5 yrs",
    perCapita: "Per capita avg annual fatality rate over the last 5 yrs",
    trend: "% change in per-capita fatalities, current 5 yr avg vs prior 5 yr avg\nUses fixed 2023 ACS Population data",
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
    onClearCity,
    cityStatsMeta,
    crashesMeta
}) {
    const [searchInput, setSearchInput] = useState("")
    const [searchQuery, setSearchQuery] = useState("")
    const [sortField, setSortField] = useState("population")
    const [sortDirection, setSortDirection] = useState("desc")

    // Pick the right stat columns based on active filter
    const suffix = fatalityFilter === "all" ? "" : `_${fatalityFilter}`

    const avgKey             = fatalityFilter === "all" ? "avg_fatalities_5yr"  : `avg_5yr_${fatalityFilter}`
    const perCapitaKey       = `avg_per_100k${suffix === "" ? "_5yr" : suffix}`
    const trendKey           = `trend_pct_change${suffix}`
    const rankPerCapitaKey   = `rank_per_100k${suffix === "" ? "" : suffix}_all`
    const rankTrendKey       = `rank_trend${suffix}_all`
    const pctPerCapitaKey    = `pct_per_100k${suffix === "" ? "" : suffix}_all`
    const pctTrendKey        = `pct_trend${suffix}_all`
    const rankPerCapitaKeyVz = rankPerCapitaKey.replace("_all", "_vz")
    const rankTrendKeyVz     = rankTrendKey.replace("_all", "_vz")
    const pctPerCapitaKeyVz  = pctPerCapitaKey.replace("_all", "_vz")
    const pctTrendKeyVz      = pctTrendKey.replace("_all", "_vz")

    const sortKey = sortField === "population"    ? "population"
                  : sortField === "city"          ? "place_name"
                  : sortField === "avgFatalities" ? avgKey
                  : sortField === "perCapita"     ? perCapitaKey
                  : sortField === "trend"         ? trendKey
                  : "population"

    const { yearData, loading: yearLoading } = useCityByYear(
        selectedCity?.state_fips,
        selectedCity?.place_fips,
        2001,
        crashesMeta?.max_year
    )

    const handleSearchKeyDown = (e) => {
        if (e.key === "Enter") setSearchQuery(searchInput.trim().toLowerCase())
    }

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(d => d === "asc" ? "desc" : "asc")
        } else {
            setSortField(field)
            setSortDirection(field === "city" ? "asc" : "desc")
        }
    }

    const handleReset = () => {
        setSortField("population")
        setSortDirection("desc")
        onFatalityFilterChange("all")
        onVzFilterChange("reset")
        setSearchInput("")
        setSearchQuery("")
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

    const sortedCities = useMemo(() => {
        const sorted = [...filteredCities]
        sorted.sort((a, b) => {
            const aVal = a[sortKey] ?? null
            const bVal = b[sortKey] ?? null
            if (aVal === null && bVal === null) return 0
            if (aVal === null) return 1
            if (bVal === null) return -1
            if (typeof aVal === "string") {
                return sortDirection === "asc"
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal)
            }
            return sortDirection === "asc" ? aVal - bVal : bVal - aVal
        })
        return sorted
    }, [filteredCities, sortKey, sortDirection])

    const rankedCountAll    = cities.filter(c => c[rankPerCapitaKey] !== null).length
    const rankedTrendAll    = cities.filter(c => c[rankTrendKey] !== null).length
    const rankedCountVz     = cities.filter(c => c[rankPerCapitaKeyVz] !== null).length
    const rankedTrendVz     = cities.filter(c => c[rankTrendKeyVz] !== null).length

    return (
        <div className="pane">
            <div className="pane-header">
                <h1 className="pane-title">Vision Zero Dashboard</h1>
                {view === "city" ? (
                    <>
                        <p className="pane-breadcrumb" onClick={onClearCity}>
                            ← {selectedCity.display_name || selectedCity.place_name}, {selectedCity.state_name}
                        </p>
                    </>
                ) : (
                    <>
                        <p className="pane-subtitle">
                            Select a city to view its <a href="https://www.nhtsa.gov/research-data/fatality-analysis-reporting-system-fars">FARS</a> crash history. Includes all <a href="https://visionzeronetwork.org/">Vision Zero</a> cities and non-Vision Zero cities with &gt; 100K people.
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
                            <button className="filter-btn reset-btn" onClick={handleReset}>
                                Reset Table
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="content-area">
                {view === "city" ? (
                    <div className="city-detail">
                        <table className="city-table">
                            <thead>
                                <tr>
                                    <th>City</th>
                                    <th>VZ</th>
                                                <th className="right" title="Avg annual fatality count over the last 5 yrs">Avg Fatalities</th>
                                                <th className="right" title="Per capita avg annual fatality rate over the last 5 yrs">Per 100k</th>
                                                <th className="right" title="% change in per-capita fatalities, current 5 yr avg vs prior 5 yr avg&#10;Uses fixed 2023 ACS Population data">Pct Change</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="selected-city-row">
                                    <td>
                                        <div className="city-name">{selectedCity.display_name || selectedCity.place_name}</div>
                                        <div className="state-name">{selectedCity.state_name}</div>
                                    </td>
                                    <td>
                                        {selectedCity.is_vision_zero && (
                                            <span className="vz-badge">VZ</span>
                                        )}
                                    </td>
                                    <td className="right">{selectedCity[avgKey] ?? "—"}</td>
                                    <td className="right">{selectedCity[perCapitaKey] ?? "—"}</td>
                                    <td className="right">
                                        <TrendIndicator slope={selectedCity[trendKey]} />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="metrics-panel">
                            <CityMetricsPanel
                                city={selectedCity}
                                perCapitaKey={perCapitaKey}
                                trendKey={trendKey}
                                rankPerCapitaKey={rankPerCapitaKey}
                                pctPerCapitaKey={pctPerCapitaKey}
                                rankPerCapitaKeyVz={rankPerCapitaKeyVz}
                                pctPerCapitaKeyVz={pctPerCapitaKeyVz}
                                rankTrendKey={rankTrendKey}
                                pctTrendKey={pctTrendKey}
                                rankTrendKeyVz={rankTrendKeyVz}
                                pctTrendKeyVz={pctTrendKeyVz}
                                cityStatsMeta={cityStatsMeta}
                                rankedCountAll={rankedCountAll}
                                rankedTrendAll={rankedTrendAll}
                                rankedCountVz={rankedCountVz}
                                rankedTrendVz={rankedTrendVz}
                            />
                        </div>
                        <div className="chart-section">
                            {yearLoading ? (
                                <div className="chart-placeholder"><span>Loading...</span></div>
                            ) : (
                                <CityChart yearData={yearData} fatalityFilter={fatalityFilter} />
                            )}
                        </div>
                    </div>
                ) : (
                    filteredCities.length === 0 ? (
                        <div className="no-results">No cities match "{searchQuery}"</div>
                    ) : (
                        <table className="city-table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort("city")} className="sortable">
                                        City {sortField === "city" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                                    </th>
                                    <th>VZ</th>
                                    <th className="right sortable" onClick={() => handleSort("avgFatalities")} title={COLUMN_TOOLTIPS.avgFatalities}>
                                        Avg Fatalities {sortField === "avgFatalities" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                                    </th>
                                    <th className="right sortable" onClick={() => handleSort("perCapita")} title={COLUMN_TOOLTIPS.perCapita}>
                                        Per 100k {sortField === "perCapita" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                                    </th>
                                    <th className="right sortable" onClick={() => handleSort("trend")} title={COLUMN_TOOLTIPS.trend}>
                                        Pct Change {sortField === "trend" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedCities.map(city => (
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
                                        <td className="right">{city[perCapitaKey] ?? "—"}</td>
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