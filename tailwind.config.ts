import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.7)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "draw-circle": {
          "0%": { strokeDashoffset: "264" },
          "100%": { strokeDashoffset: "0" },
        },
        "loading-bar": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.7", transform: "scale(1.05)" },
        },
        "plane-fly": {
          "0%": { transform: "translate(0,0) rotate(0deg) scale(0.4)", opacity: "0" },
          "8%": { opacity: "1" },
          "20%": { transform: "translate(-30vw, -20vh) rotate(-25deg) scale(0.55)" },
          "38%": { transform: "translate(-45vw, 10vh) rotate(-90deg) scale(0.65)" },
          "55%": { transform: "translate(-10vw, 25vh) rotate(-160deg) scale(0.8)" },
          "72%": { transform: "translate(25vw, 5vh) rotate(-220deg) scale(1)" },
          "85%": { transform: "translate(10vw, -5vh) rotate(-260deg) scale(1.6)", opacity: "1" },
          "95%": { transform: "translate(0, 0) rotate(-280deg) scale(4)", opacity: "0.9" },
          "100%": { transform: "translate(0, 0) rotate(-290deg) scale(8)", opacity: "0" },
        },
        "burst-in": {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "60%": { opacity: "1", transform: "scale(1.05)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "ring-expand": {
          "0%": { transform: "scale(0)", opacity: "0.6" },
          "100%": { transform: "scale(3)", opacity: "0" },
        },
        "confetti-fall": {
          "0%": { transform: "translateY(-20vh) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(110vh) rotate(720deg)", opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.6s ease-out",
        "scale-in": "scale-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "spin-slow": "spin-slow 8s linear infinite",
        "draw-circle": "draw-circle 1.8s ease-out forwards",
        "loading-bar": "loading-bar 1.5s ease-in-out infinite",
        "pulse-slow": "pulse-slow 4s ease-in-out infinite",
        "plane-fly": "plane-fly 2.4s cubic-bezier(0.45, 0, 0.55, 1) forwards",
        "burst-in": "burst-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "ring-expand": "ring-expand 1.4s ease-out forwards",
        "confetti-fall": "confetti-fall 3s ease-in forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
