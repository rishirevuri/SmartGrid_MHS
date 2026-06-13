"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, ChevronUp, Clock, DollarSign, Send, ShieldAlert } from "lucide-react";
import { queryAgent } from "@/lib/api";
import { GridNode, LiveSignals, RerouteOption, RerouteSimulation, RiskSummary } from "@/lib/types";
import { pct } from "@/lib/mapUtils";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
}

function getRerouteOptions(reroute: RerouteSimulation): RerouteOption[] {
  if (Array.isArray(reroute.reroute_options) && reroute.reroute_options.length) {
    return reroute.reroute_options as RerouteOption[];
  }
  if (Array.isArray(reroute.recommended_path) && reroute.recommended_path.length) {
    return [{ path: reroute.recommended_path, score: 0.7, explanation: String(reroute.explanation || "") }];
  }
  return [];
}

function nodeDisplayName(node?: GridNode) {
  if (!node) return "that substation";
  const neighborhood = node.neighborhood || "Unknown area";
  const subname = node.subname && !node.subname.startsWith("Sub_") ? node.subname : `Substation ${node._id}`;
  return `${neighborhood} ${subname}`;
}

function compactNodeName(node?: GridNode) {
  if (!node) return "that substation";
  return node.neighborhood || (node.subname && !node.subname.startsWith("Sub_") ? node.subname : `Substation ${node._id}`);
}

function buildNodeLookup(nodes: GridNode[]) {
  return new Map(nodes.map((node) => [String(node._id).toLowerCase(), node]));
}

function pathToNames(path: string[] | undefined, nodes: GridNode[]) {
  const lookup = buildNodeLookup(nodes);
  return (path || []).map((id) => compactNodeName(lookup.get(String(id).toLowerCase()))).join(" → ");
}

function findMentionedNode(query: string, nodes: GridNode[], selectedNode?: GridNode) {
  const q = query.toLowerCase();
  const candidates = nodes
    .filter((node) => node._id !== selectedNode?._id)
    .map((node) => ({
      node,
      names: [
        node._id,
        node.subname,
        node.neighborhood,
        node.subname?.replace(/^Sub_/, "substation ")
      ].filter(Boolean).map((value) => String(value).toLowerCase())
    }))
    .sort((a, b) => Math.max(...b.names.map((name) => name.length)) - Math.max(...a.names.map((name) => name.length)));
  return candidates.find(({ names }) => names.some((name) => name.length > 1 && q.includes(name)))?.node;
}

function describeNodeHealth(node?: GridNode) {
  if (!node) return "I do not have enough data for that substation.";
  const load = Math.round(pct(node.load_pct) * 100);
  const risk = Math.round(pct(node.risk_score) * 100);
  const status = String(node.status || "unknown");
  if (status === "critical" || risk >= 70) return `${compactNodeName(node)} was too risky: about ${risk}% risk and ${load}% load. Sending more power there could cause another failure.`;
  if (status === "high" || load >= 80 || risk >= 50) return `${compactNodeName(node)} was already stressed: about ${risk}% risk and ${load}% load. It is a weak backup, not a safe detour.`;
  if (node.critical_infrastructure) return `${compactNodeName(node)} protects critical infrastructure, so SmartGrid avoids using it unless there is no safer option.`;
  return `${compactNodeName(node)} looked usable on its own, but the full route still has to be connected, low-risk, and able to carry the extra load.`;
}

function explainWhyNotCandidate(query: string, node: GridNode | undefined, nodes: GridNode[], reroute?: RerouteSimulation) {
  const candidate = findMentionedNode(query, nodes, node);
  const opts = reroute ? getRerouteOptions(reroute) : [];
  const best = opts[0];
  const alt = opts[1];

  if (!best) {
    return `I need an active reroute first. Click a substation, run “Simulate Failure,” then ask why SmartGrid did or did not use a specific substation.`;
  }

  if (!candidate) {
    return `I can explain that, but I could not confidently identify the substation name in your question.\n\nCurrent safe route: ${pathToNames(best.path, nodes)}.\n\nTry asking: “Why wasn’t Mission used?” or “Why not route through SoMa?”`;
  }

  const chosen = best.path.map(String);
  const rejected = alt?.path?.map(String) || [];
  const candidateId = String(candidate._id);
  const candidateName = nodeDisplayName(candidate);

  if (chosen.includes(candidateId)) {
    return `${candidateName} actually is part of the chosen route.\n\nThe route is: ${pathToNames(best.path, nodes)}.\n\nSmartGrid used it because it helped move power around the failed area without adding too much stress to weaker substations.`;
  }

  if (candidateId === node?._id) {
    return `${candidateName} was the failed substation in this simulation.\n\nThat means SmartGrid cannot send power through it. It has to go around it, like traffic taking a detour around a closed road.`;
  }

  if (rejected.includes(candidateId)) {
    return `${candidateName} was considered, but it was on the rejected route.\n\nRejected route: ${pathToNames(alt?.path, nodes)}.\n\nWhy it was rejected: ${describeNodeHealth(candidate)}\n\nChosen route: ${pathToNames(best.path, nodes)}.\n\nIn simple terms: the chosen route is the safer road for electricity. The rejected route asks a weaker part of the grid to carry more weight.`;
  }

  const connectedToFailure = node?.neighbors?.map(String).includes(candidateId);
  const connectedToChosen = best.path.some((id) => {
    const pathNode = nodes.find((n) => String(n._id) === String(id));
    return pathNode?.neighbors?.map(String).includes(candidateId);
  });

  if (!connectedToFailure && !connectedToChosen) {
    return `${candidateName} was not used because it is not on a clean electrical path from the failed area to the safer backup route.\n\nElectricity cannot jump across the map. It has to follow feeder lines that are physically connected.\n\nChosen route: ${pathToNames(best.path, nodes)}.\n\n${describeNodeHealth(candidate)}`;
  }

  return `${candidateName} was not chosen because the full path through it was not as safe as the route SmartGrid picked.\n\nChosen route: ${pathToNames(best.path, nodes)}.\n\n${describeNodeHealth(candidate)}\n\nSimple version: SmartGrid picked the route that keeps power moving while putting the least extra pressure on already-stressed substations.`;
}

function buildJustification(node: GridNode, reroute: RerouteSimulation, riskSummary?: RiskSummary, nodes: GridNode[] = []) {
  const opts = getRerouteOptions(reroute);
  const best = opts[0];
  const alt = opts[1];
  if (!best) return null;

  const loadMW = (node.current_load_kw || 0) / 1000;
  const hourlyImpact = Math.round(loadMW * 145);
  const loadPct = Math.round(pct(node.load_pct) * 100);
  const hops = best.path.length - 1;
  const riskMatch = best.explanation.match(/avg risk ([\d.]+)/);
  const pathRisk = riskMatch ? Math.round(parseFloat(riskMatch[1]) * 100) : Math.round(pct(node.risk_score) * 45);
  const nodeRisk = Math.round(pct(node.risk_score) * 100);
  const bestPath = pathToNames(best.path, nodes);
  const altPath = alt ? pathToNames(alt.path, nodes) : "";

  const financial = `${loadMW.toFixed(1)} MW is moved through ${bestPath}. That avoids roughly $${hourlyImpact.toLocaleString()} per hour in outage impact.`;
  const risk = `The failed substation is around ${nodeRisk}% risk. The selected path is safer, around ${pathRisk}% average risk. ${alt ? `The backup path through ${altPath} was weaker.` : ""}`;
  const time = `${hops === 1 ? "Direct route" : `${hops}-step route`}. Switching should take about ${hops <= 1 ? "2 to 4" : hops === 2 ? "4 to 7" : "7 to 12"} minutes, then ${loadPct >= 90 ? "8 to 15" : "5 to 10"} minutes to stabilize.`;

  return { financial, risk, time };
}

// Pattern is tested TOP-TO-BOTTOM — higher priority patterns must come first.
// "why/explain" must appear before "path/route" because the user might ask
// "explain why it rerouted" which contains the word "reroute".
function localAnswer(
  query: string,
  node?: GridNode,
  reroute?: RerouteSimulation,
  riskSummary?: RiskSummary,
  nodes: GridNode[] = []
): string {
  const q = query.toLowerCase();
  const opts = reroute ? getRerouteOptions(reroute) : [];
  const best = opts[0];
  const alt = opts[1];
  const nodeName = nodeDisplayName(node);
  const selectedArea = compactNodeName(node);
  const chosenPath = pathToNames(best?.path, nodes);
  const rejectedPath = pathToNames(alt?.path, nodes);

  if (q.match(/why.*not|why.*wasn.t|why.*was not|instead|rather than|not used|didn.t use|did not use|why avoid|why skip|why wasn.t/)) {
    return explainWhyNotCandidate(query, node, nodes, reroute);
  }

  // ── Visual element explanations — highest priority ───────────────────────
  if (q.match(/red.*line|red.*dashed|danger.*line|pink.*line|what.*red.*line|red.*path/)) {
    return `The red dashed line is the route SmartGrid decided not to use.\n\nThink of it like a road detour marked “do not take this way.” It may pass through a substation that is already stressed, not well connected, or protecting critical infrastructure.${alt ? `\n\nRejected route: ${rejectedPath}.` : ""}\n\nThe red line is shown so operators can see what was considered and why the green route is safer.`;
  }

  if (q.match(/green.*line|mint.*line|what.*green.*line|reroute.*line|bright.*green|active.*route/)) {
    const pathStr = best ? chosenPath : "available substations";
    return `The green line is the active reroute. It shows where electricity is being sent after the failure.\n\nCurrent route: ${pathStr}.\n\nSimple version: power cannot go through the failed substation, so SmartGrid sends it around the problem using a safer feeder path.`;
  }

  if (q.match(/yellow.*line|orange.*line|feeder.*line|thin.*line|what.*feeder|power.*line.*map/)) {
    return `The YELLOW and ORANGE lines are feeder cables — the physical power lines connecting SF's substations.\n\n🟡 Yellow = running normally (under 45% load)\n🟠 Orange = near capacity (over 75% load)\n\nThey're faint so you can see the map underneath, but glow brighter near your cursor. Mostly orange feeders = grid under high stress.`;
  }

  if (q.match(/red.*dot|red.*circle|red.*node|critical.*node|circle.*red|what.*red.*circle/)) {
    return `RED circles are CRITICAL substations — operating at dangerous risk levels (risk score over 70%). They could fail at any moment if load keeps rising.\n\nThink of a car engine buried in the red zone on the tachometer.\n\nRight now: ${riskSummary?.critical_count ?? 0} critical nodes on the SF grid. Click one to see its exact stats, then simulate a failure to see the impact.`;
  }

  if (q.match(/orange.*dot|orange.*circle|orange.*node|high.*risk.*node|yellow.*dot|yellow.*node/)) {
    return `ORANGE/YELLOW circles are HIGH-RISK or ELEVATED substations — stressed but not yet critical (risk 30–70%). Like a warning light: not broken, but watch it.\n\nRight now: ${riskSummary?.high_count ?? 0} high-risk and ${riskSummary?.elevated_count ?? 0} elevated nodes across SF.`;
  }

  if (q.match(/green.*dot|green.*circle|teal.*dot|normal.*node|healthy.*node/)) {
    return `GREEN/TEAL circles are healthy substations — running within safe parameters (risk score under 30%). These are the stable backbone of the grid.\n\nRight now: ${riskSummary?.normal_count ?? 0} normal nodes out of ${riskSummary?.total_substations ?? 29} total.`;
  }

  if (q.match(/pulse|halo|glow.*circle|flash|ring|blink|spin.*node/)) {
    return `The PULSING RING around a node means it just failed in the simulation — the expanding/contracting glow is the failure alert.\n\nThe bigger and brighter the pulse, the more severe the failure. The screen also briefly flashes red to mimic a SCADA control-room alarm.`;
  }

  if (q.match(/what.*color|color.*mean|legend|map.*mean|how.*read.*map/)) {
    return `Map color guide:\n\n🟢 Green node = healthy (under 30% risk)\n🟡 Yellow node = elevated risk\n🟠 Orange node = high risk (stressed)\n🔴 Red node = critical (could fail)\n\n💚 Green LINE = active reroute (power flows here now)\n❤️ Red LINE = rejected path (AI ruled this out)\n🟡 Yellow/orange LINE = feeder cable (physical power line)\n\nGrid: ${riskSummary?.critical_count ?? 0} critical, ${riskSummary?.high_count ?? 0} high, ${riskSummary?.normal_count ?? 0} normal`;
  }

  // ── Why / reasoning — MUST come before path/route/reroute patterns ────────
  if (q.match(/why|reason|explain|logic|how.*decide|how.*chose|how.*pick|how.*work|what.*criteria|scoring/)) {
    if (!best) return `No active reroute yet. Click any substation on the map → "Simulate Failure" — then ask me why the AI chose a particular path and I'll break down the scoring logic.`;
    return `SmartGrid picked the green route because it is the safest path for moving power around ${selectedArea}.\n\nChosen route: ${chosenPath}.\n\nIt checks three simple things:\n1. Is there room on the feeder line for more electricity?\n2. Are the substations on that route healthy enough?\n3. Is the route short enough to switch quickly?\n\nWhy this route: ${best.explanation || "it keeps power away from the most stressed substations."}${alt ? `\n\nRejected route: ${rejectedPath}.\nThat route was not as safe because it would push power toward a weaker part of the grid.` : ""}\n\nPlain English: SmartGrid chose the road with less traffic, fewer weak bridges, and a shorter detour.`;
  }

  // ── How to use ───────────────────────────────────────────────────────────
  if (q.match(/how.*use|help|get started|tutorial|what.*do|simulat.*how|how.*simulat/)) {
    return `Here's how to use SmartGrid:\n\n1️⃣ Click any circle on the map — that's a power substation\n2️⃣ In the right panel, click "Simulate Failure"\n3️⃣ Watch the failure cascade (nodes flash red)\n4️⃣ GREEN LINE appears — that's where power gets rerouted\n5️⃣ RED LINE shows the path the AI rejected\n\nThen ask me anything:\n• "What does the green line mean?"\n• "How much does this failure cost?"\n• "Why did the AI pick that route?"`;
  }

  // ── Financial ────────────────────────────────────────────────────────────
  if (q.match(/cost|financ|money|dollar|impact|saving|expensive|price/)) {
    if (!node || !best) return `No active reroute yet. Simulate a failure first by clicking any substation → "Simulate Failure." Then ask about cost and I'll give you the financial breakdown.`;
    const loadMW = (node.current_load_kw || 0) / 1000;
    const hourly = Math.round(loadMW * 145);
    const daily = hourly * 24;
    return `Cost impact for ${nodeName}:\n\n• Power being moved: about ${loadMW.toFixed(1)} MW\n• Outage cost avoided: about $${hourly.toLocaleString()} per hour\n• If left unfixed for 24 hours: about $${daily.toLocaleString()}\n\nSmartGrid is trying to keep power flowing so homes, hospitals, traffic signals, and businesses do not lose service.`;
  }

  // ── Risk ─────────────────────────────────────────────────────────────────
  if (q.match(/risk|safe|danger|critical|protect|worried|concern|bad|how.*safe|is.*danger/)) {
    if (!node || !best) {
      return `SF grid risk snapshot:\n\n🔴 Critical: ${riskSummary?.critical_count ?? 0} substations (over 70% risk)\n🟠 High: ${riskSummary?.high_count ?? 0} substations (50–70% risk)\n🟡 Elevated: ${riskSummary?.elevated_count ?? 0} substations\n✅ Normal: ${riskSummary?.normal_count ?? 0} substations\n\nOverall stress: ${riskSummary?.status ?? "unknown"}\nCAISO demand: ${Math.round(pct(riskSummary?.caiso_demand_stress) * 100)}%\nWeather risk: ${Math.round(pct(riskSummary?.weather_risk_score) * 100)}%`;
    }
    const riskMatch = best.explanation.match(/avg risk ([\d.]+)/);
    const pathRisk = riskMatch ? Math.round(parseFloat(riskMatch[1]) * 100) : 40;
    const nodeRisk = Math.round(pct(node.risk_score) * 100);
    return `Risk breakdown for ${nodeName}:\n\n• Failed substation risk: ${nodeRisk}% — ${nodeRisk > 70 ? "very high" : "moderate"}\n• Chosen route risk: about ${pathRisk}% — safer than pushing more load through the failed area\n• Grid condition: ${riskSummary?.status ?? "elevated"}\n• Critical substations still active: ${riskSummary?.critical_count ?? 0}\n\nSimple version: the green route uses healthier substations so one failure does not turn into several failures.`;
  }

  // ── Time ─────────────────────────────────────────────────────────────────
  if (q.match(/time|fast|quick|speed|restor|minut|how long|when.*fix/)) {
    if (!node || !best) return `Simulate a failure first, then ask about timing — I'll give you estimates based on the chosen path.`;
    const hops = best.path.length - 1;
    const loadPct = Math.round(pct(node.load_pct) * 100);
    return `Time estimate:\n\n• Route: ${chosenPath}\n• Steps: ${hops} ${hops === 1 ? "feeder switch" : "feeder switches"}\n• Switching time: ${hops <= 1 ? "2 to 4" : hops === 2 ? "4 to 7" : "7 to 12"} minutes\n• Full stabilization: ${loadPct >= 90 ? "8 to 15" : "5 to 10"} minutes\n\nHigher load means operators switch more carefully so the backup line does not trip too.`;
  }

  // ── Path / routing ───────────────────────────────────────────────────────
  if (q.match(/path|route|reroute|hop|where.*power|flow|energy.*go|power.*go/)) {
    if (!best) return `No active reroute. Click any node → "Simulate Failure" and I'll explain exactly where power gets redirected and why.`;
    return `Power is being rerouted through: ${chosenPath}.\n\nEach arrow is one feeder connection. The green line is the path SmartGrid is using now.${alt ? `\n\nThe red route, ${rejectedPath}, was considered but rejected because it was less safe.` : ""}\n\nSimple version: electricity is taking a safer detour around the failed substation.`;
  }

  // ── Grid status ──────────────────────────────────────────────────────────
  if (q.match(/grid|status|stress|overv|overall|sf.*grid|current.*grid/)) {
    return `🗺️ SF Power Grid — right now:\n\n• Total substations: ${riskSummary?.total_substations ?? 29}\n• ✅ Normal: ${riskSummary?.normal_count ?? 0}\n• ⚠️ Elevated: ${riskSummary?.elevated_count ?? 0}\n• 🟠 High: ${riskSummary?.high_count ?? 0}\n• 🔴 Critical: ${riskSummary?.critical_count ?? 0}\n\nCAISO demand stress: ${Math.round(pct(riskSummary?.caiso_demand_stress) * 100)}%\nWeather risk: ${Math.round(pct(riskSummary?.weather_risk_score) * 100)}%\nOverall: ${riskSummary?.status ?? "unknown"} stress`;
  }

  // ── Default ──────────────────────────────────────────────────────────────
  return `I can explain anything on this map in plain English. Try:\n\n• "What does the green line mean?"\n• "What does the red line mean?"\n• "What do the colored circles mean?"\n• "Why did the AI pick that route?"\n• "How much does this failure cost?"\n• "How dangerous is this?"\n• "How long will restoration take?"`;
}

export default function GridCopilot({
  nodes,
  selectedNode,
  latestReroute,
  riskSummary,
  liveSignals: _liveSignals,
}: {
  nodes: GridNode[];
  selectedNode?: GridNode;
  latestReroute?: RerouteSimulation;
  riskSummary?: RiskSummary;
  liveSignals?: LiveSignals;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Grid intelligence active. Simulate a failure on any substation to see rerouting analysis.\n\nNot sure what you're looking at? Ask me anything — I explain it in plain English."
    }
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevRerouteRef = useRef<RerouteSimulation | undefined>();
  const [threadId, setThreadId] = useState<string>();
  const [assistantId, setAssistantId] = useState<string>();

  // Auto-inject justification when a new reroute fires
  useEffect(() => {
    if (!latestReroute || !selectedNode || latestReroute === prevRerouteRef.current) return;
    prevRerouteRef.current = latestReroute;
    const just = buildJustification(selectedNode, latestReroute, riskSummary, nodes);
    if (!just) return;
    const opts = getRerouteOptions(latestReroute);
    const best = opts[0];
    const alt = opts[1];
    const content = [
      `Reroute complete — ${nodeDisplayName(selectedNode)}`,
      `Financial: ${just.financial}`,
      `Risk: ${just.risk}`,
      `Timing: ${just.time}`,
      best ? `Green route: ${pathToNames(best.path, nodes)}${alt ? `\nRejected route: ${pathToNames(alt.path, nodes)}` : ""}` : "",
    ].filter(Boolean).join("\n\n");
    setMessages(prev => [...prev, { id: `reroute-${Date.now()}`, role: "assistant", content }]);
  }, [latestReroute, selectedNode, riskSummary, nodes]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || isThinking) return;
    setIsThinking(true);
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    try {
      const response = await queryAgent(text, {
        selectedNode,
        riskSummary,
        latestReroute,
        thread_id: threadId,
        assistant_id: assistantId
      });
      if (response.thread_id) setThreadId(response.thread_id);
      if (response.assistant_id) setAssistantId(response.assistant_id);
      const reply = response.response || response.answer || response.text || localAnswer(text, selectedNode, latestReroute, riskSummary, nodes);
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
    } catch {
      const reply = localAnswer(text, selectedNode, latestReroute, riskSummary, nodes);
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
    } finally {
      setIsThinking(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isThinking) return;
    setInput("");
    await sendMessage(text);
  }

  const QUICK_QUESTIONS = [
    "What does the green line mean?",
    "What does the red line mean?",
    "Why did the AI pick that route?",
    "How much does this failure cost?",
  ];

  return (
    <section className="overlay-panel flex min-h-[30rem] flex-col rounded-xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bot className="h-3.5 w-3.5 text-teal-300" />
        <h2 className="panel-title">Grid Intelligence</h2>
        {latestReroute && (
          <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Reroute active
          </span>
        )}
        {/* Expand / collapse messages area */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          title={expanded ? "Collapse chat" : "Expand chat"}
          className="ml-auto flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-200"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Less" : "More"}
        </button>
      </div>

      {/* Quick-ask chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => sendMessage(q)}
            className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-zinc-300 transition hover:bg-white/[0.08] hover:text-zinc-100"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages — height toggles with expand state */}
      <div
        className={`soft-scrollbar space-y-2 overflow-y-auto pr-1 transition-[max-height] duration-300 ease-out ${
          expanded ? "max-h-[34rem]" : "max-h-72"
        }`}
      >
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[92%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                msg.role === "user" ? "bg-sky-900/40 text-sky-100" : "bg-white/[0.04] text-zinc-200"
              }`}
            >
              {msg.content.split("\n\n").map((block, bi, arr) => (
                <span key={bi}>
                  {bi === 0 && msg.role === "assistant" && arr.length > 1
                    ? <strong className="block text-white">{block}</strong>
                    : <span className="whitespace-pre-wrap">{block}</span>
                  }
                  {bi < arr.length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-xl bg-white/[0.04] px-3 py-2">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Justification quick-access when reroute active */}
      {latestReroute && selectedNode && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {([
            { Icon: DollarSign, label: "Financial", color: "text-emerald-300 border-emerald-400/20 bg-emerald-400/5", q: "financial cost" },
            { Icon: ShieldAlert, label: "Risk",      color: "text-orange-300 border-orange-400/20 bg-orange-400/5",   q: "risk danger"  },
            { Icon: Clock,       label: "Time",      color: "text-sky-300    border-sky-400/20    bg-sky-400/5",       q: "time restore" },
          ] as const).map(({ Icon, label, color, q }) => (
            <button
              key={label}
              type="button"
              onClick={() => sendMessage(q)}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition hover:opacity-80 ${color}`}
            >
              <Icon className="h-3 w-3 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask anything — e.g. what does the red line mean?"
          disabled={isThinking}
          className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-white/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!input.trim() || isThinking}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.08] disabled:opacity-40"
        >
          <Send className="h-3 w-3" />
        </button>
      </form>
    </section>
  );
}
