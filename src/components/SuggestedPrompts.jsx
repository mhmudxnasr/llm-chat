import { Sparkles, MessageSquare, Code, BookOpen, PenTool, ExternalLink } from 'lucide-react'
import { SUGGESTED_PROMPTS } from '../lib/chat'

export function SuggestedPrompts({ onSuggestion }) {
  const icons = [
    <BookOpen className="w-4 h-4" />,
    <PenTool className="w-4 h-4" />,
    <Code className="w-4 h-4" />
  ]

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full animate-in">
      <div className="mb-12 text-center space-y-4">
        <div className="relative inline-block px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 shadow-lg shadow-blue-500/5 animate-pulse-soft">
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.25em] flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            Core Ready
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter leading-tight drop-shadow-2xl">
          Initiate <span className="text-gradient">Lumen Explorer</span>
        </h1>
        <p className="text-zinc-500 text-sm sm:text-base font-medium max-w-md mx-auto leading-relaxed">
          The next generation AI studio. Secure, fast, and remarkably intelligent.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 w-full">
        {SUGGESTED_PROMPTS.map((prompt, i) => (
          <button
            key={prompt}
            onClick={() => onSuggestion(prompt)}
            className="group flex flex-col items-start gap-4 p-6 rounded-3xl glass-dark border-white/5 hover:border-blue-500/30 hover:bg-blue-600/[0.03] transition-all duration-300 text-left active:scale-[0.98] relative overflow-hidden"
          >
            <div className="absolute -top-4 -right-4 w-12 h-12 bg-blue-500/5 blur-2xl group-hover:bg-blue-500/20 transition-all rounded-full" />
            <div className="flex w-10 h-10 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/10 group-hover:bg-blue-500 text-zinc-400 group-hover:text-white group-hover:border-blue-500/20 transition-all duration-300 shadow-xl shadow-black/20">
              {icons[i] || <MessageSquare className="w-4 h-4" />}
            </div>
            <p className="text-[14px] leading-relaxed font-semibold text-zinc-300 group-hover:text-white transition-colors">{prompt}</p>
            <div className="mt-auto pt-4 flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
              Launch Session
              <ExternalLink className="w-3 h-3" />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-16 flex items-center gap-8 text-[10px] font-bold text-zinc-700 uppercase tracking-[0.2em] border-t border-white/5 pt-8 w-full justify-between sm:justify-center">
        <span className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity cursor-default">SYSTEM_01: ONLINE</span>
        <span className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity cursor-default">LATENCY: 12ms</span>
        <span className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity cursor-default">ENCRYPTION: AES-256</span>
      </div>
    </div>
  )
}
