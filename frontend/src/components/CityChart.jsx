import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    Tooltip, 
    ResponsiveContainer, 
    CartesianGrid 
} from "recharts"

import { FATALITY_COLORS } from "../constants/colors"


const LINES = [
    { key: "total_fatalities",       label: "Total",      color: FATALITY_COLORS.total },
    { key: "motorist_fatalities",    label: "Motorist & Other",   color: FATALITY_COLORS.motorist },
    { key: "pedestrian_fatalities",  label: "Pedestrian", color: FATALITY_COLORS.pedestrian },
    { key: "cyclist_fatalities",     label: "Cyclist",    color: FATALITY_COLORS.cyclist },
]

export default function CityChart({ yearData, fatalityFilter }) {
    const visibleLines = fatalityFilter === "all"
        ? LINES
        : LINES.filter(l => l.key === `${fatalityFilter}_fatalities`)

    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={yearData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
                <XAxis
                    dataKey="year"
                    tick={{ fill: "#9fa7b1", fontSize: 11, fontFamily: "DM Mono, monospace" }}
                    tickLine={false}
                    axisLine={{ stroke: "#1e2535" }}
                />
                <YAxis
                    tick={{ fill: "#9fa7b1", fontSize: 11, fontFamily: "DM Mono, monospace" }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    allowDecimals={false}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: "#1a1f2e",
                        border: "1px solid #2a3144",
                        borderRadius: "4px",
                        fontFamily: "DM Mono, monospace",
                        fontSize: "12px",
                        color: "#e2e8f0",
                    }}
                    labelStyle={{ color: "#9fa7b1", marginBottom: "4px" }}
                    itemSorter={(item) => item.dataKey === "total_fatalities" ? -1 : 0}
                />
                {visibleLines.map(l => (
                    <Line
                        key={l.key}
                        type="monotone"
                        dataKey={l.key}
                        name={l.label}
                        stroke={l.color}
                        strokeWidth={l.key === "total_fatalities" ? 2 : 1.5}
                        dot={false}
                        activeDot={{ r: 4 }}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    )
}