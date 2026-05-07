import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import cookieParser from "cookie-parser";
import { Readable } from "stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("study_app.db");

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    courseId TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    content TEXT,
    FOREIGN KEY(courseId) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS google_tokens (
    uid TEXT PRIMARY KEY,
    tokens TEXT NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY,
    courseId TEXT NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    difficulty TEXT DEFAULT 'None',
    type TEXT DEFAULT 'Manual',
    source TEXT,
    topic TEXT,
    FOREIGN KEY(courseId) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS quiz_questions (
    id TEXT PRIMARY KEY,
    courseId TEXT NOT NULL,
    question TEXT NOT NULL,
    type TEXT NOT NULL,
    topic TEXT NOT NULL,
    suggestedAnswer TEXT NOT NULL,
    source TEXT,
    FOREIGN KEY(courseId) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS exam_questions (
    id TEXT PRIMARY KEY,
    courseId TEXT NOT NULL,
    question TEXT NOT NULL,
    type TEXT NOT NULL,
    topic TEXT NOT NULL,
    options TEXT, -- JSON string
    suggestedAnswer TEXT NOT NULL,
    points INTEGER NOT NULL,
    source TEXT,
    FOREIGN KEY(courseId) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS exam_simulations (
    id TEXT PRIMARY KEY,
    courseId TEXT NOT NULL,
    title TEXT NOT NULL,
    durationMinutes INTEGER NOT NULL,
    questions TEXT NOT NULL, -- JSON string
    status TEXT DEFAULT 'InProgress',
    currentIndex INTEGER DEFAULT 0,
    startTime INTEGER,
    answers TEXT, -- JSON string
    flaggedQuestions TEXT, -- JSON string
    FOREIGN KEY(courseId) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS evaluations (
    id TEXT PRIMARY KEY,
    courseId TEXT NOT NULL,
    questionId TEXT NOT NULL,
    studentAnswer TEXT NOT NULL,
    score INTEGER NOT NULL,
    correctPoints TEXT NOT NULL, -- JSON string
    missingPoints TEXT NOT NULL, -- JSON string
    feedback TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY(courseId) REFERENCES courses(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  const getOAuth2Client = (redirectUri?: string, uid?: string) => {
    const client_id = process.env.GOOGLE_CLIENT_ID?.trim();
    const client_secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const app_url = process.env.APP_URL?.replace(/\/$/, '');
    const redirect_uri = redirectUri || process.env.GOOGLE_REDIRECT_URI || `${app_url}/auth/google/callback`;

    const client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uri
    );

    if (uid) {
      client.on('tokens', (tokens) => {
        const row = db.prepare("SELECT tokens FROM google_tokens WHERE uid = ?").get(uid) as any;
        if (row) {
          const currentTokens = JSON.parse(row.tokens);
          const updatedTokens = { ...currentTokens, ...tokens };
          db.prepare("INSERT OR REPLACE INTO google_tokens (uid, tokens) VALUES (?, ?)")
            .run(uid, JSON.stringify(updatedTokens));
        }
      });
    }

    return client;
  };

  // Google Auth Routes
  app.get("/api/auth/google/url", (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "Missing uid" });

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ 
        error: "Google OAuth credentials are not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your AI Studio Secrets." 
      });
    }

    const client = getOAuth2Client();
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/drive.file", 
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/calendar.events"
      ],
      state: uid as string,
      prompt: "consent"
    });
    res.json({ url });
  });

  app.get("/auth/google/callback", async (req, res) => {
    const { code, state: uid } = req.query;
    if (!code || !uid) return res.status(400).send("Missing code or state");

    try {
      const client = getOAuth2Client();
      const { tokens } = await client.getToken(code as string);
      db.prepare("INSERT OR REPLACE INTO google_tokens (uid, tokens) VALUES (?, ?)")
        .run(uid, JSON.stringify(tokens));

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', uid: '${uid}' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Google Auth Error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.get("/api/drive/token", async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "Missing uid" });

    const row = db.prepare("SELECT tokens FROM google_tokens WHERE uid = ?").get(uid) as any;
    if (!row) return res.status(401).json({ error: "Not connected to Google Drive" });

    try {
      const tokens = JSON.parse(row.tokens);
      const client = getOAuth2Client(undefined, uid as string);
      client.setCredentials(tokens);
      
      const { token } = await client.getAccessToken();
      res.json({ accessToken: token });
    } catch (error) {
      console.error("Token Error:", error);
      res.status(500).json({ error: "Failed to get token" });
    }
  });

  app.get("/api/drive/status", (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "Missing uid" });

    const row = db.prepare("SELECT tokens FROM google_tokens WHERE uid = ?").get(uid);
    res.json({ connected: !!row });
  });

  app.post("/api/drive/disconnect", (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "UID is required" });
    
    try {
      db.prepare("DELETE FROM google_tokens WHERE uid = ?").run(uid);
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting Google Drive:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/drive/upload", async (req, res) => {
    const { uid, name, mimeType, content } = req.body;
    if (!uid || !content) return res.status(400).json({ error: "Missing data" });

    const row = db.prepare("SELECT tokens FROM google_tokens WHERE uid = ?").get(uid) as any;
    if (!row) return res.status(401).json({ error: "Not connected to Google Drive" });

    try {
      const tokens = JSON.parse(row.tokens);
      const client = getOAuth2Client(undefined, uid as string);
      client.setCredentials(tokens);

      // Ensure token is fresh
      await client.getAccessToken();

      const drive = google.drive({ version: "v3", auth: client });
      
      // Convert base64 to buffer
      const buffer = Buffer.from(content.split(",")[1], "base64");
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      const response = await drive.files.create({
        requestBody: {
          name: name,
          mimeType: mimeType,
        },
        media: {
          mimeType: mimeType,
          body: stream,
        },
        fields: "id, webViewLink, iconLink",
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("Drive Upload Error:", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  });

  app.get("/api/drive/download", async (req, res) => {
    const { uid, fileId } = req.query;
    if (!uid || !fileId) return res.status(400).json({ error: "Missing data" });

    const row = db.prepare("SELECT tokens FROM google_tokens WHERE uid = ?").get(uid) as any;
    if (!row) return res.status(401).json({ error: "Not connected to Google Drive" });

    try {
      const tokens = JSON.parse(row.tokens);
      const client = getOAuth2Client(undefined, uid as string);
      client.setCredentials(tokens);

      // Ensure token is fresh
      await client.getAccessToken();

      const drive = google.drive({ version: "v3", auth: client });
      
      // Get metadata first to check mimeType
      const metadata = await drive.files.get({
        fileId: fileId as string,
        fields: 'id, name, mimeType'
      });

      const mimeType = metadata.data.mimeType;
      let response;

      if (mimeType?.startsWith('application/vnd.google-apps.')) {
        // It's a Google Doc/Sheet/Slide, we must export it
        let exportMimeType = 'application/pdf';
        if (mimeType === 'application/vnd.google-apps.spreadsheet') {
          exportMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (mimeType === 'application/vnd.google-apps.presentation') {
          exportMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        } else if (mimeType === 'application/vnd.google-apps.document') {
          exportMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        }

        console.log(`Exporting Google Drive file ${fileId} (${mimeType}) as ${exportMimeType}`);
        response = await drive.files.export({
          fileId: fileId as string,
          mimeType: exportMimeType
        }, { responseType: 'arraybuffer' });

        const base64 = Buffer.from(response.data as any).toString('base64');
        res.json({ 
          mimeType: exportMimeType, 
          data: base64 
        });
      } else {
        console.log(`Downloading Google Drive file ${fileId} (${mimeType})`);
        response = await drive.files.get({
          fileId: fileId as string,
          alt: 'media'
        }, { responseType: 'arraybuffer' });

        const base64 = Buffer.from(response.data as any).toString('base64');
        res.json({ 
          mimeType: mimeType, 
          data: base64 
        });
      }
    } catch (error: any) {
      console.error("Drive Download Error:", error.message || error);
      if (error.code === 404) {
        return res.status(404).json({ error: "File not found in Google Drive. Please check the file ID and permissions." });
      }
      if (error.code === 401 || error.code === 403) {
        return res.status(error.code).json({ error: "Google Drive authentication failed. Please reconnect your account." });
      }
      res.status(500).json({ error: "Download failed", details: error.message });
    }
  });

  app.get("/api/proxy", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "Missing url" });

    try {
      console.log(`Proxying request to: ${url}`);
      const response = await fetch(url as string, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': '*/*'
        }
      });
      
      if (!response.ok) {
        console.error(`Proxy target returned ${response.status} for ${url}`);
        // Return the status from the target to the client
        return res.status(response.status).json({ 
          error: `Target returned ${response.status}`,
          status: response.status,
          url: url,
          message: response.status === 401 || response.status === 403 
            ? "This resource requires authentication or is protected. If this is a Google Drive file, please ensure you have connected your Google account in the dashboard."
            : "The resource could not be fetched."
        });
      }
      
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = response.headers.get('content-type') || 'application/octet-stream';
      
      res.json({ mimeType, data: base64 });
    } catch (error) {
      console.error("Proxy Error for URL:", url, error);
      res.status(500).json({ error: "Proxy failed", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Google Calendar Sync API
  app.post("/api/calendar/sync", async (req, res) => {
    const { uid, events } = req.body;
    if (!uid || !events || !Array.isArray(events)) {
      return res.status(400).json({ error: "Missing uid or events array" });
    }

    const row = db.prepare("SELECT tokens FROM google_tokens WHERE uid = ?").get(uid) as any;
    if (!row) return res.status(401).json({ error: "Not connected to Google" });

    try {
      const tokens = JSON.parse(row.tokens);
      const client = getOAuth2Client(undefined, uid as string);
      client.setCredentials(tokens);

      const calendar = google.calendar({ version: "v3", auth: client });

      const results = [];
      for (const event of events) {
        try {
          // Check if event already exists by looking for a private extended property
          // or just create it. For simplicity, we'll create new ones or update if we had an ID.
          // In a real app, you'd store the Google Event ID in your DB.
          
          const googleEvent = {
            summary: event.title,
            description: event.description || `Course: ${event.courseName || 'General'}`,
            start: {
              dateTime: event.start, // Expecting ISO string
              timeZone: 'UTC',
            },
            end: {
              dateTime: event.end || event.start, // Expecting ISO string
              timeZone: 'UTC',
            },
            reminders: {
              useDefault: true
            },
            extendedProperties: {
              private: {
                appEventId: event.id
              }
            }
          };

          const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: googleEvent,
          });
          results.push({ id: event.id, googleId: response.data.id });
        } catch (err) {
          console.error(`Failed to sync event ${event.id}:`, err);
          results.push({ id: event.id, error: String(err) });
        }
      }

      res.json({ success: true, results });
    } catch (error: any) {
      console.error("Calendar Sync Error:", error);
      res.status(500).json({ error: error.message || "Sync failed" });
    }
  });

  // Courses API
  app.get("/api/courses", (req, res) => {
    const courses = db.prepare("SELECT * FROM courses").all();
    res.json(courses);
  });

  app.post("/api/courses", (req, res) => {
    const { id, name, description, color } = req.body;
    db.prepare("INSERT OR REPLACE INTO courses (id, name, description, color) VALUES (?, ?, ?, ?)")
      .run(id, name, description, color);
    res.json({ success: true });
  });

  // Files API
  app.get("/api/files/:courseId", (req, res) => {
    const files = db.prepare("SELECT * FROM files WHERE courseId = ?").all(req.params.courseId);
    res.json(files);
  });

  app.post("/api/files", (req, res) => {
    const { id, courseId, name, type, content } = req.body;
    db.prepare("INSERT OR REPLACE INTO files (id, courseId, name, type, content) VALUES (?, ?, ?, ?, ?)")
      .run(id, courseId, name, type, content);
    res.json({ success: true });
  });

  // Flashcards API
  app.get("/api/flashcards/:courseId", (req, res) => {
    const flashcards = db.prepare("SELECT * FROM flashcards WHERE courseId = ?").all(req.params.courseId);
    res.json(flashcards);
  });

  app.post("/api/flashcards", (req, res) => {
    const { id, courseId, front, back, difficulty, type, source, topic } = req.body;
    db.prepare("INSERT OR REPLACE INTO flashcards (id, courseId, front, back, difficulty, type, source, topic) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, courseId, front, back, difficulty, type, source, topic);
    res.json({ success: true });
  });

  app.delete("/api/flashcards/:id", (req, res) => {
    db.prepare("DELETE FROM flashcards WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Quiz Questions API
  app.get("/api/quiz-questions/:courseId", (req, res) => {
    const questions = db.prepare("SELECT * FROM quiz_questions WHERE courseId = ?").all(req.params.courseId);
    res.json(questions);
  });

  app.post("/api/quiz-questions", (req, res) => {
    const { id, courseId, question, type, topic, suggestedAnswer, source } = req.body;
    db.prepare("INSERT OR REPLACE INTO quiz_questions (id, courseId, question, type, topic, suggestedAnswer, source) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, courseId, question, type, topic, suggestedAnswer, source);
    res.json({ success: true });
  });

  app.delete("/api/quiz-questions/:id", (req, res) => {
    db.prepare("DELETE FROM quiz_questions WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Exam Questions API
  app.get("/api/exam-questions/:courseId", (req, res) => {
    const questions = db.prepare("SELECT * FROM exam_questions WHERE courseId = ?").all(req.params.courseId);
    res.json(questions.map(q => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : undefined
    })));
  });

  app.post("/api/exam-questions", (req, res) => {
    const { id, courseId, question, type, topic, options, suggestedAnswer, points, source } = req.body;
    db.prepare("INSERT OR REPLACE INTO exam_questions (id, courseId, question, type, topic, options, suggestedAnswer, points, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, courseId, question, type, topic, options ? JSON.stringify(options) : null, suggestedAnswer, points, source);
    res.json({ success: true });
  });

  app.delete("/api/exam-questions/:id", (req, res) => {
    db.prepare("DELETE FROM exam_questions WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Exam Simulations API
  app.get("/api/exam-simulations/:courseId", (req, res) => {
    const simulations = db.prepare("SELECT * FROM exam_simulations WHERE courseId = ?").all(req.params.courseId);
    res.json(simulations.map(s => ({
      ...s,
      questions: JSON.parse(s.questions),
      answers: s.answers ? JSON.parse(s.answers) : {},
      flaggedQuestions: s.flaggedQuestions ? JSON.parse(s.flaggedQuestions) : []
    })));
  });

  app.post("/api/exam-simulations", (req, res) => {
    const { id, courseId, title, durationMinutes, questions, status, currentIndex, startTime, answers, flaggedQuestions } = req.body;
    db.prepare("INSERT OR REPLACE INTO exam_simulations (id, courseId, title, durationMinutes, questions, status, currentIndex, startTime, answers, flaggedQuestions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, courseId, title, durationMinutes, JSON.stringify(questions), status, currentIndex, startTime, JSON.stringify(answers), JSON.stringify(flaggedQuestions));
    res.json({ success: true });
  });

  // Evaluations API
  app.get("/api/evaluations/:courseId", (req, res) => {
    const evaluations = db.prepare("SELECT * FROM evaluations WHERE courseId = ?").all(req.params.courseId);
    res.json(evaluations.map(e => ({
      ...e,
      correctPoints: JSON.parse(e.correctPoints),
      missingPoints: JSON.parse(e.missingPoints)
    })));
  });

  app.post("/api/evaluations", (req, res) => {
    const { id, courseId, questionId, studentAnswer, score, correctPoints, missingPoints, feedback, timestamp } = req.body;
    db.prepare("INSERT OR REPLACE INTO evaluations (id, courseId, questionId, studentAnswer, score, correctPoints, missingPoints, feedback, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, courseId, questionId, studentAnswer, score, JSON.stringify(correctPoints), JSON.stringify(missingPoints), feedback, timestamp);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
