import TrendIndicator from "./TrendIndicator"
import "../styles/CityMetricsPanel.css"

function RankBlock({ label, rank, pct, totalCities, isSmallPop }) {
    const betterThan = pct !== null && pct !== undefined
        ? (100 - pct).toFixed(1)
        : null

    return (
        <div className="rank-block">
            <div className="rank-block-label">
                {label}
            </div>
            {rank !== null && rank !== undefined ? (
                <>
                    <div className="rank-block-rank">
                        #{rank} <span className="rank-block-total">of {totalCities ?? "—"}</span>
                    </div>
                    <div className="rank-block-pct">
                        better than {betterThan}% of cities
                    </div>
                </>
            ) : (
                <div className="rank-block-unavailable">Insufficient data to rank</div>
            )}
        </div>
    )
}

function MetricSection({ 
    label, 
    value, 
    rankAll, 
    pctAll, 
    rankVz, 
    pctVz, 
    isVz, 
    isSmallPop, 
    rankedCountAll, 
    rankedCountVz,
    isTrend=false 
}) {
    return (
        <div className="metric-section">
            <div className="metric-section-label">
                {label}
                {isSmallPop && (
                    <span
                        style={{ position: 'relative', top: '0.05em' }}
                        className="rank-stability-flag"
                        title="Smaller population — rankings less stable"
                    >⚠️</span>
                )}
            </div>
            <div className={`metric-section-ranks${!isVz ? " centered" : ""}`}>
                <RankBlock
                    label="Among All Cities"
                    rank={rankAll}
                    pct={pctAll}
                    totalCities={rankedCountAll}
                    isSmallPop={isSmallPop}
                />
                {isVz && (
                    <RankBlock
                        label="Among VZ Cities"
                        rank={rankVz}
                        pct={pctVz}
                        totalCities={rankedCountVz}
                        isSmallPop={isSmallPop}
                    />
                )}
            </div>
        </div>
    )
}

export default function CityMetricsPanel({ 
    city, 
    perCapitaKey, 
    trendKey, 
    rankPerCapitaKey, 
    pctPerCapitaKey, 
    rankPerCapitaKeyVz, 
    pctPerCapitaKeyVz, 
    rankTrendKey, pctTrendKey, 
    rankTrendKeyVz, 
    pctTrendKeyVz, 
    rankedCountAll,
    rankedTrendAll,
    rankedCountVz,
    rankedTrendVz
}) {
    const isVz = city.is_vision_zero
    const isSmallPop = city.population < 100000

    return (
        <>
            <MetricSection
                label="Per 100k Fatality Rate"
                rankAll={city[rankPerCapitaKey]}
                pctAll={city[pctPerCapitaKey]}
                rankVz={city[rankPerCapitaKeyVz]}
                pctVz={city[pctPerCapitaKeyVz]}
                isVz={isVz}
                isSmallPop={isSmallPop}
                rankedCountAll={rankedCountAll}
                rankedCountVz={rankedCountVz}
            />
            <MetricSection
                label="Trend (Pct&nbsp;Change)"
                rankAll={city[rankTrendKey]}
                pctAll={city[pctTrendKey]}
                rankVz={city[rankTrendKeyVz]}
                pctVz={city[pctTrendKeyVz]}
                isVz={isVz}
                isSmallPop={isSmallPop}
                rankedCountAll={rankedTrendAll}
                rankedCountVz={rankedTrendVz}
            />
        </>
    )
}