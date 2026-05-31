import { useState, useEffect } from "react"
import "../styles/AboutModal.css"

const STORAGE_KEY = "vz_hide_about_on_load"

export default function AboutModal() {
    const [open, setOpen] = useState(false)
    const [hideOnLoad, setHideOnLoad] = useState(false)

    useEffect(() => {
        const hidden = localStorage.getItem(STORAGE_KEY) === "true"
        if (!hidden) setOpen(true)
    }, [])

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") handleClose()
        }
        if (open) window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [open, hideOnLoad])

    const handleClose = () => {
        if (hideOnLoad) localStorage.setItem(STORAGE_KEY, "true")
        setOpen(false)
    }

    const handleHideOnLoadChange = (e) => {
        setHideOnLoad(e.target.checked)
    }

    return (
        <>
            <button className="about-trigger" onClick={() => setOpen(true)}>
                About ℹ︎ 
            </button>
            {open && (
                <>
                    <div className="about-overlay" onClick={handleClose} />
                    <div className="about-modal">
                        <button className="about-close" onClick={handleClose}>✕</button>

                        <h2 className="about-title">Vision Zero Dashboard</h2>

                        <p className="about-lead">
                            Roughly 40,000 people are killed in motor vehicle crashes in the United States each year, making them the second leading cause of accidental death <a href="https://www.cdc.gov/nchs/products/databriefs/db526.htm" target="_blank" rel="noreferrer">(CDC, 2023)</a>.
                        </p>

                        <p>
                            <a href="https://visionzeronetwork.org/" target="_blank" rel="noreferrer">Vision Zero</a> is a road safety framework built on the principle that traffic deaths are preventable, not inevitable. Cities that adopt Vision Zero make a formal commitment to eliminating fatalities through infrastructure improvements, policy changes, and data-driven analysis.
                        </p>

                        <p>
                            This dashboard visualizes U.S. traffic fatality data from the <a href="https://www.nhtsa.gov/research-data/fatality-analysis-reporting-system-fars" target="_blank" rel="noreferrer">Fatality Analysis Reporting System (FARS)</a>, a nationwide census of fatal motor vehicle crashes maintained by the <a href="https://www.nhtsa.gov/" target="_blank" rel="noreferrer">National Highway Traffic Safety Administration (NHTSA)</a>. It covers all Vision Zero cities and non-Vision Zero cities with a population greater than 100,000.
                        </p>

                        <h3 className="about-section-title">Data Notes:</h3>
                            <p>FARS began recording spatial data in 2001</p>
                            <p>Per-capita rates use 2023 <a href="https://www.census.gov/programs-surveys/acs" target="_blank" rel="noreferrer">ACS population estimates</a></p>
                            <p>Average fatality rate and per-capita rate use the 5 most recent years of data</p>
                            <p>Data has a ~2 year publication lag</p>

                        <a className="about-github" href="https://github.com/bgoblirsch/vision-zero-dashboard" target="_blank" rel="noreferrer">
                            View source on GitHub
                        </a>

                        <div className="about-footer">
                            <label className="about-hide-label">
                                <input
                                    type="checkbox"
                                    checked={hideOnLoad}
                                    onChange={handleHideOnLoadChange}
                                />
                                Don't show this again
                            </label>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}