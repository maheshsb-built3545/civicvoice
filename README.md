# 🚨 CivicVoice

### AI-Powered Smart City Grievance Redressal Platform

> **Report a civic issue on WhatsApp. Let AI understand it, route it, and close the loop.**

CivicVoice is an end-to-end municipal grievance redressal platform that connects citizens with local government through a **WhatsApp-first experience**.

It combines conversational AI, image/voice processing, geospatial ward routing, role-based dashboards, and automated WhatsApp notifications to transform an unstructured citizen message into an actionable municipal complaint.

---

## 🎯 The Problem

Traditional civic grievance systems often create friction for both citizens and municipal authorities:

* 📋 **Complicated portals** — Citizens have to navigate lengthy forms and unfamiliar interfaces.
* 📱 **App/download friction** — Installing and registering for a dedicated app is inconvenient for one-time complaints.
* 🔀 **Incorrect routing** — Manual forwarding can result in complaints reaching the wrong department or ward.
* 👨‍💼 **Manual triage** — Officers spend time reading, categorizing, and routing unstructured complaints.
* 👁️ **Limited transparency** — Citizens may have little visibility into the progress of their complaints.
* 🔁 **Broken follow-up loops** — Citizens often need to make additional calls or visits to know whether their issue was resolved.

---

# 💡 Our Solution

CivicVoice turns a simple WhatsApp conversation into a complete grievance workflow.

```text
Citizen
   ↓
WhatsApp
   ↓
AI Understanding
   ↓
Location & Geospatial Processing
   ↓
Ward Identification
   ↓
Officer Assignment
   ↓
Resolution
   ↓
WhatsApp Notification
   ↓
Administrative Analytics
```

### The citizen doesn't need to:

* Download another application
* Learn a complicated portal
* Manually identify the correct municipal department
* Follow up repeatedly with officials

They simply **send the complaint through WhatsApp**.

---

# ⚡ Key Features

### 💬 WhatsApp-First Citizen Intake

Citizens can report civic issues using:

* Text messages
* Voice notes
* Photographs

The familiar WhatsApp interface removes the need for a separate citizen application.

### 🧠 AI-Powered Complaint Processing

CivicVoice uses Groq-powered AI services to process citizen inputs and extract structured complaint information such as:

* Complaint category
* Description
* Severity/relevant metadata
* Visual evidence from submitted images

### 🗺️ Intelligent Geospatial Ward Routing

Location information is processed using geocoding and MongoDB geospatial capabilities to identify the appropriate municipal ward.

This allows complaints to be routed according to **jurisdiction rather than manual forwarding**.

### 👮 Role-Based Officer Portal

Municipal officers receive a dashboard focused on their assigned jurisdiction.

They can:

* View assigned complaints
* Inspect complaint details
* Review submitted evidence
* Track complaint status
* Update the resolution lifecycle

### 📊 Super Admin Analytics

Administrators get a city-level overview of operational data, including:

* Complaint statistics
* Ward performance
* SLA metrics
* Complaint trends
* Resolution tracking

### 🔔 Automated Citizen Feedback

When an officer updates the complaint status, CivicVoice can trigger a WhatsApp notification back to the citizen, creating a closed communication loop.

---

# 🎬 End-to-End Workflow

## 1. Citizen Reports an Issue

A citizen sends a message through WhatsApp.

Example:

> **"There is a huge broken road near Sanjivani College."**

A photograph can be attached as supporting evidence.

---

## 2. WhatsApp Webhook Receives the Complaint

The Meta WhatsApp Cloud API sends the incoming message/media event to the CivicVoice backend.

The Express.js backend receives and processes the incoming payload.

---

## 3. AI Understands the Complaint

The backend processes the citizen's message using the AI pipeline.

The system extracts relevant information such as:

```text
Category
Description
Severity / Metadata
Visual Evidence
```

This transforms an unstructured citizen message into structured complaint data.

---

## 4. Location Is Processed

The system processes location information provided by the citizen.

Where applicable, OpenStreetMap Nominatim is used for geocoding and location resolution.

---

## 5. Ward Is Identified

The resulting geographic information is processed using MongoDB's geospatial capabilities.

The complaint is matched against defined ward boundaries to determine the responsible operational area.

```text
Location
   ↓
Coordinates
   ↓
Ward Boundary
   ↓
Geospatial Query
   ↓
Responsible Ward
```

---

## 6. Complaint Is Assigned

The complaint is stored in MongoDB and associated with the appropriate ward/officer workflow.

The responsible officer can then access it from the dashboard.

---

## 7. Officer Takes Action

The assigned officer reviews:

* Complaint information
* AI-generated information
* Location
* Photo/media evidence
* Current status

The officer can update the complaint lifecycle.

Example:

```text
RECEIVED
    ↓
IN_PROGRESS
    ↓
RESOLVED
```

---

## 8. Citizen Is Notified

After a status update or resolution, CivicVoice sends the appropriate WhatsApp notification back to the citizen.

This creates the complete loop:

```text
Report → Route → Act → Resolve → Notify
```

---

# 🧠 AI Pipeline

CivicVoice uses AI to convert unstructured citizen communication into structured municipal data.

```text
Text / Voice / Image
        ↓
   AI Processing
        ↓
Structured Information
        ↓
Complaint Record
        ↓
Routing & Officer Workflow
```

### Text Processing

Natural-language messages are processed to identify the intent and relevant complaint information.

### Voice Processing

Voice-note inputs can be processed through speech-to-text before entering the complaint processing pipeline.

### Image Processing

Photographs submitted by citizens provide visual evidence that can be processed through the vision pipeline.

### Structured Output

The extracted information is used downstream for complaint creation, categorization, and routing.

---

# 🗺️ Geospatial Routing Engine

One of CivicVoice's core capabilities is automated ward-level routing.

### Location Acquisition

Location information can originate from citizen-provided descriptions or location payloads.

### Geocoding

OpenStreetMap Nominatim can convert location information into geographic coordinates.

### Geographic Processing

Coordinates are processed using standardized geospatial data structures.

### MongoDB Geospatial Queries

MongoDB's geospatial capabilities are used to compare complaint locations with defined ward boundaries.

### Ward Assignment

The system identifies the operational ward responsible for handling the complaint.

This reduces dependency on manual jurisdiction-based forwarding.

---

# 🏗️ System Architecture

```text
┌──────────────────────────┐
│        Citizen           │
│       WhatsApp           │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Meta WhatsApp Cloud API  │
└────────────┬─────────────┘
             │ Webhook
             ▼
┌──────────────────────────┐
│   Node.js / Express      │
│       Backend            │
└──────┬─────────┬─────────┘
       │         │
       ▼         ▼
┌───────────┐ ┌───────────────┐
│ AI Layer  │ │ Geo Services  │
│   Groq    │ │   Nominatim   │
└─────┬─────┘ └───────┬───────┘
      │               │
      └───────┬───────┘
              ▼
     ┌──────────────────┐
     │     MongoDB      │
     │ Complaints/Wards │
     │ Users/Officers   │
     └────────┬─────────┘
              │
       ┌──────┴───────┐
       ▼              ▼
┌──────────────┐ ┌─────────────────┐
│   Officer    │ │   Super Admin   │
│  Dashboard   │ │    Analytics    │
└──────┬───────┘ └────────┬────────┘
       │                   │
       └─────────┬─────────┘
                 ▼
       ┌──────────────────┐
       │ WhatsApp Update  │
       │   to Citizen     │
       └──────────────────┘
```

---

# 🛠️ Technology Stack

| Layer            | Technology              | Purpose                                      |
| ---------------- | ----------------------- | -------------------------------------------- |
| Backend          | Node.js                 | Server runtime                               |
| API Framework    | Express.js              | APIs, routing & middleware                   |
| Database         | MongoDB                 | Complaint, user, ward & operational data     |
| ODM              | Mongoose                | MongoDB data modeling                        |
| Frontend         | React                   | Officer/Admin dashboards                     |
| Language         | TypeScript              | Frontend development                         |
| Build Tool       | Vite                    | Frontend development & build                 |
| UI               | Tailwind CSS            | Interface styling                            |
| AI               | Groq / LLaMA            | Natural-language processing & AI analysis    |
| Geospatial       | OpenStreetMap Nominatim | Location/geocoding                           |
| Communication    | Meta WhatsApp Cloud API | Citizen interaction & notifications          |
| Queue Management | Redis                   | Background/queue processing where configured |

---

# 👮 Officer Dashboard

The officer portal is designed around **jurisdiction-specific workflows**.

An officer can:

* View complaints assigned to their ward
* Open individual complaint records
* Review citizen-provided information
* View supporting media/evidence
* Review AI-generated information
* Update complaint status
* Mark complaints as resolved

Instead of overwhelming an officer with city-wide complaints, CivicVoice focuses the workflow on the officer's operational jurisdiction.

---

# 📊 Super Admin Analytics

The Super Admin dashboard provides an administrative overview of the grievance system.

It can provide visibility into:

* Total complaints
* Active complaints
* Resolved complaints
* Ward-level performance
* SLA-related metrics
* Complaint trends
* Operational workload

This allows administrators to move from individual complaint handling to **city-level operational visibility**.

---

# 📂 Project Structure

```text
CivicVoice/
│
├── admin-dashboard/
│
├── civicvoice-backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── models/
│   │   └── services/
│   │
│   ├── scripts/
│   ├── frontend/
│   ├── uploads/
│   ├── server.js
│   └── .env.example
│
├── body.json
├── .gitignore
└── README.md
```

> **Note:** `.env` files containing real credentials are intentionally excluded from the repository.

---

# 🔌 API & Webhook Overview

| Method  | Endpoint                     | Purpose                                    |
| ------- | ---------------------------- | ------------------------------------------ |
| `GET`   | `/api/webhook`               | WhatsApp webhook verification              |
| `POST`  | `/api/webhook`               | Incoming WhatsApp messages/status events   |
| `POST`  | `/api/auth/login`            | Officer/Admin authentication               |
| `GET`   | `/api/complaints`            | Retrieve complaints according to role/ward |
| `PATCH` | `/api/complaints/:id/status` | Update complaint status                    |

---

# 🔐 Security

CivicVoice follows basic security practices for protecting application credentials and access.

### Environment Variables

Sensitive credentials are stored through environment variables rather than committed to source control.

### Git Protection

The repository excludes `.env` files containing private credentials.

### Authentication & Authorization

Role-based access separates different levels of access within the platform.

### Password Security

User credentials are protected using password hashing.

### WhatsApp Webhook Verification

Webhook verification is implemented for validating Meta WhatsApp webhook requests.

> **Never commit real API keys, database credentials, access tokens, or secrets to this repository.**

---

# 🚀 Running CivicVoice Locally

## Prerequisites

* Node.js 18+
* npm
* MongoDB / MongoDB Atlas
* Required AI and WhatsApp API credentials

---

## Backend Setup

```bash
cd civicvoice-backend
npm install
```

Configure your environment variables:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_VERIFY_TOKEN=your_whatsapp_verify_token
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
```

Run the required database seed scripts if using the provided seed data:

```bash
node src/scripts/seedWards.js
node src/scripts/seedOfficers.js
```

Start the backend:

```bash
npm start
```

---

## Frontend Setup

```bash
cd civicvoice-backend/frontend
npm install
npm run build
```

For local development, use the development command defined in the frontend's `package.json`.

---

# ☁️ Deployment Architecture

### Target Production Architecture

```text
              ┌──────────────────┐
              │     Citizens     │
              │     WhatsApp     │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  Meta WhatsApp   │
              │    Cloud API     │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Render Backend   │
              │ Node + Express   │
              └────────┬─────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
       ┌──────────────┐  ┌──────────────┐
       │ MongoDB Atlas│  │ AI Services  │
       └──────────────┘  └──────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Vercel Frontend  │
              │ Officer/Admin UI │
              └──────────────────┘
```

The intended deployment stack is:

* **Frontend:** Vercel
* **Backend:** Render
* **Database:** MongoDB Atlas
* **Messaging:** Meta WhatsApp Cloud API

> **Deployment status:** This architecture represents the intended production configuration. Deployment endpoints and credentials should be configured separately through environment variables.

---

# 🧪 Demo Scenario

### Citizen

The citizen sends:

> **"There is a huge broken road near Sanjivani College."**

and attaches a photograph.

### CivicVoice

The system:

```text
Receives WhatsApp message
        ↓
Processes text + image
        ↓
Extracts complaint information
        ↓
Processes location
        ↓
Identifies responsible ward
        ↓
Creates complaint
        ↓
Routes to officer
```

### Officer

The responsible officer opens the complaint, reviews the available information and evidence, and updates the complaint status.

### Resolution

Once the complaint is marked resolved:

```text
Officer
   ↓
Status = RESOLVED
   ↓
CivicVoice
   ↓
WhatsApp Notification
   ↓
Citizen
```

This demonstrates the complete **citizen-to-government-to-citizen feedback loop**.

---

# 🖼️ Demo Evidence

Screenshots can be added here to demonstrate the working system.

### Citizen WhatsApp Interaction

*Add screenshot here*

### AI-Processed Complaint

*Add screenshot here*

### Officer Dashboard

*Add screenshot here*

### Complaint Details & Evidence

*Add screenshot here*

### Super Admin Analytics

*Add screenshot here*

---

# 🔮 Future Scope

CivicVoice can be extended with:

* 🌐 **Multilingual Support** — Support regional languages for wider citizen accessibility.
* 🔮 **Predictive Maintenance** — Use historical complaint patterns to identify infrastructure issues before they become critical.
* 🔗 **Municipal System Integration** — Connect with existing municipal ERP and work-order systems.
* 📈 **Advanced Analytics** — Use historical data for resource allocation and infrastructure planning.
* 📱 **Additional Citizen Channels** — Extend beyond WhatsApp to other communication channels.

---

# 👥 Team

### Team UrbanLoop

**Project:** CivicVoice
**Category:** Smart City / AI-Powered Civic Technology

---

# 📄 License

This repository is currently maintained as a **hackathon prototype** by Team UrbanLoop.
