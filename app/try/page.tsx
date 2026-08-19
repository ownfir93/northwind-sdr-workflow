"use client";
import { useMemo, useRef, useState } from "react";
import {
  Box, Card, CardContent, Typography, Button, Chip, Stack, TextField, Collapse,
  Table, TableBody, TableCell, TableHead, TableRow, LinearProgress, Divider, Alert,
} from "@mui/material";

type Row = { firstName: string; lastName: string; email: string; title: string; company: string };
type Result = Row & {
  persona: string; seniority: string; painPoints: string[];
  accountResearch: string | null; accountAiContext: string | null; researchSource: string;
  briefing: string; signals: string[]; nextStep: string;
  subject: string; body: string; citations: string[];
  qaPassed: boolean | null; mode: "live" | "fallback";
};
type Status = "queued" | "researching" | "drafting" | "done";

const SAMPLE = `first_name,last_name,email,title,company
Maria,Gonzalez,maria.gonzalez@notion.so,VP of Growth,Notion
David,Park,david.park@webflow.com,Director of Data Platform,Webflow
Sarah,Chen,sarah.chen@gusto.com,Lifecycle Marketing Manager,Gusto`;

const TEMPLATE = "first_name,last_name,email,title,company\n";

function splitCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else { if (ch === ",") { out.push(cur); cur = ""; } else if (ch === '"') q = true; else cur += ch; }
  }
  out.push(cur); return out;
}

function parseCsv(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) => headers.findIndex((h) => names.includes(h));
  const fi = idx(["first_name", "firstname", "first", "first name"]);
  const li = idx(["last_name", "lastname", "last", "last name"]);
  const ni = idx(["name", "full_name", "full name"]);
  const ei = idx(["email", "email_address", "e-mail"]);
  const ti = idx(["title", "job_title", "job title", "role", "position"]);
  const ci = idx(["company", "account", "company_name", "organization", "employer"]);
  return lines.slice(1).map((line) => {
    const c = splitCsvLine(line);
    let firstName = fi >= 0 ? (c[fi] ?? "").trim() : "";
    let lastName = li >= 0 ? (c[li] ?? "").trim() : "";
    if (!firstName && ni >= 0) { const p = (c[ni] ?? "").trim().split(/\s+/); firstName = p[0] ?? ""; lastName = p.slice(1).join(" "); }
    return { firstName, lastName, email: ei >= 0 ? (c[ei] ?? "").trim() : "", title: ti >= 0 ? (c[ti] ?? "").trim() : "", company: ci >= 0 ? (c[ci] ?? "").trim() : "" };
  }).filter((r) => r.firstName || r.lastName || r.email || r.company);
}

const csvCell = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const STATUS_LABEL: Record<Status, string> = { queued: "Queued", researching: "Researching account…", drafting: "Drafting email…", done: "Done" };

export default function TryIt() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<(Result | null)[]>([]);
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const overLimit = rows.length > 10;
  const effectiveRows = useMemo(() => rows.slice(0, 10), [rows]);
  const doneCount = results.filter(Boolean).length;

  function loadText(t: string) {
    setText(t); setError(null); setResults([]); setStatuses({}); setExpanded(null);
    const parsed = parseCsv(t);
    setRows(parsed);
    if (t.trim() && parsed.length === 0) setError("Couldn't parse any rows. Expected a header row with first_name, last_name, email, title, company.");
  }

  async function run(source?: "clay") {
    if (source !== "clay" && !effectiveRows.length) return;
    setRunning(true); setError(null); setExpanded(null);
    if (source === "clay") { setRows([]); setText(""); setResults([]); setStatuses({}); }
    else {
      setResults(new Array(effectiveRows.length).fill(null));
      setStatuses(Object.fromEntries(effectiveRows.map((_, i) => [i, "queued"])));
    }
    try {
      const payload = source === "clay" ? { source: "clay", email } : { rows: effectiveRows, email };
      const res = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "The live demo couldn't start.");
        setRunning(false);
        return;
      }
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
        for (const p of parts) {
          const line = p.replace(/^data: /, "").trim(); if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === "start") {
            if (ev.rows) setRows(ev.rows.map((r: any) => ({ firstName: r.firstName, lastName: r.lastName, email: "", title: r.title, company: r.company })));
            setResults(new Array(ev.count).fill(null));
            setStatuses(Object.fromEntries(Array.from({ length: ev.count }, (_, i) => [i, "queued" as Status])));
          } else if (ev.type === "progress") setStatuses((s) => ({ ...s, [ev.index]: ev.status }));
          else if (ev.type === "result") {
            setStatuses((s) => ({ ...s, [ev.index]: "done" }));
            setResults((r) => { const n = [...r]; n[ev.index] = ev.result; return n; });
          } else if (ev.type === "error") setError(ev.message);
        }
      }
    } catch (e) { setError(String(e)); }
    setRunning(false);
  }

  function exportCsv() {
    const cols = ["first_name", "last_name", "email", "title", "company", "persona", "seniority", "account_ai_context", "ai_briefing", "next_step", "email_subject", "email_body", "citations"];
    const lines = results.filter(Boolean).map((r) => [
      r!.firstName, r!.lastName, r!.email, r!.title, r!.company, r!.persona, r!.seniority,
      r!.accountAiContext ?? "", r!.briefing, r!.nextStep, r!.subject, r!.body, (r!.citations ?? []).join(" | "),
    ].map(csvCell).join(","));
    download("gtm-josh-enriched-contacts.csv", [cols.join(","), ...lines].join("\n"));
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1040, mx: "auto" }}>
      <Typography variant="h5" fontWeight={800}>Try It — run your own contacts</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Upload up to 10 brand-new contacts (or run the <b>Clay found-contacts batch</b>). Each runs through the
        live workflow — account research (web), persona match with persona-specific pains, AI Context, and a
        drafted next email — then download the enriched CSV. Treated as cold first-touch leads. Live research
        runs ~20–30s per unique company.
      </Typography>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" size="small" onClick={() => fileRef.current?.click()}>Upload CSV</Button>
            <Button variant="text" size="small" onClick={() => loadText(SAMPLE)}>Load sample</Button>
            <Button variant="text" size="small" onClick={() => download("contacts-template.csv", TEMPLATE)}>Download template</Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" size="small" color="secondary" onClick={() => run("clay")} disabled={running}>Run Clay found-contacts batch</Button>
            {rows.length > 0 && <Button variant="text" size="small" color="inherit" onClick={() => loadText("")}>Clear</Button>}
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return; const rd = new FileReader();
              rd.onload = () => loadText(String(rd.result || "")); rd.readAsText(f); e.target.value = "";
            }} />
          </Stack>
          <TextField
            size="small"
            label="Email for more runs"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            helperText="First 10 live runs are free. After that, this signs you up for GTM Josh updates."
            sx={{ mb: 1.5, maxWidth: 380 }}
            fullWidth
          />
          <TextField
            value={text} onChange={(e) => loadText(e.target.value)} multiline minRows={4} fullWidth size="small"
            placeholder={"Paste CSV here, or use Upload / Load sample.\n" + TEMPLATE}
            sx={{ "& textarea": { fontFamily: "monospace", fontSize: 12.5 } }}
          />
          {error && <Alert severity="warning" sx={{ mt: 1.5 }}>{error}</Alert>}

          {effectiveRows.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              {overLimit && <Alert severity="info" sx={{ mb: 1 }}>{rows.length} rows detected — only the first 10 will run.</Alert>}
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Name</TableCell><TableCell>Title</TableCell><TableCell>Company</TableCell>
                  <TableCell>Persona (inferred)</TableCell><TableCell>Status</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {effectiveRows.map((r, i) => {
                    const st = statuses[i]; const res = results[i];
                    return (
                      <TableRow key={i}>
                        <TableCell>{`${r.firstName} ${r.lastName}`.trim() || "—"}</TableCell>
                        <TableCell>{r.title || "—"}</TableCell>
                        <TableCell>{r.company || "—"}</TableCell>
                        <TableCell>{res ? <Chip size="small" label={res.persona} variant="outlined" /> : "—"}</TableCell>
                        <TableCell>
                          {!st ? "—" : st === "done"
                            ? <Chip size="small" color="success" variant="outlined" label="Done" />
                            : <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#f59e0b" }} /><Typography variant="caption">{STATUS_LABEL[st]}</Typography></Stack>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
                <Button variant="contained" onClick={() => run()} disabled={running || !effectiveRows.length}>
                  {running ? `Running… ${doneCount}/${effectiveRows.length}` : `Run workflow (${effectiveRows.length})`}
                </Button>
                <Button variant="outlined" onClick={exportCsv} disabled={doneCount === 0}>Download enriched CSV</Button>
              </Stack>
              {running && <LinearProgress variant="determinate" value={(doneCount / effectiveRows.length) * 100} sx={{ mt: 1.5, borderRadius: 1 }} />}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.some(Boolean) && (
        <Stack spacing={1.5}>
          {results.map((r, i) => r && (
            <Card key={i} variant="outlined">
              <CardContent sx={{ pb: 1.5 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="subtitle1" fontWeight={800}>{`${r.firstName} ${r.lastName}`.trim() || r.email}</Typography>
                  <Typography variant="body2" color="text.secondary">{r.title || "title unknown"} · {r.company}</Typography>
                  <Chip size="small" label={r.persona} color="primary" variant="outlined" />
                  <Chip size="small" label={r.seniority} variant="outlined" />
                  <Chip size="small" label={r.researchSource === "live" ? "● researched (web)" : "research n/a"} color={r.researchSource === "live" ? "success" : "default"} variant="outlined" />
                  <Box sx={{ flexGrow: 1 }} />
                  <Button size="small" onClick={() => setExpanded(expanded === i ? null : i)}>{expanded === i ? "Hide" : "View context & email"}</Button>
                </Stack>

                {/* The drafted email — always visible (the payoff). */}
                <Box sx={{ mt: 1.5, p: 1.5, bgcolor: "#fafafa", border: "1px solid #eee", borderRadius: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700}>{r.subject}</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>{r.body}</Typography>
                  {r.citations?.length > 0 && (
                    <Box sx={{ mt: 1 }}>{r.citations.map((c, k) => <Chip key={k} size="small" color="info" variant="outlined" label={c} sx={{ mr: 0.5, mb: 0.5 }} />)}</Box>
                  )}
                </Box>

                <Collapse in={expanded === i} unmountOnExit>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="overline" color="text.secondary">AI Context</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>{r.briefing}</Typography>
                  {r.accountAiContext && (<><Typography variant="caption" fontWeight={700}>Account research</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{r.accountResearch ?? r.accountAiContext}</Typography></>)}
                  {r.painPoints?.length > 0 && (<><Typography variant="caption" fontWeight={700}>Persona pain points ({r.persona})</Typography>
                    <Box component="ul" sx={{ mt: 0.25, mb: 1, pl: 2.5 }}>{r.painPoints.map((p, k) => <li key={k}><Typography variant="body2" color="text.secondary">{p}</Typography></li>)}</Box></>)}
                  <Typography variant="caption" fontWeight={700}>Signals</Typography>
                  <Box sx={{ mb: 1 }}>{(r.signals ?? []).map((s, k) => <Chip key={k} size="small" variant="outlined" label={s} sx={{ mr: 0.5, mb: 0.5, maxWidth: "100%" }} />)}</Box>
                  <Typography variant="caption" fontWeight={700}>Recommended next step:</Typography>{" "}
                  <Typography variant="body2" component="span">{r.nextStep}</Typography>
                </Collapse>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
