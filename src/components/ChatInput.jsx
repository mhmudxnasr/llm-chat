import { Send, Clock, ShieldCheck, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react'
import { useRef, useEffect } from 'react'

function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function ChatInput({ 
  handleSubmit, 
  draft, 
  setDraft, 
  isStreaming, 
  currentApiKey, 
  statusMessage,
  draftTokenEstimate,
  conversationTokenEstimate
}) {
  const composerRef = useRef(null)

  useEffect(() => {
    if (!composerRef.current) return
    composerRef.current.style.height = '0px'
    composerRef.current.style.height = `${Math.min(composerRef.current.scrollHeight, 240)}px`
  }, [draft])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const isReady = draft.trim() && !isStreaming && currentApiKey

  return (
    <footer className="sticky bottom-0 bg-gradient-to-t from-void via-void to-transparent pt-12 pb-4 px-4 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 relative">
          
          {/* Main Input Plate */}
          <div className="glass rounded-[2rem] p-2 flex flex-col gap-2 shadow-2xl transition-all duration-500 focus-within:shadow-blue-500/5 focus-within:border-white/10 group">
            <textarea
              ref={composerRef}
              value={draft}
              disabled={isStreaming}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              rows={1}
              className="max-h-60 min-h-[80px] w-full resize-none bg-transparent px-5 py-4 text-[15px] leading-relaxed text-white outline-none placeholder:text-zinc-500 focus:placeholder:text-zinc-400 transition-all"
            />
            
            <div className="flex flex-wrap items-center justify-between px-3 pb-2 gap-3">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <InputStat icon={<Sparkles className="w-3 h-3" />} label="DRAFT" value={draftTokenEstimate} />
                <div className="w-1 h-1 rounded-full bg-zinc-700" />
                <InputStat icon={<Clock className="w-3 h-3" />} label="CONTEXT" value={conversationTokenEstimate} />
              </div>

              <div className="flex items-center gap-2">
                {statusMessage && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 rounded-full animate-pulse">
                    <AlertCircle className="w-3 h-3" />
                    {statusMessage}
                  </span>
                )}
                
                <button
                  type="submit"
                  disabled={!isReady}
                  className={cn(
                    "relative flex h-10 items-center justify-center gap-2 rounded-2xl px-5 text-xs font-bold uppercase tracking-widest transition-all duration-300",
                    isReady 
                      ? "bg-white text-zinc-950 hover:bg-zinc-100 hover:scale-[1.02] shadow-xl shadow-white/5" 
                      : "bg-white/5 text-zinc-600 cursor-not-allowed grayscale"
                  )}
                >
                  {isStreaming ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="w-1 h-1 rounded-full bg-current transition-opacity duration-300" style={{ animation: `pulse 1s ${i * 0.15}s infinite` }} />
                        ))}
                      </div>
                      THINKING
                    </div>
                  ) : (
                    <>
                      <span>TRANSMIT</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Model Status Bar */}
          <div className="flex items-center justify-center gap-6 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600 px-4">
            <span className="flex items-center gap-1.5">
              {currentApiKey ? (
                <ShieldCheck className="w-3 h-3 text-emerald-500/60" />
              ) : (
                <ShieldAlert className="w-3 h-3 text-amber-500/60" />
              )}
              {currentApiKey ? 'Identity Verified' : 'Access Denied'}
            </span>
            <span className="text-zinc-800">|</span>
            <span className="hover:text-zinc-500 transition-colors cursor-default">LLM Core v3.0</span>
          </div>
        </form>
        
        <p className="mt-4 text-center text-[9px] text-zinc-600 uppercase tracking-widest leading-loose">
          Secure end-to-end communication verified &bull; AI models may generate inaccurate results
        </p>
      </div>
    </footer>
  )
}

function InputStat({ icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-zinc-500 group-hover:text-zinc-400 transition-colors">
      <span className="opacity-60">{icon}</span>
      <span className="text-[10px] font-bold tracking-widest">{label}</span>
      <span className="text-[10px] font-mono text-zinc-400 font-bold">{value}</span>
    </div>
  )
}
