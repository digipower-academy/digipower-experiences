-- Only "other categories used to reach you" remains in the new export
-- (your_topics / reels_* are gone); `theme` groups them for the chart.
SELECT title, theme AS _type FROM InstagramAdInterest;
