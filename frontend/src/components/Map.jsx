import { useState } from "react"
import Map from "react-map-gl/maplibre"
import DeckGL from "@deck.gl/react"
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers"
import "maplibre-gl/dist/maplibre-gl.css"

const INITIAL_VIEW = {
    longitude: -98.5795,
    latitude: 39.8283,
    zoom: 4,
    pitch: 0,
    bearing: 0,
}

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty"

export default function CrashMap({ crashPoints, tigerPlaces, cities, onPointSelect, onCitySelect }) {
    const [viewState, setViewState] = useState(INITIAL_VIEW)

    const tigerPlacesLayer = new GeoJsonLayer({
        id: "tiger-places-layer",
        data: tigerPlaces.map(p => ({
            type: "Feature",
            geometry: p.geom,
            properties: {
                place_name: p.place_name,
                statefp: p.statefp,
                place_type: p.place_type,
            }
        })),
        filled: true,
        stroked: true,
        getFillColor: [100, 150, 255, 30],
        getLineColor: [100, 150, 255, 150],
        getLineWidth: 1,
        lineWidthUnits: "pixels",
    })

    const cityPointsLayer = new ScatterplotLayer({
        id: "city-points-layer",
        data: cities,
        getPosition: d => [d.lon, d.lat],
        getRadius: d => Math.sqrt(d.population) * 50,
        radiusUnits: "meters",
        radiusMinPixels: 4,
        radiusMaxPixels: 30,
        getFillColor: [30, 144, 255, 200],
        pickable: true,
        onClick: ({ object }) => {
            if (object && onCitySelect) onCitySelect(object)
        },
    })

    const crashPointsLayer = new ScatterplotLayer({
        id: "crash-points-layer",
        data: crashPoints,
        getPosition: d => [d[0], d[1]],
        getRadius: 300,
        radiusUnits: "meters",
        radiusMinPixels: 2,
        radiusMaxPixels: 10,
        getFillColor: d => d[2] === 1 ? [0, 200, 100, 180] : [255, 0, 0, 180],
        pickable: true,
        onClick: ({ object }) => {
            if (point) onPointSelect({
                lon: object[0],
                lat: object[1],
                is_rural: object[2],
                st_case: object[3],
                year: object[4],
                crash_date: object[5],
                state_name: object[6],
                city_name: object[7],
                road_label: object[8],
                total_fatalities: object[9],
            })
        },
    })

    return (
        <DeckGL
            viewState={viewState}
            onViewStateChange={({ viewState }) => setViewState(viewState)}
            controller={true}
            layers={[tigerPlacesLayer, cityPointsLayer, crashPointsLayer]}
        >
            <Map mapStyle={MAP_STYLE} />
        </DeckGL>
    )
}