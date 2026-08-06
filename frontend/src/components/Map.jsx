
// import "maplibre-gl/dist/maplibre-gl.css"
// import { useState, useEffect, useRef } from "react"
import { useEffect, useRef } from "react"
// import Map from "react-map-gl/maplibre"
// import DeckGL from "@deck.gl/react"
// import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers"
// import { WebMercatorViewport } from "@deck.gl/core"
// import Supercluster from "supercluster"
// import booleanPointInPolygon from "@turf/boolean-point-in-polygon"

import "../styles/Map.css"
// import EyeIcon from "./EyeIcon"
// import { fetchCityBoundary } from "../api/cities"
// import { FATALITY_COLORS, FATALITY_COLORS_RGB, VZ_COLORS, VZ_COLORS_RGB } from "../constants/colors"
import { VZ_COLORS } from "../constants/colors"

const HERE_API_KEY = import.meta.env.VITE_HERE_API_KEY

// const CONT_US_BOUNDS = {
//     minLon: -126,
//     maxLon: -67,
//     minLat: 24,
//     maxLat: 50,
// }

const CONT_US_CENTER = { lat: 39, lng: -98 } // rough geographic center of continental US
const INITIAL_ZOOM = 4

function circleIcon(color, radiusPx = 8) {
    const size = radiusPx * 2
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${radiusPx}" cy="${radiusPx}" r="${radiusPx - 1}" fill="${color}" stroke="white" stroke-width="1.5" /></svg>`
    return new window.H.map.Icon(svg, {
        size: { w: size, h: size },
        anchor: { x: radiusPx, y: radiusPx },
    })
}

export default function CrashMap({ cities, onCitySelect, vzFilter, ...props }) {
    // All original props are still accepted so the parent component doesn't
    // break -- they're just unused for now while we build the map back up.

    const hereMapDivRef = useRef(null)
    const hereMapRef = useRef(null)
    const cityMarkerGroupRef = useRef(null)
    const iconsRef = useRef(null)

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
        
        // const liteLayer = defaultLayers.vector.normal.lite;
        // hMap.setBaseLayer(liteLayer);
        new window.H.mapevents.Behavior(new window.H.mapevents.MapEvents(hMap))

        // createDefault() gives native zoom buttons + required copyright control.
        // If you want copyright WITHOUT the default zoom UI later, this is the
        // line to swap out for a manually-constructed H.ui.UI with just the
        // copyright control added.
        window.H.ui.UI.createDefault(hMap, defaultLayers)

        hereMapRef.current = hMap

        iconsRef.current = {
            vz: circleIcon(VZ_COLORS.vz),
            nonVz: circleIcon(VZ_COLORS.nonVZ),
        }

        const group = new window.H.map.Group()
        hMap.addObject(group)
        cityMarkerGroupRef.current = group

        group.addEventListener('tap', (evt) => {
            const marker = evt.target
            const cityProps = marker.getData()
            if (cityProps && onCitySelect) onCitySelect(cityProps)
        })

        const handleResize = () => hMap.getViewPort().resize()
        window.addEventListener("resize", handleResize)

        // quick sanity log -- confirm this fires on pan/zoom/native-zoom-button clicks
        hMap.addEventListener("mapviewchange", () => {
            // do nothing (previously console.logged)
        })

        return () => {
            window.removeEventListener("resize", handleResize)
            hMap.dispose()
        }
    }, [])

    useEffect(() => {
        const group = cityMarkerGroupRef.current
        const icons = iconsRef.current
    
        if (!group || !icons || !cities.length) return

        group.removeAll()

        const visibleCities = cities.filter(city =>
            (city.is_vision_zero || city.population >= 100000) &&
            (city.is_vision_zero ? vzFilter.has("vz") : vzFilter.has("non-vz"))
        )

        const markers = visibleCities.map(city => {
            const marker = new window.H.map.Marker(
                { lat: city.lat, lng: city.lon },
                { icon: city.is_vision_zero ? icons.vz : icons.nonVz }
            )
            marker.setData(city)
            return marker
        })

        group.addObjects(markers)
    }, [cities, vzFilter])

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <div ref={hereMapDivRef} style={{ position: "absolute", inset: 0 }} />
        </div>
    )
}

// const CITY_LEGEND_ITEMS = [
//     { key: "vz", color: VZ_COLORS.vz, label: "Vision Zero city" },
//     { key: "non-vz", color: VZ_COLORS.nonVZ, label: "Non-Vision Zero city" },
// ]

// const CRASH_LEGEND_ITEMS = [
//     { key: "motorist", color: FATALITY_COLORS.motorist, label: "Motorist & other fatality" },
//     { key: "pedestrian", color: FATALITY_COLORS.pedestrian, label: "Pedestrian fatality" },
//     { key: "cyclist", color: FATALITY_COLORS.cyclist, label: "Cyclist fatality" },
// ]

// const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron"

// const supercluster = new Supercluster({
//     radius: 40,
//     maxZoom: 14,
// })

// const CLUSTER_NAME_OVERRIDES = {
//     "San Jose": "Bay Area",
// }

// function getExtentFromGeometry(geometry) {
//     const coords = []
//     const collect = (geom) => {
//         if (geom.type === "Polygon") {
//             geom.coordinates[0].forEach(c => coords.push(c))
//         } else if (geom.type === "MultiPolygon") {
//             geom.coordinates.forEach(poly => poly[0].forEach(c => coords.push(c)))
//         }
//     }
//     collect(geometry)
//     const lons = coords.map(c => c[0])
//     const lats = coords.map(c => c[1])
//     return {
//         min_lon: Math.min(...lons),
//         max_lon: Math.max(...lons),
//         min_lat: Math.min(...lats),
//         max_lat: Math.max(...lats),
//     }
// }

// function getClusterExpansionViewState(clusterId, currentViewState) {
//     const leaves = supercluster.getLeaves(clusterId, Infinity)
//     const lons = leaves.map(l => l.geometry.coordinates[0])
//     const lats = leaves.map(l => l.geometry.coordinates[1])
//     const viewport = new WebMercatorViewport({
//         width: window.innerWidth * 0.6,
//         height: window.innerHeight
//     })
//     const { longitude, latitude, zoom } = viewport.fitBounds(
//         [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
//         { padding: 120 }
//     )
//     return { ...currentViewState, longitude, latitude, zoom } 
// }

// function getInitialViewState(width, height) {
//     const lonRange = CONT_US_BOUNDS.maxLon - CONT_US_BOUNDS.minLon
//     const latRange = CONT_US_BOUNDS.maxLat - CONT_US_BOUNDS.minLat
//     const zoomX = Math.log2(width / 256 * 360 / lonRange)
//     const zoomY = Math.log2(height / 256 * 180 / latRange)
//     const zoom = Math.min(zoomX, zoomY) - 1
//     return {
//         longitude: (CONT_US_BOUNDS.minLon + CONT_US_BOUNDS.maxLon) / 2,
//         latitude: (CONT_US_BOUNDS.minLat + CONT_US_BOUNDS.maxLat) / 2,
//         zoom,
//         pitch: 0,
//         bearing: 0,
//     }
// }
// function LegendRow({ color, label, visible, onToggle }) {
//     return (
//         <div
//             className="map-legend-row"
//             style={{ cursor: "pointer", opacity: visible ? 1 : 0.4 }}
//             onClick={onToggle}
//         >
//             <EyeIcon open={visible} />
//             <div className="map-legend-dot" style={{ backgroundColor: color }} />
//             <span>{label}</span>
//         </div>
//     )
// }

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