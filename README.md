# StudyPrep AI: Personalized Academic Performance Platform

**StudyPrep AI** is a data-driven study ecosystem built to help university students manage cognitive load and improve retention. This project was developed as a full-stack proof-of-concept for an AI-enhanced educational tool.

## 🚀 Product Vision
To transform passive studying into an active, multisensory experience by leveraging Generative AI and data visualization, reducing student burnout through automated planning and progress transparency.

## 🧠 Why "StudyPrep AI"?
Unlike generic "StudyPrep" apps that merely store notes, **StudyPrep AI** focuses on **Active Intelligence**. The "AI" suffix represents:
1.  **Generative Audio:** Transforming static text into emotive human speech.
2.  **Autonomous Planning:** Algorithms that analyze your schedule to recommend daily goals.
3.  **Adaptive Analytics:** Identifying specific knowledge gaps that a human student might overlook.

## 🎨 Design Philosophy: "Calm Design"
This application adheres to **Calm Design** principles:
- **Mobile-First & PWA-Ready:** Engineered for high-stress, on-the-go student environments.
- **Minimalist Aesthetic:** Uses a "Stone/Neutral" palette to minimize visual fatigue during long study sessions.
- **Context-Aware UI:** Differentiates interfaces based on the course type (Exam vs. Project).

## 🧠 User Problem & Solution
| Problem | Product Solution |
| :--- | :--- |
| **Cognitive Overload** | Minimalist, "Calm Design" interface reduces visual noise and choice paralysis. |
| **Fragmented Study Flows** | Centralized dashboard combining Google Calendar tasks, Firebase database, and custom study logs. |
| **Passive Reading Fatigue** | **AI-Powered TTS:** Converts text flashcards into high-fidelity "Charon" human-male voices via Gemini 3.1 Flash. |
| **Lack of Visibility** | Structured performance dashboard tracking mastery trends and knowledge gaps. |

## 🛠 Features (The "What")
- **AI-Driven Study Ecosystem:** Uses Gemini API to generate daily goals and customize study difficulty.
- **Multisensory Flashcards:** High-performance Text-to-Speech (TTS) using the `@google/genai` SDK with smart fallbacks.
- **Performance Analytics:** Data visualization dashboard built with Recharts, tracking weekly consistency and topic mastery.
- **Academic Focus Mode:** A "deep work" timer UI designed to minimize distractions.

## 📸 Product Walkthrough & Ecosystem Dissection

### 1. The Intelligence Hub (Main Dashboard)
*The central command center for student life.*
- **AI-Generated Daily Strategy:** Analyzes your workload to suggest specific "Impact Tasks" every morning.
- **Dynamic Exam Countdown:** A persistent progress bar that calculates exactly how many weeks/days remain until your next major assessment by syncing with your **Google Calendar**.
- **Visual Timetable:** A streamlined view of your weekly class schedule to reduce context-switching.
- **Active Task Sync:** Integrated task tracker that fires notifications via the **Google Calendar API** to ensure zero missed deadlines.
*(Replace this text with your Dashboard Screenshot)*

### 2. User Profile & Semester Lifecycle Management
*Tailoring the platform to your academic journey.*
- **Semester Onboarding:** Students can "Start New Semester," which resets analytics for the current period while archiving previous data for historical growth tracking.
- **Academic Persona:** Captures University, Major, and current Semester to tune the AI recommendation engine.
- **Study Preferences:** Configure notification thresholds and voice speed for the AI assistant.
*(Replace this text with your Profile/Onboarding Screenshot)*

### 3. AI-Powered Flashcard & Quiz Engine
*Bridging the gap between passive reading and active recall.*
- **Multisensory Flashcards:** High-fidelity audio generation using **Gemini 3.1 Flash TTS**.
- **Adaptive Quiz Screen:** AI generates custom quizzes based on your uploaded notes. Includes instant grading and "Why I got this wrong" explanations.
- **Professor Style Training:** You can specify your professor's unique "Exam Style" (e.g., "Heavy on Case Studies" or "Multiple Choice focus"). The AI then mirrors this style in all generated quizzes and flashcards.
*(Replace this text with your Quiz/Flashcard Screenshot)*

### 4. Interactive Course Workspaces (Branching Paths)
*The application adapts its toolset based on the Course Type.*

#### **Path A: Exam-Based Courses**
- **Lecture Suite:** Upload and read PDFs/Slides directly in the app via **Google Drive API** integration.
- **Weekly Exam Simulations:** Automated, high-stakes mock exams that occur every weekend to build psychological stamina for finals.
- **Topic Heatmap:** Identifies which specific sub-topics are dragging down your grade average.
*(Replace this text with your Exam Workspace Screenshot)*

#### **Path B: Project-Based Courses**
- **Kanban Task Board:** Visual project management specifically for long-term group work or dissertations.
- **Milestone Tracker:** Strategic checkpoint planning with deadline reminders.
- **Professor Feedback Archive:** Targeted storage for academic guidance and critiques.
*(Replace this text with your Project Workspace Screenshot)*

### 5. Focus Sanctuary (Deep Work Timer)
*A minimalist sanctuary designed to stop procrastination.*
- **Clutter-Free Interface:** Strips away navigation to leave only the timer, the current task, and a focus-state tracker.
- **Scientific Breaks:** Automated Pomodoro logic (25/5 or 50/10) to optimize mental energy.
- **Session Analysis:** Syncs focus time back to the Analytics Dashboard to correlate deep work with grade improvement.
*(Replace this text with your Focus Mode Screenshot)*

### 6. Performance Analytics & Mastery Tracking
*Data transparency to drive student motivation and identify gaps.*
- **Mastery Heatmap:** Visualizes daily consistency over the last 21 days (the "habit-forming" window).
- **Topic Accuracy Trends:** Uses Recharts to identify specific knowledge gaps (e.g., "Weak Topics" vs. "Mastered Topics").
- **Growth Metrics:** Quantifies weekly improvement to provide objective feedback on study effectiveness.
*(Replace this text with your Analytics Screenshot)*

## 🔗 The API Ecosystem (Technical Integration)
To provide a seamless "one-stop-shop" experience, **StudyPrep AI** leverages a sophisticated API infrastructure:

| API | Core Functionality within StudyPrep AI |
| :--- | :--- |
| **Gemini AI API** | powers TTS (Charon voice), autonomous goal setting, and personalized quiz generation. |
| **Google Drive API** | allows students to upload, manage, and read lecture materials/PDFs directly within the app workspace. |
| **Google Calendar API** | provides real-time task synchronization, exam countdown calculations, and event notifications. |
| **Firebase Auth/Firestore** | manages secure user sessions and real-time cloud data persistence for courses and logs. |

## 🏗 Data Architecture
- **In-App Reader:** Custom PDF/Slide viewer that eliminates the need to leave the app for research.
- **Professor Learning Engine:** A specialized prompt-engineering layer that takes user-inputted "Exam Styles" and formats them into JSON schemas for the AI to follow.
- **Cloud-Native Sync:** Every change made (a task completed, a quiz taken) is instantly synced to the Firebase cloud, ensuring data parity across devices.

## 📊 Technical Product Management (The "How")
As a Product Manager, I led the technical implementation focusing on:
- **Architecture:** React (Frontend) + Express (Metadata/Server) + Firebase (Data Persistence).
- **AI Integration:** Implemented the `gemini-3.1-flash-tts-preview` model for low-latency, emotive speech generation.
- **API Strategy:** Integrated Google Calendar and Drive for real-time task and file synchronization.
- **Metric-Driven Design:** Developed a performance tracking suite focused on "Active Days" and "Topic Accuracy" to measure user success.

## 📈 Future Roadmap
- **Mobile Native Conversion:** Porting the PWA-core to React Native for App Store/Play Store distribution.
- **Social Accountability:** Multiplayer "Study Rooms" using real-time WebSockets.
- **Predictive Analytics:** ML-based exam readiness scoring.

---

### 💻 Developer Quick Start
1. `npm install`
2. Configure `.env` with `GEMINI_API_KEY` and `GOOGLE_API_KEY`.
3. `npm run dev`

---
*Created for portfolio purposes to demonstrate Product Management, AI Strategy, and Full-Stack capability.*
