import "maplibre-gl/dist/maplibre-gl.css"
import { useState, useEffect } from "react"
import Map from "react-map-gl/maplibre"
import DeckGL from "@deck.gl/react"
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers"
import { WebMercatorViewport } from "@deck.gl/core"
import Supercluster from "supercluster"
import booleanPointInPolygon from "@turf/boolean-point-in-polygon"

import "../styles/Map.css"
import EyeIcon from "./EyeIcon"
import { FATALITY_COLORS, FATALITY_COLORS_RGB, VZ_COLORS, VZ_COLORS_RGB } from "../constants/colors"

const CONT_US_BOUNDS = {
    minLon: -125,
    maxLon: -66,
    minLat: 24,
    maxLat: 50,
}

const CITY_LEGEND_ITEMS = [
    { key: "vz", color: VZ_COLORS.vz, label: "Vision Zero city" },
    { key: "non-vz", color: VZ_COLORS.nonVZ, label: "Non-Vision Zero city" },
]

const CRASH_LEGEND_ITEMS = [
    { key: "motorist", color: FATALITY_COLORS.motorist, label: "Motorist & other" },
    { key: "pedestrian", color: FATALITY_COLORS.pedestrian, label: "Includes pedestrian fatality" },
    { key: "cyclist", color: FATALITY_COLORS.cyclist, label: "Includes cyclist fatality" },
]

const dotStyle = (color) => ({
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: color,
    flexShrink: 0,
})

const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron"
const BASE_URL = "http://localhost:8000"

const supercluster = new Supercluster({
    radius: 40,
    maxZoom: 14,
})


function getClusterExpansionViewState(clusterId, currentViewState) {
    const leaves = supercluster.getLeaves(clusterId, Infinity)
    const lons = leaves.map(l => l.geometry.coordinates[0])
    const lats = leaves.map(l => l.geometry.coordinates[1])
    const viewport = new WebMercatorViewport({
        width: window.innerWidth * 0.6,
        height: window.innerHeight
    })
    const { longitude, latitude, zoom } = viewport.fitBounds(
        [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
        { padding: 120 }
    )
    return { ...currentViewState, longitude, latitude, zoom } 
}


function getInitialViewState() {
    const { innerWidth, innerHeight } = window
    const lonRange = CONT_US_BOUNDS.maxLon - CONT_US_BOUNDS.minLon
    const latRange = CONT_US_BOUNDS.maxLat - CONT_US_BOUNDS.minLat

    const mapWidth = innerWidth * 0.6
    const zoomX = Math.log2(mapWidth / 256 * 360 / lonRange)
    const zoomY = Math.log2(innerHeight / 256 * 180 / latRange)
    const zoom = Math.min(zoomX, zoomY) - 1
    return {
        longitude: (CONT_US_BOUNDS.minLon + CONT_US_BOUNDS.maxLon) / 2,
        latitude: (CONT_US_BOUNDS.minLat + CONT_US_BOUNDS.maxLat) / 2,
        zoom,
        pitch: 0,
        bearing: 0,
    }
}


function LegendRow({ color, label, visible, onToggle }) {
    return (
        <div
            className="map-legend-row"
            style={{ cursor: "pointer", opacity: visible ? 1 : 0.4 }}
            onClick={onToggle}
        >
            <EyeIcon open={visible} />
            <div className="map-legend-dot" style={{ backgroundColor: color }} />
            <span>{label}</span>
        </div>
    )
}


export default function CrashMap({ 
    crashPoints, 
    cities, 
    onCrashSelect, 
    selectedCrash,
    onCitySelect, 
    selectedCity, 
    onClearCity,
    vzFilter,
    onVzFilterChange,
    fatalityFilter,
    onFatalityFilterChange,
    onCrashDeselect
}) {
    const [viewState, setViewState] = useState(getInitialViewState)
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

        const visibleCities = cities.filter(city =>
            (city.is_vision_zero || city.population >= minPop) &&
            (city.is_vision_zero ? vzFilter.has("vz") : vzFilter.has("non-vz"))
        )

        const points = visibleCities.map(city => ({
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
    }, [viewState, selectedCity, cities, vzFilter])

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
                    { padding: {
                        left: 350,
                        right: 350,
                        top: 20,
                        bottom: 20
                    } }
                )
                setViewState(v => ({ ...v, longitude, latitude, zoom }))
            })

        // fetch boundary
        fetch(`${BASE_URL}/cities/${state_fips}/${place_fips}/boundary`)
            .then(res => res.json())
            .then(setCityBoundary)

    }, [selectedCity])

    const filteredCrashPoints = fatalityFilter === "all"
        ? crashPoints
        : crashPoints.filter(d => d[`${fatalityFilter}_fatalities`] > 0)

    const crashPointsLayer = new ScatterplotLayer({
        id: "crash-points-layer",
        data: filteredCrashPoints,
        getPosition: d => [d.lon, d.lat],
        getRadius: 6,
        radiusUnits: "pixels",
        getFillColor: d => d.pedestrian_fatalities > 0 ? FATALITY_COLORS_RGB.pedestrian : 
                           d.cyclist_fatalities > 0 ? FATALITY_COLORS_RGB.cyclist : 
                           FATALITY_COLORS_RGB.motorist,
        pickable: true,
        maskId: "city-mask-layer",
        onClick: ({ object }) => {
            if (object) onCrashSelect({
                lon: object.lon,
                lat: object.lat,
                st_case: object.st_case,
                year: object.year,
                crash_date: object.crash_date,
                state_name: object.state_name,
                city_name: object.fips_city_name,
                road_label: object.road_label,
                total_fatalities: object.total_fatalities,
                motorist_fatalities: object.motorist_fatalities,
                pedestrian_fatalities: object.pedestrian_fatalities,
                cyclist_fatalities: object.cyclist_fatalities,
                other_fatalities: object.other_fatalities,
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
                return hasVZ ? VZ_COLORS_RGB.vz : VZ_COLORS_RGB.nonVZ
            }
            return data.properties.is_vision_zero ? VZ_COLORS_RGB.vz : VZ_COLORS_RGB.nonVZ
        },
        pickable: true,
        onClick: ({ object }) => {
            if (!object) return
            if (object.properties.cluster) {
                setViewState(v => getClusterExpansionViewState(object.properties.cluster_id, v))
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
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <DeckGL
                viewState={viewState}
                onViewStateChange={({ viewState }) => setViewState(viewState)}
                controller={true}
                layers={layers}
                getCursor={({isHovering}) => isHovering ? "pointer" : "grab"}
                getTooltip={({ object }) => {
                    if (!object) return null
                    if (object.properties?.cluster) {
                        const leaves = supercluster.getLeaves(object.properties.cluster_id, Infinity)
                        const largest = leaves.reduce((a, b) => 
                            a.properties.population > b.properties.population ? a : b
                        )
                        const count = leaves.length
                        return {
                            html: `<div>${largest.properties.display_name || largest.properties.place_name} Region</div>`,
                            style: {
                                backgroundColor: "white",
                                padding: "4px 6px",
                                borderRadius: "4px",
                                fontSize: "12px",
                                color: "#333",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
                            }
                        }
                    }
                    const props = object.properties || object
                    if (!props.place_name && !props.display_name) return null
                    return {
                        html: `<div>${props.display_name || props.place_name}</div>`,
                        style: {
                            backgroundColor: "white",
                            padding: "4px 6px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            color: "#333",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
                        }
                    }
                }}
                onClick={({ object, coordinate }) => {
                    if (!object) {
                        if (selectedCrash) {
                            onCrashDeselect()
                            return
                        }
                        if (selectedCity && onClearCity) {
                            if (!coordinate || !cityBoundary) {
                                onClearCity()
                                return
                            }
                            const point = { type: "Feature", geometry: { type: "Point", coordinates: coordinate } }
                            const polygon = { type: "Feature", geometry: cityBoundary.geom }
                            if (!booleanPointInPolygon(point, polygon)) {
                                onClearCity()
                            }
                        }
                    }
                }}
            >
                <Map mapStyle={MAP_STYLE} />
            </DeckGL>
            <div className="map-legend">
                <div className="map-legend-title" style={{ position: "relative", textAlign: "center" }}>
                    {selectedCity && fatalityFilter !== "all" && (
                        <span
                            style={{ color: "#7db8f7", position: "absolute", left: -5, fontSize: "9px", letterSpacing: "0.06em", cursor: "pointer" }}
                            onClick={() => onFatalityFilterChange("all")}
                        >
                            RESET
                        </span>
                    )}
                    <span>{selectedCity ? "Crash Type" : "Vision Zero Status"}</span>
                </div>
                {selectedCity ? (
                    CRASH_LEGEND_ITEMS.map(({ key, color, label }) => (
                        <LegendRow
                            key={key}
                            color={color}
                            label={label}
                            visible={fatalityFilter === "all" || fatalityFilter === key}
                            onToggle={() => onFatalityFilterChange(fatalityFilter === key ? "all" : key)}
                        />
                    ))
                ) : (
                    CITY_LEGEND_ITEMS.map(({ key, color, label }) => (
                        <LegendRow
                            key={key}
                            color={color}
                            label={label}
                            visible={vzFilter.has(key)}
                            onToggle={() => onVzFilterChange(key)}
                        />
                    ))
                )}
            </div>
            {selectedCrash && (
                <div className="crash-overlay">
                    <span>FARS Case ID: {selectedCrash.st_case}</span>
                    <button className="crash-overlay-close" onClick={onCrashDeselect}>✕</button>
                    <p>{selectedCrash.city_name}, {selectedCrash.state_name}</p>
                    <p>{selectedCrash.crash_date}</p>
                    <p>Total Fatalities: {selectedCrash.total_fatalities}</p>
                    <p>Motorist: {selectedCrash.motorist_fatalities}</p>
                    <p>Pedestrian: {selectedCrash.pedestrian_fatalities}</p>
                    <p>Cyclist: {selectedCrash.cyclist_fatalities}</p>
                    <p>Other: {selectedCrash.other_fatalities}</p>
                </div>
            )}
        </div>
    )
}