import { Plus, MessageSquare, Clock, ChevronLeft } from 'lucide-react'
import { 
  MODELS, 
  formatSidebarTime
} from '../lib/chat'

function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function Sidebar({ 
  conversations, 
  selectedConversationId, 
  setSelectedConversationId, 
  handleNewConversation, 
  isStreaming, 
  isOpen, 
  setIsOpen 
}) {
  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setIsOpen(false)}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-void border-r border-white/5 transition-transform duration-300 lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between p-4 pt-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white leading-none">Lumen</h1>
              <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">AI Studio</span>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 mt-4">
          <button
            onClick={handleNewConversation}
            disabled={isStreaming}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white/[0.03] hover:bg-white/[0.08] text-white border border-white/10 rounded-xl transition-all duration-200 group active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-semibold">New Session</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 mt-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                History
              </span>
              <span className="text-[10px] py-0.5 px-1.5 rounded-full bg-white/5 text-zinc-400 font-medium">
                {conversations.length}
              </span>
            </div>
            
            <div className="space-y-1">
              {conversations.map((conv) => {
                const isActive = conv.id === selectedConversationId
                const model = MODELS.find(m => m.value === conv.model)
                
                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setSelectedConversationId(conv.id)
                      setIsOpen(false)
                    }}
                    className={cn(
                      'w-full flex flex-col items-start gap-1 p-3 rounded-xl transition-all duration-200 border group',
                      isActive 
                        ? 'bg-blue-600/[0.08] border-blue-500/20 text-white' 
                        : 'border-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-100'
                    )}
                  >
                    <div className="w-full flex items-center justify-between gap-2 overflow-hidden">
                      <span className={cn(
                        "text-sm font-medium truncate",
                        isActive ? "text-blue-200" : ""
                      )}>
                        {conv.title}
                      </span>
                      {model && (
                        <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 border border-white/5 font-bold uppercase tracking-tighter text-zinc-500 group-hover:text-zinc-400">
                          {model.shortLabel}
                        </span>
                      )}
                    </div>
                    <div className="w-full flex items-center justify-between text-[10px] text-zinc-500">
                      <span>{formatSidebarTime(conv.updatedAt)}</span>
                      <span>{conv.messages.length} messages</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-800/20 to-zinc-900/40 border border-white/5">
            <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Workspace Info</span>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                L
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-200 truncate">Lumen Explorer</p>
                <p className="text-[10px] text-zinc-500 truncate">v0.0.1 Beta</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
