/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        navy: {
          DEFAULT: "#0f2c4c",
          50: "#eef3f9",
          100: "#d7e3f0",
          600: "#163e63",
          700: "#122f4c",
          800: "#0f2c4c",
          900: "#0a1f36",
        },
        brand: {
          DEFAULT: "#2fa27a",
          light: "#43c295",
          dark: "#1f8a5c",
        },
      },
      boxShadow: {
        soft: "0 8px 30px rgba(15, 44, 76, 0.08)",
        glow: "0 0 40px rgba(47, 162, 122, 0.25)",
      },
      keyframes: {
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "gradient-shift": "gradient-shift 12s ease infinite",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};
