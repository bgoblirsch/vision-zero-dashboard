export default function TrendIndicator({ slope }) {
    if (slope === null || slope === undefined) {
        return <span className="trend-none">—</span>
    }
    const isImproving = slope <= 0
    const value = Math.abs(slope).toFixed(1)
    return (
        <span className={isImproving ? "trend-improving" : "trend-worsening"}>
            {isImproving ? "▼" : "▲"} {value}%
        </span>
    )
}