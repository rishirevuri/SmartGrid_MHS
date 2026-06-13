"use client";

import { FormEvent, useState } from "react";
import { Mic, Send } from "lucide-react";
import { queryAgent } from "@/lib/api";
import { DecisionLogEntry, GridNode, LiveSignals, RerouteSimulation, RiskSummary } from "@/lib/types";
import { pct } from "@/lib/mapUtils";

type Message = { role: "user" | "assistant"; text: string };

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
};

function localAnswer(query: string, selectedNode?: GridNode, latestReroute?: RerouteSimulation) {
  const q = query.toLowerCase();
  if (q.includes("highest risk")) return `${selectedNode?.neighborhood || "The selected sector"} is currently the highest visible risk context at ${Math.round(pct(selectedNode?.risk_score) * 100)}% risk and ${Math.round(pct(selectedNode?.load_pct) * 100)}% load.`;
  if (q.includes("reroute") || q.includes("safer")) return `The recommended reroute avoids overloaded feeders near ${selectedNode?.neighborhood || "the fault"} and shifts flow through ${((latestReroute?.recommended_path || latestReroute?.reroute_path) ?? []).join(" -> ") || "lower-load adjacent substations"}.`;
  if (q.includes("critical") || q.includes("protected")) return `Critical infrastructure protection is prioritized by preserving redundant feed capacity for flagged substations such as hospitals, emergency feeds, and dense downtown assets.`;
  if (q.includes("fail")) return `If ${selectedNode?.neighborhood || "this node"} fails, SmartGrid expects adjacent feeders to absorb load first, then isolate high-risk paths and recommend a lower-stress reroute.`;
  return `Current evidence combines node risk, feeder loading, CAISO demand stress, weather signals, and critical-infrastructure flags. ${selectedNode?.neighborhood || "The selected node"} is being monitored for load transfer risk.`;
}

export default function VoiceCopilot({
  selectedNode,
  riskSummary,
  liveSignals,
  latestSimulation,
  latestReroute,
  decisionLog
}: {
  selectedNode?: GridNode;
  riskSummary?: RiskSummary;
  liveSignals?: LiveSignals;
  latestSimulation?: unknown;
  latestReroute?: RerouteSimulation;
  decisionLog: DecisionLogEntry[];
}) {
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [threadId, setThreadId] = useState<string>();
  const [assistantId, setAssistantId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Grid Operator Copilot online. Ask about risk, alerts, cascade behavior, or reroute decisions." }
  ]);

  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput("");
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    let answer = "";
    try {
      const response = await queryAgent(trimmed, {
        selectedNode,
        riskSummary,
        liveSignals,
        latestSimulation,
        latestReroute,
        decisionLog: decisionLog.slice(0, 8),
        thread_id: threadId,
        assistant_id: assistantId
      });
      if (response.thread_id) setThreadId(response.thread_id);
      if (response.assistant_id) setAssistantId(response.assistant_id);
      answer = response.response || response.answer || response.text || localAnswer(trimmed, selectedNode, latestReroute);
    } catch {
      answer = localAnswer(trimmed, selectedNode, latestReroute);
    }
    setMessages((current) => [...current, { role: "assistant", text: answer }]);
    speak(answer);
  };

  const startListening = () => {
    if (typeof window === "undefined") return;
    const Recognition = (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => ask(event.results[0][0].transcript);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(input);
  };

  const suggestions = ["Why this reroute?", "What caused the alert?", "Which node is highest risk?", "What happens if this fails?", "Which critical assets are protected?"];

  return (
    <section className="overlay-panel rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="panel-title">Voice Copilot</h2>
        <button onClick={startListening} className={`rounded-full border p-2.5 transition ${listening ? "border-red-400/30 bg-red-400/12 text-red-300" : "border-white/[0.1] bg-white/[0.055] text-zinc-300 hover:border-sky-300/30 hover:text-sky-200"}`}>
          <Mic className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {suggestions.map((suggestion) => (
          <button key={suggestion} onClick={() => ask(suggestion)} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-sky-300/25 hover:text-white">
            {suggestion}
          </button>
        ))}
      </div>
      <div className="soft-scrollbar mb-3 max-h-44 space-y-2 overflow-y-auto">
        {messages.slice(-6).map((message, index) => (
          <div key={`${message.role}-${index}`} className={`rounded-2xl border p-3 text-xs leading-5 ${message.role === "user" ? "ml-8 border-sky-300/20 bg-sky-300/10 text-sky-100" : "mr-8 border-white/[0.08] bg-white/[0.04] text-zinc-100"}`}>
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-600">{message.role}</span>
            {message.text}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask the copilot..." className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-300/35 focus:ring-4 focus:ring-sky-300/10" />
        <button className="rounded-xl bg-zinc-100 px-3 text-zinc-950 transition hover:bg-white">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
