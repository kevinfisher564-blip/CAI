# Local Character AI System Architecture & Design Document

## 1. System Overview & Core Objectives
This document defines the architecture, design goals, component selection, and development strategy for a self-hosted, local implementation of a **Character AI alternative**. 

The system is designed to run on a **RunPod cloud GPU instance (ranging from an NVIDIA RTX 6000 48GB VRAM up to 80GB/96GB VRAM GPUs)** and be accessed securely from a **Windows 11 PC** via an SSH tunnel. (Mobile access for iPad and Android devices will be integrated in a later expansion phase).

The solution enables rich, interactive multimodal (Text, Vision, Audio) conversations with single or multiple pre-defined and custom-created AI characters, optimized for **long-running roleplay and narrative storytelling**.

---

## 2. Design Goals & Key Decisions

### 2.1 Multimodal Capabilities
- **Text Chat**: High-quality roleplay and character dialogue powered by state-of-the-art open Vision-Language Models (VLMs).
- **Vision Reaction**: Characters can see, analyze, and react to images uploaded directly into chat turns (e.g. photos, drawings, screenshots).
- **Speech-to-Text (STT)**: Push-to-talk or continuous microphone recording transcribed in near-real-time (<300ms latency).
- **Text-to-Speech (TTS) & Zero-Shot Voice Cloning**:
  - **Zero-Shot Voice Cloning**: Ability to clone any character's voice using a short 3–10 second reference WAV/MP3 audio file.
  - **Default Preset Fallback**: If no audio reference file is attached to a character profile, the system falls back to high-quality built-in voice presets (e.g. Male/Female Narrative, Deep, Soft, Energetic).
  - **Streaming Playback**: LLM text tokens are chunked by sentence and streamed to the TTS engine to minimize latency before audio playback begins.
- **Future Image Generation Support**: Reserved VRAM / modular API endpoints to hook into local image generators (SDXL / Flux.1 / ComfyUI) in future iterations.

### 2.2 Security & Windows Network Transport (Primary Focus)
- **Primary Encryption (SSH Tunneling)**: All traffic between the Windows 11 PC and RunPod instance is encrypted end-to-end via an SSH tunnel (`ssh -L 3000:localhost:3000 -L 8000:localhost:8000`).
  - Accessible strictly at `http://localhost:3000` on the Windows 11 browser. Zero public exposure required.
- **Future Mobile Expansion (Deferred)**: Cloudflare Tunnel / HTTPS setup for iOS (iPad) and Android microphone access will be added in Phase 5.

### 2.3 In-App Character Editor UI
- Full visual web editor enabling users to:
  - Create new characters from scratch or import existing **Tavern Spec v2** character cards (JSON / PNG).
  - Modify character metadata: Name, Title, Avatar Image, Personality, Behavior Guidelines, Scenario, Greeting Message, and Example Dialogue turns (`<START>\nUser: ...\nCharacter: ...`).
  - Upload or change voice reference audio clips (3-10s WAV) or select a built-in voice preset.
  - View and edit character-specific long-term story memory recaps and lorebook entries.

### 2.4 Long-Running Story & Extended Context Architecture
To maintain character consistency across long-running stories without running out of memory or degrading quality, the system uses a **3-Tier Context Architecture**:
1. **Tier 1: Large Native vLLM Window (32k – 64k Tokens)**:
   - Configured with `Qwen2.5-VL` (native 128k context support) via vLLM with PagedAttention and FP8 KV cache compression.
   - Holds thousands of recent dialogue turns in raw, exact detail.
2. **Tier 2: Automatic Background Chapter Summarizer**:
   - As dialogue turns cross threshold limits (e.g. every 10k tokens), an asynchronous background process summarizes past events into a **"Story Milestones & Character Relationship Status"** summary.
   - Pinned at the top of the prompt context so long-term plot points are never forgotten.
3. **Tier 3: Vector Lorebook & Memory Retrieval (LanceDB)**:
   - Past conversation history and lore entries are indexed into a zero-config embedded vector database (`LanceDB`).
   - Relevant historical facts are dynamically retrieved via semantic search when referenced in chat.

### 2.5 Multi-Character Group Chat Routing
- Supports multi-character rooms where multiple AI characters coexist.
- Dynamic speaker routing supports explicit `@CharacterName` mentions or automatic LLM-driven next-speaker selection based on conversation context and character personalities.

---

## 3. Infrastructure & Hardware Resource Allocation

### 3.1 Hardware Configurations on RunPod

| VRAM Tier | Primary Vision LLM | STT Engine | Zero-Shot TTS Engine | Future Image Gen | Context Window |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **48GB VRAM (RTX 6000)** | `Qwen2.5-VL-7B-Instruct` (~16GB) | `Faster-Whisper` (~2GB) | `F5-TTS` / `XTTSv2` (~3.5GB) | Dynamic / Offloaded (~8GB) | **32,768 tokens** |
| **80-96GB VRAM (H100 / Dual RTX)** | `Qwen2.5-VL-32B` or `72B-FP8` (~35-48GB) | `Faster-Whisper` (~2GB) | `F5-TTS` / `XTTSv2` (~3.5GB) | Concurrent `Flux.1 / SDXL` (~12-16GB) | **65,536+ tokens** |

### 3.2 Port Allocations
- **Port 3000**: React Frontend Web UI (Vite dev server / web build)
- **Port 8000**: FastAPI Backend Orchestrator API & WebSockets
- **Port 8001**: vLLM OpenAI-Compatible API Engine (`Qwen2.5-VL`)
- **Port 8002**: Faster-Whisper Speech-to-Text API Service
- **Port 8003**: F5-TTS / XTTSv2 Zero-Shot Voice Synthesis Service

### 3.3 Disk Space & Storage Allocation Breakdown

| Component | Space Required | Details |
| :--- | :--- | :--- |
| **Qwen2.5-VL-7B Model Weights** | ~15 GB | Uncompressed Safetensors checkpoints |
| **Faster-Whisper (`large-v3-turbo`)** | ~1.6 GB | CTranslate2 STT weights |
| **Zero-Shot TTS (`F5-TTS` / `XTTSv2`)** | ~2.5 GB | TTS voice synthesis checkpoints |
| **PyTorch, vLLM & CUDA Packages** | ~10 GB | Python virtualenv & system dependencies |
| **Working Buffer & LanceDB Storage** | ~5-10 GB | Temp audio clips, logs, vector embeddings |
| **TOTAL MINIMUM REQUIRED** | **~35 - 40 GB** | Minimum operational disk space |
| **RECOMMENDED ALLOCATION** | **50 GB - 75 GB** | **Container Disk: 50GB \| Volume Disk: 50GB** |

---

## 4. System Architecture Diagram

```
+---------------------------------------------------------------------------------------+
|                                    WINDOWS 11 PC                                     |
|  - VS Code (Remote-SSH)                                                               |
|  - Web Browser (http://localhost:3000 via Encrypted SSH Tunnel)                       |
+------------------------------------+--------------------------------------------------+
                                     |
                       Encrypted SSH Tunnel (Ports 3000, 8000)
                                     |
+------------------------------------v--------------------------------------------------+
|                            RUNPOD INSTANCE (48GB - 96GB VRAM)                         |
|                                                                                       |
|  +---------------------------------------------------------------------------------+  |
|  |                             FRONTEND (Vite + React UI)                          |  |
|  |  - Character Gallery & Room List   - Visual In-Browser Character Editor          |  |
|  |  - Single & Group Chat Rooms       - Voice Sample Uploader (3-10s WAV)             |  |
|  |  - Push-to-Talk Mic Recording     - Image Viewer & Vision Upload                 |  |
|  |  - Story Memory Recap Viewer       - Token Gauge & Context Meter                  |  |
|  +-----------------------------------------+---------------------------------------+  |
|                                            | REST / WebSocket                         |
|  +-----------------------------------------v---------------------------------------+  |
|  |                           FASTAPI CHAT ORCHESTRATOR                             |  |
|  |  - Character Persistence & Card Manager (Tavern Spec v2 JSON + Audio/Avatar)      |  |
|  |  - Multi-Character Speaker Router & Turn Coordinator                            |  |
|  |  - 3-Tier Context Engine (32k Sliding Window + Story Recaps + Vector Lorebook)   |  |
|  |  - Audio & Vision Dispatch Pipeline                                             |  |
|  +--------+--------------------------------+-----------------------------------+---|  |
|           |                                |                                   |      |
|  +--------v-------+               +--------v-------+                  +--------v---+  |
|  |  STT SERVICE   |               |  vLLM ENGINE   |                  |TTS SERVICE |  |
|  | Faster-Whisper |               | Qwen2.5-VL     |                  |F5-TTS /    |  |
|  | (Voice -> Text)|               | (VLM + Text)   |                  |XTTSv2      |  |
|  +----------------+               +----------------+                  +------------+  |
+---------------------------------------------------------------------------------------+
```

---

## 5. Repository & Project Directory Structure

```
c:\Users\kfish\OneDrive\repos\KRF CAI\
├── design.md                # System Architecture & Design Specification (This Document)
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI routes (chat, characters, voice, vision, memory)
│   │   ├── core/            # Configuration, security, vLLM/STT/TTS client wrappers
│   │   ├── services/        # Group chat orchestrator, 3-tier context engine, story summarizer
│   │   └── models/          # Character schemas (Tavern Spec v2), Room & Memory models
│   ├── characters/          # Saved character cards (JSON metadata, avatars, voice_samples/)
│   ├── storage/             # Vector database (LanceDB) & Story memory recaps
│   ├── requirements.txt
│   └── main.py              # FastAPI application server entry point
├── frontend/
│   ├── src/
│   │   ├── components/      # ChatRoom, CharacterEditor, MemoryViewer, VoiceRecorder, MediaUpload
│   │   ├── store/           # State management (active room, character edit state)
│   │   ├── services/        # WebSocket client, API helper
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── services/
│   ├── start_vllm.sh        # vLLM launch script with Qwen2.5-VL & max context flags
│   ├── start_stt.py         # Faster-Whisper service runner
│   └── start_tts.py         # F5-TTS / XTTSv2 service runner with preset fallback
├── scripts/
│   ├── setup_runpod.sh      # One-click RunPod environment setup script
│   └── start_all.sh         # Master service starter script
└── README.md
```

---

## 6. Development Strategy & Implementation Roadmap

### Phase 1: Workspace Initialization & Service Engines Launch
- Initialize repository layout and configure Python virtual environments.
- Create container launch scripts for **vLLM** (`Qwen2.5-VL`), **Faster-Whisper** (STT), and **F5-TTS / XTTSv2** (TTS).
- Verify model engine launch and API availability on RunPod.

### Phase 2: FastAPI Orchestrator, Character Editor API & 3-Tier Context Engine
- Implement Character Card CRUD manager conforming to Tavern Spec v2 (JSON + Avatar + Voice WAV).
- Implement 3-Tier Context Manager (sliding vLLM window + background story summarizer + LanceDB vector store).
- Implement single and multi-character group chat speaker routing.
- Implement Audio dispatch pipeline (STT -> LLM -> TTS stream).

### Phase 3: Windows Desktop Web UI & Character Editor Development
- Build modern dark-mode glassmorphism interface with Vite + React optimized for Windows desktop browsers.
- Build **Character Editor** page for visual card editing, image avatar cropping, and voice testing.
- Build **Chat Room** with audio waveform recording, image attachment preview, and memory recap viewer.

### Phase 4: Encrypted Tunnel Setup & End-to-End Verification
- Configure SSH Tunnel script for Windows 11 PC.
- Run integration tests validating zero-shot voice cloning, vision reactions, multi-character group turns, and long-story memory retention.

### Phase 5: Future Mobile Expansion (Deferred)
- Configure Cloudflare Tunnel HTTPS endpoint and iOS/Android PWA features for mobile devices.

---

## 7. Verification & Testing Criteria

1. **Voice Cloning & Fallback Test**:
   - Create a character with a 5-second WAV reference clip and verify voice cloning output.
   - Create a character with no reference clip, assign a preset voice, and verify speech playback.
2. **Vision Reaction Test**:
   - Upload an image in a chat turn on Windows browser; confirm the character accurately describes and reacts to the visual input.
3. **Character Editor Persistence Test**:
   - Edit character persona and greeting message in the web UI; save and confirm changes persist in the character's behavior and JSON card.
4. **Long Story Memory Retention Test**:
   - Execute a long narrative chat session crossing 10,000+ tokens; verify that generated story recaps capture key plot milestones accurately.
5. **Group Chat Speaker Routing Test**:
   - Create a room with 2 characters; issue a prompt and verify both characters take distinct, in-character speaker turns without identity confusion.
