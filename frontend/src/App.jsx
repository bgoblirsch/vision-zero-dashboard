import { useEffect, useState } from "react"
import axios from "axios"

function App() {
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    axios.get("http://localhost:8000/crashes/cities")
      .then(res => {
        setCities(res.data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <p>Loading cities...</p>
  if (error) return <p>Error: {error}</p>

  return (
    <div>
      <h1>Vision Zero Dashboard</h1>
      <p>{cities.length} cities with fatal crash data</p>
      <ul>
        {cities.map((city, i) => (
          <li key={i}>{city.city_name}, {city.state_name}</li>
        ))}
      </ul>
    </div>
  )
}

export default App