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

const ENV_API_KEY = import.meta.env.VITE_GEMINI_API_KEY?.trim() ?? ''

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
  const [apiKeyInput, setApiKeyInput] = useState(() => {
    if (typeof window === 'undefined') {
      return ENV_API_KEY
    }

    return window.localStorage.getItem(STORAGE_KEYS.apiKey) ?? ENV_API_KEY
  })
  const [statusMessage, setStatusMessage] = useState('')

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
  const currentApiKey = apiKeyInput.trim()

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (currentApiKey) {
      window.localStorage.setItem(STORAGE_KEYS.apiKey, currentApiKey)
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.apiKey)
    }
  }, [currentApiKey])

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

    if (!currentApiKey) {
      setStatusMessage('Add your Google AI API key below to start chatting.')
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
      const genAI = new GoogleGenerativeAI(currentApiKey)
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
    <div className="min-h-screen bg-void text-zinc-100">
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
            'fixed inset-y-0 left-0 z-40 flex w-[16rem] max-w-[86vw] flex-col border-r border-white/5 bg-ink px-3 py-3 transition-transform duration-300 lg:static lg:max-w-none lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between gap-3 px-2 py-1">
            <div>
              <p className="font-heading text-base font-semibold tracking-tight text-white">
                Lumen Chat
              </p>
              <p className="text-[11px] text-zinc-500">
                AI workspace
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white lg:hidden"
            >
              <CloseIcon />
            </button>
          </div>

          <button
            type="button"
            onClick={handleNewConversation}
            disabled={isStreaming}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#2a2a2a] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#313131] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon />
            New chat
          </button>

          <div className="mt-5 flex items-center justify-between px-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
              Recent
            </p>
            <p className="text-[11px] text-zinc-500">{conversations.length}</p>
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
                    'w-full rounded-xl px-3 py-3 text-left transition',
                    selected
                      ? 'bg-[#2a2a2a]'
                      : 'hover:bg-[#242424]',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium text-zinc-100">
                        {conversation.title}
                      </p>
                      <span className="rounded-md bg-[#343434] px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                        {modelLabel}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                      {getLastPreview(conversation.messages)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-600">
                    <span>{formatSidebarTime(conversation.updatedAt)}</span>
                    <span>{conversation.messages.length} msgs</span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-4 rounded-xl bg-[#202020] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              System
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{SYSTEM_PROMPT}</p>
          </div>
        </aside>

        <main className="relative flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/5 bg-void/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-white/5 hover:text-white lg:hidden"
                >
                  <MenuIcon />
                </button>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-heading text-base font-medium text-white">
                      {activeConversation?.title || 'New chat'}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {MODELS.find((model) => model.value === activeConversation?.model)?.label}
                    </p>
                  </div>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-full bg-[#2b2b2b] px-3 py-2 text-sm text-zinc-300 md:flex">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      currentApiKey
                        ? 'bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.85)]'
                        : 'bg-amber-300 shadow-[0_0_18px_rgba(253,224,71,0.75)]',
                    )}
                  />
                  {currentApiKey ? 'Ready for Google AI' : 'API key required'}
              </div>
            </div>
          </header>

          <section className="flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-3 sm:px-6">
              {activeConversation?.messages.length ? (
                <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-1 py-4">
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
                <div className="mx-auto flex w-full max-w-3xl flex-1 items-center py-12">
                  <div className="w-full">
                    <div className="text-center">
                      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2a2a2a] text-xl font-semibold text-white">
                        AI
                      </div>
                      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                        How can I help?
                      </h1>
                      <p className="mt-3 text-sm text-zinc-400">
                        Choose a model and start chatting.
                      </p>
                    </div>

                    <div className="mt-10 grid gap-3 md:grid-cols-2">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => handleSuggestion(prompt)}
                          className="rounded-2xl border border-white/10 bg-[#262626] px-4 py-4 text-left text-sm leading-6 text-zinc-300 transition hover:bg-[#2e2e2e] hover:text-white"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <footer className="sticky bottom-0 bg-gradient-to-t from-void via-void to-transparent pt-4">
            <div className="mx-auto w-full max-w-5xl px-4 pb-4 sm:px-6">
              <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
                <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#2f2f2f] shadow-panel">
                  <textarea
                    ref={composerRef}
                    value={draft}
                    disabled={isStreaming}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Send a message..."
                    rows={1}
                    className="max-h-60 min-h-[84px] w-full resize-none bg-transparent px-5 py-4 text-[15px] leading-7 text-white outline-none placeholder:text-zinc-500"
                  />

                  <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <label className="rounded-full bg-[#252525] px-3 py-1.5 text-xs text-zinc-300">
                        <select
                          value={activeConversation?.model ?? MODELS[0].value}
                          disabled={isStreaming}
                          onChange={(event) => handleModelChange(event.target.value)}
                          className="bg-transparent outline-none"
                        >
                          {MODELS.map((model) => (
                            <option
                              key={model.value}
                              value={model.value}
                              className="bg-[#252525] text-white"
                            >
                              {model.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <StatPill label="Draft" value={draftTokenEstimate} />
                      <StatPill label="Context" value={conversationTokenEstimate} />
                      {lastUsage ? <StatPill label="Last" value={lastUsage.total} /> : null}
                    </div>

                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      {statusMessage ? (
                        <p className="text-sm text-amber-200">{statusMessage}</p>
                      ) : (
                        <p className="text-xs text-zinc-500">
                          Press Enter to send, Shift + Enter for a new line.
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={!draft.trim() || isStreaming || !currentApiKey}
                        className="inline-flex min-w-[8rem] items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
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
                <div className="mt-3 rounded-2xl border border-white/10 bg-[#262626] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(event) => setApiKeyInput(event.target.value)}
                      placeholder="Paste your Google AI API key"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={() => setStatusMessage('API key saved locally in this browser.')}
                      className="rounded-xl bg-[#343434] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#3d3d3d]"
                    >
                      Save locally
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setApiKeyInput('')
                        setStatusMessage('Stored API key cleared from this browser.')
                      }}
                      className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-center text-[11px] text-zinc-500">
                  Responses are generated by Google AI models and may be inaccurate.
                </p>
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
    <article className="animate-fade-slide">
      <div
        className={cn(
          'flex gap-4 rounded-3xl px-3 py-5 sm:px-4',
          assistantMessage ? 'bg-transparent' : 'bg-[#2a2a2a]',
        )}
      >
        <div
          className={cn(
            'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase',
            assistantMessage
              ? 'bg-accent text-white'
              : 'bg-zinc-700 text-white',
          )}
        >
          {assistantMessage ? 'A' : 'Y'}
        </div>

        <div className="group min-w-0 flex-1">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">
                {assistantMessage ? 'Assistant' : 'You'}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {formatTime(message.createdAt)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onCopy(message.id, message.content)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              {copiedMessageId === message.id ? 'Copied' : 'Copy'}
            </button>
          </div>

          {assistantMessage ? (
            <MarkdownMessage content={message.content} />
          ) : (
            <p className="whitespace-pre-wrap text-[15px] leading-7 text-zinc-100">
              {message.content}
            </p>
          )}

          {message.streaming ? (
            <div className="mt-4 flex items-center gap-3 text-sm text-zinc-400">
              <ThinkingDots />
              Streaming response
            </div>
          ) : null}

          {usage ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
              <span className="rounded-full bg-[#252525] px-2.5 py-1">
                Prompt {usage.prompt.toLocaleString()}
              </span>
              <span className="rounded-full bg-[#252525] px-2.5 py-1">
                Output {usage.output.toLocaleString()}
              </span>
              <span className="rounded-full bg-[#252525] px-2.5 py-1">
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
              className="font-medium text-[#7dd3fc] underline decoration-[#7dd3fc]/40 underline-offset-4"
            />
          ),
          code: ({ children, className, inline, ...props }) => {
            return inline ? (
              <code
                {...props}
                className="rounded-md bg-[#2b2b2b] px-1.5 py-0.5 text-[0.92em] text-zinc-100"
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
            <pre className="overflow-x-auto rounded-2xl border border-white/5 bg-[#1a1a1a] p-4 text-sm text-zinc-100">
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
    <div className="rounded-full bg-[#252525] px-3 py-1.5 text-xs text-zinc-300">
      <span className="text-zinc-500">{label}</span> {value}
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
