-- Coarse places Instagram associates with the user (locations of interest + home city).
SELECT location, COUNT(*) AS n
FROM InstagramLocation
WHERE location != ''
GROUP BY location
ORDER BY n DESC;
