-- Return FARS city names with no matching acs place name
SELECT DISTINCT city_name, state_name
FROM (
    SELECT city_name, state_name
    FROM fars_crashes
    WHERE city_name IS NOT NULL
      AND city != 0
    GROUP BY city_name, state_name
    HAVING COUNT(*) >= 50
) f
WHERE NOT EXISTS (
    SELECT 1 FROM city_populations cp
    WHERE UPPER(cp.place_name) = f.city_name
    AND cp.state_name = f.state_name
)
ORDER BY state_name, city_name;