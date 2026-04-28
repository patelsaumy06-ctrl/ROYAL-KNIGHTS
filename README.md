# 🔗 Needlink AI
### *Data-Driven Volunteer Coordination for Social Impact*

> **Smart Resource Allocation** — connecting community needs with the right volunteers, at the right time.

**Team:** Royal Knights
**Live Demo:** [needlink-ai.web.app](https://needlink-ai.web.app/)

---

## 🧩 The Problem

Local social groups and NGOs are doing incredible work — but they're flying blind.

Community needs are captured through paper surveys, field reports, and fragmented spreadsheets. This critical data sits scattered across different people, files, and systems. When a flood hits a neighbourhood, or a food bank runs low, no one has a unified picture of *where help is needed most* — and volunteers have no clear way to know *where they can do the most good*.

The result: urgent needs go unmet. Willing volunteers go undeployed. Resources are wasted.

---

## 💡 Our Solution

**Needlink AI** is an intelligent volunteer coordination platform that:

- **Aggregates** community need data from multiple sources into a single, clear dashboard
- **Prioritizes** issues using AI-driven urgency scoring, so the biggest problems are always visible first
- **Matches** available volunteers to specific tasks and geographic areas based on their skills, availability, and location
- **Connects** NGOs and volunteers in real time — reducing coordination friction from days to minutes

We turn scattered data into decisive action.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 📊 **Unified Need Dashboard** | Aggregates community reports into a live, prioritized view of local issues |
| 🤖 **AI-Powered Matching** | Intelligent algorithm matches volunteers to tasks based on skills, location, and urgency |
| 📍 **Geo-Aware Deployment** | Map-based volunteer dispatch — see needs and responders in your area |
| 🔔 **Smart Alerts** | Volunteers are notified when a high-priority need matches their profile |
| 📋 **NGO Data Intake** | Simple form-based system for NGOs to log field reports and community surveys |
| 📈 **Impact Tracking** | Track volunteer hours, tasks completed, and community outcomes over time |

---

## 🏗️ Technical Architecture

```
┌─────────────────────────────────────────────┐
│               Needlink AI                   │
│                                             │
│  ┌──────────┐     ┌──────────────────────┐  │
│  │  NGO /   │────▶│   Data Aggregation   │  │
│  │  Field   │     │   & Normalization    │  │
│  │  Reports │     └──────────┬───────────┘  │
│  └──────────┘                │              │
│                              ▼              │
│  ┌──────────┐     ┌──────────────────────┐  │
│  │Volunteer │◀────│   AI Matching Engine │  │
│  │  Portal  │     │  (Priority Scoring + │  │
│  └──────────┘     │   Skill Alignment)   │  │
│                   └──────────┬───────────┘  │
│                              │              │
│                   ┌──────────▼───────────┐  │
│                   │   Real-Time Dashboard│  │
│                   │  (NGOs + Volunteers) │  │
│                   └──────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Tech Stack

- **Frontend:** React.js, hosted on Firebase
- **AI / ML:** Intelligent matching and urgency scoring engine
- **Backend:** Firebase (Firestore, Authentication, Hosting)
- **Data Layer:** Structured ingestion pipeline for survey/field report normalization

---

## 🤖 AI Integration

The core of Needlink AI is its **smart matching engine**, which:

1. **Scores urgency** of community needs using weighted criteria (severity, affected population, time sensitivity)
2. **Profiles volunteers** based on declared skills, past activity, and availability windows
3. **Computes compatibility** between open tasks and volunteer profiles to surface the best matches
4. **Learns over time** — improving match quality as more tasks are completed and rated

This goes well beyond a simple directory. The AI layer transforms raw community reports into **actionable deployment decisions**.

---

## 🎯 Alignment With Cause

Needlink AI was built specifically for the **Smart Resource Allocation** challenge. We address all three dimensions directly:

- **Problem Definition:** We tackle a concrete, well-researched pain point — data fragmentation in grassroots NGO operations — that actively reduces the effectiveness of social impact work.
- **Relevance of Solution:** Every feature maps directly to a real coordination bottleneck. We aren't building generic software; we're solving the specific gap between need identification and volunteer deployment.
- **Expected Impact:** A platform like Needlink AI can reduce volunteer-to-task matching time from days to minutes, allow NGOs to respond faster to crises, and make community data actionable for organizations that previously lacked the tools to use it.

---

## 🔒 Security & Privacy

- User authentication via **Firebase Auth**
- Role-based access: NGO admins vs. volunteers see different data
- Volunteer personal data is never publicly exposed; only skills and availability are shared for matching
- Community need data is anonymized at the report level before aggregation

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/royal-knights/needlink-ai.git

# Install dependencies
cd needlink-ai
npm install

# Start the development server
npm run dev
```

> **Live version:** [https://needlink-ai.web.app](https://needlink-ai.web.app/)

---

## 👥 Team — Royal Knights

Built with purpose at the hackathon. We believe technology should work hardest for the people who need it most.

---

## 📄 License

MIT License — open to be built upon and adapted for real-world NGO use.