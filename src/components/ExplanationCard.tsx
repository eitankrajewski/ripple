import { motion } from "framer-motion";
import { Bot, Cpu, Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { causeChain } from "../lib/explain";
import { useTwin } from "../store";

export function ExplanationBody() {
  const explanation = useTwin((s) => s.explanation);
  const explaining = useTwin((s) => s.explaining);
  const state = useTwin((s) => s.state);
  const explainWithAI = useTwin((s) => s.explainWithAI);
  const chain = causeChain(state).map((c) => c.replace(/ \(.*\)$/, ""));

  return (
    <div className="space-y-2.5 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
          <MessageSquareText className="size-3.5 text-slate-500" /> Why
        </span>
        <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
          {explanation.source === "gemini" ? <Bot className="size-3" /> : <Cpu className="size-3" />}
          {explanation.source === "gemini" ? "Gemini wording" : "Deterministic"}
        </span>
      </div>
      <div className="space-y-2.5">
        <motion.p key={explanation.headline} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-display text-[14px] leading-snug font-medium text-slate-100">
          {explanation.headline}
        </motion.p>
        {chain.length > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            {chain.map((c, i) => (
              <span key={`${c}-${i}`} className="flex items-center gap-1">
                <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10.5px] text-slate-300">{c}</span>
                {i < chain.length - 1 && <span className="text-[10px] text-slate-600">→</span>}
              </span>
            ))}
          </div>
        )}
        <p className="text-[12px] leading-relaxed text-slate-400">{explanation.recommendationReason}</p>
        <p className="text-[11.5px] leading-relaxed text-slate-500">
          <span className="font-medium text-slate-400">Trade-off: </span>
          {explanation.tradeoff}
        </p>
        <button
          onClick={explainWithAI}
          disabled={explaining}
          className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-[11px] font-medium text-indigo-100 transition hover:bg-accent/20 disabled:opacity-60"
        >
          {explaining ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          Rephrase with AI
        </button>
        <p className="text-[10px] text-slate-600">AI only rewords the numbers above. Without a Gemini key, the deterministic text stays.</p>
      </div>
    </div>
  );
}
