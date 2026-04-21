/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#F7F4EF",
          card: "#FFFFFF",
          surface: "#EDEAE4",
        },
        ink: {
          primary: "#2D2D2D",
          muted: "#7A7A7A",
        },
        rose: {
          accent: "#C4899A",
          soft: "#E8C5CF",
        },
      },
      fontFamily: {
        cormorant: ["CormorantGaramond_400Regular"],
        "cormorant-bold": ["CormorantGaramond_700Bold"],
        "cormorant-italic": ["CormorantGaramond_400Regular_Italic"],
      },
    },
  },
  plugins: [],
};
