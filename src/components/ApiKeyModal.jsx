import { X, Shield, Eye, EyeOff, Save, Trash2, Info } from 'lucide-react'
import { useState } from 'react'

export function ApiKeyModal({ 
  isOpen, 
  onClose, 
  apiKeyInput, 
  setApiKeyInput, 
  onSave, 
  onClear, 
  statusMessage 
}) {
  const [showKey, setShowKey] = useState(false)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-xl bg-black/60 transition-opacity duration-300">
      <div 
        className="absolute inset-0 bg-transparent" 
        onClick={onClose} 
      />
      
      <div className="relative w-full max-w-md glass rounded-[2.5rem] shadow-2xl p-8 overflow-hidden animate-in">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 blur-[80px] rounded-full" />

        <div className="flex items-center justify-between mb-8 pr-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-lg shadow-blue-500/10">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight leading-none mb-1">Identity & Security</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Access Configuration</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
            <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-zinc-400">
              Your Google AI API key is stored locally in your browser and never sent to our servers. Only communication with Google APIs is encrypted.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Key Management</label>
            <div className="relative group">
              <input
                type={showKey ? "text" : "password"}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AI_CORE_ENCRYPTION_KEY..."
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-blue-500/50 focus:bg-white/[0.05] transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-white transition-colors"
                title={showKey ? "Mask ID" : "Reveal ID"}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {statusMessage && (
            <div className="px-4 py-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-[10px] font-bold text-blue-400 uppercase tracking-widest text-center animate-pulse">
              {statusMessage}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-4">
            <button
              onClick={() => {
                onClear()
                onClose()
              }}
              className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-white/[0.02] hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/20 text-zinc-400 hover:text-rose-400 text-xs font-bold uppercase tracking-widest transition-all duration-300"
            >
              <Trash2 className="w-4 h-4" />
              Reset Access
            </button>
            <button
              onClick={() => {
                onSave()
                onClose()
              }}
              className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-white text-zinc-950 hover:bg-zinc-100 text-xs font-bold uppercase tracking-widest transition-all duration-300 active:scale-[0.98] shadow-lg shadow-white/5"
            >
              <Save className="w-4 h-4" />
              Verify Auth
            </button>
          </div>
        </div>
        
        <p className="mt-8 text-center text-[9px] text-zinc-600 font-bold uppercase tracking-[0.3em]">
          Lumen Security Protocol &bull; v1.02
        </p>
      </div>
    </div>
  )
}
