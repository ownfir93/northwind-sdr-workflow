"use client";
import { useEffect, useState } from "react";
import {
  Box, Grid, Card, CardContent, Typography, Chip, Button, Alert,
  Table, TableBody, TableCell, TableHead, TableRow, LinearProgress,
  Dialog, DialogTitle, DialogContent, IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

interface Metrics {
  workflow: { totalRuns: number; draftsGen: number; qaPassRate: number; avgGenMs: number; liveResearches: number };
  ingestion: { contactsIngested: number; dupsCaught: number; createdNew: number };
  crm: {
    totalContacts: number; newContacts: number; existingContacts: number; totalAccounts: number;
    totalOpportunities: number; totalCampaign: number; aiEmailCoverage: number; emailedContacts: number;
  };
}
interface Email { subject: string | null; body: string; citations: string[] }
interface Run {
  id: number; contactId: string | null; label: string | null; triggerType: string;
  path: string; qaPassed: boolean | null; qaReasons: string[]; durationMs: number | null; email: Email | null;
}

const Stat = ({ label, value, suffix, hint, accent }:
  { label: string; value: number | string; suffix?: string; hint?: string; accent?: string }) => (
  <Card variant="outlined" sx={{ height: "100%", borderTop: accent ? `3px solid ${accent}` : undefined }}>
    <CardContent sx={{ py: 2 }}>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>{label}</Typography>
      <Typography variant="h4" fontWeight={800}>{value}<Box component="span" sx={{ fontSize: 18, fontWeight: 600, color: "text.secondary" }}>{suffix}</Box></Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </CardContent>
  </Card>
);

const Section = ({ title, note }: { title: string; note?: string }) => (
  <Box sx={{ mt: 3.5, mb: 1 }}>
    <Typography variant="overline" fontWeight={700} color="text.secondary" sx={{ letterSpacing: 1, display: "block" }}>{title}</Typography>
    {note && <Typography variant="caption" color="text.secondary">{note}</Typography>}
  </Box>
);

export default function Analytics() {
  const [m, setM] = useState<Metrics | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [emailRun, setEmailRun] = useState<Run | null>(null);

  useEffect(() => {
    const load = () => {
      fetch("/api/metrics").then((r) => r.json()).then(setM).catch(() => {});
      fetch("/api/runs").then((r) => r.json()).then((d) => setRuns(d.runs ?? [])).catch(() => {});
    };
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  if (!m) return <LinearProgress />;

  const avgSec = m.workflow.avgGenMs ? (m.workflow.avgGenMs / 1000).toFixed(1) : "0";
  const shown = showAll ? runs : runs.slice(0, 5);

  return (
    <Box sx={{ p: 3, maxWidth: 1040, mx: "auto" }}>
      <Typography variant="h5" fontWeight={800}>Analytics</Typography>
      <Typography variant="body2" color="text.secondary">
        AI generation and pipeline data quality, read live from Postgres.
      </Typography>
      <Alert severity="info" sx={{ mt: 1.5, py: 0.5 }}>
        Your activity is private to this session — what you run here is yours alone. The CRM dataset below is the shared demo data.
      </Alert>

      <Section title="AI generation · your session" />
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><Stat accent="#4f46e5" label="AI Emails Generated" value={m.workflow.draftsGen} hint="drafted for a rep to review & send" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Stat accent="#06b6d4" label="QA Pass Rate" value={m.workflow.qaPassRate} suffix="%" hint="drafts passing the rubric" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Stat accent="#06b6d4" label="Avg Generation Time" value={avgSec} suffix="s" hint="end-to-end, per run" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Stat label="Workflow Runs" value={m.workflow.totalRuns} hint="triggers fired" /></Grid>
      </Grid>

      <Section title="Pipeline data quality · your session" />
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><Stat label="Contacts Ingested" value={m.ingestion.contactsIngested} hint="via Try It (CSV) + Clay" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Stat accent="#4f46e5" label="Duplicates Caught" value={m.ingestion.dupsCaught} hint="exact + fuzzy, before a rep saw them" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Stat label="Net-new Created" value={m.ingestion.createdNew} hint="genuinely new contacts" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Stat accent="#06b6d4" label="Live Researches" value={m.workflow.liveResearches} hint="live web research runs" /></Grid>
      </Grid>

      <Section title="CRM dataset · shared" note="The reference data everyone demos against." />
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 2 }}><Stat label="Total Contacts" value={m.crm.totalContacts} /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><Stat label="Total Accounts" value={m.crm.totalAccounts} /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><Stat label="Total Opportunities" value={m.crm.totalOpportunities} /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><Stat label="Campaign Engagements" value={m.crm.totalCampaign} /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><Stat label="New / Existing" value={`${m.crm.newContacts} / ${m.crm.existingContacts}`} hint="new (ingested) vs existing (CRM)" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><Stat accent="#4f46e5" label="AI Email Coverage" value={m.crm.aiEmailCoverage} suffix="%" hint={`${m.crm.emailedContacts}/${m.crm.totalContacts} you've drafted for`} /></Grid>
      </Grid>

      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mt: 3.5, mb: 1 }}>
        <Typography variant="overline" fontWeight={700} color="text.secondary" sx={{ letterSpacing: 1 }}>Recent runs · your session</Typography>
        {runs.length > 5 && <Button size="small" onClick={() => setShowAll((s) => !s)}>{showAll ? "Show less" : `View all (${runs.length})`}</Button>}
      </Box>
      <Card variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Lead</TableCell><TableCell>Trigger</TableCell>
              <TableCell>Path</TableCell><TableCell>AI Email</TableCell><TableCell align="right">Time</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.contactId ?? r.label ?? "new lead"}</TableCell>
                <TableCell>{r.triggerType}</TableCell>
                <TableCell>{r.path}</TableCell>
                <TableCell>
                  {r.email
                    ? <Button size="small" variant="outlined" color={r.qaPassed === false ? "warning" : "primary"} onClick={() => setEmailRun(r)} sx={{ textTransform: "none", py: 0, minHeight: 24 }}>
                        View Email{r.qaPassed === false ? " ⚠" : ""}
                      </Button>
                    : "—"}
                </TableCell>
                <TableCell align="right">{r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}</TableCell>
              </TableRow>
            ))}
            {runs.length === 0 && (
              <TableRow><TableCell colSpan={5}><Typography variant="body2" color="text.secondary">No runs yet — fire a trigger in the Workflow Visualizer or run the Try It tab.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Email review dialog */}
      <Dialog open={!!emailRun} onClose={() => setEmailRun(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          AI Next Email — {emailRun?.contactId ?? emailRun?.label ?? "lead"}
          {emailRun?.qaPassed === false && <Chip size="small" color="warning" variant="outlined" label="Needs revision" sx={{ ml: 1, height: 20 }} />}
          {emailRun?.qaPassed === true && <Chip size="small" color="success" variant="outlined" label="QA passed" sx={{ ml: 1, height: 20 }} />}
          <IconButton onClick={() => setEmailRun(null)} sx={{ position: "absolute", right: 8, top: 8 }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {emailRun?.qaPassed === false && (emailRun?.qaReasons?.length ?? 0) > 0 && (
            <Alert severity="warning" sx={{ mb: 1.5, py: 0.5 }}>
              <Typography variant="caption" fontWeight={700}>QA flagged:</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>{emailRun!.qaReasons.map((r, i) => <li key={i}><Typography variant="caption">{r}</Typography></li>)}</Box>
            </Alert>
          )}
          {emailRun?.email && (
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>{emailRun.email.subject}</Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 1 }}>{emailRun.email.body}</Typography>
              {emailRun.email.citations?.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">Sources</Typography>
                  <Box sx={{ mt: 0.5 }}>{emailRun.email.citations.map((c, i) => <Chip key={i} size="small" color="info" variant="outlined" label={c} sx={{ mr: 0.5, mb: 0.5 }} />)}</Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
