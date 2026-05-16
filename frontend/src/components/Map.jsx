import "maplibre-gl/dist/maplibre-gl.css"
import { useState, useEffect } from "react"
import Map from "react-map-gl/maplibre"
import DeckGL from "@deck.gl/react"
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers"
import { WebMercatorViewport } from "@deck.gl/core"
import Supercluster from "supercluster"

const INITIAL_VIEW = {
    longitude: -98.5795,
    latitude: 39.8283,
    zoom: 4,
    pitch: 0,
    bearing: 0,
}

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty"
const BASE_URL = "http://localhost:8000"

const supercluster = new Supercluster({
    radius: 40,
    maxZoom: 14,
})

export default function CrashMap({ crashPoints, cities, onCrashSelect, onCitySelect, selectedCity, onClearCity }) {
    const [viewState, setViewState] = useState(INITIAL_VIEW)
    const [cityBoundary, setCityBoundary] = useState(null)
    const [clusters, setClusters] = useState([])

    useEffect(() => {
        if (!cities.length) return
        const points = cities.map(city => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [city.lon, city.lat] },
            properties: {
                ...city,
            }
        }))
        supercluster.load(points)
    }, [cities])

    useEffect(() => {
        if (selectedCity) {
            setClusters([])
            return
        }

        const minPop = viewState.zoom < 5 ? 200000
                 : viewState.zoom < 7 ? 100000
                 : 50000

        const eligibleCities = cities.filter(city => 
            city.is_vision_zero || city.population >= minPop
        )

        const points = eligibleCities.map(city => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [city.lon, city.lat] },
            properties: { ...city }
        }))

        supercluster.load(points)

        const viewport = new WebMercatorViewport(viewState)
        const bounds = viewport.getBounds()
        const newClusters = supercluster.getClusters(
            [bounds[0], bounds[1], bounds[2], bounds[3]],
            Math.floor(viewState.zoom)
        )
        setClusters(newClusters)
    }, [viewState, selectedCity, cities])

    useEffect(() => {
        if (!selectedCity) {
            setCityBoundary(null)
            return
        }

        const { state_fips, place_fips } = selectedCity

        // fetch extent and zoom
        fetch(`${BASE_URL}/cities/${state_fips}/${place_fips}/extent`)
            .then(res => res.json())
            .then(ext => {
                const viewport = new WebMercatorViewport({ width: window.innerWidth, height: window.innerHeight })
                const { longitude, latitude, zoom } = viewport.fitBounds(
                    [[ext.min_lon, ext.min_lat], [ext.max_lon, ext.max_lat]],
                    { padding: 40 }
                )
                setViewState(v => ({ ...v, longitude, latitude, zoom }))
            })

        // fetch boundary
        fetch(`${BASE_URL}/cities/${state_fips}/${place_fips}/boundary`)
            .then(res => res.json())
            .then(setCityBoundary)

    }, [selectedCity])

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
        maskId: "city-mask-layer",
        onClick: ({ object }) => {
            if (object) onCrashSelect({
                lon: object[0],
                lat: object[1],
                st_case: object[2],
                year: object[3],
                crash_date: object[4],
                state_name: object[5],
                city_name: object[6],
                road_label: object[7],
                total_fatalities: object[8],
            })
        },
    })

    const clusterLayer = new ScatterplotLayer({
        id: "city-points-layer",
        data: clusters,
        getPosition: d => d.geometry.coordinates,
        getRadius: d => d.properties.cluster ? 12 : 10,
        radiusUnits: "pixels",
        getFillColor: data => {
            if (data.properties.cluster) {
                const leaves = supercluster.getLeaves(data.properties.cluster_id, Infinity)
                const hasVZ = leaves.some(l => l.properties.is_vision_zero)
                return hasVZ ? [0, 150, 73, 200] : [150, 0, 2, 200]
            }
            return data.properties.is_vision_zero ? [0, 150, 73, 200] : [150, 0, 2, 200]
        },
        pickable: true,
        onClick: ({ object }) => {
            if (!object) return
            if (object.properties.cluster) {
                const [longitude, latitude] = object.geometry.coordinates
                setViewState(v => ({ ...v, longitude, latitude, zoom: v.zoom + 5 }))
            } else {
                if (onCitySelect) onCitySelect(object.properties)
            }
        },
    })

    const cityBoundaryLayer = cityBoundary ? new GeoJsonLayer({
        id: "city-boundary-layer",
        data: {
            type: "Feature",
            geometry: cityBoundary.geom,
            properties: {},
        },
        filled: true,
        stroked: true,
        getFillColor: [0, 0, 0, 0],
        getLineColor: [100, 100, 100, 200],
        getLineWidth: 2,
        lineWidthUnits: "pixels",
    }) : null

    const layers = [
        cityBoundaryLayer,
        clusterLayer,
        crashPointsLayer,
    ].filter(Boolean)

    return (
        <DeckGL
            viewState={viewState}
            onViewStateChange={({ viewState }) => setViewState(viewState)}
            controller={true}
            layers={layers}
            getTooltip={({ object }) => {
                if (!object) return null
                if (object.properties?.cluster) return null
                const props = object.properties || object
                if (!props.place_name && !props.display_name) return null
                return {
                    html: `<div>${props.display_name || props.place_name}</div>`,
                    style: {
                        backgroundColor: "white",
                        padding: "6px 10px",
                        borderRadius: "4px",
                        fontSize: "13px",
                        color: "#333",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
                    }
                }
            }}
            onClick={({ object }) => {
                if (!object && selectedCity && onClearCity) onClearCity()
            }}
        >
            <Map mapStyle={MAP_STYLE} />
        </DeckGL>
    )
}