
import { useEffect, useRef, useState } from "react"
import booleanPointInPolygon from "@turf/boolean-point-in-polygon"

import "../styles/Map.css"
import EyeIcon from "./EyeIcon"
import { fetchCityBoundary } from "../api/cities"
import { FATALITY_COLORS, FATALITY_COLORS_RGB, VZ_COLORS, VZ_COLORS_RGB } from "../constants/colors"

const HERE_API_KEY = import.meta.env.VITE_HERE_API_KEY

const CONT_US_CENTER = { lat: 39, lng: -98 } // rough geographic center of continental US
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

function getExtentFromGeometry(geometry) {
    const coords = []
    const collect = (geom) => {
        if (geom.type === "Polygon") {
            geom.coordinates[0].forEach(c => coords.push(c))
        } else if (geom.type === "MultiPolygon") {
            geom.coordinates.forEach(poly => poly[0].forEach(c => coords.push(c)))
        }
    }
    collect(geometry)
    const lons = coords.map(c => c[0])
    const lats = coords.map(c => c[1])
    return {
        min_lon: Math.min(...lons),
        max_lon: Math.max(...lons),
        min_lat: Math.min(...lats),
        max_lat: Math.max(...lats),
    }
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

        uiRef.current = window.H.ui.UI.createDefault(hMap, defaultLayers)
        
        // add map interaction behavior (zoom, pan, etc.)
        new window.H.mapevents.Behavior(new window.H.mapevents.MapEvents(hMap))

        // add native zoom controls and attribution
        window.H.ui.UI.createDefault(hMap, defaultLayers)

        hereMapRef.current = hMap

        iconsRef.current = {
            vz: circleIcon(VZ_COLORS.vz),
            nonVz: circleIcon(VZ_COLORS.nonVZ),
        }

        const handleResize = () => hMap.getViewPort().resize()
        window.addEventListener("resize", handleResize)

        return () => {
            window.removeEventListener("resize", handleResize)
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
                noiseMarker.title = city?.display_name
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

    useEffect(() => {
        const hMap = hereMapRef.current
        if (!hMap) return

        if (crashPointsGroupRef.current) {
            hMap.removeObject(crashPointsGroupRef.current) // Group extends H.map.Object, so removeObject is correct here (unlike the boundary layer)
            crashPointsGroupRef.current = null
        }

        if (!selectedCity || !crashPoints?.length) return

        const filteredCrashPoints = fatalityFilter === "all"
            ? crashPoints
            : crashPoints.filter(d => d[`${fatalityFilter}_fatalities`] > 0)

        const getColor = (d) => {
            if (fatalityFilter === "pedestrian") return FATALITY_COLORS.pedestrian
            if (fatalityFilter === "cyclist")    return FATALITY_COLORS.cyclist
            if (fatalityFilter === "motorist")   return FATALITY_COLORS.motorist
            if (d.pedestrian_fatalities > 0)     return FATALITY_COLORS.pedestrian
            if (d.cyclist_fatalities > 0)        return FATALITY_COLORS.cyclist
            return FATALITY_COLORS.motorist
        }

        const crashPointGroup = new window.H.map.Group()

        filteredCrashPoints.forEach(d => {
            const marker = new window.H.map.Marker(
                { lat: d.lat, lng: d.lon },
                { icon: circleIcon(getColor(d), 7) }
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

// export default function CrashMap({ 
//     crashPoints, 
//     cities, 
//     onCrashSelect, 
//     selectedCrash,
//     onCitySelect, 
//     selectedCity, 
//     onClearCity,
//     vzFilter,
//     onVzFilterChange,
//     fatalityFilter,
//     onFatalityFilterChange,
//     onCrashDeselect,
//     loadedYears,
//     loadYear,
//     pointsLoading,
//     maxYear,
// }) {
//     const [viewState, setViewState] = useState(() => {
//         return getInitialViewState(window.innerWidth * 0.6, window.innerHeight)
//     })
//     const [cityBoundary, setCityBoundary] = useState(null)
//     const [clusters, setClusters] = useState([])

//     const mapContainerRef = useRef(null)

//     useEffect(() => {
//         if (!cities.length) return
//         const points = cities.map(city => ({
//             type: "Feature",
//             geometry: { type: "Point", coordinates: [city.lon, city.lat] },
//             properties: { ...city }
//         }))
//         supercluster.load(points)
//     }, [cities])

//     useEffect(() => {
//         if (selectedCity) {
//             setClusters([])
//             return
//         }

//         const visibleCities = cities.filter(city =>
//             (city.is_vision_zero || city.population >= 100000) &&
//             (city.is_vision_zero ? vzFilter.has("vz") : vzFilter.has("non-vz"))
//         )

//         const points = visibleCities.map(city => ({
//             type: "Feature",
//             geometry: { type: "Point", coordinates: [city.lon, city.lat] },
//             properties: { ...city }
//         }))

//         supercluster.load(points)

//         const el = mapContainerRef.current
//         const w = el ? el.clientWidth : window.innerWidth
//         const h = el ? el.clientHeight : window.innerHeight
//         const viewport = new WebMercatorViewport({ ...viewState, width: w, height: h })
//         const bounds = viewport.getBounds()
//         const newClusters = supercluster.getClusters(
//             [bounds[0], bounds[1], bounds[2], bounds[3]],
//             Math.floor(viewState.zoom)
//         )
//         setClusters(newClusters)
//     }, [viewState, selectedCity, cities, vzFilter])

//     useEffect(() => {
//         if (!selectedCity) {
//             setCityBoundary(null)
//             return
//         }

//         const { state_fips, place_fips } = selectedCity

//         fetchCityBoundary(state_fips, place_fips)
//             .then(boundary => {
//                 setCityBoundary(boundary)
//                 const ext = getExtentFromGeometry(boundary.geometry)
//                 const el = mapContainerRef.current
//                 const w = el ? el.clientWidth : window.innerWidth
//                 const h = el ? el.clientHeight : window.innerHeight
//                 const viewport = new WebMercatorViewport({ width: w, height: h })
//                 const { longitude, latitude, zoom } = viewport.fitBounds(
//                     [[ext.min_lon, ext.min_lat], [ext.max_lon, ext.max_lat]],
//                     { padding: { left: 40, right: 40, top: 20, bottom: 20 } }
//                 )
//                 setViewState(v => ({ ...v, longitude, latitude, zoom }))
//             })
//     }, [selectedCity])

//     const remainingYears = maxYear
//         ? Array.from(
//             { length: maxYear - 2001 - 4 },
//             (_, i) => maxYear - 5 - i
//           ).filter(y => y >= 2001 && !loadedYears.includes(y))
//         : []

//     const allYearsLoaded = remainingYears.length === 0

//     const handleLoadFullHistory = async () => {
//         for (const year of remainingYears) {
//             await loadYear(year)
//         }
//     }

//     const filteredCrashPoints = fatalityFilter === "all"
//         ? crashPoints
//         : crashPoints.filter(d => d[`${fatalityFilter}_fatalities`] > 0)

//     const crashPointsLayer = new ScatterplotLayer({
//         id: "crash-points-layer",
//         data: filteredCrashPoints,
//         getPosition: d => [d.lon, d.lat],
//         getRadius: 6,
//         radiusUnits: "pixels",
//         getFillColor: d => {
//             if (fatalityFilter === "pedestrian") return FATALITY_COLORS_RGB.pedestrian
//             if (fatalityFilter === "cyclist")    return FATALITY_COLORS_RGB.cyclist
//             if (fatalityFilter === "motorist")   return FATALITY_COLORS_RGB.motorist
//             if (d.pedestrian_fatalities > 0)     return FATALITY_COLORS_RGB.pedestrian
//             if (d.cyclist_fatalities > 0)        return FATALITY_COLORS_RGB.cyclist
//             return FATALITY_COLORS_RGB.motorist
//         },
//         pickable: true,
//         maskId: "city-mask-layer",
//         onClick: ({ object }) => {
//             if (object) onCrashSelect({
//                 lon: object.lon,
//                 lat: object.lat,
//                 st_case: object.st_case,
//                 year: object.year,
//                 crash_date: object.crash_date,
//                 state_name: object.state_name,
//                 city_name: object.fips_city_name,
//                 road_label: object.road_label,
//                 total_fatalities: object.total_fatalities,
//                 motorist_fatalities: object.motorist_fatalities,
//                 pedestrian_fatalities: object.pedestrian_fatalities,
//                 cyclist_fatalities: object.cyclist_fatalities,
//                 other_fatalities: object.other_fatalities,
//             })
//         },
//     })

//     const clusterLayer = new ScatterplotLayer({
//         id: "city-points-layer",
//         data: clusters,
//         getPosition: d => d.geometry.coordinates,
//         getRadius: d => d.properties.cluster ? 12 : 10,
//         radiusUnits: "pixels",
//         getFillColor: data => {
//             if (data.properties.cluster) {
//                 const leaves = supercluster.getLeaves(data.properties.cluster_id, Infinity)
//                 const hasVZ = leaves.some(l => l.properties.is_vision_zero)
//                 return hasVZ ? VZ_COLORS_RGB.vz : VZ_COLORS_RGB.nonVZ
//             }
//             return data.properties.is_vision_zero ? VZ_COLORS_RGB.vz : VZ_COLORS_RGB.nonVZ
//         },
//         pickable: true,
//         onClick: ({ object }) => {
//             if (!object) return
//             if (object.properties.cluster) {
//                 setViewState(v => getClusterExpansionViewState(object.properties.cluster_id, v))
//             } else {
//                 if (onCitySelect) onCitySelect(object.properties)
//             }
//         },
//     })

//     const cityBoundaryLayer = cityBoundary ? new GeoJsonLayer({
//         id: "city-boundary-layer",
//         data: {
//             type: "Feature",
//             geometry: cityBoundary.geometry,
//             properties: {},
//         },
//         filled: true,
//         stroked: true,
//         getFillColor: [0, 0, 0, 0],
//         getLineColor: [100, 100, 100, 200],
//         getLineWidth: 2,
//         lineWidthUnits: "pixels",
//     }) : null

//     const layers = [
//         cityBoundaryLayer,
//         clusterLayer,
//         crashPointsLayer,
//     ].filter(Boolean)

//     return (
//         <div ref={mapContainerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
//             <DeckGL
//                 viewState={viewState}
//                 onViewStateChange={({ viewState }) => setViewState(viewState)}
//                 controller={true}
//                 layers={layers}
//                 getCursor={({isHovering}) => isHovering ? "pointer" : "grab"}
//                 getTooltip={({ object }) => {
//                     if (!object) return null
//                     if (object.properties?.cluster) {
//                         const leaves = supercluster.getLeaves(object.properties.cluster_id, Infinity)
//                         const largest = leaves.reduce((a, b) => 
//                             a.properties.population > b.properties.population ? a : b
//                         )
//                         const count = leaves.length
//                         const name = largest.properties.display_name || largest.properties.place_name
//                         const label = CLUSTER_NAME_OVERRIDES[name] ?? `${name} Region`
//                         return {
//                             html: `<div>${label}</div>`,
//                             style: {
//                                 backgroundColor: "white",
//                                 padding: "4px 6px",
//                                 borderRadius: "4px",
//                                 fontSize: "12px",
//                                 color: "#333",
//                                 boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
//                             }
//                         }
//                     }
//                     const props = object.properties || object
//                     if (!props.place_name && !props.display_name) return null
//                     return {
//                         html: `<div>${props.display_name || props.place_name}</div>`,
//                         style: {
//                             backgroundColor: "white",
//                             padding: "4px 6px",
//                             borderRadius: "4px",
//                             fontSize: "12px",
//                             color: "#333",
//                             boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
//                         }
//                     }
//                 }}
//                 onClick={({ object, coordinate }) => {
//                     if (!object) {
//                         if (selectedCrash) {
//                             onCrashDeselect()
//                             return
//                         }
//                         if (selectedCity && onClearCity) {
//                             if (!coordinate || !cityBoundary) {
//                                 onClearCity()
//                                 return
//                             }
//                             const point = { type: "Feature", geometry: { type: "Point", coordinates: coordinate } }
//                             const polygon = { type: "Feature", geometry: cityBoundary.geometry }
//                             if (!booleanPointInPolygon(point, polygon)) {
//                                 onClearCity()
//                             }
//                         }
//                     }
//                 }}
//             >
//                 <Map 
//                     mapStyle={MAP_STYLE} 
//                     attributionControl={false}
//                 />
//             </DeckGL>
//             <div className="map-controls">
//                 <button className="map-control-btn" onClick={() => {
//                     setViewState(getInitialViewState(window.innerWidth * 0.6, window.innerHeight))
//                 }}>⌂</button>
//                 <div className="map-controls-zoom">
//                 <button className="map-control-btn" onClick={() => setViewState(v => ({ ...v, zoom: v.zoom + 1 }))}>+</button>
//                 <button className="map-control-btn" onClick={() => setViewState(v => ({ ...v, zoom: v.zoom - 1 }))}>−</button>
//                 </div>
//             </div>
//             <div className="map-attribution">
//                 <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>
//                 {" "}© <a href="https://openmaptiles.org" target="_blank" rel="noreferrer">OpenMapTiles</a>
//                 {" from "}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OSM</a>
//             </div>
//             {selectedCity && (
//                 <div className="map-history-control">
//                     <span className="map-years-indicator">
//                         {allYearsLoaded ? `2001–${maxYear}` : `${Math.min(...loadedYears)}–${maxYear}`}
//                     </span>
//                     <button
//                         className="map-history-btn"
//                         onClick={handleLoadFullHistory}
//                         disabled={allYearsLoaded || pointsLoading}
//                     >
//                         {pointsLoading ? "Loading..." : allYearsLoaded ? "Full history loaded" : "Load full history"}
//                     </button>
//                 </div>
//             )}
//             <div className="map-legend">
//                 <div className="map-legend-title" style={{ position: "relative", textAlign: "center" }}>
//                     {selectedCity && fatalityFilter !== "all" && (
//                         <span
//                             style={{ color: "#7db8f7", position: "absolute", left: -5, fontSize: "9px", letterSpacing: "0.06em", cursor: "pointer" }}
//                             onClick={() => onFatalityFilterChange("all")}
//                         >
//                             RESET
//                         </span>
//                     )}
//                     <span>{selectedCity ? "Crash Type" : "Vision Zero Status"}</span>
//                 </div>
//                 {selectedCity ? (
//                     CRASH_LEGEND_ITEMS.map(({ key, color, label }) => (
//                         <LegendRow
//                             key={key}
//                             color={color}
//                             label={label}
//                             visible={fatalityFilter === "all" || fatalityFilter === key}
//                             onToggle={() => onFatalityFilterChange(fatalityFilter === key ? "all" : key)}
//                         />
//                     ))
//                 ) : (
//                     CITY_LEGEND_ITEMS.map(({ key, color, label }) => (
//                         <LegendRow
//                             key={key}
//                             color={color}
//                             label={label}
//                             visible={vzFilter.has(key)}
//                             onToggle={() => onVzFilterChange(key)}
//                         />
//                     ))
//                 )}
//             </div>
//             {selectedCrash && (
//                 <div className="crash-overlay">
//                     <span>FARS Case ID: {selectedCrash.st_case}</span>
//                     <button className="crash-overlay-close" onClick={onCrashDeselect}>✕</button>
//                     <p>{selectedCrash.city_name}, {selectedCrash.state_name}</p>
//                     <p>{selectedCrash.crash_date}</p>
//                     <p>Total Fatalities: {selectedCrash.total_fatalities}</p>
//                     <p>Motorist: {selectedCrash.motorist_fatalities}</p>
//                     <p>Pedestrian: {selectedCrash.pedestrian_fatalities}</p>
//                     <p>Cyclist: {selectedCrash.cyclist_fatalities}</p>
//                     <p>Other: {selectedCrash.other_fatalities}</p>
//                 </div>
//             )}
//         </div>
//     )
// }