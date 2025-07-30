# 🚨 ice_tracker

A community-powered web app for reporting and mapping recent ICE (Immigration and Customs Enforcement) activity. Built with Next.js, Firebase, and OpenAI moderation, this project helps keep communities informed and safe.

## Features

- **Submit Reports:** Anonymously report ICE sightings or activity at specific locations.
- **Live Map:** Recent reports are displayed on an interactive map (React Leaflet + OpenStreetMap).
- **Content Moderation:** AI-powered filtering prevents abusive or negative submissions.
- **Multilingual:** Supports multiple languages with instant language switching (next-intl) between English and Spanish.
- **Realtime Updates:** All reports and stats update live via Firebase Realtime Database.
- **Privacy First:** No user accounts or personal data required.

## How It Works

1. **Submit a Location:** Enter an address and (optionally) additional info about ICE activity.
2. **AI Moderation:** Submissions are checked for negative or abusive content.
3. **Geocoding:** Addresses are validated and mapped using Google Maps API.
4. **Live Display:** Approved reports appear instantly on the map and in the list.
5. **Stats:** The app tracks daily and weekly report counts.

## Tech Stack

- **Frontend:**

  - [Next.js](https://nextjs.org/) (React framework)
  - [Tailwind CSS](https://tailwindcss.com/) for styling
  - [next-intl](https://github.com/amannn/next-intl) for internationalization (i18n)

- **Backend:**

  - [Firebase Functions](https://firebase.google.com/docs/functions) (Node.js/TypeScript)
  - [Firebase Realtime Database](https://firebase.google.com/products/realtime-database)
  - [Firestore](https://firebase.google.com/products/firestore)

- **Mapping:**

  - [React Leaflet](https://react-leaflet.js.org/) + [OpenStreetMap](https://www.openstreetmap.org/)

- **Geocoding:**

  - [Google Maps Geocoding API](https://developers.google.com/maps/documentation/geocoding/overview) for address validation and coordinate lookup

- **AI Moderation:**
  - [OpenAI API](https://openai.com/api/) for content filtering

## Deployment

- **Frontend:** Deployed on [Vercel](https://vercel.com/) for seamless Next.js hosting and automatic CI/CD.
- **Backend:** Managed by [Firebase Hosting & Functions](https://firebase.google.com/), including the database and serverless cloud functions.

## Contributing

Pull requests and issues are welcome! Please open an issue to discuss major changes.
