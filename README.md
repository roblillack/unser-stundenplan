# Unser Stundenplan

A family timetable viewer that displays school schedules from the "Beste Schule" app. Perfect for mounting on a kitchen iPad to show your children's daily schedules at a glance.

**Try it now:** [https://unser-stundenplan.vercel.app](https://unser-stundenplan.vercel.app)

## What is this?

This is a web application that fetches and displays timetables from the "Beste Schule" school management system. It automatically shows the next school day's schedule, handles holidays and weekends, and refreshes periodically to catch any last-minute changes.

**Target audience:** German-speaking families with school-age children whose schools use the "Beste Schule" platform.

## A note on language

You may notice that the codebase, commit messages, and pull requests are often in English, while the user interface is strictly in German. This reflects the reality that the tool is built for German students and families, but developed using international coding conventions. We embrace this duality!

## Setup & Usage

### Getting your API Token

1. Sign in to the Beste Schule website (note: use the **website**, not the mobile app)
2. Navigate to [https://beste.schule/me/passport](https://beste.schule/me/passport)
3. Create a new "Personal Access Token"
4. Open this web app and enter the token when prompted
5. The token is stored locally in your browser

### Recommended Setup

For the best experience:
- Use an old iPad mounted in your kitchen
- Open the app in Safari and add it to the home screen (for fullscreen mode)
- Enable "Guided Access" to prevent accidental exits
- The display will auto-refresh and show upcoming schedules automatically

## Features

- 📅 Automatically finds the next school day (skips weekends and holidays)
- 🔄 Auto-refresh every 5 minutes to catch schedule changes
- 🎉 Holiday detection with countdown to next school day
- 👨‍👩‍👧‍👦 Multi-child support (displays multiple class schedules side-by-side)
- 📝 Shows daily notes and announcements
- ❌ Highlights cancelled lessons
- 📱 iOS Safari optimized (fullscreen web app mode)

## Tech Stack

- **TypeScript** - Programming language
- **Vite** - Build tool and dev server
- **React 18** - UI framework
- **Biome** - Linting and formatting
- **Vite Legacy Plugin** - Safari 15+ compatibility

## Development

### Prerequisites

- Node.js or potentially another JavaScript runtime, like Deno or Bun
- npm or yarn

### Install Dependencies

```bash
npm install
```

### Development Server

```bash
npm run dev
```

This starts the Vite development server with hot module replacement. The server will be accessible on your local network (uses `--host` flag).

### Code Quality

We use **Biome** for both linting and formatting:

```bash
# Check for issues
npm run lint

# Format code
npm run format
```

### Build for Production

```bash
npm run build
```

This compiles TypeScript and builds the production bundle with Vite.

## Deployment

This is a **frontend-only application** with no server-side components. All API calls are made directly from the browser to the Beste Schule API.

Deployment is **completely automated** using Vercel:

1. Push your changes to the `main` branch
2. Vercel automatically detects the Vite configuration
3. The app is built and deployed

No Vercel configuration file needed! The platform auto-detects the build process from `package.json` and recognizes the standard Vite setup. Since this is a static frontend app, you can also host it on any static hosting service (GitHub Pages, Netlify, etc.).

## License

This is a personal project. Use at your own risk.
