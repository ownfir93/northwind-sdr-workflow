"use client";
import { createTheme } from "@mui/material/styles";

// Compact, neutral product theme. Nothing flashy — the data is the story.
const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#4f46e5" }, // indigo-600
    background: { default: "#f7f8fa" },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: `var(--font-geist-sans), system-ui, -apple-system, Segoe UI, Roboto, sans-serif`,
  },
});

export default theme;
