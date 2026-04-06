import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  MODELS,
  STORAGE_KEYS,
  SUGGESTED_PROMPTS,
  SYSTEM_PROMPT,
  buildContents,
  createConversation,
  createMessage,
  deriveConversationTitle,
  estimateConversationTokens,
  estimateTokens,
  formatSidebarTime,
  formatTime,
  getLastPreview,
  getUsageSummary,
  loadStoredConversations,
} from './lib/chat'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY?.trim()
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null

function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}

function App() {
  const [conversations, setConversations] = useState(() => loadStoredConversations())
  const [selectedConversationId, setSelectedConversationId] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.localStorage.getItem(STORAGE_KEYS.selectedConversation) ?? ''
  })
  const [draft, setDraft] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState('')
  const [statusMessage, setStatusMessage] = useState(
    API_KEY ? '' : 'Add your Gemini API key to .env to start chatting.',
  )

  const composerRef = useRef(null)
  const messagesEndRef = useRef(null)

  const deferredDraft = useDeferredValue(draft)
  const activeConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) ??
    conversations[0]
  const conversationTokenEstimate = estimateConversationTokens(
    activeConversation?.messages ?? [],
  )
  const draftTokenEstimate = estimateTokens(deferredDraft)
  const lastUsage = getUsageSummary(activeConversation?.tokenUsage)
  const lastMessageContent = activeConversation?.messages.at(-1)?.content ?? ''

  function replaceConversation(conversationId, updater) {
    setConversations((currentConversations) => {
      const currentConversation = currentConversations.find(
        (conversation) => conversation.id === conversationId,
      )

      if (!currentConversation) {
        return currentConversations
      }

      const nextConversation = updater(currentConversation)

      return [
        nextConversation,
        ...currentConversations.filter(
          (conversation) => conversation.id !== conversationId,
        ),
      ]
    })
  }

  const scrollToLatest = useEffectEvent((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
  })

  useEffect(() => {
    if (!conversations.length) {
      const freshConversation = createConversation()
      setConversations([freshConversation])
      setSelectedConversationId(freshConversation.id)
      return
    }

    if (!activeConversation) {
      setSelectedConversationId(conversations[0].id)
    }
  }, [activeConversation, conversations])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      STORAGE_KEYS.conversations,
      JSON.stringify(conversations),
    )
  }, [conversations])

  useEffect(() => {
    if (typeof window === 'undefined' || !selectedConversationId) {
      return
    }

    window.localStorage.setItem(
      STORAGE_KEYS.selectedConversation,
      selectedConversationId,
    )
  }, [selectedConversationId])

  useEffect(() => {
    if (!composerRef.current) {
      return
    }

    composerRef.current.style.height = '0px'
    composerRef.current.style.height = `${Math.min(
      composerRef.current.scrollHeight,
      240,
    )}px`
  }, [draft])

  useEffect(() => {
    scrollToLatest(isStreaming ? 'auto' : 'smooth')
  }, [
    activeConversation?.id,
    activeConversation?.messages.length,
    lastMessageContent,
    isStreaming,
  ])

  function handleNewConversation() {
    const freshConversation = createConversation(activeConversation?.model)

    startTransition(() => {
      setConversations((currentConversations) => [
        freshConversation,
        ...currentConversations,
      ])
    })
    setSelectedConversationId(freshConversation.id)
    setDraft('')
    setSidebarOpen(false)
  }

  function handleModelChange(nextModel) {
    if (!activeConversation) {
      return
    }

    replaceConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      model: nextModel,
      updatedAt: Date.now(),
    }))
  }

  async function handleCopy(messageId, value) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedMessageId(messageId)
      window.setTimeout(() => {
        setCopiedMessageId((currentValue) =>
          currentValue === messageId ? '' : currentValue,
        )
      }, 1600)
    } catch {
      setStatusMessage('Copy failed in this browser session. Please try again.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!activeConversation || isStreaming) {
      return
    }

    const nextPrompt = draft.trim()

    if (!nextPrompt) {
      return
    }

    if (!genAI) {
      setStatusMessage('The selected model is unavailable because the API key is missing.')
      return
    }

    const conversationId = activeConversation.id
    const selectedModel = activeConversation.model
    const userMessage = createMessage('user', nextPrompt)
    const assistantMessage = createMessage('assistant', '', { streaming: true })
    const nextMessages = [...activeConversation.messages, userMessage, assistantMessage]

    setDraft('')
    setIsStreaming(true)
    setSidebarOpen(false)
    setStatusMessage('')

    startTransition(() => {
      replaceConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: nextMessages,
        title: deriveConversationTitle(nextMessages),
        updatedAt: Date.now(),
      }))
    })

    try {
      const model = genAI.getGenerativeModel({
        model: selectedModel,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          temperature: 0.8,
          topP: 0.92,
          maxOutputTokens: 4096,
        },
      })

      const streamResult = await model.generateContentStream({
        contents: buildContents([...activeConversation.messages, userMessage]),
      })

      let streamedText = ''

      for await (const chunk of streamResult.stream) {
        streamedText += chunk.text()

        startTransition(() => {
          replaceConversation(conversationId, (conversation) => ({
            ...conversation,
            messages: conversation.messages.map((message) =>
              message.id === assistantMessage.id
                ? { ...message, content: streamedText, streaming: true }
                : message,
            ),
            title: deriveConversationTitle(conversation.messages),
            updatedAt: Date.now(),
          }))
        })
      }

      const completedResponse = await streamResult.response
      const finalizedText = streamedText || completedResponse.text()

      startTransition(() => {
        replaceConversation(conversationId, (conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === assistantMessage.id
              ? {
                  ...message,
                  content:
                    finalizedText || 'I could not generate a response. Please try again.',
                  streaming: false,
                  usageMetadata: completedResponse.usageMetadata ?? null,
                }
              : message,
          ),
          title: deriveConversationTitle(conversation.messages),
          tokenUsage: completedResponse.usageMetadata ?? null,
          updatedAt: Date.now(),
        }))
      })
    } catch (error) {
      const friendlyMessage =
        error instanceof Error
          ? error.message
          : 'The selected model returned an unexpected error. Please retry.'

      startTransition(() => {
        replaceConversation(conversationId, (conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === assistantMessage.id
              ? {
                  ...message,
                  content: `I ran into an error while contacting the selected model.\n\n${friendlyMessage}`,
                  streaming: false,
                  isError: true,
                }
              : message,
          ),
          updatedAt: Date.now(),
        }))
      })
      setStatusMessage('The last request failed. You can edit the prompt and try again.')
    } finally {
      setIsStreaming(false)
    }
  }

  function handleSuggestion(prompt) {
    setDraft(prompt)
    composerRef.current?.focus()
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSubmit(event)
    }
  }

  return (
    <div className="min-h-screen bg-void text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(8,15,24,0.92),rgba(4,7,11,1))]" />
        <div className="absolute left-[-12rem] top-[-10rem] h-80 w-80 animate-float rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-8rem] h-72 w-72 animate-float rounded-full bg-sky-400/10 blur-3xl" />
      </div>

      <div className="relative flex min-h-screen">
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className={cn(
            'fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition lg:hidden',
            sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        />

        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-[21rem] max-w-[86vw] flex-col border-r border-white/10 bg-slate-950/90 px-5 py-5 shadow-panel backdrop-blur-xl transition-transform duration-300 lg:static lg:max-w-none lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-heading text-lg font-semibold tracking-tight text-white">
                Lumen Chat
              </p>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                Google AI Workspace
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:border-white/20 hover:text-white lg:hidden"
            >
              <CloseIcon />
            </button>
          </div>

          <button
            type="button"
            onClick={handleNewConversation}
            disabled={isStreaming}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition hover:border-accent/50 hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon />
            New chat
          </button>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
              History
            </p>
            <p className="text-xs text-slate-500">{conversations.length} threads</p>
          </div>

          <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
            {conversations.map((conversation) => {
              const selected = conversation.id === activeConversation?.id
              const modelLabel =
                MODELS.find((model) => model.value === conversation.model)?.shortLabel ??
                conversation.model

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => {
                    setSelectedConversationId(conversation.id)
                    setSidebarOpen(false)
                  }}
                  className={cn(
                    'w-full rounded-3xl border px-4 py-4 text-left transition',
                    selected
                      ? 'border-accent/30 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05]',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {conversation.title}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                        {getLastPreview(conversation.messages)}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                      {modelLabel}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-slate-500">
                    <span>{formatSidebarTime(conversation.updatedAt)}</span>
                    <span>{conversation.messages.length} msgs</span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
              System prompt
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{SYSTEM_PROMPT}</p>
          </div>
        </aside>

        <main className="relative flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-10">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-white/20 hover:text-white lg:hidden"
                  >
                    <MenuIcon />
                  </button>
                  <div>
                    <p className="font-heading text-2xl font-semibold tracking-tight text-white">
                      Premium AI chat
                    </p>
                    <p className="text-sm text-slate-400">
                      Streaming answers, markdown rendering, and local conversation memory.
                    </p>
                  </div>
                </div>
                <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300 md:flex">
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      API_KEY
                        ? 'bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.85)]'
                        : 'bg-amber-300 shadow-[0_0_18px_rgba(253,224,71,0.75)]',
                    )}
                  />
                  {API_KEY ? 'Ready for Google AI' : 'API key required'}
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <label className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span className="text-xs uppercase tracking-[0.28em] text-slate-500">
                    Model
                  </span>
                  <select
                    value={activeConversation?.model ?? MODELS[0].value}
                    disabled={isStreaming}
                    onChange={(event) => handleModelChange(event.target.value)}
                    className="mt-2 w-full bg-transparent text-base font-semibold text-white outline-none"
                  >
                    {MODELS.map((model) => (
                      <option
                        key={model.value}
                        value={model.value}
                        className="bg-slate-950 text-white"
                      >
                        {model.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                    Context
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {conversationTokenEstimate.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">Approx prompt tokens in this thread</p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                    Last response
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {lastUsage ? lastUsage.total.toLocaleString() : '—'}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {lastUsage
                      ? `${lastUsage.prompt.toLocaleString()} prompt • ${lastUsage.output.toLocaleString()} output`
                      : 'Token metrics appear after a completed response'}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <section className="flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-10">
              {activeConversation?.messages.length ? (
                <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4">
                  {activeConversation.messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      copiedMessageId={copiedMessageId}
                      onCopy={handleCopy}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-4xl flex-1 items-center">
                  <div className="w-full overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-8 shadow-panel">
                    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-accent">
                          <span className="h-2 w-2 rounded-full bg-accent animate-pulse-soft" />
                          Live streaming
                        </div>
                        <h1 className="mt-6 font-heading text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                          Ask bigger questions with a cleaner interface.
                        </h1>
                        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                          Start a new conversation with markdown output, persistent history,
                          quick model switching, and token visibility built in.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                          Prompt starters
                        </p>
                        {SUGGESTED_PROMPTS.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => handleSuggestion(prompt)}
                            className="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-left text-sm leading-6 text-slate-300 transition hover:border-accent/30 hover:bg-white/[0.05] hover:text-white"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <footer className="border-t border-white/10 bg-slate-950/80 backdrop-blur-xl">
            <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-10">
              <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
                <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-panel">
                  <textarea
                    ref={composerRef}
                    value={draft}
                    disabled={isStreaming}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Send a message..."
                    rows={1}
                    className="max-h-60 min-h-[104px] w-full resize-none bg-transparent px-5 py-5 text-base leading-7 text-white outline-none placeholder:text-slate-500"
                  />

                  <div className="flex flex-col gap-4 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <StatPill label="Draft" value={draftTokenEstimate} />
                      <StatPill label="Context" value={conversationTokenEstimate} />
                      <StatPill
                        label="Model"
                        value={activeConversation?.model ?? MODELS[0].value}
                      />
                    </div>

                    <div className="flex flex-col items-start gap-3 sm:items-end">
                      {statusMessage ? (
                        <p className="text-sm text-amber-200">{statusMessage}</p>
                      ) : (
                        <p className="text-sm text-slate-400">
                          Press Enter to send, Shift + Enter for a new line.
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={!draft.trim() || isStreaming || !API_KEY}
                        className="inline-flex min-w-[8.5rem] items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                      >
                        {isStreaming ? (
                          <>
                            <ThinkingDots />
                            Thinking
                          </>
                        ) : (
                          <>
                            Send message
                            <SendIcon />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}

function MessageBubble({ copiedMessageId, message, onCopy }) {
  const assistantMessage = message.role === 'assistant'
  const usage = getUsageSummary(message.usageMetadata)

  return (
    <article
      className={cn(
        'animate-fade-slide',
        assistantMessage ? 'self-start' : 'self-end',
      )}
    >
      <div
        className={cn(
          'flex items-start gap-3',
          assistantMessage ? '' : 'flex-row-reverse',
        )}
      >
        <div
          className={cn(
            'mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold uppercase tracking-[0.24em]',
            assistantMessage
              ? 'border-accent/25 bg-accent/10 text-accent'
              : 'border-white/10 bg-white/[0.06] text-white',
          )}
        >
          {assistantMessage ? 'AI' : 'You'}
        </div>

        <div
          className={cn(
            'group max-w-3xl rounded-[1.75rem] border px-5 py-4 shadow-panel',
            assistantMessage
              ? 'border-white/10 bg-slate-950/70'
              : 'border-accent/20 bg-gradient-to-br from-slate-900/90 to-slate-950/90',
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">
                {assistantMessage ? 'Assistant' : 'You'}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                {formatTime(message.createdAt)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onCopy(message.id, message.content)}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              {copiedMessageId === message.id ? 'Copied' : 'Copy'}
            </button>
          </div>

          {assistantMessage ? (
            <MarkdownMessage content={message.content} />
          ) : (
            <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-100">
              {message.content}
            </p>
          )}

          {message.streaming ? (
            <div className="mt-4 flex items-center gap-3 text-sm text-slate-400">
              <ThinkingDots />
              Streaming response
            </div>
          ) : null}

          {usage ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
              <span className="rounded-full border border-white/10 px-2.5 py-1">
                Prompt {usage.prompt.toLocaleString()}
              </span>
              <span className="rounded-full border border-white/10 px-2.5 py-1">
                Output {usage.output.toLocaleString()}
              </span>
              <span className="rounded-full border border-white/10 px-2.5 py-1">
                Total {usage.total.toLocaleString()}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function MarkdownMessage({ content }) {
  if (!content) {
    return <p className="text-[15px] leading-7 text-slate-400">Thinking…</p>
  }

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent underline decoration-accent/40 underline-offset-4"
            />
          ),
          code: ({ children, className, inline, ...props }) => {

            return inline ? (
              <code
                {...props}
                className="rounded-lg border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[0.92em] text-cyan-100"
              >
                {children}
              </code>
            ) : (
              <code {...props} className={className}>
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-[#07111a] p-4 text-sm text-slate-100">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-slate-300">
      <span className="text-slate-500">{label}</span> {value}
    </div>
  )
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1.5">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-2 w-2 animate-pulse-soft rounded-full bg-current"
          style={{ animationDelay: `${index * 160}ms` }}
        />
      ))}
    </span>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M22 2L11 13" strokeLinecap="round" />
      <path d="M22 2L15 22l-4-9-9-4 20-7Z" strokeLinejoin="round" />
    </svg>
  )
}

export default App
