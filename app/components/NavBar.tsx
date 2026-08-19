"use client";
import { useState } from "react";
import { AppBar, Toolbar, Typography, Button, Box, IconButton, Menu, MenuItem } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/workflow", label: "Workflow Visualizer" },
  { href: "/try", label: "Try It" },
  { href: "/analytics", label: "Analytics" },
  { href: "/documentation", label: "Documentation" },
];

export default function NavBar() {
  const path = usePathname();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        top: 0,
        zIndex: (t) => t.zIndex.appBar + 1,
        color: "#0f172a",
        bgcolor: "rgba(255,255,255,0.85)",
        backdropFilter: "saturate(180%) blur(10px)",
        borderBottom: "1px solid #e6e8eb",
      }}
    >
      <Toolbar variant="dense" sx={{ gap: 1, minHeight: 52 }}>
        <Box
          component={Link}
          href="/workflow"
          sx={{ display: "flex", alignItems: "center", gap: 1.25, textDecoration: "none", color: "inherit", minWidth: 0 }}
        >
          <Box
            sx={{
              flex: "0 0 auto", width: 28, height: 28, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 900, fontSize: 15, lineHeight: 1,
              background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
              boxShadow: "0 2px 8px rgba(79,70,229,0.35)",
            }}
          >
            H
          </Box>
          <Typography variant="subtitle1" fontWeight={800} noWrap sx={{ letterSpacing: "-0.01em" }}>
            AI Context Layer Demo
            <Box component="span" sx={{ color: "#64748b", fontWeight: 600, display: { xs: "none", sm: "inline" } }}>{"  —  GTM Josh scenario"}</Box>
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        {/* Desktop: inline links */}
        <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1 }}>
          {LINKS.map((l) => {
            const active = path === l.href;
            return (
              <Button
                key={l.href}
                component={Link}
                href={l.href}
                size="small"
                disableElevation
                sx={{
                  textTransform: "none",
                  fontWeight: active ? 800 : 600,
                  color: active ? "#4338ca" : "#475569",
                  bgcolor: active ? "#eef2ff" : "transparent",
                  borderRadius: 2,
                  px: 1.5,
                  whiteSpace: "nowrap",
                  "&:hover": { bgcolor: active ? "#e0e7ff" : "#f1f5f9" },
                }}
              >
                {l.label}
              </Button>
            );
          })}
        </Box>

        {/* Mobile: hamburger menu */}
        <IconButton
          aria-label="menu"
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ display: { xs: "inline-flex", md: "none" }, color: "#475569" }}
        >
          <MenuIcon />
        </IconButton>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} keepMounted>
          {LINKS.map((l) => (
            <MenuItem
              key={l.href}
              component={Link}
              href={l.href}
              selected={path === l.href}
              onClick={() => setAnchor(null)}
              sx={{ fontWeight: path === l.href ? 800 : 500, color: path === l.href ? "#4338ca" : "#0f172a" }}
            >
              {l.label}
            </MenuItem>
          ))}
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
