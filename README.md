# 🚀 Growth Engine

An autonomous, AI-powered lead generation, enrichment, and outreach engine designed to map business gaps, generate visual mockups, and execute multi-channel messaging sequences autonomously.

## 📖 Description

Growth Engine is an end-to-end local business automation pipeline. It identifies potential leads, crawls their digital footprint to identify technological gaps (missing websites, absent WhatsApp widgets, lacking SSL, etc.), and autonomously scores them based on intent. Using high-speed AI models (via Groq/Local LLMs), the engine drafts personalized outreach messages and dynamically routes them through optimized channels (WhatsApp or Email) complete with auto-generated visual proofs of concept (mockups).

## ✨ Core Features

* **🤖 AI Intent & Gap Mapping:** Leverages Groq (Llama 3) to analyze business profiles, detect exact technological gaps, and assign dynamic "Pitch Pillars" (e.g., Presence, Automation, Reputation).
* **🕷️ Stealth Scraping & Enrichment:** Uses Playwright to silently visit lead websites, bypassing basic bot protections to harvest contact data and assess web performance.
* **🎨 Visual Proof Engine:** Generates on-the-fly, customized landing page mockups for leads and seamlessly uploads them to Cloudflare R2 storage for inclusion in outreach messages.
* **🔀 Autonomous Outreach Sequences:** Orchestrated by Redis and BullMQ, background workers autonomously handle WhatsApp dispatches, email templates, rate-limiting, and multi-day follow-up sequences.
* **🛡️ Smart Deduplication:** Employs composite hashing to prevent duplicate lead outreach and maintain high domain/sender reputation.

## 🏗️ Architecture

### Tech Stack
* **Frontend:** React, Vite, TailwindCSS
* **Backend:** Node.js, Express.js
* **Database & Caching:** PostgreSQL, Redis (BullMQ)
* **AI & Media:** Groq API (LLMs), Cloudflare R2 (Object Storage), Playwright (Web Automation)
* **Messaging:** WhatsApp Web JS (Baileys), SMTP Email Integration

### Background Worker Ecosystem
* `scraperWorker`: Ingests raw leads from discovery sources.
* `enrichmentWorker`: Crawls domains, maps AI gaps, and drafts the initial pitch.
* `whatsappWorker` & `emailWorker`: Handles the actual delivery, ensuring safe delays and rate limits.
* `sequenceWorker`: Orchestrates multi-step, multi-day campaigns.

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* PostgreSQL
* Redis Server (Running locally on port 6379)
* Cloudflare R2 Bucket credentials
* Groq API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/growth-engine.git
   cd growth-engine
   ```

2. **Install Dependencies**
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Environment Setup**
   * Copy `.env.example` to `.env` in the root directory.
   * Fill in your PostgreSQL database credentials, Redis URL, Cloudflare R2 keys, and Groq API keys.

4. **Database Initialization**
   * Run the SQL migration scripts located in `backend/src/migrations/` to initialize your database schema.

### Running the Application

To start the full pipeline (Frontend, Backend, and all Background Workers):

```bash
# In the root directory, run the PowerShell start script
.\run.ps1
```

Alternatively, you can run the services individually:
* **Backend API & Workers:** `cd backend && npm run dev`
* **Frontend Dashboard:** `cd frontend && npm run dev`

## 🔒 Security & Privacy

* Sensitive configuration files, API keys, and WhatsApp session caches are strictly ignored via `.gitignore`. 
* Ensure your `.env` and `backend/auth_info_baileys/` folders are never committed to version control.

---
*Built to orchestrate digital growth, autonomously.*
