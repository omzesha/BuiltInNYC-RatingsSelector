# Ratings Adjuster

Ratings Adjuster is a Chrome extension that helps viewers filter videos based on the rating and content categories they choose.

It turns broad content ratings into timestamp-level controls, so people can keep watching while filtering only the moments they personally want to avoid.

For the MVP demo, the extension works on YouTube using a local timestamp database. When a video reaches an approved timestamp range, Ratings Adjuster can mute or skip that moment and show a small on-screen indicator.

## What It Does

- Lets users choose a rating ceiling: `G`, `PG`, `PG-13`, `R`, or `NC-17`
- Lets users turn content categories on or off
- Supports categories like profanity, nudity, violence, gore, drugs, alcohol, sexual references, religious content, and jump scares
- Mutes or skips matching timestamp ranges
- Shows a small overlay when filtering happens
- Stores user settings in Chrome sync storage
- Lets users save pending timestamp suggestions for editor review

## Project Links

- Landing page: deploy `index.html` on Vercel
- Hackathon submission notes: `SUBMISSION.md`
- Product brief: `docs/PRODUCT_BRIEF.md`
- Architecture: `docs/ARCHITECTURE.md`
- Future backend schema: `supabase/schema.sql`

## Install Locally

1. Open Chrome and go to `chrome://extensions`
2. Turn on Developer mode
3. Click Load unpacked
4. Select this repository folder
5. Open YouTube and click the Ratings Adjuster extension icon

## Demo Video

The current local demo data is set up for:

`https://www.youtube.com/watch?v=0NbemFbr7Jw`

Try the default `G` setting with all categories enabled. The extension will use the sample timestamps in `data/curatedSegments.json`.

## Contributing

This project is early. Useful contributions include:

- Adding more approved timestamp data
- Improving YouTube player detection
- Building a backend for community submissions and editor approval
- Adding tests for rating/category matching
- Improving the popup UI and accessibility

For timestamp data, follow the shape in `data/curatedSegments.json`: include the video URL, start/end time, rating, categories, action, and review status.

For product direction, keep the MVP focused on one promise: viewers should be able to filter specific moments without blocking the entire video.
