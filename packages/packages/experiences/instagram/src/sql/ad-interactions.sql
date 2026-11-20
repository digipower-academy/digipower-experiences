-- ads_clicked is gone from the new export; only "viewed" remains,
-- so the panel shows which advertisers (ad owners) showed you the most ads.
SELECT accountName as title, datetime AS _date FROM InstagramAdViewed;
