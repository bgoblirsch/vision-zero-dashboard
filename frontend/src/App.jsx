import { useState } from "react"
import { useCrashPoints } from "./hooks/useCrashPoints"
import { useCities } from "./hooks/useCities"
import CrashMap from "./components/Map"

function App() {
  const [selectedCrash, setSelectedCrash] = useState(null)
  const [selectedCity, setSelectedCity] = useState(null)

  const { cities, loading: citiesLoading, error: citiesError } = useCities()
  const { crashPoints, loading: pointsLoading, error: pointsError } = useCrashPoints(
    selectedCity?.state_fips,
    selectedCity?.place_fips
  )

  const handleCitySelect = (city) => {
    setSelectedCity(city)
    setSelectedCrash(null)
  }

  const handleClearCity = () => {
    setSelectedCity(null)
    setSelectedCrash(null)
  }
  
  if (citiesLoading) return <p>Loading...</p>
  if (pointsError) return <p>Error: {pointsError}</p>
  if (citiesError) return <p>Error: {citiesError}</p>

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <CrashMap
        crashPoints={crashPoints}
        onCrashSelect={setSelectedCrash}
        cities={cities}
        selectedCity={selectedCity}
        onCitySelect={handleCitySelect}
        onClearCity={handleClearCity}
      />
      {selectedCrash && (
        <div style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "white",
          padding: "10px",
          borderRadius: "4px",
        }}>
          <p>{selectedCrash.city_name}, {selectedCrash.state_name}</p>
          <p>{selectedCrash.crash_date}</p>
          <p>Fatalities: {selectedCrash.total_fatalities}</p>
        </div>
      )}
    </div>
  )
}

export default App