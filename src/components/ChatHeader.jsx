import { Menu, Shield, Settings } from 'lucide-react'
import { MODELS } from '../lib/chat'

function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function ChatHeader({ 
  activeConversation, 
  setIsOpen, 
  currentApiKey, 
  handleModelChange, 
  isStreaming,
  onOpenSettings
}) {
  return (
    <header className="sticky top-0 z-20 glass-dark border-b border-white/5 py-3 px-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              {activeConversation?.title || 'New Session'}
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <select
                value={activeConversation?.model || MODELS[0].value}
                disabled={isStreaming}
                onChange={(e) => handleModelChange(e.target.value)}
                className="bg-transparent border-none p-0 text-[10px] text-zinc-500 font-bold uppercase tracking-wider outline-none cursor-pointer hover:text-zinc-300 transition-colors"
              >
                {MODELS.map(m => (
                  <option key={m.value} value={m.value} className="bg-zinc-900 border-none">{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={cn(
            "hidden sm:flex items-center gap-2 py-1.5 px-3 rounded-full border text-[11px] font-bold tracking-tight transition-all duration-300",
            currentApiKey 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-amber-500/10 border-amber-500/20 text-amber-500"
          )}>
            <Shield className="w-3.5 h-3.5" />
            <span>{currentApiKey ? 'SECURE' : 'ACTION REQUIRED'}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenSettings}
              className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
