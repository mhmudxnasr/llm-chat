import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Components
import { Sidebar } from './components/Sidebar'
import { ChatHeader } from './components/ChatHeader'
import { MessageBubble } from './components/MessageBubble'
import { ChatInput } from './components/ChatInput'
import { ApiKeyModal } from './components/ApiKeyModal'
import { SuggestedPrompts } from './components/SuggestedPrompts'

import {
  MODELS,
  STORAGE_KEYS,
  SYSTEM_PROMPT,
  buildRequestContents,
  createConversation,
  createMessage,
  deriveConversationTitle,
  estimateConversationTokens,
  estimateTokens,
  loadStoredConversations,
  supportsSystemInstruction,
} from './lib/chat'

const ENV_API_KEY = import.meta.env.VITE_GEMINI_API_KEY?.trim() ?? ''

export default function App() {
  const [conversations, setConversations] = useState(() => loadStoredConversations())
  const [selectedConversationId, setSelectedConversationId] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(STORAGE_KEYS.selectedConversation) ?? ''
  })
  const [draft, setDraft] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState(() => {
    if (typeof window === 'undefined') return ENV_API_KEY
    return window.localStorage.getItem(STORAGE_KEYS.apiKey) ?? ENV_API_KEY
  })
  const [statusMessage, setStatusMessage] = useState('')

  const messagesEndRef = useRef(null)

  const deferredDraft = useDeferredValue(draft)
  const activeConversation =
    conversations.find((c) => c.id === selectedConversationId) ?? conversations[0]
  
  const conversationTokenEstimate = estimateConversationTokens(activeConversation?.messages ?? [])
  const draftTokenEstimate = estimateTokens(deferredDraft)
  const currentApiKey = apiKeyInput.trim()

  function replaceConversation(id, updater) {
    setConversations((current) => {
      const target = current.find((c) => c.id === id)
      if (!target) return current
      const next = updater(target)
      return [next, ...current.filter((c) => c.id !== id)]
    })
  }

  const scrollToLatest = useEffectEvent((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
  })

  useEffect(() => {
    if (!conversations.length) {
      const fresh = createConversation()
      setConversations([fresh])
      setSelectedConversationId(fresh.id)
      return
    }
    if (!activeConversation) setSelectedConversationId(conversations[0].id)
  }, [activeConversation, conversations])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(conversations))
  }, [conversations])

  useEffect(() => {
    if (typeof window === 'undefined' || !selectedConversationId) return
    window.localStorage.setItem(STORAGE_KEYS.selectedConversation, selectedConversationId)
  }, [selectedConversationId])

  useEffect(() => {
    scrollToLatest(isStreaming ? 'auto' : 'smooth')
  }, [activeConversation?.id, activeConversation?.messages.length, isStreaming])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (currentApiKey) window.localStorage.setItem(STORAGE_KEYS.apiKey, currentApiKey)
    else window.localStorage.removeItem(STORAGE_KEYS.apiKey)
  }, [currentApiKey])

  function handleNewConversation() {
    const fresh = createConversation(activeConversation?.model)
    startTransition(() => {
      setConversations((current) => [fresh, ...current])
    })
    setSelectedConversationId(fresh.id)
    setDraft('')
    setSidebarOpen(false)
  }

  function handleModelChange(nextModel) {
    if (!activeConversation) return
    replaceConversation(activeConversation.id, (c) => ({
      ...c,
      model: nextModel,
      updatedAt: Date.now(),
    }))
  }

  async function handleCopy(messageId, value) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedMessageId(messageId)
      window.setTimeout(() => setCopiedMessageId((id) => (id === messageId ? '' : id)), 1600)
    } catch {
      setStatusMessage('Copy failed.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!activeConversation || isStreaming) return

    const nextPrompt = draft.trim()
    if (!nextPrompt) return
    if (!currentApiKey) {
      setSettingsOpen(true)
      setStatusMessage('API Key Required')
      return
    }

    const conversationId = activeConversation.id
    const selectedModel = activeConversation.model
    const userMsg = createMessage('user', nextPrompt)
    const assistantMsg = createMessage('assistant', '', { streaming: true })
    const nextMsgs = [...activeConversation.messages, userMsg, assistantMsg]

    setDraft('')
    setIsStreaming(true)
    setSidebarOpen(false)
    setStatusMessage('')

    startTransition(() => {
      replaceConversation(conversationId, (c) => ({
        ...c,
        messages: nextMsgs,
        title: deriveConversationTitle(nextMsgs),
        updatedAt: Date.now(),
      }))
    })

    try {
      const genAI = new GoogleGenerativeAI(currentApiKey)
      const model = genAI.getGenerativeModel({
        model: selectedModel,
        ...(supportsSystemInstruction(selectedModel)
          ? { systemInstruction: SYSTEM_PROMPT }
          : {}),
        generationConfig: { temperature: 0.8, topP: 0.92, maxOutputTokens: 4096 },
      })

      const streamResult = await model.generateContentStream({
        contents: buildRequestContents(
          [...activeConversation.messages, userMsg],
          selectedModel,
          SYSTEM_PROMPT,
        ),
      })

      let streamedText = ''
      for await (const chunk of streamResult.stream) {
        streamedText += chunk.text()
        startTransition(() => {
          replaceConversation(conversationId, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: streamedText, streaming: true } : m
            ),
            title: deriveConversationTitle(c.messages),
            updatedAt: Date.now(),
          }))
        })
      }

      const completedResponse = await streamResult.response
      const finalizedText = streamedText || completedResponse.text()

      startTransition(() => {
        replaceConversation(conversationId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  content: finalizedText || 'Response failed.',
                  streaming: false,
                  usageMetadata: completedResponse.usageMetadata ?? null,
                }
              : m
          ),
          title: deriveConversationTitle(c.messages),
          tokenUsage: completedResponse.usageMetadata ?? null,
          updatedAt: Date.now(),
        }))
      })
    } catch (error) {
      const friendly = error instanceof Error ? error.message : 'Model error. Please retry.'
      startTransition(() => {
        replaceConversation(conversationId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: `Error: ${friendly}`, streaming: false, isError: true }
              : m
          ),
          updatedAt: Date.now(),
        }))
      })
      setStatusMessage('Request Failed')
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-void font-sans antialiased text-zinc-100">
      <Sidebar
        conversations={conversations}
        activeConversation={activeConversation}
        selectedConversationId={selectedConversationId}
        setSelectedConversationId={setSelectedConversationId}
        handleNewConversation={handleNewConversation}
        isStreaming={isStreaming}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <ChatHeader
          activeConversation={activeConversation}
          setIsOpen={setSidebarOpen}
          currentApiKey={currentApiKey}
          handleModelChange={handleModelChange}
          isStreaming={isStreaming}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {!activeConversation?.messages.length ? (
              <SuggestedPrompts
                onSuggestion={(prompt) => setDraft(prompt)}
                modelLabel={MODELS.find(m => m.value === activeConversation?.model)?.label}
              />
            ) : (
              activeConversation.messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  copiedMessageId={copiedMessageId}
                  onCopy={handleCopy}
                />
              ))
            )}
            <div ref={messagesEndRef} className="h-4 w-full" />
          </div>
        </div>

        <ChatInput
          handleSubmit={handleSubmit}
          draft={draft}
          setDraft={setDraft}
          isStreaming={isStreaming}
          currentApiKey={currentApiKey}
          statusMessage={statusMessage}
          draftTokenEstimate={draftTokenEstimate}
          conversationTokenEstimate={conversationTokenEstimate}
        />
      </main>

      <ApiKeyModal
        isOpen={settingsOpen}
        apiKeyInput={apiKeyInput}
        setApiKeyInput={setApiKeyInput}
        statusMessage={statusMessage}
        onSave={() => setStatusMessage('API key saved locally in this browser.')}
        onClear={() => {
          setApiKeyInput('')
          setStatusMessage('Stored API key cleared from this browser.')
        }}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
