import { useState } from "react"

import { useCrashPoints } from "./hooks/useCrashPoints"
import { useCities } from "./hooks/useCities"
import { useCrashesMeta } from "./hooks/useCrashesMeta"

import CrashMap from "./components/Map"
import DataPane from "./components/DataPane"

import "./styles/App.css"


function App() {
  const [selectedCrash, setSelectedCrash] = useState(null)
  const [selectedCity, setSelectedCity] = useState(null)
  const [dataPaneView, setDataPaneView] = useState("table") // table | city
  const [fatalityFilter, setFatalityFilter] = useState("all") // all | motorist | pedestrian | cyclist | other
  const [vzFilter, setVzFilter] = useState(new Set(["vz", "non-vz"]))

  const { cities, loading: citiesLoading, error: citiesError } = useCities()
  const { meta: crashesMeta } = useCrashesMeta()
  const { crashPoints, loadedYears, loadYear, loading: pointsLoading, error: pointsError } = useCrashPoints(
    selectedCity?.state_fips,
    selectedCity?.place_fips,
    crashesMeta?.max_year
  )
  
  const handleCitySelect = (city) => {
    setSelectedCity(city)
    setSelectedCrash(null)
    setDataPaneView("city")
  }

  const handleClearCity = () => {
    setSelectedCity(null)
    setSelectedCrash(null)
    setDataPaneView("table")
  }

  const handleVzFilterChange = (value) => {
    if (value === "reset") {
        setVzFilter(new Set(["vz", "non-vz"]))
        return
    }
    setVzFilter(prev => {
      const next = new Set(prev)
      if (next.has(value)) {
        if (next.size > 1) next.delete(value) // prevent deselecting both
      } else {
        next.add(value)
      }
      return next
    })
  }
  
  if (citiesLoading) return <p>Loading...</p>
  if (pointsError) return <p>Error: {pointsError}</p>
  if (citiesError) return <p>Error: {citiesError}</p>

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <div style={{ flex: "0 0 60%" }}>
        <CrashMap
          crashPoints={crashPoints}
          onCrashSelect={setSelectedCrash}
          selectedCrash={selectedCrash}
          cities={cities}
          selectedCity={selectedCity}
          onCitySelect={handleCitySelect}
          onClearCity={handleClearCity}
          fatalityFilter={fatalityFilter}
          vzFilter={vzFilter}
          onVzFilterChange={handleVzFilterChange}
          onFatalityFilterChange={setFatalityFilter}
          onCrashDeselect={() => setSelectedCrash(null)}
          loadedYears={loadedYears}
          loadYear={loadYear}
          pointsLoading={pointsLoading}
          maxYear={crashesMeta?.max_year}
        />
      </div>
      <div style={{ flex: "0 0 40%", overflowY: "auto", borderLeft: "1px solid #e0e0e0" }}>
        <DataPane
          cities={cities}
          selectedCity={selectedCity}
          selectedCrash={selectedCrash}
          view={dataPaneView}
          vzFilter={vzFilter}
          fatalityFilter={fatalityFilter}
          onVzFilterChange={handleVzFilterChange}
          onFatalityFilterChange={setFatalityFilter}
          onCitySelect={handleCitySelect}
          onClearCity={handleClearCity}
          crashesMeta={crashesMeta}
        />
      </div>
    </div>
  )
}

export default App