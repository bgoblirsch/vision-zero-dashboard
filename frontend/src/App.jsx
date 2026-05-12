import { useState } from "react"
import { useCrashPoints } from "./hooks/useCrashPoints"
import { useTigerPlaces } from "./hooks/useTigerPlaces"
import CrashMap from "./components/Map"

function App() {
  const { crashPoints, pointsLoading, pointsError } = useCrashPoints()
  const { tigerPlaces, placesLoading, placesError } = useTigerPlaces()
  const [selectedPoint, setSelectedPoint] = useState(null)

  if (pointsLoading) return <p>Loading crash points...</p>
  if (pointsError) return <p>Error: {pointsError}</p>

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <CrashMap
        tigerPlaces={tigerPlaces}
        crashPoints={crashPoints}
        onPointSelect={setSelectedPoint}
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