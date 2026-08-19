"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, Background, Controls, useNodesState, useEdgesState,
  MarkerType, type Node, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Box, Stack, Card, CardContent, Typography, Button, Chip, Alert,
  Select, MenuItem, FormControl, InputLabel, TextField,
  Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WfNode from "./WfNode";
import {
  WF_NODES, WF_EDGES, activePathFor, VISUALIZER_TRIGGERS,
} from "@/lib/workflowGraph";

const nodeTypes = { wf: WfNode };
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nodeTitle = (id: string) => WF_NODES.find((n) => n.id === id)?.title ?? id;

interface ContactOpt {
  id: string; name: string; accountName: string;
  lifecycleStage: string | null; accountResearched: boolean;
  onOpportunity: boolean; opportunityRole: string | null; opportunityName: string | null;
}
interface FoundOpt {
  foundId: string; firstName: string; lastName: string;
  title: string | null; accountId: string;
}

function buildNodes(): Node[] {
  return WF_NODES.map((n) => ({
    id: n.id, type: "wf", position: { x: n.x, y: n.y },
    data: { ...n, state: "idle" }, draggable: false,
  }));
}
function buildEdges(): Edge[] {
  return WF_EDGES.map((e) => ({
    id: `${e.source}__${e.target}`, source: e.source, target: e.target, label: e.label,
    animated: false,
    style: { stroke: "#cbd5e1", strokeWidth: 1.5, strokeDasharray: e.dashed ? "5 4" : undefined },
    labelStyle: { fontSize: 10, fill: "#64748b" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#cbd5e1" },
  }));
}

export default function WorkflowVisualizer() {
  const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildEdges());

  const [trigger, setTrigger] = useState("opp_stage_changed");
  const [contacts, setContacts] = useState<ContactOpt[]>([]);
  const [foundLeads, setFoundLeads] = useState<FoundOpt[]>([]);
  const [leadId, setLeadId] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [staged, setStaged] = useState<any[] | null>(null);
  const [ranNodeIds, setRanNodeIds] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  const triggerDef = VISUALIZER_TRIGGERS.find((t) => t.value === trigger)!;
  const isBatch = trigger === "clay_found";
  const isFound = triggerDef.source === "found";
  const isScheduled = triggerDef.runnable === false;
  const showLeadSelector = !isBatch && !isScheduled;

  useEffect(() => {
    fetch("/api/records").then((r) => r.json()).then((d) => setContacts(d.contacts ?? [])).catch(() => {});
    fetch("/api/ingest").then((r) => r.json()).then((d) => setFoundLeads(d.staged ?? [])).catch(() => {});
  }, []);

  // Keep the whole graph fitted to the (responsive) frame as the window resizes.
  const rfRef = useRef<any>(null);
  useEffect(() => {
    let raf = 0;
    const refit = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => rfRef.current?.fitView({ padding: 0.12 })); };
    window.addEventListener("resize", refit);
    return () => { window.removeEventListener("resize", refit); cancelAnimationFrame(raf); };
  }, []);

  // Leads eligible for the selected trigger (existing-contact triggers filter by stage).
  const eligibleContacts = useMemo(() => {
    return contacts.filter((c) => {
      const stage = c.lifecycleStage;
      if (triggerDef.eligibleStages) {
        if (!stage || !triggerDef.eligibleStages.includes(stage)) return false;
      }
      if (triggerDef.excludeStages && stage && triggerDef.excludeStages.includes(stage)) return false;
      if (triggerDef.requiresOpp && !c.onOpportunity) return false;
      return true;
    });
  }, [contacts, triggerDef]);

  const leadOptions = useMemo(() => {
    if (isFound) {
      return foundLeads.map((f) => ({ id: f.foundId, label: `${f.firstName} ${f.lastName} · ${f.accountId} · ${f.title ?? "—"}` }));
    }
    return eligibleContacts.map((c) => ({
      id: c.id,
      label: `${c.name} · ${c.accountName} · ${c.lifecycleStage ?? "—"}${c.onOpportunity ? ` · ${c.opportunityRole} on ${c.opportunityName}` : ""}`,
    }));
  }, [isFound, foundLeads, eligibleContacts]);

  // Keep the selected lead valid as the trigger (and its eligibility) changes.
  useEffect(() => {
    if (!showLeadSelector) return;
    if (!leadOptions.find((o) => o.id === leadId)) setLeadId(leadOptions[0]?.id ?? "");
  }, [leadOptions, leadId, showLeadSelector]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === leadId),
    [contacts, leadId],
  );

  const reset = useCallback(() => {
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, state: "idle" } })));
    setEdges((es) => es.map((e) => ({
      ...e, animated: false,
      style: { ...e.style, stroke: "#cbd5e1", strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#cbd5e1" },
    })));
    setResult(null); setStaged(null); setRanNodeIds(new Set()); setSelectedNode(null);
  }, [setNodes, setEdges]);

  // Full demo reset: re-seed the DB (clears runs, research, generated emails, merges) + reload records.
  const [resetting, setResetting] = useState(false);
  const resetDemo = useCallback(async () => {
    if (!window.confirm("Reset your demo session?\n\nThis clears the runs and analytics from your session only. The shared CRM dataset and other people's sessions are untouched.")) return;
    setResetting(true);
    try {
      await fetch("/api/reset", { method: "POST" });
      const [recs, ing] = await Promise.all([
        fetch("/api/records").then((r) => r.json()).catch(() => ({})),
        fetch("/api/ingest").then((r) => r.json()).catch(() => ({})),
      ]);
      setContacts(recs.contacts ?? []); setFoundLeads(ing.staged ?? []);
    } catch { /* ignore */ }
    reset(); setResetting(false);
  }, [reset]);

  const setNodeState = (id: string, state: string) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, state } } : n)));

  const lightEdge = (id: string) =>
    setEdges((es) => es.map((e) => (e.id === id ? {
      ...e, animated: true,
      style: { ...e.style, stroke: "#f59e0b", strokeWidth: 2.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
    } : e)));

  async function run() {
    if (isScheduled) return;
    reset();
    setLimitMessage(null);
    setRunning(true);
    await delay(100);
    const needsResearch = !isBatch && !isFound && selectedContact ? !selectedContact.accountResearched : false;
    const { nodeIds, edgeIds, path } = activePathFor(trigger, needsResearch);
    setRanNodeIds(new Set(nodeIds));

    // Clay batch: short path; pace the hygiene node to the real gate call.
    if (isBatch) {
      try {
        const ingestP = fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }).then(async (r) => {
          const json = await r.json().catch(() => ({}));
          if (!r.ok) throw json;
          return json;
        });
        for (let i = 0; i < nodeIds.length; i++) {
          if (i > 0) { setNodeState(nodeIds[i - 1], "done"); lightEdge(edgeIds[i - 1]); }
          setNodeState(nodeIds[i], "active");
          if (nodeIds[i] === "hygiene") { lightEdge("hygiene__needs_review"); lightEdge("hygiene__analytics"); await ingestP; }
          else await delay(420);
        }
        setNodeState(nodeIds[nodeIds.length - 1], "done");
        setStaged((await ingestP).staged ?? []);
      } catch (e: any) {
        if (e?.emailRequired) setLimitMessage(e.error ?? "Add your email to keep running the live demo.");
      } finally { setRunning(false); }
      return;
    }

    // Existing / single new-lead: the orchestrator returns the 3 AI steps together, so 03→04→05 are paced
    // on estimated timing during the real run; Account Research stays event-driven (its own real call).
    const doneReceived = new Set<string>();
    const resolvers: Record<string, () => void> = {};
    let resultPayload: any = null;
    let resolveResult: () => void = () => {};
    const resultPromise = new Promise<void>((r) => { resolveResult = r; });
    const waitDone = (node: string, timeout: number) =>
      new Promise<void>((resolve) => {
        if (doneReceived.has(node)) return resolve();
        let settled = false;
        const fin = () => { if (!settled) { settled = true; resolve(); } };
        resolvers[node] = fin;
        setTimeout(fin, timeout);
      });

    const reader = (async () => {
      try {
        const body = isFound ? { foundId: leadId, triggerType: "new_lead", email } : { contactId: leadId, triggerType: trigger, email };
        const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          if (json.emailRequired) setLimitMessage(json.error ?? "Add your email to keep running the live demo.");
          return;
        }
        const rd = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await rd.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const line = buf.slice(0, idx).split("\n").find((l) => l.startsWith("data:"));
            buf = buf.slice(idx + 2);
            if (!line) continue;
            const evt = JSON.parse(line.slice(5).trim());
            if (evt.type === "step" && evt.status === "done") { doneReceived.add(evt.node); resolvers[evt.node]?.(); }
            else if (evt.type === "result") { resultPayload = evt.payload; resolveResult(); }
          }
        }
      } catch { /* network/stream error — walk falls through on timeouts */ }
      finally { resolveResult(); }
    })();

    // Estimated durations for the orchestrator's 03→04→05 (snap forward the moment the result arrives).
    const EST: Record<string, number> = { context: 9000, draft: 14000, qa: 5000 };
    for (let i = 0; i < nodeIds.length; i++) {
      const node = nodeIds[i];
      if (i > 0) { setNodeState(nodeIds[i - 1], "done"); lightEdge(edgeIds[i - 1]); }
      setNodeState(node, "active");
      if (path === "new_lead" && node === "hygiene") { lightEdge("hygiene__needs_review"); lightEdge("hygiene__analytics"); }
      if (node === "ai_next_email") { lightEdge("ai_next_email__analytics"); setNodeState("analytics", "done"); }
      if (node === "acct_research") await Promise.race([waitDone("acct_research", 75000), resultPromise]);
      else if (EST[node] != null) await Promise.race([delay(EST[node]), resultPromise]);
      else await delay(360);
    }
    setNodeState(nodeIds[nodeIds.length - 1], "done");

    await reader;
    if (resultPayload) setResult(resultPayload);
    setRunning(false);
  }

  const hasOutput = !!result || !!staged;

  return (
    <Box sx={{ p: 3, maxWidth: 1500, mx: "auto" }}>
      <Typography variant="h5" fontWeight={800}>Workflow Visualizer</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The end-to-end workflow as it actually runs — driven by <b>automated events</b>, not human
        clicks. Pick an event, run a lead through, then <b>click any completed step</b> to see its
        real output. The workflow ends by writing the <b>AI Next Email</b> field; the outreach tool
        builds the in-sequence email from it and a rep reviews & sends. This same
        topology is what the app runtime executes.
      </Typography>

      {limitMessage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {limitMessage}
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              label="Email for more runs"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ minWidth: 260 }}
              helperText="First 10 runs are free. After that, this signs you up for GTM Josh updates."
            />
            <FormControl size="small" sx={{ minWidth: 250 }}>
              <InputLabel>Event trigger</InputLabel>
              <Select value={trigger} label="Event trigger" onChange={(e) => { setTrigger(e.target.value); reset(); }}>
                {VISUALIZER_TRIGGERS.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                    {t.scheduled ? " · scheduled" : t.path === "new_lead" ? " · new-lead" : " · existing"}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {showLeadSelector && (
              <FormControl size="small" sx={{ minWidth: 320 }}>
                <InputLabel>{isFound ? "New lead (from Clay)" : "Lead"}</InputLabel>
                <Select value={leadId} label={isFound ? "New lead (from Clay)" : "Lead"} onChange={(e) => setLeadId(e.target.value)}>
                  {leadOptions.map((o) => <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>)}
                  {leadOptions.length === 0 && <MenuItem disabled value="">No eligible leads for this trigger</MenuItem>}
                </Select>
              </FormControl>
            )}
            {isBatch && <Chip color="warning" variant="outlined" label="runs the whole found_contacts batch" />}

            <Button variant="contained" onClick={run} disabled={running || isScheduled || (showLeadSelector && !leadId)}>
              {running ? "Running…" : "Run lead through workflow"}
            </Button>
            <Button variant="text" onClick={resetDemo} disabled={running || resetting}>{resetting ? "Resetting…" : "Reset demo"}</Button>
          </Stack>

          {isScheduled && (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              <b>Scheduled trigger — not runnable here.</b> A nightly scheduled job sweeps the day's work —
              re-research stale accounts, refresh AI Context,
              process new leads. Shown as scaffolding for a repeatable process; Phase 2 implements the batch logic.
            </Alert>
          )}
          {!isScheduled && (triggerDef.eligibleStages || triggerDef.excludeStages || triggerDef.requiresOpp) && showLeadSelector && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              {triggerDef.requiresOpp
                ? `${triggerDef.label} only fires for leads on an open opportunity (any role) — and a contact on an opp is always in Pipeline. Being at an account that has an opp doesn't count.`
                : triggerDef.eligibleStages
                ? `${triggerDef.label} only fires for leads in: ${triggerDef.eligibleStages.join(", ")}.`
                : `${triggerDef.label} fires for any lead except: ${triggerDef.excludeStages!.join(", ")}.`}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        {/* Responsive frame: fills the viewport below the controls and re-fits the graph on resize. */}
        <div style={{ height: "clamp(360px, calc(100dvh - 300px), 1000px)", width: "100%", background: "#fbfbfd" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, n) => setSelectedNode(n.id)}
            onInit={(inst) => { rfRef.current = inst; inst.fitView({ padding: 0.12 }); }}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            proOptions={{ hideAttribution: true }}
            nodesConnectable={false}
            nodesDraggable={false}
            minZoom={0.2}
          >
            <Background gap={18} color="#eceef2" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </Card>

      <Box sx={{ mt: 1, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
        <LegendDot color="#fb923c" label="event source (automated)" />
        <LegendDot color="#818cf8" label="skill / process" />
        <LegendDot color="#c084fc" label="decision" />
        <LegendDot color="#94a3b8" label="terminal" />
        <LegendDot color="#22d3ee" label="outreach + human send" />
        <LegendDot color="#475569" label="scheduled (cron)" />
        {hasOutput && (
          <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
            ▸ click any completed step to inspect its output
          </Typography>
        )}
      </Box>

      <Dialog open={!!selectedNode} onClose={() => setSelectedNode(null)} maxWidth="sm" fullWidth>
        {selectedNode && (
          <>
            <DialogTitle sx={{ pr: 6 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography component="span" variant="subtitle1" fontWeight={700}>{nodeTitle(selectedNode)}</Typography>
                {hasOutput && !ranNodeIds.has(selectedNode) && (
                  <Chip size="small" color="default" variant="outlined" label="not run in this path" />
                )}
                {!hasOutput && <Chip size="small" color="default" variant="outlined" label="run a lead to see output" />}
              </Stack>
              <IconButton aria-label="close" onClick={() => setSelectedNode(null)} sx={{ position: "absolute", right: 8, top: 8, color: "grey.500" }}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {hasOutput
                ? <StepOutput nodeId={selectedNode} ran={ranNodeIds.has(selectedNode)} result={result} staged={staged} />
                : <NodeDescription nodeId={selectedNode} />}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}

function NodeDescription({ nodeId }: { nodeId: string }) {
  const n = WF_NODES.find((x) => x.id === nodeId);
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 0.5 }}>{n?.subtitle}</Typography>
      {n?.model && <Chip size="small" variant="outlined" label={n.model} />}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        Output available upon workflow completion.
      </Typography>
    </Box>
  );
}

function StepOutput({ nodeId, ran, result, staged }:
  { nodeId: string; ran: boolean; result: any; staged: any[] | null }) {
  if (!ran) {
    return (
      <Typography variant="body2" color="text.secondary">
        This step wasn’t on the path for this run. {nodeId === "acct_research"
          ? "Account Research is lazy — it only runs when the account hasn’t been researched yet."
          : nodeId === "needs_review"
          ? "Fuzzy/ambiguous matches route here for human adjudication."
          : "Pick a different trigger to exercise it."}
      </Typography>
    );
  }

  // ---- new-lead (Clay batch) staging steps ----
  if (staged && (nodeId === "ingest" || nodeId === "hygiene" || nodeId === "analytics")) {
    return (
      <Box>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {nodeId === "ingest"
            ? `Ingested ${staged.length} discovered contacts to staged.`
            : nodeId === "analytics"
            ? "Phase 2 writes a HygieneEvent row per record; the Analytics tab reflects them."
            : "Phase 1 stops at staged. Phase 2 adjudicates each (exact → fuzzy → AI)."}
        </Typography>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Found</TableCell><TableCell>Name</TableCell><TableCell>Match</TableCell><TableCell>Decision</TableCell><TableCell>Reason</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {staged.map((s) => {
              const h = s.hygiene ?? {};
              const color = h.decision === "auto_merge" ? "success" : h.decision === "needs_review" ? "warning" : h.decision === "create_new" ? "info" : "default";
              return (
                <TableRow key={s.foundId}>
                  <TableCell>{s.foundId}</TableCell>
                  <TableCell>{s.firstName} {s.lastName}</TableCell>
                  <TableCell>{h.matchType ?? "—"}{h.confidence != null ? ` · ${Math.round(h.confidence * 100)}%` : ""}</TableCell>
                  <TableCell><Chip size="small" color={color as any} variant="outlined" label={h.decision ?? "pending"} /></TableCell>
                  <TableCell sx={{ maxWidth: 260, fontSize: 11 }}>{h.reason ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    );
  }

  if (!result) {
    return <Typography variant="body2" color="text.secondary">No output captured for this step.</Typography>;
  }

  if (nodeId.startsWith("ev_")) {
    return <Detail label="Automated event"><b>{result.triggerLabel}</b> fired for {result.contactName}. In Phase 2 this is a real webhook/schedule, not a click.</Detail>;
  }

  const c = result.context ?? {};
  switch (nodeId) {
    case "trigger":
      return <Detail label="Workflow trigger">Received the event and started the run on the <b>{result.path}</b> path. The trigger only starts the workflow; the logic lives in the repo’s prompts and rules.</Detail>;
    case "research":
      return (
        <Box>
          <Typography variant="overline" color="text.secondary">01 Research — verified signals</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>Click a finding to expand it.</Typography>
          <ExpandableSignals signals={c.signals ?? []} />
        </Box>
      );
    case "enrich":
      return <EnrichTable enrichment={result.enrichment} />;
    case "acct_gate":
      return (
        <Detail label="Account researched?">
          {c.researchStatus === "researched"
            ? <>Yes — researched {c.researchedAt ? `on ${String(c.researchedAt).slice(0, 10)}` : ""}. Skip Account Research, proceed to Build Context.</>
            : <>No — would dispatch the Account Research agent (lazy, runs once).</>}
        </Detail>
      );
    case "acct_research":
      return (
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
            <Typography variant="overline" color="text.secondary">Account Research (lazy · web search)</Typography>
            {c.researchSource && c.researchSource !== "none" && (
              <Chip size="small"
                color={c.researchSource === "live" ? "success" : c.researchSource === "fallback" ? "warning" : "default"}
                variant={c.researchSource === "live" ? "filled" : "outlined"}
                label={c.researchSource === "live" ? "● researched live" : c.researchSource} sx={{ height: 20 }} />
            )}
          </Stack>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {c.accountResearch ?? "Researched live by the account research step when the account isn't researched yet."}
          </Typography>
        </Box>
      );
    case "context":
      return (
        <Box>
          <Typography variant="overline" color="text.secondary">03 Build Context — AI Context (every run)</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>{c.accountAiContext}</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>{c.briefing}</Typography>
          {c.opportunityContext && (
            <Typography variant="caption" color="text.secondary" display="block">
              <b>Opp:</b> {c.opportunityContext.contactRole ? `this contact is ${c.opportunityContext.contactRole} on ` : ""}
              {c.opportunityContext.name} ({c.opportunityContext.stage}) · {c.opportunityContext.context}
            </Typography>
          )}
          {c.opportunityContext?.nextStepHistory?.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                Next-step history
              </Typography>
              <Box sx={{ borderLeft: "2px solid #e2e8f0", pl: 1, mt: 0.5 }}>
                {c.opportunityContext.nextStepHistory.map((h: any, i: number, arr: any[]) => (
                  <Typography key={i} variant="caption" display="block"
                    color={i === arr.length - 1 ? "text.primary" : "text.secondary"}
                    sx={{ fontWeight: i === arr.length - 1 ? 700 : 400 }}>
                    {String(h.date).slice(0, 10)} · {h.note}{i === arr.length - 1 ? "  ← current" : ""}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>{c.historyNote}</Typography>
          <AiStepExtras result={result} step="context" />
        </Box>
      );
    case "draft":
      return (
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
            <Typography variant="overline" color="text.secondary">04 Draft — Opus 4.8</Typography>
            <Chip size="small" color={result.mode === "live" ? "success" : "default"} variant={result.mode === "live" ? "filled" : "outlined"}
              label={result.mode === "live" ? "● live model call" : "templated fallback"} sx={{ height: 20 }} />
          </Stack>
          <Box sx={{ p: 1.5, bgcolor: "#fafafa", borderRadius: 1, border: "1px solid #eee" }}>
            <Typography variant="body2" fontWeight={700}>{result.email?.subject}</Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>{result.email?.body}</Typography>
          </Box>
          <Box sx={{ mt: 1 }}>
            {(result.email?.citations ?? []).map((x: string, i: number) => (
              <Chip key={i} size="small" color="info" variant="outlined" label={x} sx={{ mr: 0.5, mb: 0.5 }} />
            ))}
          </Box>
          <AiStepExtras result={result} step="draft" />
        </Box>
      );
    case "qa":
      return (
        <Box>
          <Typography variant="overline" color="text.secondary">05 QA grade</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            {(result.qa?.rubric ?? []).map((r: any, i: number) => (
              <Chip key={i} size="small" color={r.pass ? "success" : "error"} variant="outlined" label={`${r.criterion} ${r.pass ? "✓" : "✗"}`} />
            ))}
          </Stack>
          <AiStepExtras result={result} step="qa" />
        </Box>
      );
    case "ai_next_email":
      return (
        <Box>
          <Typography variant="overline" color="text.secondary">Write AI Next Email</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {result.aiNextEmailWritten
              ? <>Populated <code>contact.aiNextEmail</code> with the drafted email below. Re-running a trigger (e.g. “Rep sent email”) overwrites it with the next-in-sequence message.</>
              : <>For a brand-new lead the field is written after the hygiene <i>create</i> in Phase 2.</>}
          </Typography>
          <Box sx={{ p: 1.5, bgcolor: "#f0fdff", borderRadius: 1, border: "1px solid #cffafe" }}>
            <Typography variant="body2" fontWeight={700}>{result.email?.subject}</Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>{result.email?.body}</Typography>
          </Box>
        </Box>
      );
    case "sequence":
      return <Detail label="Outreach sequence">The outreach tool builds the next email <b>in-sequence</b> from the <code>aiNextEmail</code> field — so the AI-drafted message slots into the rep’s existing cadence rather than a separate tool.</Detail>;
    case "rep_send":
      return <Detail label="Rep reviews & sends">A rep reviews the AI-drafted email, edits if needed, and sends. <b>Never auto-sent</b> — human-in-the-loop on anything that goes out.</Detail>;
    case "analytics":
      return (
        <Detail label="Analytics — Run row written">
          trigger=<b>{result.triggerType}</b> · path=<b>{result.path}</b> · contextGenerated=true · draftGenerated=true · qaPassed=<b>{String(result.qa?.passed)}</b>. The Analytics tab increments live.
        </Detail>
      );
    default:
      return <Typography variant="body2" color="text.secondary">No detail for this step.</Typography>;
  }
}

function ExpandableBlock({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false);
  if (!content) return null;
  return (
    <Box sx={{ mt: 0.75 }}>
      <Box onClick={() => setOpen((o) => !o)}
        sx={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.4, borderRadius: 1, border: "1px solid #c7d2fe", bgcolor: "#eef2ff", "&:hover": { bgcolor: "#e0e7ff" } }}>
        <span style={{ fontSize: 11, color: "#4338ca" }}>{open ? "▾" : "▸"}</span>
        <Typography variant="caption" fontWeight={700} sx={{ color: "#4338ca" }}>{label}</Typography>
      </Box>
      {open && (
        <Box component="pre" sx={{ mt: 0.5, p: 1, m: 0, bgcolor: "#0f172a", color: "#e2e8f0", borderRadius: 1, fontSize: 10, lineHeight: 1.5, maxHeight: 320, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {content}
        </Box>
      )}
    </Box>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <Box component="pre" sx={{ p: 1, m: 0, mt: 0.5, bgcolor: "#0f172a", color: "#e2e8f0", borderRadius: 1, fontSize: 10, lineHeight: 1.5, maxHeight: 300, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {text}
    </Box>
  );
}

// Collapsible header that wraps arbitrary content (used for the prompt view + each reference layer).
function ExpandableSection({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ mt: 0.75 }}>
      <Box onClick={() => setOpen((o) => !o)}
        sx={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.4, borderRadius: 1, border: "1px solid #c7d2fe", bgcolor: "#eef2ff", "&:hover": { bgcolor: "#e0e7ff" } }}>
        <span style={{ fontSize: 11, color: "#4338ca" }}>{open ? "▾" : "▸"}</span>
        <Typography variant="caption" fontWeight={700} sx={{ color: "#4338ca" }}>{label}</Typography>
      </Box>
      {open && <Box sx={{ mt: 0.5 }}>{children}</Box>}
    </Box>
  );
}

// Renders a prompt as: core system instructions + collapsed reference "layers" + the user prompt.
function PromptView({ prompt, appendNote }: { prompt: any; appendNote?: string }) {
  if (!prompt) return <Typography variant="body2" color="text.secondary">Run a lead to capture the prompt.</Typography>;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        model <b>{prompt.model}</b> · sent prompt = instructions + only the relevant reference layers + user
      </Typography>
      <Typography variant="caption" fontWeight={700} sx={{ display: "block", mt: 0.5 }}>System instructions</Typography>
      <CodeBlock text={prompt.instructions} />
      {(prompt.references ?? []).length > 0 && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Reference layers (sliced to this contact — collapsed; expand any to read it):
          </Typography>
          {prompt.references.map((r: any, i: number) => (
            <ExpandableSection key={i} label={r.title}><CodeBlock text={r.body} /></ExpandableSection>
          ))}
        </Box>
      )}
      <Typography variant="caption" fontWeight={700} sx={{ display: "block", mt: 1 }}>User prompt</Typography>
      <CodeBlock text={(prompt.user ?? "") + (appendNote ?? "")} />
    </Box>
  );
}

// "See Prompt Used" + "See Context Used" for an AI step (03 / 04 / 05).
function AiStepExtras({ result, step }: { result: any; step: "context" | "draft" | "qa" }) {
  const appendNote = step === "draft"
    ? "\n\n(at run time the workflow appends the live 03 Build Context output here as the AI Context)"
    : step === "qa"
    ? "\n\n(at run time the workflow appends the live 04 draft + 03 context here)"
    : "";

  let ctxLabel = "See Context Used";
  let ctxText = "";
  if (step === "context") {
    ctxLabel = "See Input Record (fed to 03)";
    ctxText = result?.recordUsed ?? "";
  } else {
    const c = result?.context ?? {};
    ctxText = JSON.stringify({
      briefing: c.briefing, accountAiContext: c.accountAiContext, accountResearch: c.accountResearch,
      opportunity: c.opportunityContext, signals: c.signals, nextStep: result?.nextStep,
    }, null, 2);
    if (step === "qa") {
      ctxText = `--- DRAFT GRADED ---\nSubject: ${result?.email?.subject}\n\n${result?.email?.body}\n\n--- AI CONTEXT ---\n${ctxText}`;
    }
  }
  return (
    <>
      <ExpandableSection label="See Prompt Used"><PromptView prompt={result?.prompts?.[step]} appendNote={appendNote} /></ExpandableSection>
      <ExpandableBlock label={ctxLabel} content={ctxText} />
    </>
  );
}

function ExpandableSignals({ signals }: { signals: string[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  if (!signals.length) return <Typography variant="body2" color="text.secondary">No signals.</Typography>;
  return (
    <Stack spacing={0.75}>
      {signals.map((s, i) => {
        const isOpen = !!open[i];
        const m = s.match(/^(\[[^\]]+\])\s*([\s\S]*)$/);
        const tag = m ? m[1] : null;
        const text = m ? m[2] : s;
        return (
          <Box key={i} onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
            sx={{ cursor: "pointer", border: "1px solid #e2e8f0", borderRadius: 1.5, px: 1, py: 0.6, bgcolor: "#f8fafc", "&:hover": { bgcolor: "#eef2f7" } }}>
            <Stack direction="row" spacing={0.75} alignItems="flex-start">
              <span style={{ fontSize: 11, color: "#6366f1", userSelect: "none", lineHeight: "20px" }}>{isOpen ? "▾" : "▸"}</span>
              <Typography variant="body2" sx={{ minWidth: 0, whiteSpace: isOpen ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {tag && <b style={{ color: "#4338ca" }}>{tag} </b>}{text}
              </Typography>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}

function EnrichTable({ enrichment }: { enrichment: any }) {
  const fields = enrichment?.fields ?? [];
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="overline" color="text.secondary">02b Enrich — before → after</Typography>
        <Chip size="small" color="success" variant="outlined" label={`${enrichment?.filledCount ?? 0} filled · ${enrichment?.provider ?? "mock"}`} />
      </Stack>
      <Table size="small">
        <TableHead><TableRow>
          <TableCell>Field</TableCell><TableCell>Before</TableCell><TableCell>After</TableCell><TableCell>Drives</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {fields.map((f: any) => (
            <TableRow key={f.key} sx={{ bgcolor: f.changed ? "rgba(76,175,80,0.07)" : undefined }}>
              <TableCell><b>{f.label}</b></TableCell>
              <TableCell sx={{ color: f.before ? "text.primary" : "#c44" }}>{f.before ?? "— empty —"}</TableCell>
              <TableCell>{f.after ?? "—"}</TableCell>
              <TableCell>{f.drives ? <Chip size="small" color="info" variant="outlined" label={f.drives} sx={{ height: 20 }} /> : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">{label}</Typography>
      <Typography variant="body2">{children}</Typography>
    </Box>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Box sx={{ width: 11, height: 11, borderRadius: "3px", border: `2px solid ${color}` }} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  );
}
