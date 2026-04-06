import { Copy, Check, Bot, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatTime, getUsageSummary } from '../lib/chat'

function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function MessageBubble({ message, copiedMessageId, onCopy }) {
  const isAssistant = message.role === 'assistant'
  const usage = getUsageSummary(message.usageMetadata)
  const isCopied = copiedMessageId === message.id

  return (
    <article className="animate-in group relative w-full first:mt-4 last:mb-8">
      <div 
        className={cn(
          "flex gap-4 p-5 rounded-3xl transition-all duration-300",
          isAssistant ? "bg-white/[0.02] border border-white/5" : "bg-transparent"
        )}
      >
        <div className={cn(
          "shrink-0 mt-1 flex h-9 w-9 items-center justify-center rounded-xl font-bold uppercase text-[10px] tracking-tight transition-transform group-hover:scale-105",
          isAssistant 
            ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20" 
            : "bg-white/[0.05] text-zinc-400 border border-white/10"
        )}>
          {isAssistant ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-white uppercase tracking-widest leading-none">
                {isAssistant ? 'Assistant' : 'Explorer'}
              </span>
              <span className="text-[10px] text-zinc-500 font-medium">
                {formatTime(message.createdAt)}
              </span>
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onCopy(message.id, message.content)}
                className={cn(
                  "flex items-center gap-1.5 py-1 px-2 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all",
                  isCopied 
                    ? "bg-emerald-500/10 text-emerald-400" 
                    : "text-zinc-500 hover:text-white hover:bg-white/5"
                )}
              >
                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'STAGED' : 'COPY'}</span>
              </button>
            </div>
          </div>

          <div className={cn(
            "text-[15px] leading-relaxed",
            isAssistant ? "text-zinc-100" : "text-zinc-300"
          )}>
            {isAssistant ? (
              <MarkdownRenderer content={message.content} />
            ) : (
              <p className="whitespace-pre-wrap">{message.content}</p>
            )}
          </div>

          {message.streaming && (
            <div className="mt-4 flex items-center gap-2 text-blue-400/80 animate-pulse">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <div 
                    key={i} 
                    className="w-1.5 h-1.5 rounded-full bg-current" 
                    style={{ animationDelay: `${i * 150}ms`, animationName: 'pulse' }}
                  />
                ))}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest">Streaming</span>
            </div>
          )}

          {usage && (
            <div className="mt-6 pt-4 border-t border-white/[0.03] grid grid-cols-2 sm:grid-cols-3 gap-2">
              <StatPill label="Prompt" value={usage.prompt} />
              <StatPill label="Output" value={usage.output} />
              <StatPill label="Total" value={usage.total} color="blue" />
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function StatPill({ label, value, color = 'zinc' }) {
  const colors = {
    zinc: "bg-white/[0.02] border-white/5 text-zinc-500",
    blue: "bg-blue-500/10 border-blue-500/10 text-blue-400"
  }
  
  return (
    <div className={cn(
      "flex flex-col gap-0.5 px-3 py-2 rounded-xl border transition-colors",
      colors[color]
    )}>
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-80">{label}</span>
      <span className="text-xs font-bold font-mono">{typeof value === 'number' ? value.toLocaleString() : value}</span>
    </div>
  )
}

function MarkdownRenderer({ content }) {
  if (!content) return null

  return (
    <div className="markdown-body prose prose-invert prose-blue max-w-none prose-sm sm:prose-base">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => (
            <a {...props} className="text-blue-400 underline decoration-blue-400/30 underline-offset-4 hover:decoration-blue-400 transition-all font-semibold" target="_blank" rel="noreferrer" />
          ),
          code: ({ inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '')
            return !inline ? (
              <div className="relative group/code my-6 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                {match && (
                  <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{match[1]}</span>
                  </div>
                )}
                <pre className="!m-0 !p-4 !bg-black/40 overflow-x-auto text-[13.5px] leading-relaxed">
                  <code {...props} className={className}>
                    {children}
                  </code>
                </pre>
              </div>
            ) : (
              <code className="bg-white/10 px-1.5 py-0.5 rounded-md font-mono text-[0.85em] text-blue-200" {...props}>
                {children}
              </code>
            )
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
