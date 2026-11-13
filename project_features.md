# Unified Intelligence Platform (UIP) – Comprehensive Feature Documentation

The **Unified Intelligence Platform (UIP)** is an advanced, multi-tenant enterprise system combining knowledge graphs, document intelligence, real-time collaboration, predictive simulations, and generative AI. It is designed to ingest heterogeneous unstructured data, extract structured entities and relationships, run graph-theoretic analytics, simulate complex scenarios, and allow real-time human-in-the-loop collaboration.

Below is an exhaustive documentation of every single feature, including detailed sub-features and technical facts for each architectural component.

---

## 1. Core Architecture & Multi-Tenancy (Rooms)
At its core, UIP utilizes a rigorous multi-tenant model built on "Rooms". All user data, files, knowledge graphs, and chats are isolated per room.

### 🔹 Sub-features:
* **Room Workspaces:** Creation and management of custom Rooms representing projects, departments, or domains. Rooms can be updated, archived, or permanently deleted.
* **Membership & Invite System:** Room owners can invite other users by email. System roles (Owner, Editor, Observer) dictate granular workspace edit permissions.
* **Data Isolation Engine:** PostgreSQL and Neo4j architectures strictly isolate data by `room_id`.

> [!TIP]
> **Technical Fact:** Inter-tenant database leakage is strictly prevented at the query level using explicit SQLAlchemy filter clauses and Neo4j Cypher parameters, guaranteeing that users in Room A can never read, search, or link to entities in Room B.

---

## 2. Authentication, Authorization & User Management
A secure authentication layer controls access to the platform and manages user profiles.

### 🔹 Sub-features:
* **JWT-Based Authentication:** Employs double-token security with short-lived Access tokens and long-lived Refresh tokens stored securely.
* **Registration & Email Verification:** User sign-up flow requiring email, name, and password creation. Triggers automated SMTP verification emails with time-limited signature tokens.
* **Password Recovery:** Forgot-password workflow that dispatches secure reset links via email.
* **Profile & Avatar Management:** Users can update their names, passwords, emails, and upload/crop profile pictures.

> [!NOTE]
> **Technical Fact:** Passwords are cryptographically hashed using the `bcrypt` algorithm. API routes are robustly protected via FastAPI dependencies (`get_current_user`). Profile pictures are processed and stored in a localized media directory.

---

## 3. Document Intelligence & Continuous Ingestion
UIP allows users to drop unstructured files into the system and automatically translates them into structured knowledge.

### 🔹 Sub-features:
* **Multi-Format Document Upload:** Supports drag-and-drop uploading of multiple document formats.
* **Continuous Discovery Engine:** A background heartbeat service that monitors the document vault, picks up newly uploaded files, parses their text, and prepares them for LLM ingestion.
* **Dynamic Entity & Relationship Extraction Service:** Automatically scans document text to extract **Entities** (People, Organizations, Plants, Chemicals, Locations, Concepts) and **Relationships** (e.g., `affects`, `related_to`, `partner_of`).
* **Custom Extraction Rules:** Users can define dynamic active rules (e.g., *"Extract all marital relationships"*) which override standard AI behavior.

> [!IMPORTANT]
> **Technical Fact:** The extraction engine integrates directly with localized, on-premise LLMs (like Ollama running Qwen models) to ensure complete data privacy. Extracted nodes are linked directly back to their source document in PostgreSQL, creating verifiable provenance citations for every single knowledge graph node.

---

## 4. Interactive Knowledge Graph Visualizations
The system features dual layout visualization engines to map and navigate complex connections visually.

### 🔹 Sub-features:
* **2D Canvas Force-Directed Network Graph:** High-performance canvas rendering with color-coded halos, interactive node drag-and-drop, and dynamic physics force calculations.
* **3D Spatial Network Graph:** Renders the knowledge graph in full 3D WebGL space with glowing metalness/roughness shaders, camera panning, and 3D link physics.
* **Focus Mode (Progressive Disclosure):** Hovering over or clicking a node highlights its direct links and adjacent neighbors, dimming the rest of the network to reduce visual clutter.
* **Directional Particle Flow:** Animated particles travel along relationship links to represent connection strength and directionality.
* **Preset Layout Algorithms:** Includes algorithms to format the graph: Circular, Hierarchical Flow, Horizontal Flow, Radial, Grid, and Force Physics.

> [!TIP]
> **Technical Fact:** The application leverages `react-force-graph-2d`, `react-force-graph-3d`, and `Three.js` for rendering. When a user drags and releases a node in 2D mode, the custom coordinates are permanently saved to the database (`ui_x`, `ui_y`), pinning the layout across sessions.

---

## 5. System Dashboard & Analytics
Provides a bird's-eye view of room activities and graph metrics.

### 🔹 Sub-features:
* **Situational Metrics Panel:** Real-time counters displaying total entities, relationships, uploaded documents, and chat messages.
* **Activity Logs Feed:** A central, scrollable chronological stream capturing every creation, deletion, update, or AI reasoning call inside the room.
* **Entity Type Distribution:** Dynamic bar and pie charts mapping the structural quantity of entities per class.
* **Knowledge Growth Chart:** A timeline line chart mapping historical document uploads and node extractions over the last 30 days.

> [!NOTE]
> **Technical Fact:** The charts are generated using standard charting libraries that dynamically recalculate and animate whenever new entities are parsed by the Continuous Discovery Engine.

---

## 6. Real-Time Chat & Collaborative Tools
Rooms serve as real-time communication hubs where humans and AI collaborate seamlessly.

### 🔹 Sub-features:
* **Real-Time Room Chat:** WebSockets-based live messaging where users can send texts and upload attachments (images, files).
* **System AI Agent (Graph-RAG):** Tagging `@SystemAI` routes the message to a background AI reasoning service. The AI searches the Neo4j database and PostgreSQL document text to construct an answer based on actual room data.
* **Voice Messaging:** Built-in microphone audio recorder that uploads voice notes with custom waveform playback widgets.
* **Real-Time Video/Audio Calls:** WebRTC overlay that allows room members to start instant video/audio calls with screen-sharing capabilities.
* **Camera Capture:** Direct in-browser camera recording to snap photos or videos for chat attachments.

> [!IMPORTANT]
> **Technical Fact:** The `@SystemAI` utilizes **Retrieval-Augmented Generation (RAG)** combined with **Conversational Memory**. It actively recalls recent messages and fuses keyword-matched Neo4j graph nodes into the LLM prompt to provide highly accurate, hallucination-free answers with source citations.

---

## 7. Entity & Relationship Management
Allows users to step in and refine the knowledge graph manually.

### 🔹 Sub-features:
* **Manual Node Creation & Updates:** Form managers to manually inject new entities with custom types, descriptions, and metadata properties.
* **Manual Link Mapping:** Map source and target nodes with specific relationship classes.
* **Entity Resolution (Merging Duplicates):** A dedicated resolution service to identify and merge semantically identical entities (e.g., "Apple Tree" and "Apple Trees").

> [!TIP]
> **Technical Fact:** When merging entities, the Resolution Service programmatically iterates through all active incoming and outgoing relationship edges in Neo4j, re-routing them to the survivor node before deleting the duplicate, ensuring zero orphaned edges.

---

## 8. Digital Twins & Predictive Simulations
A simulation environment to model entity behaviors over time.

### 🔹 Sub-features:
* **Digital Twin Profiles:** Configure digital representations of complex systems (e.g., crop plots, factory components).
* **Parameter Optimization Engine:** Computes optimal input values (e.g., water levels, chemical dosages) to maximize efficiency or output.
* **Predictive Simulation Modeler:** Simulates scenarios (e.g., weather events, pest attacks) and evaluates probability vectors.

> [!NOTE]
> **Technical Fact:** The simulation engine processes chronological multi-variable equations and outputs the resulting time-series data, graphing predictions using interactive area charts.

---

## 9. Reporting & Exporting
Features to compile, summarize, and download workspace information offline.

### 🔹 Sub-features:
* **PDF & Markdown Report Generators:** Compiles comprehensive knowledge graph summaries, lists of entities, active relationships, and source document summaries.
* **Offline Exports:** Downloads professional reports directly from the UI for external stakeholders.

> [!TIP]
> **Technical Fact:** Reports dynamically compile current PostgreSQL data arrays and format them using backend templating engines before piping the output to downloadable file formats.
