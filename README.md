# Lumen Chat

A polished Gemini web chat built with React, Vite, Tailwind CSS, and the legacy `@google/generative-ai` SDK.

## Features

- Dark premium chat interface
- Gemini model switching
- Streaming markdown responses
- Conversation history stored in `localStorage`
- Copy-to-clipboard actions
- Approx context token counter plus response usage stats
- GitHub Pages deployment via `gh-pages`

## Local development

```bash
npm install
npm run dev
```

Create a `.env` file with:

```bash
VITE_GEMINI_API_KEY=your-gemini-api-key
```

## Deploy

```bash
npm run deploy
```
