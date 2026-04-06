export const SYSTEM_PROMPT = 'You are a helpful, intelligent AI assistant.'

export const MODELS = [
  {
    value: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    shortLabel: '1.5 Flash',
  },
  {
    value: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    shortLabel: '1.5 Pro',
  },
  {
    value: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    shortLabel: '2.0 Flash',
  },
]

export const SUGGESTED_PROMPTS = [
  'Summarize a research paper and list the surprising takeaways.',
  'Draft a launch announcement for a new SaaS product in a confident, modern tone.',
  'Explain a tricky codebase pattern like I am onboarding to the team today.',
]

export const STORAGE_KEYS = {
  conversations: 'llm-chat:conversations',
  selectedConversation: 'llm-chat:selected-conversation',
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

export function createConversation(model = MODELS[0].value) {
  return {
    id: uid('chat'),
    title: 'New conversation',
    model,
    updatedAt: Date.now(),
    tokenUsage: null,
    messages: [],
  }
}

export function createMessage(role, content, extra = {}) {
  return {
    id: uid('msg'),
    role,
    content,
    createdAt: Date.now(),
    streaming: false,
    isError: false,
    usageMetadata: null,
    ...extra,
  }
}

export function deriveConversationTitle(messages = []) {
  const firstUserMessage = messages.find(
    (message) => message.role === 'user' && message.content.trim(),
  )

  if (!firstUserMessage) {
    return 'New conversation'
  }

  return summarize(firstUserMessage.content, 42)
}

export function getLastPreview(messages = []) {
  const lastMessage = [...messages].reverse().find((message) => message.content.trim())

  if (!lastMessage) {
    return 'Start a new thread'
  }

  return summarize(lastMessage.content, 88)
}

export function estimateTokens(content = '') {
  const cleanedContent = content.trim()

  if (!cleanedContent) {
    return 0
  }

  return Math.max(1, Math.round(cleanedContent.length / 4))
}

export function estimateConversationTokens(messages = []) {
  return messages.reduce((total, message) => total + estimateTokens(message.content), 0)
}

export function buildContents(messages = []) {
  return messages
    .filter((message) => message.content.trim() && !message.isError)
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }))
}

export function formatSidebarTime(value) {
  const date = new Date(value)
  const now = new Date()
  const sameDay = now.toDateString() === date.toDateString()

  if (sameDay) {
    return new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  const diffInDays = Math.round((now - date) / 86400000)

  if (diffInDays < 7) {
    return new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date)
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatTime(value) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function getUsageSummary(usageMetadata) {
  if (!usageMetadata) {
    return null
  }

  return {
    prompt: usageMetadata.promptTokenCount ?? 0,
    output: usageMetadata.candidatesTokenCount ?? 0,
    total: usageMetadata.totalTokenCount ?? 0,
  }
}

export function loadStoredConversations() {
  if (typeof window === 'undefined') {
    return [createConversation()]
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEYS.conversations)

    if (!rawValue) {
      return [createConversation()]
    }

    const parsedValue = JSON.parse(rawValue)

    if (!Array.isArray(parsedValue) || !parsedValue.length) {
      return [createConversation()]
    }

    return parsedValue
      .map((conversation) => ({
        id: typeof conversation.id === 'string' ? conversation.id : uid('chat'),
        title:
          typeof conversation.title === 'string' && conversation.title.trim()
            ? conversation.title
            : 'New conversation',
        model:
          typeof conversation.model === 'string'
            ? conversation.model
            : MODELS[0].value,
        updatedAt:
          typeof conversation.updatedAt === 'number'
            ? conversation.updatedAt
            : Date.now(),
        tokenUsage: conversation.tokenUsage ?? null,
        messages: Array.isArray(conversation.messages)
          ? conversation.messages
              .filter(
                (message) =>
                  message &&
                  (message.role === 'user' || message.role === 'assistant'),
              )
              .map((message) => ({
                id: typeof message.id === 'string' ? message.id : uid('msg'),
                role: message.role,
                content: typeof message.content === 'string' ? message.content : '',
                createdAt:
                  typeof message.createdAt === 'number'
                    ? message.createdAt
                    : Date.now(),
                streaming: false,
                isError: Boolean(message.isError),
                usageMetadata: message.usageMetadata ?? null,
              }))
          : [],
      }))
      .sort((left, right) => right.updatedAt - left.updatedAt)
  } catch {
    return [createConversation()]
  }
}

function summarize(content, maxLength) {
  const singleLine = content.replace(/\s+/g, ' ').trim()

  if (!singleLine) {
    return 'Untitled'
  }

  if (singleLine.length <= maxLength) {
    return singleLine
  }

  return `${singleLine.slice(0, maxLength - 1).trimEnd()}…`
}
