import { useState } from "react"
import { useCrashPoints } from "./hooks/useCrashPoints"
import { useCities } from "./hooks/useCities"
import CrashMap from "./components/Map"

function App() {
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [selectedCity, setSelectedCity] = useState(null)

  const { crashPoints, loading: pointsLoading, error: pointsError } = useCrashPoints(
    selectedCity?.state_fips,
    selectedCity?.place_fips
  )
  const { cities, loading: citiesLoading, error: citiesError } = useCities()

  if (citiesLoading) return <p>Loading...</p>
  if (pointsError) return <p>Error: {pointsError}</p>
  if (citiesError) return <p>Error: {citiesError}</p>

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <CrashMap
        tigerPlaces={[]}
        crashPoints={crashPoints}
        cities={cities}
        onPointSelect={setSelectedPoint}
        onCitySelect={setSelectedCity}
      />
      {selectedPoint && (
        <div style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "white",
          padding: "10px",
          borderRadius: "4px",
        }}>
          <p>{selectedPoint.city_name}, {selectedPoint.state_name}</p>
          <p>{selectedPoint.crash_date}</p>
          <p>Fatalities: {selectedPoint.total_fatalities}</p>
        </div>
      )}
    </div>
  )
}

export default App