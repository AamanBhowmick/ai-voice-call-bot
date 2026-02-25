# 🤖 AI Voice Call Bot

An AI-powered voice call bot built on **Azure Communication Services (ACS)** with a custom webhook server, real-time audio streaming, and an STT → LLM → TTS pipeline.

---

## 🚀 Quick Start

```bash
bun install        # install dependencies
cp .env.example .env   # fill in your Azure credentials
bun run dev        # start the server with hot reload
```

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) v1.2+ |
| Language | TypeScript |
| HTTP Server | Express v5 |
| Logging | Pino + Pino-Pretty |
| Telephony | Azure Communication Services (ACS) |
| Event Routing | Azure Event Grid |
| Audio Streaming | WebSocket (ws) |
| Speech-to-Text | Azure Cognitive STT / Google STT |
| AI / LLM | Gemini / Claude / GPT-4o |
| Text-to-Speech | Azure Neural TTS |
| Hosting | Azure App Service / Container Apps |

---

## ✅ Implementation Checklist

### 🏗 Project Setup
- [x] Bun project initialized (`bun init`)
- [x] TypeScript configured (`tsconfig.json`)
- [x] Express + CORS + Morgan installed
- [x] Pino + Pino-Pretty logging installed
- [ ] ACS Call Automation SDK installed (`@azure/communication-call-automation`)
- [ ] WebSocket library installed (`ws`)
- [ ] `.env` file configured with all credentials
- [ ] `.env.example` committed to repo

### ☁ Azure Infrastructure
- [ ] Resource Group created (`rg-voice-bot`)
- [ ] ACS resource provisioned (`acs-voice-bot`)
- [ ] ACS phone number purchased (Voice calls enabled)
- [ ] App Service created (B1 plan, WebSockets enabled)
- [ ] Event Grid subscription created → `/api/incoming-call`
- [ ] Event Grid subscription validated (handshake successful)
- [ ] App Service environment variables configured

### 🔧 Server Code
- [ ] Logger setup (`src/logger.ts`)
- [ ] Express app setup (`src/app.ts`)
- [ ] Webhook route — Event Grid validation handshake
- [ ] Webhook route — Answer incoming call via SDK
- [ ] Webhook route — Attach media stream (WebSocket URL)
- [ ] Callback route — Handle `CallConnected` / `CallDisconnected` events
- [ ] WebSocket server — Accept ACS audio connection
- [ ] WebSocket server — Parse PCM audio frames
- [ ] WebSocket server — Validate `callConnectionId`

### 🤖 AI Pipeline
- [ ] STT integration — stream PCM chunks to Speech-to-Text
- [ ] Voice Activity Detection (VAD) — detect end of utterance
- [ ] LLM integration — send transcript, receive response
- [ ] Conversation history management (multi-turn)
- [ ] TTS integration — convert LLM response to PCM audio
- [ ] Audio injection — send TTS audio back over WebSocket

### 🔒 Security
- [ ] Webhook secret header validation (`aeg-sas-key`)
- [ ] Rate limiting middleware (`express-rate-limit`)
- [ ] `callConnectionId` cache for WebSocket auth
- [ ] `.env` added to `.gitignore`
- [ ] Azure Key Vault integration (production)
- [ ] Managed Identity enabled on App Service (production)

### 📈 Scalability (Production)
- [ ] Containerised with `Dockerfile`
- [ ] Deployed to Azure Container Apps
- [ ] Azure Service Bus queue for decoupling webhook ↔ workers
- [ ] KEDA autoscaling configured on worker pods
- [ ] ACS quota increase requested from Microsoft

### 🧪 Testing
- [ ] Test call made to ACS phone number
- [ ] Event Grid delivery verified in Log stream
- [ ] WebSocket connection confirmed
- [ ] AI response heard by caller
- [ ] End-to-end latency measured (target: < 2s first response)

---

## 📁 Project Structure

```
ai-voice-call-bot/
├── src/
│   ├── index.ts          # Entry point — starts HTTP + WS servers
│   ├── app.ts            # Express app configuration
│   ├── logger.ts         # Pino logger setup
│   ├── routes/
│   │   ├── webhook.ts    # POST /api/incoming-call
│   │   └── callback.ts   # POST /api/callback
│   └── services/
│       ├── acsClient.ts  # ACS SDK client singleton
│       ├── wsServer.ts   # WebSocket server + audio handler
│       ├── stt.ts        # Speech-to-Text integration
│       ├── llm.ts        # LLM integration
│       └── tts.ts        # Text-to-Speech integration
├── index.html            # Architecture diagram + Azure setup guide
├── .env.example          # Required environment variables
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `PORT` | HTTP server port (default: `3000`) |
| `ACS_CONNECTION_STRING` | From ACS resource → Keys |
| `ACS_PHONE_NUMBER` | Your ACS number e.g. `+12025550123` |
| `CALLBACK_URI` | `https://yourserver.com/api/callback` |
| `WEBSOCKET_URL` | `wss://yourserver.com/audio` |
| `WEBHOOK_SECRET` | Random secret for Event Grid header auth |

---

## 📖 Architecture

See [index.html](./index.html) for the full animated architecture diagram, Azure setup guide, and security/scalability analysis.
