/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#1a1a1a",
        surface: "#242424",
        border: "rgba(255, 255, 255, 0.1)",
        text: {
          primary: "#ffffff",
          secondary: "rgba(255, 255, 255, 0.7)",
          muted: "rgba(255, 255, 255, 0.5)",
        },
        accent: {
          primary: "#3b82f6", // Blue-500
        },
        status: {
          ready: "#22c55e", // Green-500
          loading: "#eab308", // Yellow-500
          offline: "#ef4444", // Red-500
          degraded: "#f97316", // Orange-500
        }
      }
    },
  },
  plugins: [],
}
