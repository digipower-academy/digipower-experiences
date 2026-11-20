SELECT
  accountName,
  datetime AS actionDate,
  'Post Viewed' AS actionType
FROM
  InstagramPostViewed
UNION
SELECT
  accountName,
  datetime AS actionDate,
  'Video Watched' AS actionType
FROM
  InstagramVideoWatched
UNION
SELECT
  accountName,
  datetime AS actionDate,
  'Ad Viewed' AS actionType
FROM
  InstagramAdViewed
UNION
SELECT
  accountName,
  datetime AS actionDate,
  'Thread Viewed' AS actionType
FROM
  InstagramThreadViewed
UNION
SELECT
  accountName,
  datetime AS actionDate,
  'Story Viewed' AS actionType
FROM
  InstagramStoryViewed;
