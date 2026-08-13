
import { useEffect, useRef, useState } from "react"
import booleanPointInPolygon from "@turf/boolean-point-in-polygon"

import "../styles/Map.css"
import EyeIcon from "./EyeIcon"
import { fetchCityBoundary } from "../api/cities"
import { FATALITY_COLORS, VZ_COLORS } from "../constants/colors"

const HERE_API_KEY = import.meta.env.VITE_HERE_API_KEY

const CONT_US_CENTER = { lat: 39, lng: -98 }
const INITIAL_ZOOM = 4

const CITY_LEGEND_ITEMS = [
    { key: "vz", color: VZ_COLORS.vz, label: "Vision Zero city" },
    { key: "non-vz", color: VZ_COLORS.nonVZ, label: "Non-Vision Zero city" },
]

const CRASH_LEGEND_ITEMS = [
    { key: "motorist", color: FATALITY_COLORS.motorist, label: "Motorist & other fatality" },
    { key: "pedestrian", color: FATALITY_COLORS.pedestrian, label: "Pedestrian fatality" },
    { key: "cyclist", color: FATALITY_COLORS.cyclist, label: "Cyclist fatality" },
]

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

function circleIcon(color, radiusPx = 10) {
    const size = radiusPx * 2
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${radiusPx}" cy="${radiusPx}" r="${radiusPx - 1}" fill="${color}" stroke="white" stroke-width="1.5" /></svg>`
    return new window.H.map.Icon(svg, {
        size: { w: size, h: size },
        anchor: { x: radiusPx, y: radiusPx },
    })
}

const CLUSTER_COLOR = "#2f6fdb" 

function clusterIcon(count, radiusPx = 14) {
    const size = radiusPx * 2
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${radiusPx}" cy="${radiusPx}" r="${radiusPx - 1}" fill="${CLUSTER_COLOR}" stroke="white" stroke-width="2" /><text x="${radiusPx}" y="${radiusPx}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="11" font-family="sans-serif">${count}</text></svg>`
    return new window.H.map.Icon(svg, {
        size: { w: size, h: size },
        anchor: { x: radiusPx, y: radiusPx },
    })
}

export default function CrashMap({ 
    cities, 
    selectedCity, 
    onCitySelect, 
    onClearCity,
    vzFilter, 
    fatalityFilter, 
    onFatalityFilterChange, 
    onVzFilterChange, 
    crashPoints,
    onCrashSelect,
    selectedCrash,
    onCrashDeselect,
    loadedYears,
    loadYear,
    pointsLoading,
    maxYear,
    ...props 
}) {
    const hereMapDivRef = useRef(null)
    const hereMapRef = useRef(null)
    const iconsRef = useRef(null)
    const uiRef = useRef(null)
    const tooltipRef = useRef(null)
    const [cityBoundary, setCityBoundary] = useState(null)
    const boundaryRef = useRef(null)
    const crashPointsGroupRef = useRef(null)
    const crashIconsRef = useRef(null)
    
    if (!crashIconsRef.current) {
        crashIconsRef.current = {
            motorist: circleIcon(FATALITY_COLORS.motorist, 7),
            pedestrian: circleIcon(FATALITY_COLORS.pedestrian, 7),
            cyclist: circleIcon(FATALITY_COLORS.cyclist, 7),
        }
    }

    const remainingYears = maxYear
        ? Array.from(
            { length: maxYear - 2001 - 4 },
            (_, i) => maxYear - 5 - i
          ).filter(y => y >= 2001 && !loadedYears.includes(y))
        : []

    const allYearsLoaded = remainingYears.length === 0

    const handleLoadFullHistory = async () => {
        for (const year of remainingYears) {
            await loadYear(year)
        }
    }

    // initialize HERE map
    useEffect(() => {
        if (!HERE_API_KEY) {
            console.error("Missing HERE_API_KEY -- HERE map cannot initialize.")
            return
        }
        if (!window.H) {
            console.error("HERE Maps API scripts not loaded -- check index.html script tags.")
            return
        }

        const platform = new window.H.service.Platform({ apikey: HERE_API_KEY })
        const defaultLayers = platform.createDefaultLayers()

        const style = new H.map.render.harp.Style('/MapStyle.json');
        const vectorLayerDark = platform.getOMVService().createLayer(style);

        const hMap = new window.H.Map(
            hereMapDivRef.current,
            vectorLayerDark,
            {
                center: CONT_US_CENTER,
                zoom: INITIAL_ZOOM,
                pixelRatio: window.devicePixelRatio || 1,
            }
        )

        // add native zoom controls and attribution
        uiRef.current = window.H.ui.UI.createDefault(hMap, defaultLayers)
        
        // add map interaction behavior (zoom, pan, etc.)
        new window.H.mapevents.Behavior(new window.H.mapevents.MapEvents(hMap))

        hereMapRef.current = hMap

        iconsRef.current = {
            vz: circleIcon(VZ_COLORS.vz),
            nonVz: circleIcon(VZ_COLORS.nonVZ),
        }

        const handleResize = () => hMap.getViewPort().resize()
        window.addEventListener("resize", handleResize)

        const resizeObserver = new ResizeObserver(() => {
            hMap.getViewPort().resize()
        })
        resizeObserver.observe(hereMapDivRef.current)

        return () => {
            window.removeEventListener("resize", handleResize)
            resizeObserver.disconnect()
            hMap.dispose()
        }
    }, [])

    // handle adding/removing city markers and clusters
    useEffect(() => {
        const hMap = hereMapRef.current 
        const icons = iconsRef.current

        if (!hMap || !icons || !cities.length) return

        const visibleCities = cities.filter(city =>
            (city.is_vision_zero || city.population >= 100000) &&
            (city.is_vision_zero ? vzFilter.has("vz") : vzFilter.has("non-vz")) &&
            !(city.state_fips === selectedCity?.state_fips && city.place_fips === selectedCity?.place_fips)
        )

        const dataPoints = visibleCities.map(city =>
            new window.H.clustering.DataPoint(city.lat, city.lon, undefined, city)
        )

        const clusterTheme = {
            getClusterPresentation: (cluster) => {
                const weight = cluster.getWeight()
                const clusterMarker = new window.H.map.Marker(cluster.getPosition(), {
                    icon: clusterIcon(weight),
                    min: cluster.getMinZoom(),
                    max: cluster.getMaxZoom(),
                })
                clusterMarker.setData(cluster)
                return clusterMarker
            },

            getNoisePresentation: (noisePoint) => {
                const city = noisePoint.getData()
                const noiseMarker = new window.H.map.Marker(noisePoint.getPosition(), {
                    icon: city?.is_vision_zero ? icons.vz : icons.nonVz,
                    min: noisePoint.getMinZoom(),
                })
                noiseMarker.setData(city)
                noiseMarker.__isCityMarker = true

                // Attach hover listeners directly to the individual marker
                noiseMarker.addEventListener('pointerenter', (evt) => {
                    hMap.getViewPort().element.style.cursor = "pointer"
                    const targetCity = evt.target.getData ? evt.target.getData() : city
                    const tip = tooltipRef.current
                    if (!targetCity?.display_name || !tip) return

                    tip.textContent = targetCity.display_name
                    tip.style.left = `${evt.currentPointer.viewportX}px`
                    tip.style.top = `${evt.currentPointer.viewportY}px`
                    tip.style.display = "block"
                })

                noiseMarker.addEventListener('pointerleave', () => {
                    hMap.getViewPort().element.style.cursor = "grab"
                    if (tooltipRef.current) tooltipRef.current.style.display = "none"
                })

                return noiseMarker
            },
        }

        const clusteredDataProvider = new window.H.clustering.Provider(dataPoints, { theme: clusterTheme })
        const clusterLayer = new window.H.map.layer.ObjectLayer(clusteredDataProvider)
        hMap.addLayer(clusterLayer)

        clusteredDataProvider.addEventListener('tap', (evt) => {
            const marker = evt.target
            const point = marker.getData()

            if (point && onCitySelect) {
                onCitySelect(point)
            }
        })
                
        return () => {
            hMap.removeLayer(clusterLayer)
        }
    }, [cities, vzFilter, selectedCity])

    // handle adding/removing the selected city boundary layer
    useEffect(() => {
        const hMap = hereMapRef.current
        if (!hMap) return

        if (boundaryRef.current) {
            hMap.removeLayer(boundaryRef.current)
            boundaryRef.current = null
        }

        if (!selectedCity) {
            setCityBoundary(null)
            return
        }

        const { state_fips, place_fips } = selectedCity

        fetchCityBoundary(state_fips, place_fips).then(boundaryJson => {
            const reader = new window.H.data.geojson.Reader(null, {
                style: (mapObject) => {
                    if (mapObject instanceof window.H.map.Polygon) {
                        mapObject.setStyle({
                            fillColor: "rgba(138, 190, 246, 0.12)",
                            strokeColor: "#6eaef2",
                            lineWidth: 2,
                        })
                    }
                },
            })
        
            setCityBoundary(boundaryJson)
            const layer = reader.getLayer()
            hMap.addLayer(layer)
            boundaryRef.current = layer

            // zoom to the city boundary when the reader is ready
            reader.addEventListener("statechange", () => {
                if (reader.getState() !== window.H.data.AbstractReader.State.READY) return

                const parsedObjects = reader.getParsedObjects()
                if (!parsedObjects.length) return

                const bounds = parsedObjects
                    .map(obj => obj.getBoundingBox())
                    .reduce((acc, rect) => (acc ? acc.mergeRect(rect) : rect), null)

                if (bounds) {
                    hMap.getViewModel().setLookAtData({ bounds }, 2.5)
                }
            })

            reader.parseData(boundaryJson)
        })
    }, [selectedCity])

    // handle clicks on the map background to clear the selected city if the click is outside the city boundary
    useEffect(() => {
        const hMap = hereMapRef.current
        if (!hMap || !selectedCity) return

        const handleBackgroundTap = (evt) => {
            if (evt.target?.__isCityMarker) return 

            const coordinate = hMap.screenToGeo(
                evt.currentPointer.viewportX,
                evt.currentPointer.viewportY
            )

            if (!coordinate || !cityBoundary) {
                onClearCity()
                return
            }

            const point = { type: "Feature", geometry: { type: "Point", coordinates: [coordinate.lng, coordinate.lat] } }
            const polygon = { type: "Feature", geometry: cityBoundary.geometry }

            if (!booleanPointInPolygon(point, polygon)) {
                onClearCity()
            }
        }

        hMap.addEventListener("tap", handleBackgroundTap)
        return () => hMap.removeEventListener("tap", handleBackgroundTap)
    }, [selectedCity, cityBoundary, onClearCity])

    // Handle adding/removing crash points layer
    //    Rebuilds the full marker set on every crashPoints/fatalityFilter change rather than
    //    diffing and incrementally adding/toggling. Confirmed acceptable at current scale
    //    (Houston, ~6.5k points, full history: no perceptible lag).
    //    Acceptable for this exploratory demo, but needs improvement if ever revisited !!!
    useEffect(() => {
        const hMap = hereMapRef.current
        if (!hMap) return

        if (crashPointsGroupRef.current) {
            hMap.removeObject(crashPointsGroupRef.current)
            crashPointsGroupRef.current = null
        }

        if (!selectedCity || !crashPoints?.length) return

        if (!crashIconsRef.current) {
            crashIconsRef.current = {
                motorist: circleIcon(FATALITY_COLORS.motorist, 7),
                pedestrian: circleIcon(FATALITY_COLORS.pedestrian, 7),
                cyclist: circleIcon(FATALITY_COLORS.cyclist, 7),
            }
        }

        const filteredCrashPoints = fatalityFilter === "all"
            ? crashPoints
            : crashPoints.filter(d => d[`${fatalityFilter}_fatalities`] > 0)

        const getFatalityType = (d) => {
            if (fatalityFilter === "pedestrian") return "pedestrian"
            if (fatalityFilter === "cyclist")    return "cyclist"
            if (fatalityFilter === "motorist")   return "motorist"
            if (d.pedestrian_fatalities > 0)     return "pedestrian"
            if (d.cyclist_fatalities > 0)        return "cyclist"
            return "motorist"
        }

        const crashPointGroup = new window.H.map.Group()

        filteredCrashPoints.forEach(d => {
            const marker = new window.H.map.Marker(
                { lat: d.lat, lng: d.lon },
                { icon: crashIconsRef.current[getFatalityType(d)] }
            )
            marker.setData(d)
            marker.__isCityMarker = true
            marker.addEventListener('pointerenter', (evt) => {
                hMap.getViewPort().element.style.cursor = "pointer"
            })
            marker.addEventListener('pointerleave', () => {
                hMap.getViewPort().element.style.cursor = "grab"
            })
            crashPointGroup.addObject(marker)
        })

        crashPointGroup.addEventListener("tap", (evt) => {
            const crash = evt.target.getData ? evt.target.getData() : null
            if (!crash || !onCrashSelect) return
            onCrashSelect({
                lon: crash.lon,
                lat: crash.lat,
                st_case: crash.st_case,
                year: crash.year,
                crash_date: crash.crash_date,
                state_name: crash.state_name,
                city_name: crash.fips_city_name,
                road_label: crash.road_label,
                total_fatalities: crash.total_fatalities,
                motorist_fatalities: crash.motorist_fatalities,
                pedestrian_fatalities: crash.pedestrian_fatalities,
                cyclist_fatalities: crash.cyclist_fatalities,
                other_fatalities: crash.other_fatalities,
            })
        })

        hMap.addObject(crashPointGroup)
        crashPointsGroupRef.current = crashPointGroup
    }, [selectedCity, crashPoints, fatalityFilter])

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <div ref={hereMapDivRef} style={{ position: "absolute", inset: 0 }} />
            <div
                ref={tooltipRef}
                style={{
                    position: "absolute",
                    display: "none",
                    pointerEvents: "none",
                    transform: "translate(-50%, -130%)",
                    background: "rgba(0,0,0,0.85)",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontFamily: "'DM Mono', monospace",
                    whiteSpace: "nowrap",
                    zIndex: 10,
                }}
            />
            <div className="map-legend">
                {selectedCity && (
                    <>
                        <div className="map-history-control">
                            <span className="map-years-indicator">
                                {allYearsLoaded ? `2001–${maxYear}` : `${Math.min(...loadedYears)}–${maxYear}`}
                            </span>
                            <button
                                className="map-history-btn"
                                onClick={handleLoadFullHistory}
                                disabled={allYearsLoaded || pointsLoading}
                            >
                                {pointsLoading ? "Loading..." : allYearsLoaded ? "Full history loaded" : "Load full history"}
                            </button>
                        </div>
                        <div className="map-legend-divider" />
                    </>
                )}
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