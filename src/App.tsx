/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { 
  format, 
  addDays, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth,
  isWithinInterval, 
  differenceInDays, 
  startOfMonth, 
  endOfMonth, 
  addWeeks, 
  subWeeks,
  addMonths,
  subMonths,
  differenceInWeeks,
  parseISO
} from 'date-fns';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  AreaChart, Area, FunnelChart, Funnel, LabelList, ComposedChart
} from 'recharts';
import { 
  BookOpen, 
  LayoutGrid,
  Plus, 
  FileUp, 
  Zap, 
  Clock, 
  Layers, 
  Calendar,
  ChevronRight,
  ChevronLeft,
  Settings,
  Trash2,
  GraduationCap,
  Home,
  Book,
  FileText,
  Briefcase,
  X,
  Check,
  CheckSquare,
  CheckCircle2,
  Lightbulb,
  MoreVertical,
  ArrowLeft,
  History,
  ChevronUp,
  Sparkles,
  Upload,
  Brain,
  Trophy,
  Target,
  MessageSquare,
  AlertCircle,
  XCircle,
  RotateCcw,
  ArrowRight,
  Filter,
  Bell,
  Search,
  Timer,
  Coffee,
  Eye,
  MousePointer2,
  BarChart2,
  ChevronDown,
  Pause,
  Play,
  User as UserIcon,
  Camera,
  LogOut,
  Edit2,
  RefreshCw,
  SkipForward,
  SkipBack,
  Mic,
  Volume2,
  Settings2,
  Cloud,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, storage } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs, 
  deleteDoc, 
  addDoc, 
  serverTimestamp, 
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  getBlob
} from 'firebase/storage';

// Types
type CourseType = 'Exam' | 'Project';
type AppView = 'home' | 'courses' | 'workspace' | 'lecture-materials' | 'flashcards' | 'quiz-practice' | 'exam-simulation' | 'calendar' | 'study-timer' | 'past-exams' | 'progress' | 'project-notes' | 'project-tasks' | 'project-milestones' | 'project-insights';

interface StudySessionLog {
  id: string;
  courseId: string;
  courseName: string;
  durationMinutes: number;
  date: string;
  time: string;
  note?: string;
}

interface StudyTimerSettings {
  studyMinutes: number;
  breakMinutes: number;
  cycles: number;
}

interface DailyGoal {
  id: string;
  title: string;
  completed: boolean;
  category: 'Study' | 'Review' | 'Practice' | 'Exam';
  date: string;
}

interface PerformanceData {
  courseId: string;
  weakTopics: { topic: string; score: number }[];
  flashcardAccuracy: number;
  quizLevel: number; // 0-100
  simulationScores: { date: string; score: number }[];
  improvementData: { date: string; value: number }[];
  dailyStudy: Record<string, boolean>; // date string -> boolean
}

type EventType = 'Class' | 'Exam' | 'Study Session' | 'Assignment Deadline' | 'Exam Simulation' | 'Personal Reminder' | 'Project' | 'Insight';

interface CalendarEvent {
  id: string;
  type: EventType;
  courseId?: string;
  courseName?: string;
  title: string;
  date: string; // Start date YYYY-MM-DD
  endDate?: string; // End date YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  notes?: string;
  reminderMinutes?: number;
  priority?: 'Low' | 'Medium' | 'High';
  status?: 'Not Started' | 'In Progress' | 'Completed';
  zoomLink?: string;
  professor?: string;
}

interface TimetableEntry {
  id: string;
  courseName: string;
  courseId?: string;
  dayOfWeek: string; // 'Monday', 'Tuesday', etc.
  startTime: string;
  endTime: string;
  location?: string;
  zoomLink?: string;
  professor?: string;
  semesterStart: string;
  semesterEnd: string;
}

interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

interface AcademicTask {
  id: string;
  title: string;
  courseName: string;
  courseId?: string;
  startDate?: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Not Started' | 'In Progress' | 'Completed';
  notes?: string;
  subtasks?: SubTask[];
}

interface ProfessorInsight {
  id: string;
  courseName: string;
  courseId?: string;
  content: string;
  dateAdded: string;
}

interface ExamQuestion {
  id: string;
  courseId: string;
  question: string;
  type: 'Theory' | 'Explanation' | 'CodeExplanation' | 'CodeWriting' | 'Diagram' | 'Calculation' | 'MultipleChoice';
  topic: string;
  options?: string[]; // for MultipleChoice
  suggestedAnswer: string;
  points: number;
  source?: string;
}

interface ExamSimulationSession {
  id: string;
  courseId: string;
  title: string;
  durationMinutes: number;
  questions: ExamQuestion[];
  currentIndex: number;
  startTime?: number;
  endTime?: number;
  status: 'NotStarted' | 'InProgress' | 'Completed';
  answers: Record<string, string>;
  flaggedQuestions: string[];
  sourceType?: 'All' | 'Source' | 'Topic';
  sourceId?: string;
  createdAt?: number;
  score?: number;
  result?: ExamResult;
}

interface ExamResult {
  score: number;
  timeUsedSeconds: number;
  correctAnswers: number;
  totalQuestions: number;
  weakTopics: string[];
  evaluations: Record<string, QuizEvaluation>;
}

interface QuizQuestion {
  id: string;
  courseId: string;
  question: string;
  type: 'Definition' | 'Explanation' | 'Comparison' | 'Code' | 'Calculation' | 'Diagram';
  topic: string;
  suggestedAnswer: string;
  source?: string;
}

interface QuizEvaluation {
  id: string;
  courseId: string;
  questionId: string;
  studentAnswer: string;
  score: number;
  correctPoints: string[];
  missingPoints: string[];
  incorrectPoints: string[];
  feedback: string;
  timestamp: number;
}

interface QuizSession {
  questions: QuizQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  evaluations: Record<string, QuizEvaluation>;
  mode: 'Quick' | 'Topic' | 'Exam';
  timeLeft?: number;
  startTime: number;
  difficulties: Record<string, 'Easy' | 'Medium' | 'Hard'>;
}

interface ProjectTask {
  id: string;
  courseId: string;
  uid: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'To Do' | 'In Progress' | 'Done' | 'Overdue';
  createdAt: string;
}

interface ProjectMilestone {
  id: string;
  courseId: string;
  uid: string;
  title: string;
  dueDate: string;
  status: 'Upcoming' | 'Completed';
}

interface ProjectNote {
  id: string;
  courseId: string;
  uid: string;
  title: string;
  content: string;
  updatedAt: string;
}

interface ProjectInsight {
  id: string;
  courseId: string;
  uid: string;
  content: string;
  source: string;
  date: string;
}

interface Topic {
  id: string;
  uid: string;
  name: string;
  courseId: string;
}

interface Flashcard {
  id: string;
  courseId: string;
  topicId: string;
  question: string;
  answer: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'None';
  type: 'AI' | 'Imported' | 'Manual';
  topic?: string;
  source?: string;
  createdAt: string;
}

interface LectureFile {
  id: string;
  courseId: string;
  name: string;
  uploadDate: string;
  pages: number;
  fileUrl?: string;
  fileType?: string;
}

interface PastQuestion {
  id: string;
  courseId: string;
  title: string;
  year: string;
  semester: string;
  content?: string;
  uploadDate: string;
  fileUrl?: string;
  fileType?: string;
}

interface Course {
  id: string;
  uid: string;
  name: string;
  type: CourseType;
  flashcardsCount: number;
  lecturesCount: number;
  quizQuestionsCount: number;
  lastStudied: string;
  color: string;
  status: 'Active' | 'Past';
  progress?: number;
}

interface UserProfile {
  uid: string;
  firstName: string;
  email: string;
  universityName: string;
  courseOfStudy: string;
  currentSemester: number;
  pastCourses: string[];
  profilePicture?: string;
  lastSemesterUpdate?: string;
}

const compressImage = (file: File, maxWidth: number = 400, maxHeight: number = 400): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

interface Task {
  id: string;
  type: string;
  course: string;
  description: string;
}

interface WeeklySimulation {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  durationMinutes: number;
  day: string;
  time: string;
  status: 'NotStarted' | 'InProgress' | 'Completed';
}

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

/// Mock Data
const INITIAL_COURSES: Course[] = [];

const MOCK_LECTURE_FILES: LectureFile[] = [];

const MOCK_PAST_QUESTIONS: PastQuestion[] = [];

const MOCK_FLASHCARDS: Flashcard[] = [];

const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [];

const MOCK_EXAM_QUESTIONS: ExamQuestion[] = [];

const MOCK_QUIZ_QUESTIONS: QuizQuestion[] = [];

const MOCK_STUDY_LOGS: StudySessionLog[] = [];

const MOCK_PERFORMANCE_DATA: Record<string, PerformanceData> = {};

const MOCK_TASKS: Task[] = [];

const WORKSPACE_TOOLS: Tool[] = [
  { 
    id: 'lectures', 
    title: 'Lecture Materials', 
    description: 'Upload and read lecture PDFs directly inside the app. AI can generate flashcards or quiz questions.',
    icon: <FileText className="w-6 h-6" />,
    color: 'bg-blue-50 text-blue-600'
  },
  { 
    id: 'flashcards', 
    title: 'Flashcards', 
    description: 'Study flashcards generated from lecture notes or imported manually. Track performance levels.',
    icon: <Layers className="w-6 h-6" />,
    color: 'bg-orange-50 text-orange-600'
  },
  { 
    id: 'quiz', 
    title: 'Quiz Practice', 
    description: 'Practice short-answer questions based on lecture content. Improve recall of key concepts.',
    icon: <Zap className="w-6 h-6" />,
    color: 'bg-yellow-50 text-yellow-600'
  },
  { 
    id: 'simulation', 
    title: 'Exam Simulation', 
    description: 'Simulate a real exam environment with a timer and randomized questions under time pressure.',
    icon: <Clock className="w-6 h-6" />,
    color: 'bg-red-50 text-red-600'
  },
  { 
    id: 'calendar', 
    title: 'Study Calendar', 
    description: 'Organize your academic schedule, track deadlines, and plan study blocks.',
    icon: <Calendar className="w-6 h-6" />,
    color: 'bg-emerald-50 text-emerald-600'
  },
  { 
    id: 'timer', 
    title: 'Study Timer', 
    description: 'Use the Pomodoro technique to stay focused and track your study time.',
    icon: <Timer className="w-6 h-6" />,
    color: 'bg-orange-50 text-orange-600'
  },
  { 
    id: 'past-exams', 
    title: 'Past Exams', 
    description: 'Store past exam papers and solutions. Use them for practice and AI question generation.',
    icon: <History className="w-6 h-6" />,
    color: 'bg-stone-100 text-stone-600'
  },
];

const PROJECT_TOOLS: Tool[] = [
  { 
    id: 'project-notes', 
    title: 'Notes & Documentation', 
    description: 'Write structured notes, store ideas, and document project requirements.',
    icon: <Edit2 className="w-6 h-6" />,
    color: 'bg-indigo-50 text-indigo-600'
  },
  { 
    id: 'project-tasks', 
    title: 'Task Management', 
    description: 'Manage project tasks with a Kanban board. Track progress and deadlines.',
    icon: <CheckSquare className="w-6 h-6" />,
    color: 'bg-emerald-50 text-emerald-600'
  },
  { 
    id: 'project-milestones', 
    title: 'Milestones Tracker', 
    description: 'Define major checkpoints and track project progress on a timeline.',
    icon: <Target className="w-6 h-6" />,
    color: 'bg-purple-50 text-purple-600'
  },
  { 
    id: 'project-insights', 
    title: 'Professor Insights', 
    description: 'Capture and review guidance provided by your professor for this project.',
    icon: <Lightbulb className="w-6 h-6" />,
    color: 'bg-amber-50 text-amber-600'
  },
  { 
    id: 'calendar', 
    title: 'Project Calendar', 
    description: 'View project deadlines, tasks, and milestones in your calendar.',
    icon: <Calendar className="w-6 h-6" />,
    color: 'bg-stone-50 text-stone-600'
  }
];

// --- Performance Tracker Component ---

const FilePreviewModal = ({ file, onClose }: { file: { name: string; url: string; type: string }; onClose: () => void }) => {
  const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png'].includes(file.type.toLowerCase());
  const isPdf = file.type === 'application/pdf' || file.type.toLowerCase() === 'pdf';
  const isPpt = file.type.includes('presentation') || file.type.includes('powerpoint') || ['ppt', 'pptx'].includes(file.type.toLowerCase());

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/90 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-5xl h-full max-h-[90vh] bg-white rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-400">
              {isImage ? <Upload className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-stone-900 truncate max-w-[200px] sm:max-w-md">{file.name}</h2>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{file.type}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        <div className="flex-1 bg-stone-50 overflow-auto flex items-center justify-center p-4">
          {file.url.includes('drive.google.com') ? (
            <div className="w-full h-full flex flex-col">
              <iframe src={file.url} className="flex-1 w-full border-none rounded-lg" title={file.name} />
              <div className="p-4 flex justify-center">
                <a 
                  href={file.url.replace('/preview', '/view')} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-stone-900 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-stone-800 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Google Drive
                </a>
              </div>
            </div>
          ) : (
            <>
              {isImage && (
                <img src={file.url} alt={file.name} className="max-w-full max-h-full object-contain rounded-lg shadow-lg" referrerPolicy="no-referrer" />
              )}
              {isPdf && (
                <iframe src={file.url} className="w-full h-full border-none rounded-lg" title={file.name} />
              )}
              {isPpt && (
                <div className="text-center p-12">
                  <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center text-orange-600 mx-auto mb-6">
                    <FileText className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 mb-2">PowerPoint Preview</h3>
                  <p className="text-sm text-stone-500 mb-8">Slide preview mode is active for this presentation.</p>
                  <div className="aspect-video w-full max-w-2xl bg-white rounded-2xl shadow-xl flex items-center justify-center border border-stone-200">
                    <p className="text-stone-400 font-medium italic">Presentation Slide 1</p>
                  </div>
                </div>
              )}
              {!isImage && !isPdf && !isPpt && (
                <div className="text-center p-12">
                  <AlertCircle className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                  <p className="text-stone-500">Preview not available for this file type.</p>
                  <a href={file.url} download={file.name} className="mt-4 inline-block px-6 py-3 bg-stone-900 text-white rounded-xl font-bold text-sm">Download File</a>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

interface PerformanceTrackerProps {
  courses: Course[];
  studyLogs: StudySessionLog[];
  flashcards: Flashcard[];
  evaluations: Record<string, QuizEvaluation[]>;
  quizQuestions: QuizQuestion[];
  examSimulations: ExamSimulationSession[];
  setView?: (view: AppView) => void;
}

interface TopicPerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: string;
  score: number;
  allTopics: { topic: string, score: number }[];
}

const TopicPerformanceModal: React.FC<TopicPerformanceModalProps> = ({ isOpen, onClose, topic, score, allTopics }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-serif italic">Topic Performance</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-stone-50 rounded-3xl p-6 text-center">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Selected Topic</p>
            <h3 className="text-xl font-bold text-stone-900 mb-2">{topic}</h3>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold text-stone-900">{score}%</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${score >= 70 ? 'bg-emerald-50 text-emerald-600' : score >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                {score >= 70 ? 'Strong' : score >= 50 ? 'Developing' : 'Weak'}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">All Topics in Course</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
              {allTopics.map((t) => (
                <div key={t.topic} className="flex items-center justify-between p-4 bg-white border border-stone-100 rounded-2xl shadow-sm">
                  <span className="text-sm font-medium text-stone-800 truncate w-40">{t.topic}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${t.score >= 70 ? 'bg-emerald-500' : t.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${t.score}%` }} />
                    </div>
                    <span className="text-xs font-bold text-stone-900">{t.score}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-8 py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm hover:bg-stone-800 transition-all"
        >
          Got it
        </button>
      </motion.div>
    </div>
  );
};

const PerformanceTracker: React.FC<PerformanceTrackerProps> = ({ 
  courses, 
  studyLogs, 
  flashcards, 
  evaluations,
  quizQuestions,
  examSimulations,
  setView
}) => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(courses.length > 0 ? courses[0] : null);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<{ topic: string, score: number } | null>(null);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  
  const COLORS = ['#1C1917', '#44403C', '#78716C', '#A8A29E', '#D6D3D1'];
  
  const getRealData = () => {
    if (!selectedCourse) return null;

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const studyTimeData = last7Days.map(date => {
      const dayLogs = studyLogs.filter(l => l.courseId === selectedCourse.id && l.date === date);
      const totalMins = dayLogs.reduce((acc, curr) => acc + curr.durationMinutes, 0);
      return { date: format(parseISO(date), 'MMM dd'), value: totalMins };
    });

    const courseFlashcards = flashcards.filter(f => f.courseId === selectedCourse.id);
    const difficultyCounts = {
      Easy: courseFlashcards.filter(f => f.difficulty === 'Easy').length,
      Medium: courseFlashcards.filter(f => f.difficulty === 'Medium').length,
      Hard: courseFlashcards.filter(f => f.difficulty === 'Hard').length
    };
    const difficultyData = Object.entries(difficultyCounts)
      .filter(([_, count]) => count > 0)
      .map(([label, count]) => ({ name: label, value: count }));

    const courseEvaluations = evaluations[selectedCourse.id] || [];
    
    const dailyStudy: Record<string, boolean> = {};
    studyLogs.filter(l => l.courseId === selectedCourse.id).forEach(l => {
      dailyStudy[l.date] = true;
    });

    const topicPerformance: Record<string, { totalScore: number, count: number }> = {};
    courseEvaluations.forEach(ev => {
      const q = quizQuestions.find(qq => qq.id === ev.questionId);
      if (q && q.topic) {
        if (!topicPerformance[q.topic]) topicPerformance[q.topic] = { totalScore: 0, count: 0 };
        topicPerformance[q.topic].totalScore += ev.score;
        topicPerformance[q.topic].count += 1;
      }
    });

    const allTopics = Object.entries(topicPerformance)
      .map(([topic, data]) => ({ topic, score: Math.round(data.totalScore / data.count) }))
      .sort((a, b) => b.score - a.score);

    const weakTopics = [...allTopics]
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);

    const flashcardAccuracy = courseFlashcards.length > 0 
      ? Math.round((courseFlashcards.filter(f => f.difficulty === 'Easy').length / courseFlashcards.length) * 100)
      : 0;
    
    const quizAccuracy = courseEvaluations.length > 0
      ? Math.round((courseEvaluations.filter(e => e.score >= 70).length / courseEvaluations.length) * 100)
      : 0;

    const overallAccuracy = Math.round((flashcardAccuracy + quizAccuracy) / (
      (flashcardAccuracy > 0 ? 1 : 0) + (quizAccuracy > 0 ? 1 : 0) || 1
    ));

    const accuracyTrendData = last7Days.map(date => {
      const dayEvals = courseEvaluations.filter(e => format(new Date(e.timestamp), 'yyyy-MM-dd') === date);
      const totalItems = dayEvals.length;
      if (totalItems === 0) return { date: format(parseISO(date), 'MMM dd'), value: 0 };
      const correctItems = dayEvals.filter(e => e.score >= 70).length;
      return { date: format(parseISO(date), 'MMM dd'), value: Math.round((correctItems / totalItems) * 100) };
    });

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dailyStudy[today] || dailyStudy[yesterday]) {
      let current = dailyStudy[today] ? today : yesterday;
      while (dailyStudy[current]) {
        streak++;
        const d = parseISO(current);
        d.setDate(d.getDate() - 1);
        current = d.toISOString().split('T')[0];
      }
    }

    return { 
      studyTimeData, 
      difficultyData, 
      dailyStudy,
      weakTopics,
      allTopics,
      overallAccuracy,
      accuracyTrendData,
      streak
    };
  };

  const realData = getRealData();
  const todayStr = new Date().toISOString().split('T')[0];
  const studiedToday = realData?.dailyStudy[todayStr] || false;

  const renderChart = (type: string) => {
    if (!realData) return <div className="h-[200px] flex items-center justify-center text-stone-400 text-[10px] uppercase font-bold">Waiting for data...</div>;

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={realData.studyTimeData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f2ed" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#78716C' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#78716C' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                cursor={{ fill: '#f5f2ed' }}
              />
              <Bar dataKey="value" fill="#1C1917" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'accuracy':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={realData.accuracyTrendData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1C1917" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#1C1917" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f2ed" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#78716C' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#78716C' }} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
              />
              <Area type="monotone" dataKey="value" stroke="#1C1917" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white border border-stone-100 rounded-[2.5rem] p-8 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
        <div>
          <h3 className="text-2xl font-serif italic text-stone-900 mb-1">Performance Dashboard</h3>
          <p className="text-xs text-stone-500 font-medium">Synced with your academic roadmap</p>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
            className="w-full md:w-auto flex items-center justify-between gap-4 bg-stone-50 border border-stone-100 rounded-2xl px-6 py-3 text-xs font-bold text-stone-700 hover:bg-stone-100 transition-all"
          >
            {selectedCourse?.name || 'Select Course'}
            <ChevronDown className={`w-4 h-4 transition-transform ${isCourseDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {isCourseDropdownOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full right-0 mt-2 w-64 bg-white border border-stone-100 rounded-2xl shadow-2xl z-40 overflow-hidden"
              >
                {courses.map(course => (
                  <button
                    key={course.id}
                    onClick={() => {
                      setSelectedCourse(course);
                      setIsCourseDropdownOpen(false);
                    }}
                    className="w-full text-left px-6 py-4 hover:bg-stone-50 text-xs font-medium text-stone-700 border-b border-stone-50 last:border-none transition-colors"
                  >
                    {course.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="bg-stone-50 rounded-[2rem] p-6 lg:col-span-1">
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Study Consistency</span>
            <div className={`px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest ${studiedToday ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
              {studiedToday ? 'Active' : 'Idle'}
            </div>
          </div>
          {renderChart('bar')}
          <div className="mt-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Weekly Streak</p>
              <p className="text-xl font-bold text-stone-900">{realData?.streak || 0} Days</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Daily Avg</p>
              <p className="text-xl font-bold text-stone-900">
                {realData ? Math.round(realData.studyTimeData.reduce((acc, b) => acc + (b.value || 0), 0) / (realData.studyTimeData.length || 1)) : 0}m
              </p>
            </div>
          </div>
        </div>

        <div className="bg-stone-50 rounded-[2rem] p-6 lg:col-span-1">
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Mastery Progress</span>
            <span className="text-[10px] font-bold text-stone-900">{realData?.overallAccuracy || 0}% Overall</span>
          </div>
          {renderChart('accuracy')}
          <div className="mt-6">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Topic Strengths</p>
            <div className="flex flex-wrap gap-2">
              {realData?.allTopics.slice(0, 3).map(topic => (
                <span key={topic.topic} className="px-3 py-1.5 bg-white border border-stone-200 rounded-full text-[10px] font-bold text-stone-700">
                  {topic.topic}
                </span>
              ))}
              {(!realData || realData.allTopics.length === 0) && (
                <p className="text-[10px] text-stone-400">Complete more sessions to identify strengths.</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-stone-50 rounded-[2rem] p-6 lg:col-span-1">
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Knowledge Gaps</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="space-y-4">
            {realData?.weakTopics.slice(0, 4).map(topic => (
              <div 
                key={topic.topic} 
                className="cursor-pointer group"
                onClick={() => {
                  setSelectedTopic(topic);
                  setIsTopicModalOpen(true);
                }}
              >
                <div className="flex justify-between text-[10px] font-bold text-stone-700 mb-2 group-hover:text-stone-900 transition-colors">
                  <span className="truncate flex-1">{topic.topic}</span>
                  <span>{topic.score}%</span>
                </div>
                <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${topic.score}%` }}
                    className={`h-full rounded-full ${topic.score >= 70 ? 'bg-emerald-500' : topic.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                  />
                </div>
              </div>
            ))}
            {(!realData || realData.weakTopics.length === 0) && (
              <p className="text-[10px] text-stone-400 text-center py-8 bg-white/50 rounded-2xl border border-dashed border-stone-300">
                Data missing. Start a study session!
              </p>
            )}
          </div>
          {setView && (
            <button 
              onClick={() => setView('courses')}
              className="w-full mt-6 py-3 bg-stone-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors"
            >
              Review Weak Topics
            </button>
          )}
        </div>
      </div>

      {/* Heatmap Section */}
      <div className="pt-8 border-t border-stone-100">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Study Consistency (Last 21 Days)</h4>
          <span className="text-[10px] font-bold text-stone-900">
            {realData ? Object.values(realData.dailyStudy).filter(Boolean).length : 0} Days Studied
          </span>
        </div>
        <div className="flex gap-1 justify-between">
          {Array.from({ length: 21 }, (_, i) => {
            const d = new Date();
            d.setDate(new Date().getDate() - (20 - i));
            const dateStr = d.toISOString().split('T')[0];
            const isStudied = realData?.dailyStudy?.[dateStr];
            return (
              <div 
                key={dateStr} 
                className={`flex-1 h-3 rounded-sm transition-all ${isStudied ? 'bg-stone-900' : 'bg-stone-100'} hover:scale-y-150 cursor-help`}
                title={dateStr}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-3 gap-2 mb-8 pt-8 border-t border-stone-100">
        <div className="text-center">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Quiz Level</p>
          <p className="text-lg font-bold text-stone-900">{Math.round(realData?.overallAccuracy || 0)}</p>
          <div className="w-8 h-1 bg-stone-900 mx-auto rounded-full mt-1" />
        </div>
        <div className="text-center border-x border-stone-100">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Streak</p>
          <p className="text-lg font-bold text-stone-900 flex items-center justify-center gap-1">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            {realData?.streak || 0}
          </p>
          <div className="w-8 h-1 bg-amber-500 mx-auto rounded-full mt-1" />
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Growth</p>
          <p className="text-lg font-bold text-emerald-500">+12%</p>
          <div className="w-8 h-1 bg-emerald-500 mx-auto rounded-full mt-1" />
        </div>
      </div>

      <AnimatePresence>
        {isTopicModalOpen && selectedTopic && (
          <TopicPerformanceModal 
            isOpen={isTopicModalOpen}
            onClose={() => setIsTopicModalOpen(false)}
            topic={selectedTopic.topic}
            score={selectedTopic.score}
            allTopics={realData?.allTopics || []}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Study Timer Component ---

const StudyTimer: React.FC<{ 
  courses: Course[], 
  logs: StudySessionLog[], 
  onSaveLog: (log: StudySessionLog) => void 
}> = ({ courses, logs, onSaveLog }) => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(courses.length > 0 ? courses[0] : null);
  const [settings, setSettings] = useState<StudyTimerSettings>({
    studyMinutes: 25,
    breakMinutes: 5,
    cycles: 4
  });
  const [timeLeft, setTimeLeft] = useState(settings.studyMinutes * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [sessionNote, setSessionNote] = useState('');
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleSessionComplete();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft]);

  const handleSessionComplete = () => {
    setIsActive(false);
    if (!isBreak) {
      setIsNoteModalOpen(true);
    } else {
      // Break complete
      if (currentCycle < settings.cycles) {
        setCurrentCycle(prev => prev + 1);
        setIsBreak(false);
        setTimeLeft(settings.studyMinutes * 60);
        setIsActive(true);
      } else {
        // All cycles complete
        resetTimer();
      }
    }
  };

  const saveSession = () => {
    if (!selectedCourse) return;
    const newLog: StudySessionLog = {
      id: Math.random().toString(36).substr(2, 9),
      courseId: selectedCourse.id,
      courseName: selectedCourse.name,
      durationMinutes: settings.studyMinutes,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      note: sessionNote
    };
    onSaveLog(newLog);
    setIsNoteModalOpen(false);
    setSessionNote('');
    
    // Start break or next cycle
    if (currentCycle <= settings.cycles) {
      setIsBreak(true);
      setTimeLeft(settings.breakMinutes * 60);
      setIsActive(true);
    }
  };

  const toggleTimer = () => {
    setIsActive(!isActive);
    if (!isActive) setIsFocusMode(true);
  };

  const resetTimer = () => {
    setIsActive(false);
    setIsBreak(false);
    setCurrentCycle(1);
    setTimeLeft(settings.studyMinutes * 60);
    setIsFocusMode(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = isBreak 
    ? (timeLeft / (Math.max(1, settings.breakMinutes) * 60)) * 100 
    : (timeLeft / (Math.max(1, settings.studyMinutes) * 60)) * 100;

  const today = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.date === today);
  const todayStudyTime = todayLogs.reduce((acc, curr) => acc + curr.durationMinutes, 0);
  const todaySessions = todayLogs.length;

  const getCourseAnalytics = () => {
    const analytics: Record<string, number> = {};
    logs.forEach(log => {
      analytics[log.courseName] = (analytics[log.courseName] || 0) + log.durationMinutes;
    });
    return Object.entries(analytics).sort((a, b) => b[1] - a[1]);
  };

  const studyStreak = 6; // Mock streak

  return (
    <div className={`min-h-screen transition-all duration-500 ${isFocusMode ? 'bg-stone-900' : 'bg-[#FDFCF8]'} font-sans pb-32`}>
      {/* Header */}
      {!isFocusMode && (
        <header className="px-6 pt-12 pb-6 bg-white border-b border-stone-100 sticky top-[52px] z-30">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Study Timer</h1>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-stone-50 text-stone-400 hover:text-stone-900 rounded-xl transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          <div className="relative">
            <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 px-1">Current Course</label>
            <button 
              onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
              className="w-full flex items-center justify-between bg-stone-50 border border-stone-100 rounded-2xl px-5 py-4 text-stone-900 font-semibold"
            >
              <span className="flex items-center gap-2">
                {selectedCourse && <div className={`w-2 h-2 rounded-full ${selectedCourse.color.replace('bg-', 'bg-')}`} />}
                {selectedCourse?.name || 'Select Course'}
              </span>
              <ChevronDown className={`w-5 h-5 text-stone-400 transition-transform ${isCourseDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {isCourseDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white border border-stone-100 rounded-2xl shadow-xl z-40 overflow-hidden"
                >
                  {courses.map(course => (
                    <button
                      key={course.id}
                      onClick={() => {
                        setSelectedCourse(course);
                        setIsCourseDropdownOpen(false);
                      }}
                      className="w-full text-left px-5 py-4 hover:bg-stone-50 text-sm font-medium text-stone-700 border-b border-stone-50 last:border-none"
                    >
                      {course.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>
      )}

      {/* Main Timer Area */}
      <div className={`flex flex-col items-center justify-center px-6 ${isFocusMode ? 'h-screen' : 'py-12'}`}>
        {isFocusMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-12 text-center"
          >
            <p className="text-stone-400 text-sm font-medium uppercase tracking-widest mb-2">
              {isBreak ? 'Break Time' : 'Stay Focused'}
            </p>
            <h2 className="text-white text-xl font-bold">
              {isBreak ? 'Time to recharge' : `Session ${currentCycle} of ${settings.cycles}`}
            </h2>
            <p className="text-stone-500 text-xs mt-4">
              {isBreak ? 'Your next study session starts soon' : `This session will end in ${Math.ceil(timeLeft / 60)} minutes`}
            </p>
          </motion.div>
        )}

        {/* Circular Timer */}
        <div className="relative w-72 h-72 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="144"
              cy="144"
              r="130"
              fill="none"
              stroke={isFocusMode ? '#262626' : '#F5F5F4'}
              strokeWidth="8"
            />
            <motion.circle
              cx="144"
              cy="144"
              r="130"
              fill="none"
              stroke={isBreak ? '#10B981' : (isFocusMode ? '#FFFFFF' : '#1C1917')}
              strokeWidth="8"
              strokeDasharray="816.8"
              initial={{ strokeDashoffset: 816.8 }}
              animate={{ strokeDashoffset: 816.8 - (816.8 * progress) / 100 }}
              transition={{ duration: 1, ease: "linear" }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-6xl font-bold tracking-tighter ${isFocusMode ? 'text-white' : 'text-stone-900'}`}>
              {formatTime(timeLeft)}
            </span>
            <span className={`text-xs font-bold uppercase tracking-widest mt-2 ${isFocusMode ? 'text-stone-500' : 'text-stone-400'}`}>
              {isBreak ? 'Break' : 'Study'}
            </span>
          </div>
        </div>

        {/* Timer Controls */}
        <div className="flex items-center gap-6 mt-12">
          <button 
            onClick={resetTimer}
            className={`p-4 rounded-full transition-all ${isFocusMode ? 'bg-stone-800 text-stone-400 hover:text-white' : 'bg-stone-100 text-stone-400 hover:text-stone-900'}`}
          >
            <RotateCcw className="w-6 h-6" />
          </button>
          <button 
            onClick={toggleTimer}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl ${
              isActive 
                ? (isFocusMode ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-900') 
                : (isFocusMode ? 'bg-white text-stone-900' : 'bg-stone-900 text-white')
            }`}
          >
            {isActive ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
          </button>
          <button 
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={`p-4 rounded-full transition-all ${isFocusMode ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-400 hover:text-stone-900'}`}
          >
            <Zap className={`w-6 h-6 ${isFocusMode ? 'fill-current' : ''}`} />
          </button>
        </div>

        {isFocusMode && (
          <button 
            onClick={() => setIsFocusMode(false)}
            className="mt-12 text-stone-500 text-xs font-bold uppercase tracking-widest hover:text-stone-300 transition-colors"
          >
            Exit Focus Mode
          </button>
        )}
      </div>

      {/* Stats & Analytics */}
      {!isFocusMode && (
        <div className="px-6 space-y-8 mt-6">
          {/* Daily Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-stone-100 rounded-3xl p-5 shadow-sm">
              <div className="w-8 h-8 bg-stone-50 rounded-xl flex items-center justify-center text-stone-900 mb-3">
                <Clock className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Today's Study</p>
              <p className="text-xl font-bold text-stone-900">
                {Math.floor(todayStudyTime / 60)}h {todayStudyTime % 60}m
              </p>
            </div>
            <div className="bg-white border border-stone-100 rounded-3xl p-5 shadow-sm">
              <div className="w-8 h-8 bg-stone-50 rounded-xl flex items-center justify-center text-stone-900 mb-3">
                <Target className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Sessions</p>
              <p className="text-xl font-bold text-stone-900">{todaySessions} Completed</p>
            </div>
          </div>

          {/* Streak */}
          <div className="bg-stone-900 rounded-[2.5rem] p-6 flex items-center justify-between text-white shadow-xl shadow-stone-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-yellow-400 fill-current" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Study Streak</p>
                <p className="text-xl font-bold">{studyStreak} Days</p>
              </div>
            </div>
            <div className="flex -space-x-2">
              {[1, 2, 3, 4, 5, 6, 7].map(day => (
                <div 
                  key={day} 
                  className={`w-6 h-6 rounded-full border-2 border-stone-900 flex items-center justify-center text-[8px] font-bold ${day <= studyStreak ? 'bg-yellow-400 text-stone-900' : 'bg-stone-800 text-stone-500'}`}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Course Analytics */}
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-lg font-bold text-stone-900">Course Analytics</h3>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">This Week</span>
            </div>
            <div className="bg-white border border-stone-100 rounded-[2.5rem] p-6 space-y-6 shadow-sm">
              {getCourseAnalytics().map(([course, mins]) => (
                <div key={course} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-stone-800">{course}</span>
                    <span className="text-xs font-bold text-stone-500">{Math.floor(mins / 60)}h {mins % 60}m</span>
                  </div>
                  <div className="h-2 bg-stone-50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(mins / 600) * 100}%` }} // Mock max 10h
                      className="h-full bg-stone-900 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Logs */}
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-lg font-bold text-stone-900">Recent Sessions</h3>
              <button className="text-xs font-bold text-stone-400 hover:text-stone-900 transition-colors">View All</button>
            </div>
            <div className="space-y-3">
              {logs.slice(0, 3).map(log => (
                <div key={log.id} className="bg-white border border-stone-100 rounded-3xl p-5 flex items-center gap-4 shadow-sm">
                  <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400">
                    <History className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-stone-900">{log.courseName}</h4>
                    <p className="text-[10px] text-stone-400 font-medium uppercase tracking-widest">{log.date} • {log.durationMinutes}m</p>
                    {log.note && <p className="text-xs text-stone-500 mt-1 italic">"{log.note}"</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-stone-900">Timer Settings</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-1">Study Time (min)</label>
                    <span className="text-xs font-bold text-stone-900">{settings.studyMinutes}</span>
                  </div>
                  <input 
                    type="range" min="5" max="60" step="5"
                    value={settings.studyMinutes}
                    onChange={(e) => setSettings({ ...settings, studyMinutes: parseInt(e.target.value) })}
                    className="w-full h-2 bg-stone-100 rounded-full appearance-none cursor-pointer accent-stone-900"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-1">Break Time (min)</label>
                    <span className="text-xs font-bold text-stone-900">{settings.breakMinutes}</span>
                  </div>
                  <input 
                    type="range" min="1" max="30" step="1"
                    value={settings.breakMinutes}
                    onChange={(e) => setSettings({ ...settings, breakMinutes: parseInt(e.target.value) })}
                    className="w-full h-2 bg-stone-100 rounded-full appearance-none cursor-pointer accent-stone-900"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-1">Cycles</label>
                    <span className="text-xs font-bold text-stone-900">{settings.cycles}</span>
                  </div>
                  <input 
                    type="range" min="1" max="10" step="1"
                    value={settings.cycles}
                    onChange={(e) => setSettings({ ...settings, cycles: parseInt(e.target.value) })}
                    className="w-full h-2 bg-stone-100 rounded-full appearance-none cursor-pointer accent-stone-900"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-stone-400" />
                    <span className="text-sm font-bold text-stone-700">Study Reminders</span>
                  </div>
                  <div className="w-12 h-6 bg-stone-900 rounded-full relative p-1 cursor-pointer">
                    <div className="w-4 h-4 bg-white rounded-full absolute right-1" />
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setTimeLeft(settings.studyMinutes * 60);
                    setIsSettingsOpen(false);
                  }}
                  className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-stone-800 active:scale-[0.98] transition-all shadow-xl shadow-stone-200"
                >
                  Apply Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Session Note Modal */}
      <AnimatePresence>
        {isNoteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 mb-2">Great Job!</h2>
              <p className="text-stone-500 text-sm mb-8">You've completed your study session for {selectedCourse.name}.</p>
              
              <div className="text-left mb-8">
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Session Note (Optional)</label>
                <textarea 
                  value={sessionNote}
                  onChange={(e) => setSessionNote(e.target.value)}
                  placeholder="What did you achieve?"
                  className="w-full h-24 bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all resize-none"
                />
              </div>

              <button 
                onClick={saveSession}
                className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-stone-800 active:scale-[0.98] transition-all shadow-xl shadow-stone-200"
              >
                Save & Continue
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Study Calendar Component ---

interface StudyCalendarProps {
  timetable: TimetableEntry[];
  setTimetable: React.Dispatch<React.SetStateAction<TimetableEntry[]>>;
  tasks: AcademicTask[];
  setTasks: React.Dispatch<React.SetStateAction<AcademicTask[]>>;
  insights: ProfessorInsight[];
  setInsights: React.Dispatch<React.SetStateAction<ProfessorInsight[]>>;
  projectTasks: ProjectTask[];
  projectMilestones: ProjectMilestone[];
  semesterStart: string;
  setSemesterStart: (date: string) => void;
  semesterEnd: string;
  setSemesterEnd: (date: string) => void;
  setView: (view: AppView) => void;
  courses: Course[];
  studyLogs: StudySessionLog[];
  user: any;
  googleConnected: boolean;
  onConnectGoogle: () => void;
  onSyncToGoogleCalendar: (events: any[]) => Promise<void>;
}

const StudyCalendar: React.FC<StudyCalendarProps> = ({ 
  timetable,
  setTimetable,
  tasks,
  setTasks,
  insights,
  setInsights,
  projectTasks,
  projectMilestones,
  semesterStart, 
  setSemesterStart, 
  semesterEnd, 
  setSemesterEnd,
  setView,
  courses,
  studyLogs,
  user,
  googleConnected,
  onConnectGoogle,
  onSyncToGoogleCalendar
}) => {
  const [activeSection, setActiveSection] = useState<'today' | 'timetable' | 'tasks' | 'insights'>('today');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSmartImportModalOpen, setIsSmartImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isSemesterSettingsOpen, setIsSemesterSettingsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDetecting, setIsDetecting] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [addType, setAddType] = useState<EventType>('Assignment Deadline');
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Form states
  const [newTimetable, setNewTimetable] = useState<Partial<TimetableEntry>>({
    courseName: '',
    title: '',
    dayOfWeek: format(new Date(), 'EEEE'),
    startTime: '09:00',
    endTime: '10:00',
    location: '',
    zoomLink: '',
    professor: '',
    semesterStart: semesterStart || format(new Date(), 'yyyy-MM-dd'),
    semesterEnd: semesterEnd || format(addDays(new Date(), 120), 'yyyy-MM-dd')
  });
  
  const [newTask, setNewTask] = useState<Partial<AcademicTask>>({
    title: '',
    courseName: '',
    priority: 'Medium',
    status: 'Not Started',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    startDate: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    subtasks: []
  });
  
  const [newInsight, setNewInsight] = useState<Partial<ProfessorInsight>>({
    courseName: '',
    content: ''
  });

  const today = new Date();
  
  const getTimetableOccurrences = (entry: TimetableEntry) => {
    const occurrences: any[] = [];
    const dayMap: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    const targetDay = dayMap[entry.dayOfWeek];
    
    try {
      let current = parseISO(entry.semesterStart);
      const semEnd = parseISO(entry.semesterEnd);
      
      while (current <= semEnd) {
        if (current.getDay() === targetDay) {
          occurrences.push({
            ...entry,
            date: format(current, 'yyyy-MM-dd'),
            type: 'Class'
          });
        }
        current = addDays(current, 1);
      }
    } catch (e) { console.error("Error generating occurrences", e); }
    return occurrences;
  };

  const allTimetableOccurrences = useMemo(() => {
    return timetable.flatMap(entry => getTimetableOccurrences(entry));
  }, [timetable]);

  const stats = {
    assignmentsCompleted: tasks.filter(t => t.status === 'Completed').length,
    totalAssignments: tasks.length,
    studyHoursThisWeek: (studyLogs.filter(log => {
      try {
        const logDate = parseISO(log.date);
        return isWithinInterval(logDate, {
          start: startOfWeek(new Date()),
          end: endOfWeek(new Date())
        });
      } catch (e) { return false; }
    }).reduce((acc, log) => acc + log.durationMinutes, 0) / 60).toFixed(1),
  };

  const getCourseColor = (courseName: string) => {
    const course = courses.find(c => c.name === courseName);
    if (course) return course.color;
    return 'bg-stone-100';
  };

  const handleSaveTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTimetable.courseName || !newTimetable.dayOfWeek) return;
    
    const entry: TimetableEntry = {
      id: editingItem?.id || Math.random().toString(36).substr(2, 9),
      courseName: newTimetable.courseName,
      courseId: courses.find(c => c.name === newTimetable.courseName)?.id || '',
      dayOfWeek: newTimetable.dayOfWeek,
      startTime: newTimetable.startTime || '09:00',
      endTime: newTimetable.endTime || '10:00',
      professor: newTimetable.professor || '',
      location: newTimetable.location || '',
      zoomLink: newTimetable.zoomLink || '',
      semesterStart: newTimetable.semesterStart || semesterStart,
      semesterEnd: newTimetable.semesterEnd || semesterEnd
    };

    // Update global semester dates if they were empty
    if (!semesterStart && newTimetable.semesterStart) setSemesterStart(newTimetable.semesterStart);
    if (!semesterEnd && newTimetable.semesterEnd) setSemesterEnd(newTimetable.semesterEnd);

    await api.saveTimetableEntry(user.uid, entry);
    if (editingItem) {
      setTimetable(timetable.map(t => t.id === editingItem.id ? entry : t));
    } else {
      setTimetable([...timetable, entry]);
    }
    setIsAddModalOpen(false);
    setEditingItem(null);
  };

  const handleSmartImport = async () => {
    if (!importText.trim()) return;
    setIsImporting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Parse the following academic timeline into a JSON array of tasks. 
Each task should follow this schema:
{
  "title": string,
  "courseName": string,
  "dueDate": "YYYY-MM-DD",
  "priority": "High" | "Medium" | "Low",
  "status": "Not Started",
  "notes": string,
  "subtasks": { "id": string, "title": string, "completed": false }[]
}

Today's date is ${format(new Date(), 'yyyy-MM-dd')}.
If a date range is given (e.g. Week 1: NOW -> Apr 10), use the end date as the dueDate.
If no year is given, assume 2026.

Timeline:
${importText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                courseName: { type: Type.STRING },
                dueDate: { type: Type.STRING },
                priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
                status: { type: Type.STRING, enum: ["Not Started"] },
                notes: { type: Type.STRING },
                subtasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      title: { type: Type.STRING },
                      completed: { type: Type.BOOLEAN }
                    },
                    required: ["id", "title", "completed"]
                  }
                }
              },
              required: ["title", "courseName", "dueDate", "priority", "status", "subtasks"]
            }
          }
        }
      });

      const result = await model;
      const importedTasks = JSON.parse(result.text);
      
      const savedTasks: AcademicTask[] = [];
      const formatDate = (dateStr: string) => {
        try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return format(new Date(), 'yyyy-MM-dd');
          return format(date, 'yyyy-MM-dd');
        } catch {
          return format(new Date(), 'yyyy-MM-dd');
        }
      };

      const validPriorities = ['High', 'Medium', 'Low'];
      const validStatuses = ['Not Started', 'In Progress', 'Completed'];

      for (const t of importedTasks) {
        const task: AcademicTask = {
          id: Math.random().toString(36).substr(2, 9),
          title: (t.title || 'Untitled Task').substring(0, 499),
          courseName: t.courseName || '',
          courseId: courses.find(c => c.name === t.courseName)?.id || '',
          startDate: format(new Date(), 'yyyy-MM-dd'),
          dueDate: formatDate(t.dueDate),
          priority: validPriorities.includes(t.priority) ? t.priority : 'Medium',
          status: 'Not Started',
          notes: t.notes || '',
          subtasks: (t.subtasks || []).map((st: any) => ({
            id: st.id || Math.random().toString(36).substr(2, 9),
            title: (st.title || '').substring(0, 499),
            completed: !!st.completed
          }))
        };
        await api.saveTask(user.uid, task);
        savedTasks.push(task);
      }
      
      setTasks([...tasks, ...savedTasks]);
      setIsSmartImportModalOpen(false);
      setImportText('');
    } catch (error) {
      console.error("Smart Import Error:", error);
      alert("Failed to parse timeline. Please check the format and try again.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.dueDate) {
      alert("Please provide at least a title and a due date.");
      return;
    }
    
    const task: AcademicTask = {
      id: editingItem?.id || Math.random().toString(36).substr(2, 9),
      title: newTask.title,
      courseName: newTask.courseName || '',
      courseId: courses.find(c => c.name === newTask.courseName)?.id || '',
      startDate: newTask.startDate || format(new Date(), 'yyyy-MM-dd'),
      dueDate: newTask.dueDate,
      priority: (newTask.priority || 'Medium') as any,
      status: (newTask.status || 'Not Started') as any,
      notes: newTask.notes || '',
      subtasks: (newTask.subtasks || []).map(st => ({
        id: st.id || Math.random().toString(36).substr(2, 9),
        title: st.title || '',
        completed: !!st.completed
      }))
    };

    console.log("Saving task:", task);

    try {
      await api.saveTask(user.uid, task);
      if (editingItem) {
        setTasks(prev => prev.map(t => t.id === editingItem.id ? task : t));
      } else {
        setTasks(prev => [...prev, task]);
      }
      setIsAddModalOpen(false);
      setEditingItem(null);
      setNewTask({
        title: '',
        courseName: '',
        priority: 'Medium',
        status: 'Not Started',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
        subtasks: []
      });
    } catch (error) {
      console.error("Save Task Error:", error);
      alert("Failed to save task. Please check your connection and try again.");
    }
  };

  const handleSaveInsight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInsight.content) {
      alert("Please provide insight content.");
      return;
    }
    
    const insight: ProfessorInsight = {
      id: editingItem?.id || Math.random().toString(36).substr(2, 9),
      courseName: newInsight.courseName || '',
      courseId: courses.find(c => c.name === newInsight.courseName)?.id || '',
      content: newInsight.content,
      dateAdded: new Date().toISOString()
    };

    try {
      await api.saveInsight(user.uid, insight);
      if (editingItem) {
        setInsights(prev => prev.map(i => i.id === editingItem.id ? insight : i));
      } else {
        setInsights(prev => [...prev, insight]);
      }
      setIsAddModalOpen(false);
      setEditingItem(null);
      setNewInsight({
        courseName: '',
        content: ''
      });
    } catch (error) {
      console.error("Save Insight Error:", error);
      alert("Failed to save insight. Please check your connection and try again.");
    }
  };

  const handleDelete = async (id: string, type: 'timetable' | 'task' | 'insight') => {
    if (type === 'timetable') {
      await api.deleteTimetableEntry(user.uid, id);
      setTimetable(timetable.filter(t => t.id !== id));
    } else if (type === 'task') {
      await api.deleteTask(user.uid, id);
      setTasks(tasks.filter(t => t.id !== id));
    } else if (type === 'insight') {
      await api.deleteInsight(user.uid, id);
      setInsights(insights.filter(i => i.id !== id));
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(monthEnd)
  });

  const getTaskUrgencyColor = (dueDate: string) => {
    const due = parseISO(dueDate);
    const diff = differenceInDays(due, today);
    if (diff < 0) return 'bg-red-500';
    if (diff <= 2) return 'bg-orange-500';
    return 'bg-emerald-500';
  };

  const getTaskProgress = (dueDate: string) => {
    try {
      const due = parseISO(dueDate);
      const totalDays = 7;
      const diff = differenceInDays(due, today);
      const progress = Math.max(0, Math.min(100, ((totalDays - diff) / totalDays) * 100));
      return progress;
    } catch (e) {
      return 0;
    }
  };

  const events = useMemo(() => {
    const taskEvents = tasks.map(t => ({
      ...t,
      date: t.dueDate,
      type: 'Assignment Deadline' as EventType
    }));
    const insightEvents = insights.map(i => ({
      ...i,
      title: `Insight: ${i.courseName}`,
      date: i.dateAdded.split('T')[0],
      type: 'Insight' as EventType
    }));
    
    const projTaskEvents = projectTasks.map(t => ({
      ...t,
      date: t.dueDate,
      type: 'Project' as EventType,
      title: t.title
    }));

    const projMilestoneEvents = projectMilestones.map(m => ({
      ...m,
      date: m.dueDate,
      type: 'Project' as EventType,
      title: `Milestone: ${m.title}`
    }));

    return [...allTimetableOccurrences, ...taskEvents, ...insightEvents, ...projTaskEvents, ...projMilestoneEvents];
  }, [allTimetableOccurrences, tasks, insights, projectTasks, projectMilestones]);

  const selectedDayEvents = useMemo(() => {
    return events.filter(e => {
      try {
        if (!e.date) return false;
        return isSameDay(parseISO(e.date), selectedDate);
      } catch (err) {
        console.error("Error parsing date for event:", e, err);
        return false;
      }
    });
  }, [events, selectedDate]);

  const renderTodayView = () => {
    const todayStr = format(today, 'yyyy-MM-dd');
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    const selectedDayClasses = allTimetableOccurrences.filter(o => o.date === selectedDateStr);
    const selectedDayTasks = tasks.filter(t => t.dueDate === selectedDateStr);
    const selectedDayInsights = insights.filter(i => i.dateAdded.split('T')[0] === selectedDateStr);
    
    const upcomingTasks = tasks
      .filter(t => t.status !== 'Completed')
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime())
      .slice(0, 3);

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Calendar Grid Section */}
        <section className="bg-white border border-stone-100 rounded-[2.5rem] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-stone-400" />
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-stone-50 rounded-xl transition-colors">
                <ChevronLeft className="w-5 h-5 text-stone-400" />
              </button>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-stone-50 rounded-xl transition-colors">
                <ChevronRight className="w-5 h-5 text-stone-400" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} className="text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const dayEvents = events.filter(e => e.date === dayStr);

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all ${
                    isSelected 
                      ? 'bg-stone-900 text-white shadow-lg shadow-stone-200' 
                      : isToday 
                        ? 'bg-stone-100 text-stone-900' 
                        : 'hover:bg-stone-50 text-stone-600'
                  } ${!isCurrentMonth && !isSelected ? 'opacity-20' : ''}`}
                >
                  <span className="text-sm font-bold">{format(day, 'd')}</span>
                  <div className="flex gap-0.5 mt-1">
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <div 
                        key={i} 
                        className={`w-1 h-1 rounded-full ${
                          e.type === 'Class' ? 'bg-blue-400' : 
                          e.type === 'Insight' ? 'bg-amber-400' : 'bg-emerald-400'
                        } ${isSelected ? 'bg-white' : ''}`} 
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Selected Day Schedule */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-stone-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-stone-400" />
              Schedule for {format(selectedDate, 'MMM d, yyyy')}
            </h3>
          </div>
          <div className="grid gap-3">
            {selectedDayClasses.length > 0 || selectedDayTasks.length > 0 || selectedDayInsights.length > 0 ? (
              <>
                {selectedDayClasses.map((cls, idx) => (
                  <div key={`cls-${idx}`} className="bg-white p-4 rounded-2xl border border-stone-200 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className={`w-1 h-10 rounded-full ${getCourseColor(cls.courseName)}`} />
                      <div>
                        <h4 className="font-medium text-stone-900">{cls.courseName}</h4>
                        <p className="text-sm text-stone-500">
                          {cls.startTime} - {cls.endTime} 
                          {cls.zoomLink ? (
                            <span className="flex items-center gap-1 text-blue-600 mt-1">
                              <ExternalLink className="w-3 h-3" />
                              Zoom Link
                            </span>
                          ) : cls.location ? ` • ${cls.location}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Class</span>
                    </div>
                  </div>
                ))}
                {selectedDayTasks.map((task) => (
                  <div 
                    key={`task-${task.id}`} 
                    className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm cursor-pointer hover:border-stone-300 transition-colors"
                    onClick={() => {
                      setEditingItem(task);
                      setAddType('Assignment Deadline');
                      setNewTask({
                        title: task.title,
                        courseName: task.courseName,
                        priority: task.priority,
                        status: task.status,
                        startDate: task.startDate || format(new Date(), 'yyyy-MM-dd'),
                        dueDate: task.dueDate,
                        subtasks: task.subtasks || []
                      });
                      setIsAddModalOpen(true);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-4">
                        <div className={`w-1 h-10 rounded-full ${getTaskUrgencyColor(task.dueDate)}`} />
                        <div>
                          <h4 className="font-medium text-stone-900">{task.title}</h4>
                          <p className="text-sm text-stone-500">
                            {task.courseName} • {task.startDate && format(parseISO(task.startDate), 'MMM d')} - {format(parseISO(task.dueDate), 'MMM d')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Task</span>
                      </div>
                    </div>
                    {task.subtasks && task.subtasks.length > 0 && (
                      <div className="mt-3 pl-5 space-y-2 border-l border-stone-100 ml-0.5">
                        {task.subtasks.map((st) => (
                          <div key={st.id} className="flex items-center gap-2">
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                const updatedSubtasks = (task.subtasks || []).map(s => 
                                  s.id === st.id ? { ...s, completed: !s.completed } : s
                                ).map(s => ({
                                  id: s.id,
                                  title: s.title,
                                  completed: s.completed
                                }));
                                const updatedTask = { ...task, subtasks: updatedSubtasks };
                                await api.saveTask(user.uid, updatedTask);
                                setTasks(tasks.map(t => t.id === task.id ? updatedTask : t));
                              }}
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                st.completed ? 'bg-stone-900 border-stone-900 text-white' : 'border-stone-300'
                              }`}
                            >
                              {st.completed && <Check className="w-3 h-3" />}
                            </button>
                            <span className={`text-xs ${st.completed ? 'text-stone-400 line-through' : 'text-stone-600'}`}>
                              {st.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {selectedDayInsights.map((insight) => (
                  <div key={`insight-${insight.id}`} className="bg-white p-4 rounded-2xl border border-amber-100 bg-amber-50/30 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-1 h-10 rounded-full bg-amber-400" />
                      <div>
                        <h4 className="font-medium text-stone-900">Professor Insight</h4>
                        <p className="text-sm text-stone-600 italic">"{insight.content}"</p>
                        <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest mt-1">{insight.courseName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">Insight</span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="bg-stone-50 border border-dashed border-stone-200 p-8 rounded-2xl text-center">
                <p className="text-stone-400 text-sm italic">Nothing scheduled for this day.</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-stone-900 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-stone-400" />
              Professor Insights
            </h3>
            <button onClick={() => setActiveSection('insights')} className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors">View All</button>
          </div>
          <div className="grid gap-3">
            {insights.slice(0, 2).map((insight) => (
              <div key={insight.id} className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <p className="text-sm text-stone-600 italic mb-2">"{insight.content}"</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-stone-400">{insight.courseName}</span>
                  <span className="text-xs text-stone-400">{format(parseISO(insight.dateAdded), 'MMM d')}</span>
                </div>
              </div>
            ))}
            {insights.length === 0 && (
              <div className="bg-stone-50 border border-dashed border-stone-200 p-8 rounded-2xl text-center">
                <p className="text-stone-400 text-sm italic">No insights added yet.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  };

  const renderTimetable = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-stone-900">Weekly Schedule</h3>
          <button 
            onClick={() => {
              setEditingItem(null);
              setNewTimetable({ 
                courseName: '', 
                dayOfWeek: 'Monday', 
                startTime: '09:00', 
                endTime: '10:00', 
                professor: '', 
                location: '', 
                zoomLink: '',
                semesterStart: semesterStart || format(new Date(), 'yyyy-MM-dd'),
                semesterEnd: semesterEnd || format(addDays(new Date(), 120), 'yyyy-MM-dd')
              });
              setIsAddModalOpen(true);
            }}
            className="p-2 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        
        {days.map(day => {
          const dayClasses = timetable.filter(t => t.dayOfWeek === day);
          if (dayClasses.length === 0) return null;
          return (
            <div key={day} className="space-y-3">
              <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-widest px-1">{day}</h4>
              <div className="grid gap-3">
                {dayClasses.map(cls => (
                  <div key={cls.id} className="group bg-white p-4 rounded-2xl border border-stone-200 shadow-sm hover:border-stone-300 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-1 h-10 rounded-full ${getCourseColor(cls.courseName)}`} />
                        <div>
                          <h5 className="font-medium text-stone-900">{cls.courseName}</h5>
                          <p className="text-sm text-stone-500">
                            {cls.startTime} - {cls.endTime}
                            {cls.zoomLink ? (
                              <span className="flex items-center gap-1 text-blue-600 mt-1">
                                <ExternalLink className="w-3 h-3" />
                                Zoom Link
                              </span>
                            ) : cls.location ? ` • ${cls.location}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingItem(cls);
                            setNewTimetable(cls);
                            setIsAddModalOpen(true);
                          }}
                          className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(cls.id, 'timetable')}
                          className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {timetable.length === 0 && (
          <div className="bg-stone-50 border border-dashed border-stone-200 p-12 rounded-3xl text-center">
            <p className="text-stone-400 italic">No classes added to your timetable yet.</p>
          </div>
        )}
      </div>
    );
  };

  const renderTasks = () => {
    const todayStr = format(today, 'yyyy-MM-dd');
    
    const todoTasks = tasks.filter(t => t.status !== 'Completed' && t.dueDate >= todayStr);
    const doneTasks = tasks.filter(t => t.status === 'Completed');
    const overdueTasks = tasks.filter(t => t.status !== 'Completed' && t.dueDate < todayStr);

    const TaskCard = ({ task }: { task: AcademicTask }) => (
      <div className="group bg-white p-4 rounded-2xl border border-stone-200 shadow-sm hover:border-stone-300 transition-all">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={async () => {
                const newStatus = task.status === 'Completed' ? 'Not Started' : 'Completed';
                const updated: AcademicTask = { 
                  ...task, 
                  status: newStatus as any,
                  subtasks: (task.subtasks || []).map(st => ({
                    id: st.id,
                    title: st.title,
                    completed: st.completed
                  }))
                };
                await api.saveTask(user.uid, updated);
                setTasks(tasks.map(t => t.id === task.id ? updated : t));
              }}
              className={`w-5 h-5 rounded-full border-2 transition-colors flex items-center justify-center ${
                task.status === 'Completed' ? 'bg-emerald-500 border-emerald-500' : 'border-stone-200 hover:border-emerald-500'
              }`}
            >
              {task.status === 'Completed' && <Check className="w-3 h-3 text-white" />}
            </button>
            <div>
              <h5 className={`font-medium text-stone-900 ${task.status === 'Completed' ? 'line-through opacity-50' : ''}`}>{task.title}</h5>
              <p className="text-xs text-stone-500">{task.courseName} • Due {format(parseISO(task.dueDate), 'MMM d')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => {
                setEditingItem(task);
                setNewTask(task);
                setIsAddModalOpen(true);
              }}
              className="p-2 text-stone-400 hover:text-stone-900"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => handleDelete(task.id, 'task')}
              className="p-2 text-stone-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {task.status !== 'Completed' && (
          <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${getTaskProgress(task.dueDate)}%` }}
              className={`h-full ${getTaskUrgencyColor(task.dueDate)}`}
            />
          </div>
        )}
      </div>
    );

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-stone-900">Assignments & Tasks</h3>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSmartImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-600 rounded-full hover:bg-stone-200 transition-all text-sm font-medium"
            >
              <Cloud className="w-4 h-4" />
              Smart Import
            </button>
            <button 
              onClick={() => {
                setEditingItem(null);
                setNewTask({ 
                  title: '', 
                  courseName: '', 
                  startDate: format(today, 'yyyy-MM-dd'),
                  dueDate: format(today, 'yyyy-MM-dd'), 
                  priority: 'Medium', 
                  status: 'Not Started', 
                  notes: '',
                  subtasks: []
                });
                setIsAddModalOpen(true);
              }}
              className="p-2 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {/* Overdue Section */}
          {overdueTasks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <h4 className="text-xs font-semibold text-red-500 uppercase tracking-widest">Overdue</h4>
              </div>
              <div className="grid gap-3">
                {overdueTasks.map(task => (
                  <div key={task.id}>
                    <TaskCard task={task} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* To Do Section */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-stone-400" />
              <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-widest">To Do</h4>
            </div>
            <div className="grid gap-3">
              {todoTasks.length > 0 ? todoTasks.map(task => (
                <div key={task.id}>
                  <TaskCard task={task} />
                </div>
              )) : (
                <div className="bg-stone-50 border border-dashed border-stone-200 p-8 rounded-2xl text-center">
                  <p className="text-stone-400 text-sm italic">No tasks to do!</p>
                </div>
              )}
            </div>
          </section>

          {/* Done Section */}
          {doneTasks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h4 className="text-xs font-semibold text-emerald-500 uppercase tracking-widest">Done</h4>
              </div>
              <div className="grid gap-3 opacity-75">
                {doneTasks.map(task => (
                  <div key={task.id}>
                    <TaskCard task={task} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  };

  const renderInsights = () => {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-stone-900">Professor Insights</h3>
          <button 
            onClick={() => {
              setEditingItem(null);
              setAddType('Insight');
              setNewInsight({ courseName: '', content: '' });
              setIsAddModalOpen(true);
            }}
            className="p-2 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="grid gap-4">
          {insights.map(insight => (
            <div key={insight.id} className="group bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:border-stone-300 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl ${getCourseColor(insight.courseName)} flex items-center justify-center`}>
                    <UserIcon className="w-5 h-5 text-stone-600" />
                  </div>
                  <div>
                    <h5 className="font-medium text-stone-900">{insight.courseName}</h5>
                    <p className="text-xs text-stone-400">{format(parseISO(insight.dateAdded), 'MMMM d, yyyy')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setEditingItem(insight);
                      setAddType('Insight');
                      setNewInsight(insight);
                      setIsAddModalOpen(true);
                    }}
                    className="p-2 text-stone-400 hover:text-stone-900"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(insight.id, 'insight')}
                    className="p-2 text-stone-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-stone-600 leading-relaxed italic">"{insight.content}"</p>
            </div>
          ))}
          {insights.length === 0 && (
            <div className="bg-stone-50 border border-dashed border-stone-200 p-12 rounded-3xl text-center">
              <p className="text-stone-400 italic">No professor insights recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const autoDetectSemester = async () => {
    setIsDetecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = "gemini-3-flash-preview";
      const prompt = `Based on these timetable entries, identify the start and end dates of the semester. 
      Timetable: ${JSON.stringify(timetable)}
      Return as JSON: { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }`;
      
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });
      
      const result = JSON.parse(response.text || "{}");
      if (result.start) setSemesterStart(result.start);
      if (result.end) setSemesterEnd(result.end);
    } catch (e) {
      console.error("Auto-detect failed", e);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSync = async () => {
    if (!googleConnected) {
      onConnectGoogle();
      return;
    }

    setIsSyncing(true);
    try {
      // Prepare events for sync
      const eventsToSync: any[] = [];

      // Add tasks
      tasks.forEach(task => {
        if (task.status !== 'Completed') {
          eventsToSync.push({
            id: task.id,
            title: `[Task] ${task.title}`,
            description: `Course: ${task.courseName}\nPriority: ${task.priority}\nNotes: ${task.notes || 'None'}`,
            start: `${task.dueDate}T09:00:00Z`,
            end: `${task.dueDate}T10:00:00Z`,
            courseName: task.courseName
          });
        }
      });

      // Add project milestones
      projectMilestones.forEach(milestone => {
        if (milestone.status !== 'Completed') {
          const course = courses.find(c => c.id === milestone.courseId);
          eventsToSync.push({
            id: milestone.id,
            title: `[Milestone] ${milestone.title}`,
            description: `Course: ${course?.name || 'Project'}`,
            start: `${milestone.dueDate}T09:00:00Z`,
            end: `${milestone.dueDate}T10:00:00Z`,
            courseName: course?.name
          });
        }
      });

      // Add project tasks
      projectTasks.forEach(task => {
        if (task.status !== 'Done') {
          const course = courses.find(c => c.id === task.courseId);
          eventsToSync.push({
            id: task.id,
            title: `[Project Task] ${task.title}`,
            description: `Course: ${course?.name || 'Project'}\nPriority: ${task.priority}`,
            start: `${task.dueDate}T09:00:00Z`,
            end: `${task.dueDate}T10:00:00Z`,
            courseName: course?.name
          });
        }
      });

      if (eventsToSync.length === 0) {
        alert("No upcoming tasks or milestones to sync.");
        return;
      }

      await onSyncToGoogleCalendar(eventsToSync);
      alert(`Successfully synced ${eventsToSync.length} items to Google Calendar!`);
    } catch (error) {
      console.error("Sync error:", error);
      alert("Failed to sync with Google Calendar.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] font-sans pb-32">
      {/* Header */}
      <header className="px-6 pt-12 pb-6 bg-white border-b border-stone-100 sticky top-[52px] z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                className="w-10 h-10 bg-stone-900 text-white rounded-xl flex items-center justify-center hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
              >
                <Plus className={`w-6 h-6 transition-transform ${isAddMenuOpen ? 'rotate-45' : ''}`} />
              </button>
              <AnimatePresence>
                {isAddMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute top-12 left-0 w-48 bg-white border border-stone-100 rounded-2xl shadow-xl p-2 z-50"
                  >
                    {[
                      { type: 'Assignment Deadline', label: 'New Task', icon: CheckSquare },
                      { type: 'Class', label: 'New Lecture', icon: BookOpen },
                      { type: 'Insight', label: 'New Insight', icon: MessageSquare }
                    ].map((item) => (
                      <button
                        key={item.type}
                        onClick={() => {
                          setAddType(item.type as EventType);
                          setEditingItem(null);
                          if (item.type === 'Class') {
                            setNewTimetable({ 
                              courseName: '', 
                              dayOfWeek: 'Monday', 
                              startTime: '09:00', 
                              endTime: '10:00', 
                              professor: '', 
                              location: '', 
                              zoomLink: '',
                              semesterStart: semesterStart || format(new Date(), 'yyyy-MM-dd'),
                              semesterEnd: semesterEnd || format(addDays(new Date(), 120), 'yyyy-MM-dd')
                            });
                          } else if (item.type === 'Assignment Deadline') {
                            setNewTask({
                              title: '',
                              courseName: '',
                              priority: 'Medium',
                              status: 'Not Started',
                              startDate: format(new Date(), 'yyyy-MM-dd'),
                              dueDate: format(new Date(), 'yyyy-MM-dd'),
                              notes: '',
                              subtasks: []
                            });
                          } else if (item.type === 'Insight') {
                            setNewInsight({ courseName: '', content: '' });
                          }
                          setIsAddModalOpen(true);
                          setIsAddMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 rounded-xl transition-colors text-stone-600 hover:text-stone-900"
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">{item.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                googleConnected 
                  ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' 
                  : 'bg-stone-50 text-stone-400 hover:bg-stone-100'
              }`}
            >
              {isSyncing ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Calendar className="w-3 h-3" />
              )}
              {googleConnected ? 'Sync Google' : 'Connect Google'}
            </button>
          </div>

          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-stone-900">Academic Planner</h1>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{activeSection}</p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSemesterSettingsOpen(true)}
              className="p-2 bg-stone-50 text-stone-400 hover:text-stone-900 rounded-xl transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="px-6 mt-6 space-y-8">
        {/* Stats Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-stone-100 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <CheckSquare className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Completed</span>
            </div>
            <p className="text-2xl font-bold text-stone-900">{stats.assignmentsCompleted}/{stats.totalAssignments}</p>
            <p className="text-[9px] text-stone-400 font-medium mt-1">Assignments this semester</p>
          </div>
          <div className="bg-white border border-stone-100 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Study Time</span>
            </div>
            <p className="text-2xl font-bold text-stone-900">{stats.studyHoursThisWeek}h</p>
            <p className="text-[9px] text-stone-400 font-medium mt-1">Total hours this week</p>
          </div>
        </div>

        {/* Section Navigation */}
        <div className="bg-white border border-stone-100 rounded-2xl p-1 flex items-center shadow-sm">
          {[
            { id: 'today', label: 'Today', icon: LayoutGrid },
            { id: 'timetable', label: 'Timetable', icon: Calendar },
            { id: 'tasks', label: 'Tasks', icon: CheckSquare },
            { id: 'insights', label: 'Insights', icon: Lightbulb }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                activeSection === tab.id 
                  ? 'bg-stone-900 text-white shadow-lg shadow-stone-200' 
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Active Section Content */}
        <div className="pb-12">
          {activeSection === 'today' && renderTodayView()}
          {activeSection === 'timetable' && renderTimetable()}
          {activeSection === 'tasks' && renderTasks()}
          {activeSection === 'insights' && renderInsights()}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isSemesterSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSemesterSettingsOpen(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-stone-900">Semester Timeline</h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={autoDetectSemester}
                    disabled={isDetecting}
                    className="p-2 bg-stone-50 text-stone-600 hover:bg-stone-100 rounded-xl transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                  >
                    <Sparkles className={`w-4 h-4 ${isDetecting ? 'animate-spin' : ''}`} />
                    {isDetecting ? 'Detecting...' : 'Detect'}
                  </button>
                  <button onClick={() => setIsSemesterSettingsOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-stone-400" />
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Start of Semester</label>
                  <input 
                    type="date" 
                    value={semesterStart}
                    onChange={(e) => setSemesterStart(e.target.value)}
                    className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">End of Semester</label>
                  <input 
                    type="date" 
                    value={semesterEnd}
                    onChange={(e) => setSemesterEnd(e.target.value)}
                    className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                  />
                </div>
                <button 
                  onClick={() => setIsSemesterSettingsOpen(false)}
                  className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-stone-800 transition-all shadow-xl shadow-stone-200"
                >
                  Save Timeline
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAddModalOpen(false); setEditingItem(null); }}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-stone-900">{editingItem ? 'Edit' : 'Add'} {addType}</h2>
                <button onClick={() => { setIsAddModalOpen(false); setEditingItem(null); }} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>

              {addType === 'Class' && (
                <form onSubmit={handleSaveTimetable} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Course Name</label>
                    <select 
                      value={newTimetable.courseName}
                      onChange={(e) => setNewTimetable({ ...newTimetable, courseName: e.target.value })}
                      className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                      required
                    >
                      <option value="">Select Course</option>
                      {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Day</label>
                      <select 
                        value={newTimetable.dayOfWeek}
                        onChange={(e) => setNewTimetable({ ...newTimetable, dayOfWeek: e.target.value })}
                        className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                      >
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Zoom Link</label>
                      <input 
                        type="url" 
                        value={newTimetable.zoomLink}
                        onChange={(e) => setNewTimetable({ ...newTimetable, zoomLink: e.target.value })}
                        placeholder="https://zoom.us/j/..."
                        className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Start Time</label>
                      <input 
                        type="time" 
                        value={newTimetable.startTime}
                        onChange={(e) => setNewTimetable({ ...newTimetable, startTime: e.target.value })}
                        className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">End Time</label>
                      <input 
                        type="time" 
                        value={newTimetable.endTime}
                        onChange={(e) => setNewTimetable({ ...newTimetable, endTime: e.target.value })}
                        className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">First Lecture Date</label>
                      <input 
                        type="date" 
                        value={newTimetable.semesterStart}
                        onChange={(e) => setNewTimetable({ ...newTimetable, semesterStart: e.target.value })}
                        className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Last Lecture Date</label>
                      <input 
                        type="date" 
                        value={newTimetable.semesterEnd}
                        onChange={(e) => setNewTimetable({ ...newTimetable, semesterEnd: e.target.value })}
                        className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-stone-800 transition-all shadow-xl shadow-stone-200">
                    {editingItem ? 'Update' : 'Save'} Class
                  </button>
                </form>
              )}

              {addType === 'Assignment Deadline' && (
                <form onSubmit={handleSaveTask} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Task Title</label>
                    <input 
                      type="text" 
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      placeholder="e.g. Final Project"
                      className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Course</label>
                    <select 
                      value={newTask.courseName}
                      onChange={(e) => setNewTask({ ...newTask, courseName: e.target.value })}
                      className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                    >
                      <option value="">Select Course</option>
                      {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Start Date</label>
                      <input 
                        type="date" 
                        value={newTask.startDate}
                        onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                        className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Due Date</label>
                      <input 
                        type="date" 
                        value={newTask.dueDate}
                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                        className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Priority</label>
                    <select 
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                      className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>

                  {/* Subtasks Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest">Subtasks</label>
                      <button 
                        type="button"
                        onClick={() => {
                          const subtasks = [...(newTask.subtasks || [])];
                          subtasks.push({ 
                            id: Math.random().toString(36).substr(2, 9), 
                            title: '', 
                            completed: false
                          });
                          setNewTask({ ...newTask, subtasks });
                        }}
                        className="p-1 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      {(newTask.subtasks || []).map((st, idx) => (
                        <div key={st.id} className="bg-stone-50 p-4 rounded-2xl space-y-3 border border-stone-100">
                          <div className="flex items-center gap-2">
                            <input 
                              type="text"
                              value={st.title}
                              onChange={(e) => {
                                const subtasks = (newTask.subtasks || []).map((s, i) => 
                                  i === idx ? { ...s, title: e.target.value } : s
                                );
                                setNewTask({ ...newTask, subtasks });
                              }}
                              placeholder="Subtask title..."
                              className="flex-1 bg-white border-none rounded-xl px-4 py-3 text-sm text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all shadow-sm"
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                const subtasks = (newTask.subtasks || []).filter((_, i) => i !== idx);
                                setNewTask({ ...newTask, subtasks });
                              }}
                              className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button type="submit" className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-stone-800 transition-all shadow-xl shadow-stone-200">
                    {editingItem ? 'Update' : 'Save'} Task
                  </button>
                </form>
              )}

              {addType === 'Insight' && (
                <form onSubmit={handleSaveInsight} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Insight / Note</label>
                    <textarea 
                      value={newInsight.content}
                      onChange={(e) => setNewInsight({ ...newInsight, content: e.target.value })}
                      placeholder="e.g. Professor mentioned Chapter 5 is critical"
                      className="w-full h-32 bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all resize-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Course</label>
                    <select 
                      value={newInsight.courseName}
                      onChange={(e) => setNewInsight({ ...newInsight, courseName: e.target.value })}
                      className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                    >
                      <option value="">Select Course</option>
                      {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <button type="submit" className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-stone-800 transition-all shadow-xl shadow-stone-200">
                    {editingItem ? 'Update' : 'Save'} Insight
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSmartImportModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSmartImportModalOpen(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-stone-900">Smart Timeline Import</h2>
                  <p className="text-sm text-stone-500 mt-1">Paste your course timeline or project schedule below.</p>
                </div>
                <button onClick={() => setIsSmartImportModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <textarea 
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="e.g. Week 1: Introduction... Week 2: Research..."
                    className="w-full h-64 bg-stone-50 border-2 border-stone-100 rounded-3xl px-6 py-5 text-stone-900 focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all resize-none text-sm leading-relaxed"
                  />
                  {isImporting && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] rounded-3xl flex flex-col items-center justify-center gap-4">
                      <div className="w-10 h-10 border-4 border-stone-900 border-t-transparent rounded-full animate-spin" />
                      <p className="text-stone-900 font-medium animate-pulse">AI is parsing your timeline...</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsSmartImportModalOpen(false)}
                    className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSmartImport}
                    disabled={isImporting || !importText.trim()}
                    className="flex-[2] py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-stone-200 flex items-center justify-center gap-2"
                  >
                    {isImporting ? 'Importing...' : (
                      <>
                        <Cloud className="w-5 h-5" />
                        Generate Tasks
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Exam Simulation Component ---

interface ExamSimulationProps {
  course: Course;
  onBack: () => void;
  questions: ExamQuestion[];
  professorStyle: string;
  onUpdateProfessorStyle: (style: string) => void;
  onFinish?: (result: ExamResult) => void;
  onDeleteQuestion?: (id: string) => void;
  onAddQuestions?: (questions: ExamQuestion[]) => void;
  user: User | null;
  lectureFiles: LectureFile[];
  pastQuestions: PastQuestion[];
  onStudyComplete?: (durationMins: number) => void;
  fetchAsBase64: (url: string) => Promise<{ mimeType: string, data: string } | null>;
}

const ExamSimulation: React.FC<ExamSimulationProps> = ({ 
  course, 
  onBack, 
  questions: stateQuestions, 
  professorStyle, 
  onUpdateProfessorStyle, 
  onFinish, 
  onDeleteQuestion,
  onAddQuestions,
  user,
  lectureFiles,
  pastQuestions,
  fetchAsBase64
}) => {
  const [session, setSession] = useState<ExamSimulationSession | null>(null);
  const [activeTab, setActiveTab] = useState<'setup' | 'history'>('setup');
  const [pastSimulations, setPastSimulations] = useState<ExamSimulationSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isResultView, setIsResultView] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isJumpMenuOpen, setIsJumpMenuOpen] = useState(false);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [simulationFilter, setSimulationFilter] = useState<{ type: 'All' | 'Source' | 'Topic', value?: string }>({ type: 'All' });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [simulationDuration, setSimulationDuration] = useState<number>(90);
  const [simulationQuestionCount, setSimulationQuestionCount] = useState<number>(10);
  const [simulationSchedule, setSimulationSchedule] = useState<string>('Every Sunday');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isDurationModalOpen, setIsDurationModalOpen] = useState(false);
  const [isQuestionCountModalOpen, setIsQuestionCountModalOpen] = useState(false);
  const [isConfirmGenModalOpen, setIsConfirmGenModalOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{ open: boolean, title: string, message: string }>({ open: false, title: '', message: '' });

  const showAlert = (title: string, message: string) => {
    setAlertConfig({ open: true, title, message });
  };

  // Fetch history
  useEffect(() => {
    if (activeTab === 'history' && user) {
      setIsLoadingHistory(true);
      api.getExamSimulations(user.uid, course.id)
        .then(setPastSimulations)
        .finally(() => setIsLoadingHistory(false));
    }
  }, [activeTab, course.id, user]);

  // Timer logic
  useEffect(() => {
    let timer: any;
    if (session && session.status === 'InProgress' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleFinishSimulation();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [session?.status]);

  const handleImportText = async () => {
    if (!importText.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate ${simulationQuestionCount} exam questions based on this text: "${importText}". 
        Return ONLY a JSON array of objects with these fields: question (string), type ('MultipleChoice' or 'OpenEnded'), topic (string), options (string[] for MultipleChoice, null for OpenEnded), suggestedAnswer (string), points (number), source (string).`,
        config: { responseMimeType: "application/json" }
      });

      const newQuestions = JSON.parse(response.text || '[]').map((q: any) => ({
        ...q,
        id: Math.random().toString(36).substr(2, 9),
        courseId: course.id,
        source: q.source || 'Manual Import'
      }));

      if (onAddQuestions) onAddQuestions(newQuestions);
      setIsImportModalOpen(false);
      setImportText('');
      showAlert("Success", `Successfully imported ${newQuestions.length} questions!`);
    } catch (error) {
      console.error("Error importing text:", error);
      showAlert("Error", "Failed to generate questions from text. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAIExam = async () => {
    setIsGenerating(true);
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("Gemini API Key is missing.");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";

      const filteredLectures = lectureFiles.filter(f => f.courseId === course.id);
      
      // If a specific source is selected, prioritize it
      let targetLectures = filteredLectures;
      if (simulationFilter.type === 'Source' && simulationFilter.value) {
        targetLectures = filteredLectures.filter(f => f.name === simulationFilter.value);
      }

      const filePartsPromises = targetLectures.map(async f => {
        if (f.fileUrl && f.fileUrl.startsWith('http')) {
          const data = await fetchAsBase64(f.fileUrl);
          if (data) {
            return {
              inlineData: {
                mimeType: data.mimeType,
                data: data.data
              }
            };
          }
        }
        return { text: `Lecture File Content (Reference): ${f.name}` };
      });

      const fileParts = await Promise.all(filePartsPromises);
      const pastExamContext = pastQuestions.filter(pq => pq.courseId === course.id).map(pq => pq.content).join('\n');

      const response = await ai.models.generateContent({
        model,
        contents: [{ 
          parts: [
            ...fileParts,
            { text: `Generate ${simulationQuestionCount} high-quality university-level exam questions for the course "${course.name}". 
            Focus on: ${simulationFilter.type === 'All' ? 'all topics' : (simulationFilter.type === 'Topic' ? 'the topic: ' + simulationFilter.value : 'the lecture file: ' + simulationFilter.value)}.
            Professor Style: ${professorStyle || 'Standard'}
            Past Exam Context: ${pastExamContext || 'No past exams provided.'}
            
            Return ONLY a JSON array of objects with these fields: 
            question (string), 
            type ('Theory' | 'Explanation' | 'CodeExplanation' | 'CodeWriting' | 'Diagram' | 'Calculation' | 'MultipleChoice'), 
            topic (string), 
            options (string[] for MultipleChoice, null for others), 
            suggestedAnswer (string), 
            points (number), 
            source (string).` }
          ] 
        }],
        config: { responseMimeType: "application/json" }
      });

      const newQuestions = JSON.parse(response.text || '[]').map((q: any) => ({
        ...q,
        id: Math.random().toString(36).substr(2, 9),
        courseId: course.id,
        source: simulationFilter.type === 'Source' ? simulationFilter.value : (q.source || 'AI Generated'),
        topic: simulationFilter.type === 'Topic' ? simulationFilter.value : (q.topic || 'General')
      }));

      if (onAddQuestions) onAddQuestions(newQuestions);
      showAlert("Success", `Generated ${newQuestions.length} new questions!`);
      return newQuestions;
    } catch (error) {
      console.error("Error generating exam:", error);
      showAlert("Error", "Failed to generate exam. Please check your connection and API key.");
      return null;
    } finally {
      setIsGenerating(false);
      setIsConfirmGenModalOpen(false);
    }
  };

  const startSimulation = async () => {
    console.log("Starting simulation with filter:", simulationFilter);
    let filteredQuestions = [...stateQuestions];
    
    if (simulationFilter.type === 'Source' && simulationFilter.value) {
      filteredQuestions = filteredQuestions.filter(q => q.source === simulationFilter.value);
    } else if (simulationFilter.type === 'Topic' && simulationFilter.value) {
      filteredQuestions = filteredQuestions.filter(q => q.topic === simulationFilter.value);
    }

    if (filteredQuestions.length === 0) {
      setIsConfirmGenModalOpen(true);
      return;
    }

    const questions = filteredQuestions.sort(() => 0.5 - Math.random()).slice(0, simulationQuestionCount);
    const duration = simulationDuration; 
    const newSession: ExamSimulationSession = {
      id: Math.random().toString(36).substr(2, 9),
      courseId: course.id,
      title: `${course.name} - ${simulationFilter.type === 'All' ? 'Full Course' : (simulationFilter.type === 'Topic' ? 'Topic: ' + simulationFilter.value : 'File: ' + simulationFilter.value)}`,
      durationMinutes: duration,
      questions,
      currentIndex: 0,
      startTime: Date.now(),
      status: 'InProgress',
      answers: {},
      flaggedQuestions: [],
      sourceType: simulationFilter.type,
      sourceId: simulationFilter.value,
      createdAt: Date.now()
    };
    setSession(newSession);
    if (user) {
      api.saveExamSimulation(user.uid, newSession);
    }
    setTimeLeft(duration * 60);
    setIsResultView(false);
  };

  const handleFinishSimulation = async () => {
    if (!session || !user) return;
    setIsSubmitting(true);
    
    const timeUsedSeconds = (session.durationMinutes * 60) - timeLeft;
    
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("Gemini API Key is missing.");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";

      const evaluations: Record<string, QuizEvaluation> = {};
      let correctCount = 0;

      // Evaluate each question
      const evalPromises = session.questions.map(async (q) => {
        const studentAnswer = session.answers[q.id] || "No answer provided.";
        
        const prompt = `Evaluate this student's exam answer for the course "${course.name}".
        Question: ${q.question}
        Type: ${q.type}
        Points: ${q.points}
        Suggested Answer: ${q.suggestedAnswer}
        Student Answer: ${studentAnswer}
        
        Provide feedback in JSON format with:
        - score (0 to ${q.points})
        - correctPoints (array of strings)
        - missingPoints (array of strings)
        - feedback (a summary of suggested improvement)`;

        const response = await ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                correctPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                missingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                feedback: { type: Type.STRING }
              },
              required: ["score", "correctPoints", "missingPoints", "feedback"]
            }
          }
        });

        const evaluation = JSON.parse(response.text || '{}');
        evaluations[q.id] = {
          ...evaluation,
          id: Math.random().toString(36).substr(2, 9),
          courseId: course.id,
          questionId: q.id,
          studentAnswer,
          incorrectPoints: [], // Not used in this schema but required by interface
          timestamp: Date.now()
        };
        
        if (evaluation.score >= (q.points * 0.7)) {
          correctCount++;
        }
      });

      await Promise.all(evalPromises);

      const totalPoints = session.questions.reduce((acc, q) => acc + q.points, 0);
      const earnedPoints = Object.values(evaluations).reduce((acc, e) => acc + e.score, 0);
      const scorePercentage = Math.round((earnedPoints / totalPoints) * 100);

      const weakTopics = Array.from(new Set(
        session.questions
          .filter(q => evaluations[q.id].score < (q.points * 0.6))
          .map(q => q.topic)
      )) as string[];

      const finalResult: ExamResult = {
        score: scorePercentage,
        timeUsedSeconds,
        correctAnswers: correctCount,
        totalQuestions: session.questions.length,
        weakTopics,
        evaluations
      };

      setResult(finalResult);
      setIsResultView(true);
      
      const updatedSession: ExamSimulationSession = { 
        ...session, 
        status: 'Completed', 
        endTime: Date.now(),
        score: scorePercentage,
        result: finalResult
      };
      setSession(updatedSession);
      await api.saveExamSimulation(user.uid, updatedSession);
      setPastSimulations(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));

      if (onFinish) onFinish(finalResult);

    } catch (error) {
      console.error("Exam evaluation failed:", error);
      alert("Failed to evaluate exam. Please try again or check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFlag = (questionId: string) => {
    setSession(prev => {
      if (!prev) return null;
      const flagged = prev.flaggedQuestions.includes(questionId)
        ? prev.flaggedQuestions.filter(id => id !== questionId)
        : [...prev.flaggedQuestions, questionId];
      return { ...prev, flaggedQuestions: flagged };
    });
  };

  const handleAnswerChange = (answer: string) => {
    if (!session) return;
    const currentQuestion = session.questions[session.currentIndex];
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        answers: { ...prev.answers, [currentQuestion.id]: answer }
      };
    });
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isResultView && result && session) {
    return (
      <div className="min-h-screen bg-stone-50 p-6 font-sans pb-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          <div className="flex items-center gap-4 mb-8">
            <button onClick={onBack} className="p-2 hover:bg-white rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-serif italic">Simulation Report</h1>
          </div>

          <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-stone-200 mb-8 text-center">
            <div className="w-24 h-24 bg-stone-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-12 h-12 text-yellow-400" />
            </div>
            <h2 className="text-5xl font-bold mb-2">{result.score}%</h2>
            <p className="text-stone-400 uppercase tracking-[0.2em] text-[10px] font-bold">Estimated Exam Grade</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-6 rounded-3xl border border-stone-200 text-center">
              <Clock className="w-5 h-5 mx-auto mb-2 text-stone-400" />
              <p className="text-xl font-bold">{Math.floor(result.timeUsedSeconds / 60)}m</p>
              <p className="text-[10px] text-stone-400 uppercase font-bold">Time Used</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-stone-200 text-center">
              <Target className="w-5 h-5 mx-auto mb-2 text-stone-400" />
              <p className="text-xl font-bold">{result.correctAnswers}/{result.totalQuestions}</p>
              <p className="text-[10px] text-stone-400 uppercase font-bold">Correct</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-stone-200 text-center">
              <Zap className="w-5 h-5 mx-auto mb-2 text-stone-400" />
              <p className="text-xl font-bold">Mixed</p>
              <p className="text-[10px] text-stone-400 uppercase font-bold">Difficulty</p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-[2rem] p-8 mb-8">
            <div className="flex items-center gap-2 mb-6 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold uppercase tracking-widest text-xs">Weak Topics Detected</h3>
            </div>
            <div className="space-y-3 mb-8">
              {result.weakTopics.map(topic => (
                <div key={topic} className="bg-white/60 p-4 rounded-2xl border border-red-100 flex items-center justify-between">
                  <span className="text-sm font-medium text-red-900">{topic}</span>
                  <span className="text-[10px] font-bold text-red-400 uppercase">Review Needed</span>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-red-400">Study Recommendations</h4>
              <button className="w-full p-4 bg-white rounded-2xl border border-red-100 flex items-center justify-between group hover:border-red-300 transition-all">
                <div className="flex items-center gap-3">
                  <Layers className="w-5 h-5 text-red-500" />
                  <span className="text-sm font-medium text-red-900">Review Flashcards for weak topics</span>
                </div>
                <ChevronRight className="w-4 h-4 text-red-300 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          <div className="space-y-6 mb-12">
            <h3 className="text-xl font-serif italic px-2">Detailed Feedback</h3>
            {session.questions.map((q, idx) => {
              const evalItem = result.evaluations[q.id];
              return (
                <div key={q.id} className="bg-white rounded-[2rem] p-8 border border-stone-200 shadow-sm">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Question {idx + 1}</span>
                      <h4 className="text-lg font-bold text-stone-900 mt-1">{q.question}</h4>
                    </div>
                    <div className={`px-4 py-2 rounded-full text-xs font-bold ${evalItem.score >= 70 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {evalItem.score}%
                    </div>
                  </div>
                  
                  <div className="space-y-6 pt-6 border-t border-stone-50">
                    <div>
                      <div className="flex items-center gap-2 mb-3 text-stone-400">
                        <FileText className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Suggested Answer</span>
                      </div>
                      <p className="text-sm text-stone-600 leading-relaxed italic bg-stone-50 p-6 rounded-2xl">{q.suggestedAnswer}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-3 text-orange-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">What you missed</span>
                      </div>
                      <ul className="space-y-2">
                        {evalItem.missingPoints.map((p, i) => (
                          <li key={i} className="text-sm text-stone-600 flex gap-3 bg-orange-50/30 p-4 rounded-xl">
                            <span className="text-orange-400 font-bold">!</span> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button 
            onClick={onBack}
            className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-stone-800 transition-all shadow-xl shadow-stone-200"
          >
            Finish Review
          </button>
        </motion.div>
      </div>
    );
  }

  if (session && session.status === 'InProgress') {
    const currentQuestion = session.questions[session.currentIndex];
    const isFlagged = session.flaggedQuestions.includes(currentQuestion.id);
    const progress = session.questions.length > 0 ? ((session.currentIndex + 1) / session.questions.length) * 100 : 0;

    return (
      <div className="min-h-screen bg-[#FDFCF8] font-sans flex flex-col">
        {/* Exam Header */}
        <div className="bg-white border-b border-stone-100 p-6 sticky top-0 z-50">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <button 
                onClick={() => {
                  if (confirm('Exit simulation? Your progress will be lost.')) onBack();
                }} 
                className="p-2 hover:bg-stone-50 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="text-center">
                <h2 className="text-lg font-serif italic">{course.name}</h2>
                <div className="flex items-center justify-center gap-4 mt-1">
                  <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Exam Simulation</span>
                  <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatTime(timeLeft)}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => {
                  if (confirm('Finish and submit your exam?')) handleFinishSimulation();
                }}
                className="bg-stone-900 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all shadow-md shadow-stone-200"
              >
                Finish
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Question {session.currentIndex + 1} of {session.questions.length}</p>
                <p className="text-[10px] font-bold text-stone-900 uppercase tracking-widest">{Math.round(progress)}%</p>
              </div>
              <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-red-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6 pb-40">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2 text-stone-400">
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{currentQuestion.type} • {currentQuestion.points} Points</span>
              </div>
              <button 
                onClick={() => toggleFlag(currentQuestion.id)}
                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${isFlagged ? 'text-red-600' : 'text-stone-300 hover:text-stone-600'}`}
              >
                <Target className="w-4 h-4" />
                {isFlagged ? 'Flagged' : 'Flag Question'}
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <h3 className="text-2xl font-serif leading-tight text-stone-900 whitespace-pre-wrap">
                  {currentQuestion.question}
                </h3>

                {/* Answer Inputs */}
                <div className="space-y-6">
                  {currentQuestion.type === 'MultipleChoice' ? (
                    <div className="space-y-3">
                      {currentQuestion.options?.map((option, i) => (
                        <button
                          key={i}
                          onClick={() => handleAnswerChange(option)}
                          className={`w-full p-6 rounded-[1.5rem] border text-left text-sm font-medium transition-all flex items-center gap-4 ${
                            session.answers[currentQuestion.id] === option 
                              ? 'border-stone-900 bg-stone-900 text-white shadow-lg' 
                              : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                            session.answers[currentQuestion.id] === option ? 'border-white/30 bg-white/10' : 'border-stone-100 bg-stone-50'
                          }`}>
                            {String.fromCharCode(65 + i)}
                          </div>
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : currentQuestion.type === 'CodeWriting' ? (
                    <div className="space-y-0 rounded-[2rem] overflow-hidden border border-stone-200 shadow-sm">
                      <div className="flex items-center justify-between px-6 py-3 bg-stone-800 text-stone-400">
                        <span className="text-[10px] font-bold uppercase tracking-widest">Code Editor</span>
                        <div className="flex gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-red-500/50" />
                          <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                          <div className="w-2 h-2 rounded-full bg-green-500/50" />
                        </div>
                      </div>
                      <textarea
                        value={session.answers[currentQuestion.id] || ''}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        placeholder="Write your code here..."
                        className="w-full h-80 p-8 bg-stone-900 text-stone-100 font-mono text-sm focus:ring-0 outline-none resize-none"
                      />
                    </div>
                  ) : (
                    <textarea
                      value={session.answers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      placeholder="Type your detailed explanation here..."
                      className="w-full h-80 p-8 bg-white border border-stone-200 rounded-[2rem] focus:ring-2 focus:ring-stone-900 outline-none resize-none text-lg text-stone-800 placeholder:text-stone-200 transition-all shadow-sm"
                    />
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 p-6 pb-10 z-50">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <button 
              onClick={() => setSession(prev => prev ? { ...prev, currentIndex: Math.max(0, prev.currentIndex - 1) } : null)}
              disabled={session.currentIndex === 0}
              className="p-4 bg-stone-50 text-stone-400 rounded-2xl disabled:opacity-30 transition-all hover:bg-stone-100"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <button 
              onClick={() => setIsJumpMenuOpen(!isJumpMenuOpen)}
              className="flex-1 py-4 bg-white border border-stone-200 rounded-2xl font-bold text-[10px] uppercase tracking-widest text-stone-500 hover:bg-stone-50 transition-all flex items-center justify-center gap-2"
            >
              Jump to Question
              <ChevronUp className={`w-4 h-4 transition-transform ${isJumpMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            <button 
              onClick={() => {
                if (session.currentIndex < session.questions.length - 1) {
                  setSession(prev => prev ? { ...prev, currentIndex: prev.currentIndex + 1 } : null);
                } else {
                  if (confirm('Finish exam and submit?')) handleFinishSimulation();
                }
              }}
              className="p-4 bg-stone-900 text-white rounded-2xl transition-all hover:bg-stone-800 shadow-lg shadow-stone-200"
            >
              {session.currentIndex === session.questions.length - 1 ? <Check className="w-6 h-6" /> : <ArrowRight className="w-6 h-6" />}
            </button>
          </div>

          {/* Jump Menu */}
          <AnimatePresence>
            {isJumpMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-full left-0 right-0 mb-4 px-6"
              >
                <div className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-[2.5rem] p-8 shadow-2xl grid grid-cols-5 gap-3">
                  {session.questions.map((q, i) => {
                    const isAnswered = !!session.answers[q.id];
                    const isFlagged = session.flaggedQuestions.includes(q.id);
                    const isCurrent = session.currentIndex === i;
                    return (
                      <button
                        key={q.id}
                        onClick={() => {
                          setSession(prev => prev ? { ...prev, currentIndex: i } : null);
                          setIsJumpMenuOpen(false);
                        }}
                        className={`h-12 rounded-xl text-[10px] font-bold flex items-center justify-center transition-all relative ${
                          isCurrent ? 'bg-stone-900 text-white ring-4 ring-stone-100' :
                          isFlagged ? 'bg-red-50 text-red-600 border border-red-100' :
                          isAnswered ? 'bg-stone-100 text-stone-900' :
                          'bg-white border border-stone-100 text-stone-300'
                        }`}
                      >
                        {i + 1}
                        {isFlagged && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCF8] p-6 font-sans pb-24">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-white border border-stone-100 rounded-xl text-stone-400 hover:text-stone-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Exam Simulation</h1>
          </div>
          
          <div className="flex bg-stone-100 p-1 rounded-2xl">
            <button 
              onClick={() => setActiveTab('setup')}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'setup' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Setup
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              History
            </button>
          </div>
        </div>

        {activeTab === 'history' ? (
          <div className="space-y-6">
            <div className="bg-white border border-stone-100 rounded-[2.5rem] p-8 shadow-sm">
              <h2 className="text-lg font-bold text-stone-900 mb-6">Simulation History</h2>
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-8 h-8 border-4 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
                  <p className="text-sm text-stone-500">Loading history...</p>
                </div>
              ) : pastSimulations.length > 0 ? (
                <div className="space-y-4">
                  {pastSimulations.sort((a, b) => (b.startTime || 0) - (a.startTime || 0)).map(sim => (
                    <div key={sim.id} className="p-6 bg-stone-50 rounded-3xl border border-stone-100 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-stone-900">{sim.title}</h3>
                        <p className="text-xs text-stone-500 mt-1">
                          {new Date(sim.startTime || 0).toLocaleDateString()} • {sim.questions.length} Questions • {sim.durationMinutes}m
                        </p>
                        <div className={`mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          sim.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {sim.status}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {sim.status === 'Completed' && sim.result && (
                          <button 
                            onClick={() => {
                              setSession(sim);
                              setResult(sim.result || null);
                              setIsResultView(true);
                            }}
                            className="px-4 py-2 bg-stone-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all"
                          >
                            Review
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setSession({ ...sim, status: 'InProgress', currentIndex: 0, startTime: Date.now(), answers: {}, flaggedQuestions: [] });
                            setTimeLeft(sim.durationMinutes * 60);
                            setIsResultView(false);
                            setResult(null);
                          }}
                          className="px-4 py-2 bg-white border border-stone-200 text-stone-900 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-100 transition-all"
                        >
                          Retake
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <History className="w-6 h-6 text-stone-300" />
                  </div>
                  <p className="text-sm text-stone-500">No simulations completed yet.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white border border-stone-100 rounded-[2.5rem] p-8 mb-8 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">{course.name}</h2>
              <p className="text-sm text-stone-500">Ready for your weekly simulation?</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <button 
              onClick={() => setIsDurationModalOpen(true)}
              className="bg-stone-50 p-5 rounded-3xl text-left hover:bg-stone-100 transition-all group"
            >
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 group-hover:text-stone-600">Duration</p>
              <p className="text-lg font-bold text-stone-900">{simulationDuration} Minutes</p>
            </button>
            <button 
              onClick={() => setIsQuestionCountModalOpen(true)}
              className="bg-stone-50 p-5 rounded-3xl text-left hover:bg-stone-100 transition-all group"
            >
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 group-hover:text-stone-600">Questions</p>
              <p className="text-lg font-bold text-stone-900">{simulationQuestionCount} Mixed</p>
            </button>
          </div>

          <div className="space-y-4 mb-12">
            <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
              <div className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-stone-400" />
                <span className="text-sm font-medium text-stone-700">
                  {simulationFilter.type === 'All' ? 'Full Course Simulation' : `Focused: ${simulationFilter.value || 'Select ' + simulationFilter.type}`}
                </span>
              </div>
              <button 
                onClick={() => setIsFilterModalOpen(true)}
                className="text-xs font-bold text-stone-900 hover:underline"
              >
                Change
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-stone-400" />
                <span className="text-sm font-medium text-stone-700">Professor Style Mode</span>
              </div>
              <button 
                onClick={() => setIsStyleModalOpen(true)}
                className="text-xs font-bold text-stone-900 hover:underline"
              >
                Configure
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-stone-400" />
                <span className="text-sm font-medium text-stone-700">Simulation Schedule</span>
              </div>
              <button 
                onClick={() => setIsScheduleModalOpen(true)}
                className="text-xs font-bold text-stone-900 hover:underline"
              >
                {simulationSchedule}
              </button>
            </div>
          </div>

          {/* Manage Questions */}
          <div className="space-y-4 mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">Manage Questions</h2>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsConfirmGenModalOpen(true)}
                  className="text-[10px] font-bold text-stone-900 uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Generate with AI
                </button>
                <button 
                  onClick={() => setIsImportModalOpen(true)}
                  className="text-[10px] font-bold text-stone-900 uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Import Text
                </button>
                <button 
                  onClick={() => { setSimulationFilter({ type: 'Topic' }); setIsFilterModalOpen(true); }}
                  className="text-[10px] font-bold text-stone-900 uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  <Filter className="w-3 h-3" />
                  Manage Topics
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {stateQuestions.map(q => (
                <div key={q.id} className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm flex justify-between items-start gap-4 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 line-clamp-2">{q.question}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">{q.type}</p>
                      {q.source && <p className="text-[10px] text-stone-500 uppercase font-bold tracking-widest bg-stone-100 px-1.5 rounded">Source: {q.source}</p>}
                      {q.topic && (
                        <button 
                          onClick={() => { setSimulationFilter({ type: 'Topic', value: q.topic as string }); setIsFilterModalOpen(true); }}
                          className="text-[10px] text-orange-400 uppercase font-bold tracking-widest bg-orange-50 px-1.5 rounded hover:bg-orange-100 transition-colors"
                        >
                          Topic: {q.topic}
                        </button>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => onDeleteQuestion?.(q.id)}
                    className="p-2 text-stone-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Delete Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-stone-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-2">Start Simulation</h3>
            <p className="text-stone-400 text-sm mb-8 leading-relaxed">
              This will start a timed {simulationDuration}-minute session with {simulationQuestionCount} questions. 
              Scope: <span className="text-white font-bold">{simulationFilter.type === 'All' ? 'Entire Course' : simulationFilter.value}</span>.
              Ensure you are in a quiet environment with no distractions.
            </p>
            <button 
              onClick={startSimulation}
              className="w-full py-5 bg-white text-stone-900 rounded-2xl font-bold text-lg hover:bg-stone-100 transition-all flex items-center justify-center gap-3"
            >
              <Play className="w-5 h-5 fill-current" />
              Begin Exam
            </button>
          </div>
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        </div>

        {/* Alert Modal */}
        <AnimatePresence>
          {alertConfig.open && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setAlertConfig(prev => ({ ...prev, open: false }))}
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl text-center"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${alertConfig.title === 'Error' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                  {alertConfig.title === 'Error' ? <AlertCircle className="w-6 h-6" /> : <Check className="w-6 h-6" />}
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-2">{alertConfig.title}</h3>
                <p className="text-sm text-stone-500 mb-6">{alertConfig.message}</p>
                <button 
                  onClick={() => setAlertConfig(prev => ({ ...prev, open: false }))}
                  className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold text-sm hover:bg-stone-800 transition-all"
                >
                  Dismiss
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Confirm Generation Modal */}
        <AnimatePresence>
          {isConfirmGenModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsConfirmGenModalOpen(false)}
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl text-center"
              >
                <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-2">Generate AI Exam?</h3>
                <p className="text-sm text-stone-500 mb-6">No questions found for this selection. Would you like AI to generate a fresh exam based on your course materials?</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsConfirmGenModalOpen(false)}
                    className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold text-sm hover:bg-stone-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      const qs = await generateAIExam();
                      if (qs) {
                        // Start simulation with new questions
                        const duration = simulationDuration; 
                        const newSession: ExamSimulationSession = {
                          id: Math.random().toString(36).substr(2, 9),
                          courseId: course.id,
                          title: `${course.name} - ${simulationFilter.type === 'All' ? 'Full Course' : (simulationFilter.type === 'Topic' ? 'Topic: ' + simulationFilter.value : 'File: ' + simulationFilter.value)}`,
                          durationMinutes: duration,
                          questions: qs.slice(0, simulationQuestionCount),
                          currentIndex: 0,
                          startTime: Date.now(),
                          status: 'InProgress',
                          answers: {},
                          flaggedQuestions: [],
                          sourceType: simulationFilter.type,
                          sourceId: simulationFilter.value,
                          createdAt: Date.now()
                        };
                        setSession(newSession);
                        if (user) {
                          api.saveExamSimulation(user.uid, newSession);
                        }
                        setTimeLeft(duration * 60);
                        setIsResultView(false);
                      }
                    }}
                    className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-bold text-sm hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
                  >
                    Generate
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Import Text Modal */}
        <AnimatePresence>
          {isImportModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsImportModalOpen(false)}
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-stone-900">Import Study Text</h3>
                  <button onClick={() => setIsImportModalOpen(false)} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <p className="text-sm text-stone-500 mb-6">Paste text from your lectures or notes. AI will generate {simulationQuestionCount} exam questions from it.</p>
                
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste your text here..."
                  className="w-full h-64 p-6 bg-stone-50 border border-stone-100 rounded-2xl focus:ring-2 focus:ring-stone-900 outline-none resize-none text-sm mb-6"
                />

                <button 
                  onClick={handleImportText}
                  disabled={!importText.trim() || isGenerating}
                  className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-stone-400 border-t-white rounded-full animate-spin" />
                      Generating Questions...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Questions
                    </>
                  )}
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Filter Modal */}
        <AnimatePresence>
          {isFilterModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsFilterModalOpen(false)}
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl max-h-[85vh] flex flex-col"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-stone-900">Simulation Scope</h2>
                  <button onClick={() => setIsFilterModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-stone-400" />
                  </button>
                </div>

                {/* Segmented Control */}
                <div className="flex bg-stone-100 p-1 rounded-2xl mb-8">
                  <button 
                    onClick={() => setSimulationFilter(prev => ({ ...prev, type: 'All' }))}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${simulationFilter.type === 'All' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    Entire Course
                  </button>
                  <button 
                    onClick={() => setSimulationFilter(prev => ({ ...prev, type: 'Source' }))}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${simulationFilter.type === 'Source' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    Lecture Files
                  </button>
                  <button 
                    onClick={() => setSimulationFilter(prev => ({ ...prev, type: 'Topic' }))}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${simulationFilter.type === 'Topic' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    Topics
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
                  {simulationFilter.type === 'All' && (
                    <div className="space-y-4">
                      <button 
                        onClick={() => { setSimulationFilter({ type: 'All' }); setIsFilterModalOpen(false); }}
                        className="w-full p-6 rounded-3xl border-2 border-stone-900 bg-stone-50 text-left transition-all flex items-center justify-between group"
                      >
                        <div>
                          <p className="font-bold text-stone-900 text-lg">Entire Course</p>
                          <p className="text-sm text-stone-500 mt-1">Includes questions from all lectures and topics.</p>
                        </div>
                        <div className="w-6 h-6 rounded-full border-2 border-stone-900 flex items-center justify-center">
                          <div className="w-3 h-3 bg-stone-900 rounded-full" />
                        </div>
                      </button>
                    </div>
                  )}

                  {simulationFilter.type === 'Source' && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-2 mb-4">Select a Lecture File</p>
                      <div className="grid grid-cols-1 gap-3">
                        {lectureFiles.filter(f => f.courseId === course.id).length > 0 ? (
                          lectureFiles.filter(f => f.courseId === course.id).map(file => (
                            <button 
                              key={file.id}
                              onClick={() => { setSimulationFilter({ type: 'Source', value: file.name }); setIsFilterModalOpen(false); }}
                              className={`w-full p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between group ${simulationFilter.value === file.name ? 'border-stone-900 bg-stone-50' : 'border-stone-100 hover:border-stone-200'}`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${simulationFilter.value === file.name ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400 group-hover:bg-stone-200'}`}>
                                  <FileText className="w-5 h-5" />
                                </div>
                                <span className={`font-bold ${simulationFilter.value === file.name ? 'text-stone-900' : 'text-stone-600'}`}>{file.name}</span>
                              </div>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${simulationFilter.value === file.name ? 'border-stone-900' : 'border-stone-200 group-hover:border-stone-300'}`}>
                                {simulationFilter.value === file.name && <div className="w-3 h-3 bg-stone-900 rounded-full" />}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="text-center py-12 bg-stone-50 rounded-3xl border border-dashed border-stone-200">
                            <FileUp className="w-8 h-8 text-stone-300 mx-auto mb-3" />
                            <p className="text-sm text-stone-500">No lecture files found.</p>
                            <p className="text-[10px] text-stone-400 mt-1">Upload materials to enable file-based simulation.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {simulationFilter.type === 'Topic' && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-2 mb-4">Select a Topic</p>
                      <div className="grid grid-cols-1 gap-3">
                        {Array.from(new Set(stateQuestions.filter(q => q.courseId === course.id).map(q => q.topic).filter(Boolean))).length > 0 ? (
                          Array.from(new Set(stateQuestions.filter(q => q.courseId === course.id).map(q => q.topic).filter(Boolean))).map(topic => (
                            <button 
                              key={topic}
                              onClick={() => { setSimulationFilter({ type: 'Topic', value: topic as string }); setIsFilterModalOpen(false); }}
                              className={`w-full p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between group ${simulationFilter.value === topic ? 'border-stone-900 bg-stone-50' : 'border-stone-100 hover:border-stone-200'}`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${simulationFilter.value === topic ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-400 group-hover:bg-orange-100'}`}>
                                  <Layers className="w-5 h-5" />
                                </div>
                                <span className={`font-bold ${simulationFilter.value === topic ? 'text-stone-900' : 'text-stone-600'}`}>{topic}</span>
                              </div>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${simulationFilter.value === topic ? 'border-stone-900' : 'border-stone-200 group-hover:border-stone-300'}`}>
                                {simulationFilter.value === topic && <div className="w-3 h-3 bg-stone-900 rounded-full" />}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="text-center py-12 bg-stone-50 rounded-3xl border border-dashed border-stone-200">
                            <Brain className="w-8 h-8 text-stone-300 mx-auto mb-3" />
                            <p className="text-sm text-stone-500">No topics found.</p>
                            <p className="text-[10px] text-stone-400 mt-1">Generate questions first to extract topics.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-stone-100">
                  <button 
                    onClick={() => setIsFilterModalOpen(false)}
                    className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
                  >
                    Confirm Selection
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Professor Style Modal */}
        <AnimatePresence>
          {isStyleModalOpen && (
            <div className="fixed inset-0 z-50 flex items-end justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsStyleModalOpen(false)}
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-stone-900">Professor Style</h2>
                  <button onClick={() => setIsStyleModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-stone-400" />
                  </button>
                </div>
                <p className="text-xs text-stone-500 mb-6 leading-relaxed">
                  Describe how your professor writes exams. AI will adapt simulation questions based on this description.
                </p>
                <textarea 
                  value={professorStyle}
                  onChange={(e) => onUpdateProfessorStyle(e.target.value)}
                  placeholder="e.g. My professor often asks conceptual explanations and tricky code interpretation questions..."
                  className="w-full h-48 bg-stone-50 border-none rounded-2xl p-6 text-sm text-stone-800 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all resize-none mb-6"
                />
                <button 
                  onClick={() => setIsStyleModalOpen(false)}
                  className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg flex items-center justify-center gap-3 hover:bg-stone-800 active:scale-[0.98] transition-all"
                >
                  <Check className="w-6 h-6" />
                  Save Description
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Schedule Modal */}
        <AnimatePresence>
          {isScheduleModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsScheduleModalOpen(false)}
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-stone-900">Simulation Schedule</h2>
                  <button onClick={() => setIsScheduleModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-stone-400" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
                  {['Every Monday', 'Every Tuesday', 'Every Wednesday', 'Every Thursday', 'Every Friday', 'Every Saturday', 'Every Sunday', 'Manual Only'].map(s => (
                    <button 
                      key={s}
                      onClick={() => { setSimulationSchedule(s); setIsScheduleModalOpen(false); }}
                      className={`w-full p-4 rounded-2xl border text-left transition-all ${simulationSchedule === s ? 'border-stone-900 bg-stone-50 font-bold' : 'border-stone-100 hover:border-stone-300'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Duration Modal */}
        <AnimatePresence>
          {isDurationModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDurationModalOpen(false)}
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-stone-900">Set Duration</h2>
                  <button onClick={() => setIsDurationModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-stone-400" />
                  </button>
                </div>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="15" 
                      max="180" 
                      step="15"
                      value={simulationDuration}
                      onChange={(e) => setSimulationDuration(parseInt(e.target.value))}
                      className="flex-1 accent-stone-900"
                    />
                    <span className="text-xl font-bold text-stone-900 w-20 text-right">{simulationDuration}m</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[30, 45, 60, 90, 120, 180].map(m => (
                      <button 
                        key={m}
                        onClick={() => setSimulationDuration(m)}
                        className={`p-3 rounded-xl border text-sm transition-all ${simulationDuration === m ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-100 hover:border-stone-300'}`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => setIsDurationModalOpen(false)}
                    className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Question Count Modal */}
        <AnimatePresence>
          {isQuestionCountModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsQuestionCountModalOpen(false)}
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-stone-900">Number of Questions</h2>
                  <button onClick={() => setIsQuestionCountModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-stone-400" />
                  </button>
                </div>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="5" 
                      max="50" 
                      step="5"
                      value={simulationQuestionCount}
                      onChange={(e) => setSimulationQuestionCount(parseInt(e.target.value))}
                      className="flex-1 accent-stone-900"
                    />
                    <span className="text-xl font-bold text-stone-900 w-20 text-right">{simulationQuestionCount}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 15, 20, 25, 30, 40, 50].map(c => (
                      <button 
                        key={c}
                        onClick={() => setSimulationQuestionCount(c)}
                        className={`p-3 rounded-xl border text-sm transition-all ${simulationQuestionCount === c ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-100 hover:border-stone-300'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => setIsQuestionCountModalOpen(false)}
                    className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    )}
  </div>
</div>
);
};

interface QuizPracticeProps {
  course: Course;
  onBack: () => void;
  questions: QuizQuestion[];
  onAddQuestions: (newQuestions: QuizQuestion[]) => void;
  onDeleteQuestion?: (id: string) => void;
  user: User | null;
  lectureFiles: LectureFile[];
  onGenerateQuiz: () => void;
  isGenerating: boolean;
  onStudyComplete?: (durationMins: number) => void;
}

const QuizPractice: React.FC<QuizPracticeProps> = ({ 
  course, 
  onBack, 
  questions: stateQuestions, 
  onAddQuestions,
  onDeleteQuestion, 
  user,
  lectureFiles,
  onGenerateQuiz,
  isGenerating,
  onStudyComplete
}) => {
  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showSuggested, setShowSuggested] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [selectingTopic, setSelectingTopic] = useState(false);
  const [selectingSource, setSelectingSource] = useState(false);
  const [isManualAdding, setIsManualAdding] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [manualTopic, setManualTopic] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [dailyStats, setDailyStats] = useState({
    practiced: 0,
    correct: 0,
    accuracy: 0
  });

  // Timer logic for Exam mode
  useEffect(() => {
    let timer: any;
    if (session && session.mode === 'Exam' && session.timeLeft !== undefined && session.timeLeft > 0 && !isReviewing) {
      timer = setInterval(() => {
        setSession(prev => {
          if (!prev || prev.timeLeft === undefined) return prev;
          if (prev.timeLeft <= 1) {
            clearInterval(timer);
            setIsReviewing(true);
            return { ...prev, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [session?.mode, isReviewing, !!session]);

  const startQuiz = (mode: 'Quick' | 'Topic' | 'Exam' | 'Source', filterValue?: string) => {
    let questions = [...stateQuestions];
    if (questions.length === 0) return;

    if (mode === 'Quick') {
      questions = questions.sort(() => 0.5 - Math.random()).slice(0, 5);
    } else if (mode === 'Exam') {
      questions = questions.sort(() => 0.5 - Math.random()).slice(0, 15);
    } else if (mode === 'Topic' && filterValue) {
      questions = questions.filter(q => q.topic === filterValue);
    } else if (mode === 'Source' && filterValue) {
      questions = questions.filter(q => q.source === filterValue);
    }
    
    setSession({
      questions,
      currentIndex: 0,
      answers: {},
      evaluations: {},
      mode: mode === 'Source' ? 'Topic' : mode, // Treat Source as Topic mode for UI purposes
      startTime: Date.now(),
      timeLeft: mode === 'Exam' ? 25 * 60 : undefined,
      difficulties: {}
    });
    setIsReviewing(false);
    setSelectingTopic(false);
    setSelectingSource(false);
    setCurrentAnswer('');
    setShowSuggested(false);
  };

  const handleEvaluate = async () => {
    if (!session || !currentAnswer.trim()) return;
    
    setIsEvaluating(true);
    const currentQuestion = session.questions[session.currentIndex];
    if (!currentQuestion) {
      setIsEvaluating(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const isCodeQuestion = currentQuestion.type === 'Code' || currentQuestion.type.toLowerCase().includes('code');
      
      const prompt = isCodeQuestion 
        ? `Evaluate this student's code answer to the following programming question.
        Question: ${currentQuestion.question}
        Suggested Solution: ${currentQuestion.suggestedAnswer}
        Student Code: ${currentAnswer}
        
        CRITICAL: Analyze the code for syntax errors, logic issues, missing brackets, or wrong structure.
        
        Provide feedback in JSON format with:
        - score (0-100)
        - correctPoints (array of strings)
        - missingPoints (array of strings)
        - incorrectPoints (array of strings - specifically syntax errors or logic bugs)
        - feedback (a summary of suggested improvement and a corrected version of the code if errors were found)`
        : `Evaluate this student's answer to the following question.
        Question: ${currentQuestion.question}
        Suggested Answer: ${currentQuestion.suggestedAnswer}
        Student Answer: ${currentAnswer}
        
        CRITICAL: The student's answer does NOT have to be word-for-word. If the student provides the correct LOGIC or CONCEPT, mark it as correct.
        
        Provide feedback in JSON format with:
        - score (0-100)
        - correctPoints (array of strings)
        - missingPoints (array of strings)
        - incorrectPoints (array of strings - specifically things the student got wrong or misconceptions)
        - feedback (a summary of suggested improvement)`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              correctPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              missingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              incorrectPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              feedback: { type: Type.STRING }
            },
            required: ["score", "correctPoints", "missingPoints", "incorrectPoints", "feedback"]
          }
        }
      });

      const evaluation = JSON.parse(response.text || '{}');
      
      // Save to DB
      if (course && course.id && user) {
        await api.saveEvaluation(user.uid, {
          id: Math.random().toString(36).substr(2, 9),
          courseId: course.id,
          questionId: currentQuestion.id,
          studentAnswer: currentAnswer,
          score: evaluation.score,
          correctPoints: evaluation.correctPoints,
          missingPoints: evaluation.missingPoints,
          incorrectPoints: evaluation.incorrectPoints || [],
          feedback: evaluation.feedback,
          timestamp: Date.now()
        });
      }

      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          answers: { ...prev.answers, [currentQuestion.id]: currentAnswer },
          evaluations: { ...prev.evaluations, [currentQuestion.id]: evaluation }
        };
      });

      // Update daily stats
      if (evaluation.score >= 70) {
        setDailyStats(prev => ({
          ...prev,
          practiced: prev.practiced + 1,
          correct: prev.correct + 1,
          accuracy: Math.round(((prev.correct + 1) / (prev.practiced + 1)) * 100)
        }));
      } else {
        setDailyStats(prev => ({
          ...prev,
          practiced: prev.practiced + 1,
          accuracy: Math.round((prev.correct / (prev.practiced + 1)) * 100)
        }));
      }

    } catch (error) {
      console.error("Evaluation failed:", error);
      const fallbackEval: QuizEvaluation = {
        id: Math.random().toString(36).substr(2, 9),
        courseId: course.id,
        questionId: currentQuestion.id,
        studentAnswer: currentAnswer,
        score: 50,
        correctPoints: ["Answer submitted successfully."],
        missingPoints: ["AI evaluation is currently unavailable."],
        incorrectPoints: [],
        feedback: "Please review the suggested answer below.",
        timestamp: Date.now()
      };
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          answers: { ...prev.answers, [currentQuestion.id]: currentAnswer },
          evaluations: { ...prev.evaluations, [currentQuestion.id]: fallbackEval }
        };
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const nextQuestion = () => {
    if (!session) return;
    if (session.currentIndex < session.questions.length - 1) {
      const nextQ = session.questions[session.currentIndex + 1];
      setSession(prev => prev ? { ...prev, currentIndex: prev.currentIndex + 1 } : null);
      if (nextQ) {
        setCurrentAnswer(session.answers[nextQ.id] || '');
      }
      setShowSuggested(false);
    } else {
      setIsReviewing(true);
      if (onStudyComplete && session.startTime) {
        const durationMins = Math.max(1, Math.round((Date.now() - session.startTime) / 60000));
        onStudyComplete(durationMins);
      }
    }
  };

  const prevQuestion = () => {
    if (!session || session.currentIndex === 0) return;
    const prevQ = session.questions[session.currentIndex - 1];
    setSession(prev => prev ? { ...prev, currentIndex: prev.currentIndex - 1 } : null);
    if (prevQ) {
      setCurrentAnswer(session.answers[prevQ.id] || '');
    }
    setShowSuggested(false);
  };

  const markDifficulty = (difficulty: 'Easy' | 'Medium' | 'Hard') => {
    if (!session) return;
    const currentQuestion = session.questions[session.currentIndex];
    if (!currentQuestion) return;
    
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        difficulties: { ...prev.difficulties, [currentQuestion.id]: difficulty }
      };
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleManualAdd = async () => {
    if (!manualInput.trim() || !manualTopic.trim() || !user || !course) return;
    
    setIsParsing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `Parse the following text into a JSON array of quiz questions for the topic "${manualTopic}".
      The input format is "q:" for questions and "a:" for answers. There might be multiple questions and answers.
      
      Input Text:
      ${manualInput}
      
      CRITICAL: 
      - Keep the questions and answers exactly as provided.
      - Separate each individual question and answer pair.
      - Assign a relevant "type" to each question from: "Definition", "Explanation", "Comparison", "Code", "Calculation", "Diagram".
      
      Return as a JSON array of objects: { "question": string, "suggestedAnswer": string, "topic": string, "type": string }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                suggestedAnswer: { type: Type.STRING },
                topic: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["Definition", "Explanation", "Comparison", "Code", "Calculation", "Diagram"] }
              },
              required: ["question", "suggestedAnswer", "topic", "type"]
            }
          }
        }
      });

      const generated = JSON.parse(response.text || '[]');
      const newQuestions: QuizQuestion[] = generated.map((q: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        courseId: course.id,
        ...q,
        source: 'Manual Entry'
      }));

      if (newQuestions.length > 0) {
        await Promise.all(newQuestions.map(q => api.saveQuizQuestion(user.uid, q)));
        onAddQuestions(newQuestions);
      }

      setManualInput('');
      setManualTopic('');
      setIsManualAdding(false);
    } catch (error) {
      console.error("Manual parsing failed:", error);
    } finally {
      setIsParsing(false);
    }
  };

  if (isManualAdding) {
    const topics: string[] = Array.from(new Set(stateQuestions.map(q => q.topic)));
    return (
      <div className="min-h-screen bg-[#FDFCF8] p-6 font-sans">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setIsManualAdding(false)} className="p-2 hover:bg-white rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-serif italic">Add Manual Quiz</h1>
          </div>

          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-sm">
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4 px-1">Select or Enter Topic</label>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 mb-4">
                  {topics.map(t => (
                    <button
                      key={t}
                      onClick={() => setManualTopic(t)}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                        manualTopic === t ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={manualTopic}
                  onChange={(e) => setManualTopic(e.target.value)}
                  placeholder="Enter new topic..."
                  className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all"
                />
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-sm">
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4 px-1">Questions & Answers (q: and a:)</label>
              <textarea
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="q: What is React?&#10;a: A JavaScript library for building user interfaces.&#10;&#10;q: What is JSX?&#10;a: A syntax extension for JavaScript."
                className="w-full h-80 bg-stone-50 border-none rounded-2xl p-6 text-stone-800 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all resize-none font-mono text-sm"
              />
            </div>

            <button
              onClick={handleManualAdd}
              disabled={!manualInput.trim() || !manualTopic.trim() || isParsing}
              className="w-full py-6 bg-stone-900 text-white rounded-[2rem] font-bold text-sm uppercase tracking-widest hover:bg-stone-800 disabled:opacity-50 transition-all shadow-xl shadow-stone-200 flex items-center justify-center gap-3"
            >
              {isParsing ? (
                <div className="w-5 h-5 border-2 border-stone-300 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-5 h-5" />
              )}
              {isParsing ? 'Parsing Questions...' : 'Save Manual Quiz'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (selectingSource) {
    const sources: string[] = Array.from(new Set(stateQuestions.map(q => q.source).filter(Boolean))) as string[];
    return (
      <div className="min-h-screen bg-[#FDFCF8] p-6 font-sans">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setSelectingSource(false)} className="p-2 hover:bg-white rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-serif italic">Select Source</h1>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {sources.length > 0 ? sources.map(source => (
              <button
                key={source}
                onClick={() => startQuiz('Source', source)}
                className="w-full bg-white p-6 rounded-[2rem] border border-stone-200 shadow-sm hover:border-stone-400 transition-all text-left flex items-center justify-between group"
              >
                <div>
                  <h3 className="text-lg font-bold text-stone-900">{source}</h3>
                  <p className="text-xs text-stone-400 uppercase font-bold tracking-widest mt-1">
                    {stateQuestions.filter(q => q.source === source).length} Questions Available
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-900 transition-all" />
              </button>
            )) : (
              <div className="text-center py-12">
                <p className="text-stone-400 font-medium">No source-tagged questions found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (selectingTopic) {
    const topics: string[] = Array.from(new Set(stateQuestions.map(q => q.topic)));
    return (
      <div className="min-h-screen bg-[#FDFCF8] p-6 font-sans">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setSelectingTopic(false)} className="p-2 hover:bg-white rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-serif italic">Select Topic</h1>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {topics.map(topic => (
              <button
                key={topic}
                onClick={() => startQuiz('Topic', topic)}
                className="w-full bg-white p-6 rounded-[2rem] border border-stone-200 shadow-sm hover:border-stone-400 transition-all text-left flex items-center justify-between group"
              >
                <div>
                  <h3 className="text-lg font-bold text-stone-900">{topic}</h3>
                  <p className="text-xs text-stone-400 uppercase font-bold tracking-widest mt-1">
                    {stateQuestions.filter(q => q.topic === topic).length} Questions Available
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-900 transition-all" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isReviewing && session) {
    const evaluations = Object.values(session.evaluations) as QuizEvaluation[];
    const totalScore = evaluations.reduce((acc, curr) => acc + curr.score, 0);
    const avgScore = evaluations.length > 0 ? Math.round(totalScore / evaluations.length) : 0;
    const timeSpent = Math.round((Date.now() - session.startTime) / 1000);
    
    const weakTopics = Array.from(new Set(
      session.questions
        .filter(q => {
          const evalItem = session.evaluations[q.id];
          const diff = session.difficulties[q.id];
          return (evalItem && evalItem.score < 60) || diff === 'Hard';
        })
        .map(q => q.topic)
    ));

    return (
      <div className="min-h-screen bg-stone-50 p-6 font-sans pb-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setSession(null)} className="p-2 hover:bg-white rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-serif italic">Quiz Summary</h1>
          </div>

          <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-stone-200 mb-8 text-center">
            <div className="w-24 h-24 bg-stone-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-12 h-12 text-yellow-400" />
            </div>
            <h2 className="text-5xl font-bold mb-2">{avgScore}%</h2>
            <p className="text-stone-400 uppercase tracking-[0.2em] text-[10px] font-bold">Quiz Performance</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white p-6 rounded-3xl border border-stone-200 text-center">
              <Target className="w-5 h-5 mx-auto mb-2 text-stone-400" />
              <p className="text-xl font-bold">{evaluations.filter(e => e.score >= 70).length}/{session.questions.length}</p>
              <p className="text-[10px] text-stone-400 uppercase font-bold">Correct Answers</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-stone-200 text-center">
              <Clock className="w-5 h-5 mx-auto mb-2 text-stone-400" />
              <p className="text-xl font-bold">{Math.floor(timeSpent / 60)}m {timeSpent % 60}s</p>
              <p className="text-[10px] text-stone-400 uppercase font-bold">Time Spent</p>
            </div>
          </div>

          {weakTopics.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-[2rem] p-8 mb-8">
              <div className="flex items-center gap-2 mb-6 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <h3 className="font-bold uppercase tracking-widest text-xs">Weak Topics Detected</h3>
              </div>
              <div className="space-y-3 mb-8">
                {weakTopics.map(topic => (
                  <div key={topic} className="bg-white/60 p-4 rounded-2xl border border-red-100 flex items-center justify-between">
                    <span className="text-sm font-medium text-red-900">{topic}</span>
                    <span className="text-[10px] font-bold text-red-400 uppercase">Review Needed</span>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-red-400">Study Recommendations</h4>
                <button className="w-full p-4 bg-white rounded-2xl border border-red-100 flex items-center justify-between group hover:border-red-300 transition-all">
                  <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-red-500" />
                    <span className="text-sm font-medium text-red-900">Review Flashcards for weak topics</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-red-300 group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => startQuiz('Topic')}
                  className="w-full p-4 bg-white rounded-2xl border border-red-100 flex items-center justify-between group hover:border-red-300 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-red-500" />
                    <span className="text-sm font-medium text-red-900">Practice more questions on weak topics</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-red-300 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          <button 
            onClick={() => setSession(null)}
            className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-sm uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
          >
            Finish & Return to Workspace
          </button>
        </motion.div>
      </div>
    );
  }

  if (session) {
    const currentQuestion = session.questions[session.currentIndex];
    const evaluation = session.evaluations[currentQuestion.id];
    const progress = session.questions.length > 0 ? ((session.currentIndex + 1) / session.questions.length) * 100 : 0;
    const difficulty = session.difficulties[currentQuestion.id];

    return (
      <div className="min-h-screen bg-[#FDFCF8] font-sans flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-stone-100 p-6 sticky top-0 z-50">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setSession(null)} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
              <div className="text-center">
                <h2 className="text-lg font-serif italic">{course.name}</h2>
                <div className="flex items-center justify-center gap-4 mt-1">
                  <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Today: {dailyStats.practiced}</span>
                  <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Correct: {dailyStats.correct}</span>
                  <span className="text-[9px] font-bold text-orange-500 uppercase tracking-widest">Accuracy: {dailyStats.accuracy}%</span>
                </div>
              </div>
              {session.mode === 'Exam' ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-xl text-red-600">
                  <Timer className="w-4 h-4" />
                  <span className="text-xs font-bold font-mono">{formatTime(session.timeLeft || 0)}</span>
                </div>
              ) : (
                <div className="w-10" />
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Question {session.currentIndex + 1} of {session.questions.length}</p>
                <p className="text-[10px] font-bold text-stone-900 uppercase tracking-widest">{Math.round(progress)}%</p>
              </div>
              <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-stone-900"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6 pb-32">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -100) nextQuestion();
                  if (info.offset.x > 100) prevQuestion();
                }}
                className="space-y-8"
              >
                {/* Question Area */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-stone-400">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{currentQuestion.type} Question</span>
                  </div>
                  <h3 className="text-2xl font-serif leading-tight text-stone-900">
                    {currentQuestion.question}
                  </h3>
                </div>

                {/* Answer Input */}
                <div className="space-y-6">
                  <div className="relative">
                    {currentQuestion.type === 'Code' || currentQuestion.type.toLowerCase().includes('code') ? (
                      <div className="bg-stone-900 rounded-[2rem] p-1 overflow-hidden border border-stone-800 shadow-xl">
                        <div className="flex items-center gap-2 px-6 py-3 border-b border-stone-800">
                          <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                          </div>
                          <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest ml-2">Code Editor</span>
                        </div>
                        <textarea
                          value={currentAnswer}
                          onChange={(e) => setCurrentAnswer(e.target.value)}
                          disabled={!!evaluation || isEvaluating}
                          placeholder="// Write your code here..."
                          className="w-full h-80 p-8 bg-transparent text-stone-100 font-mono text-sm focus:outline-none resize-none placeholder:text-stone-700 leading-relaxed"
                          spellCheck={false}
                        />
                      </div>
                    ) : (
                      <textarea
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        disabled={!!evaluation || isEvaluating}
                        placeholder="Write your answer here..."
                        className="w-full h-64 p-8 bg-white border border-stone-200 rounded-[2rem] focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none resize-none text-lg text-stone-800 placeholder:text-stone-300 transition-all shadow-sm"
                      />
                    )}
                    {isEvaluating && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] rounded-[2rem] flex flex-col items-center justify-center gap-4 z-10">
                        <div className="w-10 h-10 border-4 border-stone-100 border-t-stone-900 rounded-full animate-spin" />
                        <p className="text-xs font-bold uppercase tracking-widest text-stone-500">AI Evaluating Answer...</p>
                      </div>
                    )}
                  </div>
                  
                  {!evaluation ? (
                    <div className="grid grid-cols-1 gap-3">
                      <button
                        onClick={handleEvaluate}
                        disabled={!currentAnswer.trim() || isEvaluating}
                        className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-sm uppercase tracking-widest hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-stone-200"
                      >
                        Submit Answer
                      </button>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setShowSuggested(!showSuggested)}
                          className="py-4 bg-white border border-stone-200 text-stone-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-stone-50 transition-colors"
                        >
                          {showSuggested ? 'Hide Suggested' : 'Suggested Answer'}
                        </button>
                        <button
                          onClick={nextQuestion}
                          className="py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-stone-200 transition-colors"
                        >
                          Skip Question
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* Navigation After Answer */}
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          onClick={prevQuestion}
                          disabled={session.currentIndex === 0}
                          className="py-4 bg-white border border-stone-200 text-stone-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-stone-50 disabled:opacity-30 transition-all"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => {
                            setSession(prev => {
                              if (!prev) return null;
                              const newEvals = { ...prev.evaluations };
                              delete newEvals[currentQuestion.id];
                              return { ...prev, evaluations: newEvals };
                            });
                            setCurrentAnswer('');
                          }}
                          className="py-4 bg-white border border-stone-200 text-stone-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-stone-50 transition-all"
                        >
                          Retry
                        </button>
                        <button
                          onClick={nextQuestion}
                          className="py-4 bg-stone-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-stone-800 transition-all"
                        >
                          Next
                        </button>
                      </div>

                      {/* Difficulty Marking */}
                      <div className="bg-stone-50 rounded-3xl p-6 border border-stone-100">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest text-center mb-4">How difficult was this question?</p>
                        <div className="grid grid-cols-3 gap-3">
                          {(['Easy', 'Medium', 'Hard'] as const).map((d) => (
                            <button
                              key={d}
                              onClick={() => markDifficulty(d)}
                              className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                                difficulty === d 
                                  ? 'bg-stone-900 text-white shadow-md' 
                                  : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-400'
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Suggested Answer (Toggle) */}
                {showSuggested && !evaluation && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-stone-100 rounded-[2rem] p-8 border border-stone-200"
                  >
                    <div className="flex items-center gap-2 mb-4 text-stone-400">
                      <FileText className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Professor's Suggested Answer</span>
                    </div>
                    <p className="text-stone-700 leading-relaxed italic">{currentQuestion.suggestedAnswer}</p>
                  </motion.div>
                )}

                {/* AI Evaluation Feedback */}
                {evaluation && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-white rounded-[2.5rem] p-10 border border-stone-200 shadow-sm">
                      <div className="flex items-center justify-between mb-10">
                        <div>
                          <div className="flex items-center gap-2 mb-1 text-stone-400">
                            <Brain className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">AI Evaluation</span>
                          </div>
                          <h4 className="text-2xl font-serif italic">Performance Feedback</h4>
                        </div>
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 ${
                          evaluation.score >= 80 ? 'border-green-100 text-green-600' : 
                          evaluation.score >= 60 ? 'border-yellow-100 text-yellow-600' : 
                          'border-red-100 text-red-600'
                        }`}>
                          {evaluation.score}%
                        </div>
                      </div>

                      <div className="space-y-8">
                        <div className="grid grid-cols-1 gap-8">
                          <div>
                            <div className="flex items-center gap-2 mb-4 text-green-600">
                              <Check className="w-4 h-4" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Correct Points</span>
                            </div>
                            <div className="space-y-3">
                              {evaluation.correctPoints.map((point, i) => (
                                <div key={i} className="text-sm text-stone-600 flex gap-3 bg-green-50/50 p-4 rounded-2xl border border-green-100/50">
                                  <span className="text-green-500 font-bold">✓</span>
                                  {point}
                                </div>
                              ))}
                            </div>
                          </div>

                          {evaluation.incorrectPoints && evaluation.incorrectPoints.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-4 text-red-600">
                                <XCircle className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Incorrect Points / Misconceptions</span>
                              </div>
                              <div className="space-y-3">
                                {evaluation.incorrectPoints.map((point, i) => (
                                  <div key={i} className="text-sm text-stone-600 flex gap-3 bg-red-50/50 p-4 rounded-2xl border border-red-100/50">
                                    <span className="text-red-500 font-bold">✕</span>
                                    {point}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {evaluation.missingPoints.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-4 text-orange-600">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Missing Points</span>
                              </div>
                              <div className="space-y-3">
                                {evaluation.missingPoints.map((point, i) => (
                                  <div key={i} className="text-sm text-stone-600 flex gap-3 bg-orange-50/50 p-4 rounded-2xl border border-orange-100/50">
                                    <span className="text-orange-500 font-bold">!</span>
                                    {point}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-8 border-t border-stone-100">
                          <div className="flex items-center gap-2 mb-4 text-stone-400">
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Your Answer</span>
                          </div>
                          <p className="text-sm text-stone-700 leading-relaxed bg-stone-50 p-6 rounded-2xl border border-stone-100">
                            {currentAnswer}
                          </p>
                        </div>

                        <div className="pt-8 border-t border-stone-100">
                          <div className="flex items-center gap-2 mb-4 text-stone-400">
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Suggested Improvement</span>
                          </div>
                          <p className="text-sm text-stone-600 leading-relaxed italic bg-stone-50 p-6 rounded-2xl border border-stone-100">
                            "{evaluation.feedback}"
                          </p>
                        </div>

                        <div className="pt-8 border-t border-stone-100">
                          <div className="flex items-center gap-2 mb-4 text-stone-400">
                            <FileText className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Full Suggested Answer</span>
                          </div>
                          <p className="text-sm text-stone-700 leading-relaxed">{currentQuestion.suggestedAnswer}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCF8] p-6 font-sans">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="p-2 hover:bg-white rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="text-xl font-serif italic">{course.name}</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-bold">Quiz Practice</p>
          </div>
          <div className="w-10" />
        </div>

        {stateQuestions.length > 0 ? (
          <>
            {/* Stats Card */}
            <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-stone-200 mb-8">
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-stone-900">{dailyStats.practiced}</p>
                  <p className="text-[9px] uppercase tracking-widest text-stone-400 font-bold mt-1">Practiced Today</p>
                </div>
                <div className="text-center border-x border-stone-100">
                  <p className="text-3xl font-bold text-stone-900">{dailyStats.correct}</p>
                  <p className="text-[9px] uppercase tracking-widest text-stone-400 font-bold mt-1">Correct</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-600">{dailyStats.accuracy}%</p>
                  <p className="text-[9px] uppercase tracking-widest text-stone-400 font-bold mt-1">Accuracy</p>
                </div>
              </div>
            </div>

            {/* Generate More Button */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <button
                onClick={onGenerateQuiz}
                disabled={isGenerating}
                className="p-6 bg-stone-100 border border-stone-200 rounded-3xl flex items-center justify-center gap-3 group hover:bg-stone-200 transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5 text-stone-400 group-hover:text-stone-900" />
                )}
                <span className="text-xs font-bold uppercase tracking-widest text-stone-600 group-hover:text-stone-900">
                  {isGenerating ? 'Generating...' : 'AI Generate'}
                </span>
              </button>

              <button
                onClick={() => setIsManualAdding(true)}
                className="p-6 bg-white border border-stone-200 rounded-3xl flex items-center justify-center gap-3 group hover:border-stone-400 transition-all"
              >
                <Plus className="w-5 h-5 text-stone-400 group-hover:text-stone-900" />
                <span className="text-xs font-bold uppercase tracking-widest text-stone-600 group-hover:text-stone-900">
                  Manual Add
                </span>
              </button>
            </div>

            {/* Quiz Modes */}
            <div className="space-y-4 mb-12">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-4 px-2">Select Quiz Mode</h2>
              
              <button 
                onClick={() => startQuiz('Quick')}
                className="w-full bg-white p-8 rounded-[2rem] border border-stone-200 shadow-sm hover:border-stone-400 transition-all text-left group relative overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-yellow-50 rounded-2xl text-yellow-600 group-hover:bg-yellow-100 transition-colors">
                      <Zap className="w-6 h-6" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-900 transition-all" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">Quick Practice</h3>
                  <p className="text-sm text-stone-500">5 random questions for a quick study session.</p>
                </div>
              </button>

              <button 
                onClick={() => setSelectingTopic(true)}
                className="w-full bg-white p-8 rounded-[2rem] border border-stone-200 shadow-sm hover:border-stone-400 transition-all text-left group relative overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 group-hover:bg-blue-100 transition-colors">
                      <Target className="w-6 h-6" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-900 transition-all" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">Topic Practice</h3>
                  <p className="text-sm text-stone-500">Select a specific topic to focus your training.</p>
                </div>
              </button>

              <button 
                onClick={() => setSelectingSource(true)}
                className="w-full bg-white p-8 rounded-[2rem] border border-stone-200 shadow-sm hover:border-stone-400 transition-all text-left group relative overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-purple-50 rounded-2xl text-purple-600 group-hover:bg-purple-100 transition-colors">
                      <FileText className="w-6 h-6" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-900 transition-all" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">Source Practice</h3>
                  <p className="text-sm text-stone-500">Practice questions from a specific lecture or file.</p>
                </div>
              </button>

              <button 
                onClick={() => startQuiz('Exam')}
                className="w-full bg-stone-900 p-8 rounded-[2rem] border border-stone-800 shadow-xl hover:bg-stone-800 transition-all text-left group relative overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-white/10 rounded-2xl text-white group-hover:bg-white/20 transition-colors">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-stone-500 group-hover:text-white transition-all" />
                  </div>
                  <h3 className="text-xl font-bold mb-1 text-white">Exam Preparation</h3>
                  <p className="text-sm text-stone-400">15 mixed questions with varying difficulty levels & timer.</p>
                </div>
              </button>
            </div>

            {/* Sources Info */}
            <div className="bg-stone-100 rounded-[2rem] p-8 border border-stone-200 mb-12">
              <div className="flex items-center gap-2 mb-6 text-stone-400">
                <Sparkles className="w-4 h-4" />
                <h4 className="text-[10px] font-bold uppercase tracking-widest">Question Sources</h4>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <FileText className="w-6 h-6 mx-auto mb-2 text-stone-400" />
                  <p className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">Lecture Materials</p>
                </div>
                <div className="text-center">
                  <History className="w-6 h-6 mx-auto mb-2 text-stone-400" />
                  <p className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">Past Exams</p>
                </div>
                <div className="text-center">
                  <Briefcase className="w-6 h-6 mx-auto mb-2 text-stone-400" />
                  <p className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">Exam Style</p>
                </div>
              </div>
            </div>

            {/* Manage Questions */}
            <div className="space-y-4 pb-12">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-4 px-2">Manage Questions</h2>
              <div className="space-y-3">
                {stateQuestions.map(q => (
                  <div key={q.id} className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm flex justify-between items-start gap-4 group hover:border-stone-300 transition-all">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 line-clamp-2">{q.question}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[9px] text-stone-400 uppercase font-bold tracking-widest">{q.type}</span>
                        <span className="text-[9px] text-stone-300 uppercase font-bold tracking-widest">•</span>
                        <span className="text-[9px] text-stone-400 uppercase font-bold tracking-widest">{q.topic}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => onDeleteQuestion?.(q.id)}
                      className="p-2 text-stone-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Delete Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white border border-stone-100 rounded-[2.5rem] p-12 text-center shadow-sm">
            <div className="w-24 h-24 bg-stone-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
              <Brain className="w-12 h-12 text-stone-300" />
            </div>
            <h2 className="text-2xl font-bold text-stone-900 mb-3">
              {lectureFiles.length > 0 ? 'Ready to Practice?' : 'No Materials Found'}
            </h2>
            <p className="text-sm text-stone-500 max-w-xs mx-auto mb-10 leading-relaxed">
              {lectureFiles.length > 0 
                ? 'You have lecture materials uploaded. Use AI to generate practice questions tailored to your course content and professor\'s style.'
                : 'Upload your lecture notes, PDFs, or past exams first. Then, our AI will generate custom practice questions to help you prepare.'}
            </p>
            
            <div className="flex flex-col gap-3">
              {lectureFiles.length > 0 ? (
                <button 
                  onClick={onGenerateQuiz}
                  disabled={isGenerating}
                  className="w-full py-5 bg-stone-900 text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                  {isGenerating ? 'Analyzing & Generating...' : 'Generate Practice Questions'}
                </button>
              ) : (
                <button 
                  onClick={onBack}
                  className="w-full py-5 bg-stone-900 text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
                >
                  Upload Lecture Materials
                </button>
              )}
              <button 
                onClick={onBack}
                className="w-full py-5 bg-stone-100 text-stone-600 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-stone-200 transition-all"
              >
                Go to Workspace
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || 'unauthenticated',
      email: auth.currentUser?.email || 'no-email',
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || 'no-tenant',
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName || '',
        email: provider.email || '',
        photoUrl: provider.photoURL || ''
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error Detailed:', errInfo);
  throw new Error(JSON.stringify(errInfo));
}

// API Services
const api = {
  getProfile: (uid: string) => getDoc(doc(db, 'users', uid)).then(s => s.data() as UserProfile).catch(e => { handleFirestoreError(e, OperationType.GET, `users/${uid}`); return null; }),
  saveProfile: (profile: UserProfile) => setDoc(doc(db, 'users', profile.uid), profile).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${profile.uid}`)),
  getCourses: (uid: string) => getDocs(collection(db, 'users', uid, 'courses')).then(s => s.docs.map(d => d.data() as Course)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/courses`); return []; }),
  saveCourse: (uid: string, course: Course) => setDoc(doc(db, 'users', uid, 'courses', course.id), course).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/courses/${course.id}`)),
  deleteCourse: (uid: string, courseId: string) => deleteDoc(doc(db, 'users', uid, 'courses', courseId)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/courses/${courseId}`)),
  getFiles: (uid: string, courseId: string) => getDocs(query(collection(db, 'users', uid, 'files'), where('courseId', '==', courseId))).then(s => s.docs.map(d => d.data() as LectureFile)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/files`); return []; }),
  saveFile: (uid: string, file: LectureFile) => setDoc(doc(db, 'users', uid, 'files', file.id), file).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/files/${file.id}`)),
  deleteFile: (uid: string, file: LectureFile) => {
    const promises = [deleteDoc(doc(db, 'users', uid, 'files', file.id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/files/${file.id}`))];
    if (file.fileUrl && file.fileUrl.includes('firebasestorage.googleapis.com')) {
      const storageRef = ref(storage, file.fileUrl);
      promises.push(deleteObject(storageRef));
    }
    return Promise.all(promises);
  },
  getFlashcards: (uid: string, courseId: string) => getDocs(query(collection(db, 'users', uid, 'flashcards'), where('courseId', '==', courseId))).then(s => s.docs.map(d => d.data() as Flashcard)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/flashcards`); return []; }),
  getAllFlashcards: (uid: string) => getDocs(collection(db, 'users', uid, 'flashcards')).then(s => s.docs.map(d => d.data() as Flashcard)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/flashcards`); return []; }),
  saveFlashcard: (uid: string, flashcard: Flashcard) => setDoc(doc(db, 'users', uid, 'flashcards', flashcard.id), flashcard).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/flashcards/${flashcard.id}`)),
  deleteFlashcard: (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'flashcards', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/flashcards/${id}`)),
  
  getTopics: (uid: string, courseId: string) => getDocs(query(collection(db, 'users', uid, 'topics'), where('courseId', '==', courseId))).then(s => s.docs.map(d => d.data() as Topic)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/topics`); return []; }),
  saveTopic: (uid: string, topic: Topic) => setDoc(doc(db, 'users', uid, 'topics', topic.id), topic).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/topics/${topic.id}`)),
  deleteTopic: (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'topics', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/topics/${id}`)),
  getQuizQuestions: (uid: string, courseId: string) => getDocs(query(collection(db, 'users', uid, 'quiz_questions'), where('courseId', '==', courseId))).then(s => s.docs.map(d => d.data() as QuizQuestion)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/quiz_questions`); return []; }),
  saveQuizQuestion: (uid: string, question: QuizQuestion) => setDoc(doc(db, 'users', uid, 'quiz_questions', question.id), question).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/quiz_questions/${question.id}`)),
  deleteQuizQuestion: (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'quiz_questions', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/quiz_questions/${id}`)),
  getExamQuestions: (uid: string, courseId: string) => getDocs(query(collection(db, 'users', uid, 'exam_questions'), where('courseId', '==', courseId))).then(s => s.docs.map(d => d.data() as ExamQuestion)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/exam_questions`); return []; }),
  saveExamQuestion: (uid: string, question: ExamQuestion) => setDoc(doc(db, 'users', uid, 'exam_questions', question.id), question).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/exam_questions/${question.id}`)),
  deleteExamQuestion: (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'exam_questions', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/exam_questions/${id}`)),
  getExamSimulations: (uid: string, courseId: string) => getDocs(query(collection(db, 'users', uid, 'exam_simulations'), where('courseId', '==', courseId))).then(s => s.docs.map(d => d.data() as ExamSimulationSession)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/exam_simulations`); return []; }),
  getAllExamSimulations: (uid: string) => getDocs(collection(db, 'users', uid, 'exam_simulations')).then(s => s.docs.map(d => d.data() as ExamSimulationSession)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/exam_simulations`); return []; }),
  saveExamSimulation: (uid: string, simulation: ExamSimulationSession) => setDoc(doc(db, 'users', uid, 'exam_simulations', simulation.id), simulation).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/exam_simulations/${simulation.id}`)),
  getCalendarEvents: (uid: string) => getDocs(collection(db, 'users', uid, 'calendar_events')).then(s => s.docs.map(d => d.data() as CalendarEvent)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/calendar_events`); return []; }),
  saveCalendarEvent: (uid: string, event: CalendarEvent) => setDoc(doc(db, 'users', uid, 'calendar_events', event.id), event).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/calendar_events/${event.id}`)),
  deleteCalendarEvent: (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'calendar_events', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/calendar_events/${id}`)),
  getDailyGoals: (uid: string) => getDocs(collection(db, 'users', uid, 'daily_goals')).then(s => s.docs.map(d => d.data() as DailyGoal)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/daily_goals`); return []; }),
  saveDailyGoal: (uid: string, goal: DailyGoal) => setDoc(doc(db, 'users', uid, 'daily_goals', goal.id), goal).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/daily_goals/${goal.id}`)),
  deleteDailyGoal: (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'daily_goals', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/daily_goals/${id}`)),
  getEvaluations: (uid: string, courseId: string) => getDocs(query(collection(db, 'users', uid, 'evaluations'), where('courseId', '==', courseId))).then(s => s.docs.map(d => d.data() as QuizEvaluation)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/evaluations`); return []; }),
  saveEvaluation: (uid: string, evaluation: QuizEvaluation) => {
    const id = evaluation.id || Math.random().toString(36).substr(2, 9);
    return setDoc(doc(db, 'users', uid, 'evaluations', id), { ...evaluation, id }).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/evaluations/${id}`));
  },
  savePastQuestion: (uid: string, pq: PastQuestion) => setDoc(doc(db, 'users', uid, 'past_questions', pq.id), pq).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/past_questions/${pq.id}`)),
  deletePastQuestion: (uid: string, pq: PastQuestion) => {
    const promises = [deleteDoc(doc(db, 'users', uid, 'past_questions', pq.id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/past_questions/${pq.id}`))];
    if (pq.fileUrl && pq.fileUrl.includes('firebasestorage.googleapis.com')) {
      const storageRef = ref(storage, pq.fileUrl);
      promises.push(deleteObject(storageRef));
    }
    return Promise.all(promises);
  },
  getPastQuestions: (uid: string, courseId: string) => getDocs(query(collection(db, 'users', uid, 'past_questions'), where('courseId', '==', courseId))).then(s => s.docs.map(d => d.data() as PastQuestion)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/past_questions`); return []; }),
  getStudyLogs: (uid: string) => getDocs(collection(db, 'users', uid, 'study_logs')).then(s => s.docs.map(d => d.data() as StudySessionLog)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/study_logs`); return []; }),
  saveStudyLog: (uid: string, log: StudySessionLog) => setDoc(doc(db, 'users', uid, 'study_logs', log.id), log).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/study_logs/${log.id}`)),
  
  // Academic Planner API
  getTimetable: (uid: string) => getDocs(collection(db, 'users', uid, 'timetable')).then(s => s.docs.map(d => d.data() as TimetableEntry)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/timetable`); return []; }),
  saveTimetableEntry: (uid: string, entry: TimetableEntry) => setDoc(doc(db, 'users', uid, 'timetable', entry.id), entry).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/timetable/${entry.id}`)),
  deleteTimetableEntry: (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'timetable', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/timetable/${id}`)),
  
  getTasks: (uid: string) => getDocs(collection(db, 'users', uid, 'tasks')).then(s => s.docs.map(d => d.data() as AcademicTask)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/tasks`); return []; }),
  saveTask: (uid: string, task: AcademicTask) => setDoc(doc(db, 'users', uid, 'tasks', task.id), task).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/tasks/${task.id}`)),
  deleteTask: (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'tasks', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/tasks/${id}`)),
  
  getInsights: (uid: string) => getDocs(collection(db, 'users', uid, 'insights')).then(s => s.docs.map(d => d.data() as ProfessorInsight)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/insights`); return []; }),
  saveInsight: (uid: string, insight: ProfessorInsight) => setDoc(doc(db, 'users', uid, 'insights', insight.id), insight).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/insights/${insight.id}`)),
  deleteInsight: (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'insights', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/insights/${id}`)),
  getWeeklySimulations: (uid: string) => getDocs(collection(db, 'users', uid, 'weekly_simulations')).then(s => s.docs.map(d => d.data() as WeeklySimulation)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/weekly_simulations`); return []; }),
  saveWeeklySimulation: (uid: string, sim: WeeklySimulation) => setDoc(doc(db, 'users', uid, 'weekly_simulations', sim.id), sim).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/weekly_simulations/${sim.id}`)),
  deleteWeeklySimulation: (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'weekly_simulations', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/weekly_simulations/${id}`)),

  // Project Workspace API
  getProjectTasks: (uid: string, courseId: string) => getDocs(query(collection(db, 'users', uid, 'project_tasks'), where('courseId', '==', courseId))).then(s => s.docs.map(d => d.data() as ProjectTask)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/project_tasks`); return []; }),
  saveProjectTask: (uid: string, task: ProjectTask) => setDoc(doc(db, 'users', uid, 'project_tasks', task.id), task).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/project_tasks/${task.id}`)),
  deleteProjectTask: (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'project_tasks', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/project_tasks/${id}`)),
  
  getProjectMilestones: (uid: string, courseId: string) => getDocs(query(collection(db, 'users', uid, 'project_milestones'), where('courseId', '==', courseId))).then(s => s.docs.map(d => d.data() as ProjectMilestone)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/project_milestones`); return []; }),
  saveProjectMilestone: (uid: string, milestone: ProjectMilestone) => setDoc(doc(db, 'users', uid, 'project_milestones', milestone.id), milestone).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/project_milestones/${milestone.id}`)),
  deleteProjectMilestone: (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'project_milestones', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/project_milestones/${id}`)),
  
  getProjectNotes: (uid: string, courseId: string) => getDocs(query(collection(db, 'users', uid, 'project_notes'), where('courseId', '==', courseId))).then(s => s.docs.map(d => d.data() as ProjectNote)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/project_notes`); return []; }),
  saveProjectNote: (uid: string, note: ProjectNote) => setDoc(doc(db, 'users', uid, 'project_notes', note.id), note).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/project_notes/${note.id}`)),
  deleteProjectNote: (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'project_notes', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/project_notes/${id}`)),
  
  getProjectInsights: (uid: string, courseId: string) => getDocs(query(collection(db, 'users', uid, 'project_insights'), where('courseId', '==', courseId))).then(s => s.docs.map(d => d.data() as ProjectInsight)).catch(e => { handleFirestoreError(e, OperationType.LIST, `users/${uid}/project_insights`); return []; }),
  saveProjectInsight: (uid: string, insight: ProjectInsight) => setDoc(doc(db, 'users', uid, 'project_insights', insight.id), insight).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${uid}/project_insights/${insight.id}`)),
  deleteProjectInsight: (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'project_insights', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/project_insights/${id}`)),
};

const CourseCarousel: React.FC<{ 
  courses: any[], 
  onCourseTap: (course: any) => void 
}> = ({ courses, onCourseTap }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || courses.length === 0) return;

    const animate = () => {
      // Constant smooth movement
      scrollContainer.scrollLeft += 0.6; 

      // Infinite loop logic:
      // Each card is w-64 (256px) + gap-5 (20px) = 276px
      const itemWidth = 276;
      const totalWidth = courses.length * itemWidth;
      
      if (scrollContainer.scrollLeft >= totalWidth) {
        scrollContainer.scrollLeft = 0;
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [courses.length]);

  if (courses.length === 0) {
    return (
      <div className="px-6 py-12 text-center bg-stone-50 rounded-[2.5rem] mx-6 border border-dashed border-stone-200 flex flex-col items-center justify-center">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
          <GraduationCap className="w-6 h-6 text-stone-300" />
        </div>
        <p className="text-sm text-stone-500 max-w-[240px] leading-relaxed">
          You have not added any courses yet. Add a course to begin generating study materials.
        </p>
      </div>
    );
  }

  // Duplicate courses multiple times to ensure we can always scroll
  const displayCourses = [...courses, ...courses, ...courses];

  return (
    <div 
      ref={scrollRef}
      className="flex overflow-x-auto pb-8 gap-5 px-6 no-scrollbar select-none active:cursor-grabbing cursor-grab"
    >
      {displayCourses.map((course, idx) => (
        <motion.div 
          key={`${course.id}-${idx}`}
          whileHover={{ y: -4, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex-shrink-0 w-64 ${course.color} rounded-[2.5rem] p-7 flex flex-col justify-between h-60 shadow-sm hover:shadow-xl hover:shadow-stone-200/50 transition-all cursor-pointer relative group border border-white/20`}
          onClick={() => onCourseTap(course)}
        >
          <div>
            <div className="w-12 h-12 bg-white/40 backdrop-blur-md rounded-2xl flex items-center justify-center mb-5 shadow-inner">
              <GraduationCap className="w-6 h-6 text-stone-800" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 leading-tight tracking-tight">{course.name}</h3>
          </div>
          
          <div className="space-y-2 bg-white/30 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center justify-between text-[10px] font-bold text-stone-800 uppercase tracking-widest opacity-70">
              <span>Flashcards</span>
              <span className="bg-white/50 px-2 py-0.5 rounded-full">{course.flashcardsCount}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-stone-800 uppercase tracking-widest opacity-70">
              <span>Quiz Questions</span>
              <span className="bg-white/50 px-2 py-0.5 rounded-full">{course.quizQuestionsCount}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-stone-800 uppercase tracking-widest opacity-70">
              <span>Exam Simulations</span>
              <span className="bg-white/50 px-2 py-0.5 rounded-full">{course.examSimulationsCount || 0}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

interface AudioModeSettings {
  mode: 'Passive' | 'Interactive';
  speed: number;
  pauseDuration: number;
}

interface AudioFlashcardPlayerProps {
  flashcards: Flashcard[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  isFlipped: boolean;
  setIsFlipped: (flipped: boolean) => void;
}

const AudioFlashcardPlayer: React.FC<AudioFlashcardPlayerProps> = ({
  flashcards,
  currentIndex,
  onIndexChange,
  onClose,
  isFlipped,
  setIsFlipped
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [settings, setSettings] = useState<AudioModeSettings>(() => {
    const saved = localStorage.getItem('audioModeSettings');
    return saved ? JSON.parse(saved) : { mode: 'Passive', speed: 1, pauseDuration: 5 };
  });
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentRequestIdRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem('audioModeSettings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    return () => {
      currentRequestIdRef.current++; // Cancel any in-flight requests
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop();
        } catch (e) {}
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const playPCM = async (base64Data: string, sampleRate: number = 24000) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const context = audioContextRef.current;
    
    // Resume context if it was suspended (browser policy)
    if (context.state === 'suspended') {
      await context.resume();
    }

    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Int16Array(len / 2);
    for (let i = 0; i < len; i += 2) {
      // PCM 16-bit little endian
      bytes[i / 2] = (binaryString.charCodeAt(i + 1) << 8) | binaryString.charCodeAt(i);
    }
    
    const float32Data = new Float32Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      float32Data[i] = bytes[i] / 32768.0;
    }
    
    const buffer = context.createBuffer(1, float32Data.length, sampleRate);
    buffer.getChannelData(0).set(float32Data);
    
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    currentSourceRef.current = source;
    return source;
  };

  const [ttsProvider, setTtsProvider] = useState<'Gemini' | 'System' | null>(null);

  const speak = async (text: string, onEnd?: () => void) => {
    const requestId = ++currentRequestIdRef.current;
    
    // Stop any current audio
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {}
    }
    synthRef.current.cancel();

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'undefined') {
        console.warn("GEMINI_API_KEY is not defined in the current environment.");
        throw new Error("API Key Missing");
      }

      setTtsProvider('Gemini');
      console.log("Initializing Gemini TTS with key:", apiKey.substring(0, 4) + "****");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview", // Updated to correct TTS model to avoid 404
        contents: [{ parts: [{ text: text.trim() }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Charon' }, // Mature human male voice
            },
          },
        },
      });

      // If a new request started while we were waiting, don't play this one
      if (requestId !== currentRequestIdRef.current) return;

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        console.log("Gemini TTS success, playing audio...");
        const source = await playPCM(base64Audio);
        source.onended = () => {
          if (requestId === currentRequestIdRef.current && onEnd) onEnd();
        };
        source.start();
        return;
      } else {
        throw new Error("No audio data in response");
      }
    } catch (error) {
      console.error("Gemini TTS failed, falling back to system TTS:", error);
      setTtsProvider('System');
    }

    // Fallback to system TTS
    if (requestId !== currentRequestIdRef.current) return;
    
    setTimeout(() => {
      if (requestId !== currentRequestIdRef.current) return;
      
      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.rate = settings.speed;
      
      // Try to find a male voice for fallback
      const voices = synthRef.current.getVoices();
      const maleVoice = voices.find(v => 
        v.name.toLowerCase().includes('male') || 
        v.name.toLowerCase().includes('david') || 
        v.name.toLowerCase().includes('alex') ||
        v.name.toLowerCase().includes('google us english')
      );
      if (maleVoice) utterance.voice = maleVoice;

      utterance.onend = () => {
        if (requestId === currentRequestIdRef.current && onEnd) onEnd();
      };
      synthRef.current.speak(utterance);
    }, 100);
  };

  const startInteractiveSession = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      // Fallback if not supported
      timerRef.current = setTimeout(() => {
        handleNextStepAfterPause();
      }, settings.pauseDuration * 1000);
      return;
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    
    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onresult = (event: any) => {
      handleNextStepAfterPause();
    };
    recognitionRef.current.onerror = () => {
      handleNextStepAfterPause();
    };
    
    try {
      recognitionRef.current.start();
    } catch (e) {
      handleNextStepAfterPause();
    }
  };

  const handleNextStepAfterPause = () => {
    if (!isPlaying || flashcards.length === 0) return;
    
    const card = flashcards[currentIndex];
    if (!card) return;

    setIsFlipped(true);
    // Wait for flip animation
    timerRef.current = setTimeout(() => {
      speak(card.answer, () => {
        if (currentIndex < flashcards.length - 1) {
          // Wait after answer before next card
          timerRef.current = setTimeout(() => {
            setIsFlipped(false);
            // Wait for flip back animation before next card
            timerRef.current = setTimeout(() => {
              onIndexChange(currentIndex + 1);
            }, 600);
          }, 2000);
        } else {
          setIsPlaying(false);
        }
      });
    }, 600);
  };

  useEffect(() => {
    if (isPlaying && flashcards.length > 0) {
      const card = flashcards[currentIndex];
      if (!card) return;
      
      // We only trigger the START of a card sequence from the effect
      // The rest (flip, answer, next) is handled by the sequence callbacks
      if (!isFlipped) {
        speak(card.question, () => {
          if (settings.mode === 'Passive') {
            timerRef.current = setTimeout(() => {
              handleNextStepAfterPause();
            }, settings.pauseDuration * 1000);
          } else {
            // Interactive mode: wait for user to speak
            speak("What is your answer?", () => {
              startInteractiveSession();
            });
          }
        });
      } else {
        // If we resumed while flipped, speak the answer
        speak(card.answer, () => {
          if (currentIndex < flashcards.length - 1) {
            timerRef.current = setTimeout(() => {
              setIsFlipped(false);
              timerRef.current = setTimeout(() => {
                onIndexChange(currentIndex + 1);
              }, 600);
            }, 2000);
          } else {
            setIsPlaying(false);
          }
        });
      }
    } else {
      currentRequestIdRef.current++; // Cancel any in-flight requests
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop();
        } catch (e) {}
      }
      synthRef.current.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    
    return () => {
      // Don't cancel on every re-render, only when isPlaying changes or unmount
    };
  }, [isPlaying, currentIndex]); // Removed isFlipped from dependencies to prevent flip-clears-timer bug

  const progress = flashcards.length > 0 ? ((currentIndex + 1) / flashcards.length) * 100 : 0;

  if (flashcards.length === 0) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[120] bg-white border-t border-stone-100 shadow-2xl p-6 rounded-t-[2.5rem]">
        <div className="max-w-md mx-auto text-center py-8">
          <p className="text-stone-500 font-medium">No flashcards available for this course.</p>
          <button onClick={onClose} className="mt-4 text-orange-600 font-bold uppercase tracking-widest text-xs">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[120] bg-white border-t border-stone-100 shadow-2xl p-6 rounded-t-[2.5rem] animate-in slide-in-from-bottom duration-300">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header & Progress */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              Card {currentIndex + 1} of {flashcards.length}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${settings.mode === 'Passive' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                {settings.mode} Mode
              </span>
              {isListening && (
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="flex items-center gap-1 text-orange-600"
                >
                  <Mic className="w-3 h-3" />
                  <span className="text-[8px] font-bold uppercase tracking-widest">Listening...</span>
                </motion.div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-stone-50 rounded-xl transition-colors text-stone-400"
            >
              <Settings2 className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-stone-50 rounded-xl transition-colors text-stone-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-stone-50 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-orange-500"
          />
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-4 pt-2"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[8px] font-bold text-stone-400 uppercase tracking-widest mb-2">Mode</label>
                  <div className="flex bg-stone-50 rounded-xl p-1">
                    <button 
                      onClick={() => setSettings({ ...settings, mode: 'Passive' })}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${settings.mode === 'Passive' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'}`}
                    >
                      Passive
                    </button>
                    <button 
                      onClick={() => setSettings({ ...settings, mode: 'Interactive' })}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${settings.mode === 'Interactive' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'}`}
                    >
                      Interactive
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-stone-400 uppercase tracking-widest mb-2">Speed</label>
                  <select 
                    value={settings.speed}
                    onChange={(e) => setSettings({ ...settings, speed: parseFloat(e.target.value) })}
                    className="w-full bg-stone-50 border-none rounded-xl px-3 py-2 text-[10px] font-bold text-stone-900 focus:ring-1 focus:ring-stone-200"
                  >
                    <option value={0.75}>0.75x</option>
                    <option value={1}>1.0x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Voice Engine</span>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${ttsProvider === 'Gemini' ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-200 text-stone-400'}`}>
                  {ttsProvider || 'Checking...'}
                </span>
              </div>

              <div>
                <label className="block text-[8px] font-bold text-stone-400 uppercase tracking-widest mb-2">Pause Duration (Question to Answer)</label>
                <div className="flex gap-2">
                  {[2, 5, 10].map((d) => (
                    <button 
                      key={d}
                      onClick={() => setSettings({ ...settings, pauseDuration: d })}
                      className={`flex-1 py-2 rounded-xl border text-[10px] font-bold transition-all ${settings.pauseDuration === d ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-100 text-stone-400'}`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Controls */}
        <div className="flex items-center justify-between px-4">
          <button 
            onClick={() => {
              if (currentIndex > 0) {
                onIndexChange(currentIndex - 1);
                setIsFlipped(false);
              }
            }}
            disabled={currentIndex === 0}
            className="p-3 text-stone-400 hover:text-stone-900 disabled:opacity-30 transition-colors"
          >
            <SkipBack className="w-6 h-6" />
          </button>

          <button 
            onClick={() => {
              setIsFlipped(false);
              if (!isPlaying) {
                speak(flashcards[currentIndex].question);
              }
            }}
            className="p-3 text-stone-400 hover:text-stone-900 transition-colors"
            title="Repeat Card"
          >
            <RotateCcw className="w-6 h-6" />
          </button>

          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-16 h-16 bg-stone-900 text-white rounded-full flex items-center justify-center shadow-xl shadow-stone-200 hover:scale-105 active:scale-95 transition-all"
          >
            {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
          </button>

          <button 
            onClick={() => {
              if (currentIndex < flashcards.length - 1) {
                onIndexChange(currentIndex + 1);
                setIsFlipped(false);
              }
            }}
            disabled={currentIndex === flashcards.length - 1}
            className="p-3 text-stone-400 hover:text-stone-900 disabled:opacity-30 transition-colors"
          >
            <SkipForward className="w-6 h-6" />
          </button>

          <button 
            onClick={() => {
              speak(isFlipped ? flashcards[currentIndex].answer : flashcards[currentIndex].question);
            }}
            className="p-3 text-stone-400 hover:text-stone-900 transition-colors"
          >
            <Volume2 className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface ProgressTrackingProps {
  courses: Course[];
  studyLogs: StudySessionLog[];
  flashcards: Flashcard[];
  examSimulations: ExamSimulationSession[];
  tasks: AcademicTask[];
  projectTasks: ProjectTask[];
  projectMilestones: ProjectMilestone[];
  onBack: () => void;
}

const ProgressTracking: React.FC<ProgressTrackingProps> = ({
  courses,
  studyLogs,
  flashcards,
  examSimulations,
  tasks,
  projectTasks,
  projectMilestones,
  onBack
}) => {
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');

  const stats = useMemo(() => {
    const now = new Date();
    const rangeDays = timeRange === 'week' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(now.getDate() - rangeDays);
    startDate.setHours(0, 0, 0, 0);

    // 1. Study Time Chart
    const studyTimeData = Array.from({ length: rangeDays }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i + 1);
      const dateStr = d.toISOString().split('T')[0];
      const dayLogs = studyLogs.filter(l => l.date === dateStr);
      const totalMins = dayLogs.reduce((acc, curr) => acc + curr.durationMinutes, 0);
      return { 
        date: format(d, timeRange === 'week' ? 'EEE' : 'MMM dd'), 
        minutes: totalMins,
        fullDate: dateStr
      };
    });

    // 2. Flashcards Completed (Mastered/Studied)
    const flashcardStats = {
      total: flashcards.length,
      studied: flashcards.filter(f => f.difficulty !== 'None').length,
      mastered: flashcards.filter(f => f.difficulty === 'Easy').length
    };

    // 3. Exam Simulation Scores
    const examData = examSimulations
      .filter(s => s.status === 'Completed' && s.createdAt && s.createdAt >= startDate.getTime())
      .map(s => ({
        date: format(new Date(s.createdAt!), 'MMM dd'),
        score: s.score || 0,
        title: s.title
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 4. Course Completion
    const courseCompletion = courses.map(course => {
      if (course.type === 'Project') {
        const courseTasks = projectTasks.filter(t => t.courseId === course.id);
        const completedTasks = courseTasks.filter(t => t.status === 'Done').length;
        const percentage = courseTasks.length > 0 ? Math.round((completedTasks / courseTasks.length) * 100) : 0;
        return {
          ...course,
          completionPercentage: percentage,
          totalTasks: courseTasks.length,
          completedTasks
        };
      } else {
        const courseTasks = tasks.filter(t => t.courseId === course.id);
        const completedTasks = courseTasks.filter(t => t.status === 'Completed').length;
        const percentage = courseTasks.length > 0 ? Math.round((completedTasks / courseTasks.length) * 100) : 0;
        return {
          ...course,
          completionPercentage: percentage,
          totalTasks: courseTasks.length,
          completedTasks
        };
      }
    });

    // 5. Summary Stats
    const totalStudyMins = studyLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
    const totalCompletedTasks = tasks.filter(t => t.status === 'Completed').length + 
                               projectTasks.filter(t => t.status === 'Done').length;
    const completedExams = examSimulations.filter(s => s.status === 'Completed');
    const avgExamScore = completedExams.length > 0 
      ? Math.round(completedExams.reduce((acc, s) => acc + (s.score || 0), 0) / completedExams.length)
      : 0;

    return { studyTimeData, flashcardStats, examData, courseCompletion, totalStudyMins, totalCompletedTasks, avgExamScore };
  }, [timeRange, studyLogs, flashcards, examSimulations, tasks, projectTasks, courses]);

  return (
    <div className="min-h-screen bg-stone-50 pb-32">
      <header className="sticky top-0 z-30 bg-stone-50/80 backdrop-blur-md px-6 py-8">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-stone-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-stone-900" />
          </button>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-stone-100">
            <button 
              onClick={() => setTimeRange('week')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${timeRange === 'week' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-600'}`}
            >
              Week
            </button>
            <button 
              onClick={() => setTimeRange('month')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${timeRange === 'month' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-600'}`}
            >
              Month
            </button>
          </div>
        </div>
        <h1 className="text-3xl font-serif italic text-stone-900">Progress Tracking</h1>
        <p className="text-sm text-stone-400 mt-1">Your academic journey in numbers</p>
      </header>

      <main className="px-6 space-y-8">
        {/* Summary Cards */}
        <section className="grid grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 text-center">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Study Time</p>
            <p className="text-xl font-bold text-stone-900">{(stats.totalStudyMins / 60).toFixed(1)}h</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 text-center">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Avg Score</p>
            <p className="text-xl font-bold text-stone-900">{stats.avgExamScore}%</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 text-center">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Tasks Done</p>
            <p className="text-xl font-bold text-stone-900">{stats.totalCompletedTasks}</p>
          </div>
        </section>

        {/* Study Time Chart */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-stone-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-lg font-bold text-stone-900">Study Time</h2>
              <p className="text-xs text-stone-400">Minutes spent studying</p>
            </div>
            <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-900">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.studyTimeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F5F4" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#A8A29E', fontWeight: 600 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#A8A29E', fontWeight: 600 }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#F5F5F4' }}
                />
                <Bar dataKey="minutes" fill="#1C1917" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Exam Scores Chart */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-stone-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-lg font-bold text-stone-900">Exam Simulations</h2>
              <p className="text-xs text-stone-400">Scores over time</p>
            </div>
            <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-900">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
          {stats.examData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.examData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F5F4" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#A8A29E', fontWeight: 600 }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#A8A29E', fontWeight: 600 }} 
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#1C1917" 
                    strokeWidth={4} 
                    dot={{ r: 6, fill: '#1C1917', strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-stone-300 bg-stone-50 rounded-3xl border-2 border-dashed border-stone-100">
              <Target className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">No simulations completed</p>
            </div>
          )}
        </section>

        {/* Flashcard Progress */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-stone-100">
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-6">Flashcard Mastery</h3>
            <div className="flex items-end gap-4 mb-6">
              <span className="text-4xl font-bold text-stone-900">{stats.flashcardStats.mastered}</span>
              <span className="text-sm text-stone-400 mb-1">Cards Mastered</span>
            </div>
            <div className="space-y-4">
              <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(stats.flashcardStats.mastered / (stats.flashcardStats.total || 1)) * 100}%` }}
                  className="h-full bg-stone-900"
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                <span>0 Mastered</span>
                <span>{stats.flashcardStats.total} Total</span>
              </div>
            </div>
          </div>
          <div className="bg-stone-900 rounded-[2.5rem] p-8 shadow-xl text-white">
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-6">Study Efficiency</h3>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {Math.round((stats.flashcardStats.studied / (stats.flashcardStats.total || 1)) * 100)}%
                </div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Cards Studied</p>
              </div>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              You've reviewed {stats.flashcardStats.studied} out of {stats.flashcardStats.total} flashcards in your collection.
            </p>
          </div>
        </section>

        {/* Course Completion */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">Course Completion</h2>
            <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stats.courseCompletion.map(course => (
              <div key={course.id} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-stone-900">{course.name}</h3>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{course.type}</p>
                  </div>
                  <span className="text-lg font-bold text-stone-900">{course.completionPercentage}%</span>
                </div>
                <div className="h-2 w-full bg-stone-50 rounded-full overflow-hidden mb-3">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${course.completionPercentage}%` }}
                    className={`h-full ${course.color.startsWith('bg-') ? course.color : ''}`}
                    style={{ backgroundColor: !course.color.startsWith('bg-') ? course.color : undefined }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                  <span>{course.completedTasks} Tasks Done</span>
                  <span>{course.totalTasks} Total</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

interface ProjectWorkspaceProps {
  course: Course;
  onBack: () => void;
  openTool: (toolId: string) => void;
}

interface ProjectNotesViewProps {
  course: Course;
  onBack: () => void;
  notes: ProjectNote[];
  onAddNote: (note: ProjectNote) => void;
  onUpdateNote: (note: ProjectNote) => void;
  onDeleteNote: (id: string) => void;
}

interface ProjectTasksViewProps {
  course: Course;
  onBack: () => void;
  tasks: ProjectTask[];
  onAddTask: (task: ProjectTask) => void;
  onUpdateTask: (task: ProjectTask) => void;
  onDeleteTask: (id: string) => void;
  googleConnected: boolean;
  onConnectGoogle: () => void;
  onSyncToGoogleCalendar: (events: any[]) => Promise<void>;
}

interface ProjectMilestonesViewProps {
  course: Course;
  onBack: () => void;
  milestones: ProjectMilestone[];
  onAddMilestone: (milestone: ProjectMilestone) => void;
  onUpdateMilestone: (milestone: ProjectMilestone) => void;
  onDeleteMilestone: (id: string) => void;
  googleConnected: boolean;
  onConnectGoogle: () => void;
  onSyncToGoogleCalendar: (events: any[]) => Promise<void>;
}

interface ProjectInsightsViewProps {
  course: Course;
  onBack: () => void;
  insights: ProjectInsight[];
  onAddInsight: (insight: ProjectInsight) => void;
  onDeleteInsight: (id: string) => void;
}

const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({ course, onBack, openTool }) => {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 bg-white border border-stone-100 rounded-xl text-stone-400 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{course.name}</h1>
      </div>

      <div className="bg-white border border-stone-100 rounded-[2rem] p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Type</p>
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-stone-600" />
              <span className="text-sm font-bold text-stone-900">Project Course</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Status</p>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-bold text-stone-900">{course.status}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 pb-32">
        {PROJECT_TOOLS.map((tool, index) => (
          <motion.div 
            key={tool.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white border border-stone-100 rounded-[2rem] p-6 flex items-start gap-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            onClick={() => openTool(tool.id)}
          >
            <div className={`w-14 h-14 rounded-2xl ${tool.color} flex items-center justify-center flex-shrink-0`}>
              {tool.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-stone-900 group-hover:text-stone-700 transition-colors">{tool.title}</h3>
                <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-500 transition-colors" />
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">{tool.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const ProjectNotesView: React.FC<ProjectNotesViewProps> = ({ course, onBack, notes, onAddNote, onUpdateNote, onDeleteNote }) => {
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<ProjectNote | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

  const handleSaveNote = () => {
    if (!newNoteTitle.trim()) return;
    
    if (editingNote) {
      onUpdateNote({
        ...editingNote,
        title: newNoteTitle,
        content: newNoteContent,
        updatedAt: new Date().toISOString()
      });
    } else {
      onAddNote({
        id: Math.random().toString(36).substr(2, 9),
        courseId: course.id,
        uid: '', // Will be set in App
        title: newNoteTitle,
        content: newNoteContent,
        updatedAt: new Date().toISOString()
      });
    }
    
    setIsAddingNote(false);
    setEditingNote(null);
    setNewNoteTitle('');
    setNewNoteContent('');
  };

  return (
    <div className="px-6 pt-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 bg-white border border-stone-100 rounded-xl text-stone-400 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Notes & Docs</h1>
            <p className="text-xs text-stone-500 mt-1">{course.name}</p>
          </div>
        </div>
        <button 
          onClick={() => setIsAddingNote(true)}
          className="p-3 bg-stone-900 text-white rounded-2xl hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-32">
        {notes.length > 0 ? (
          notes.map((note) => (
            <motion.div 
              key={note.id}
              layoutId={note.id}
              className="bg-white border border-stone-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all group cursor-pointer"
              onClick={() => {
                setEditingNote(note);
                setNewNoteTitle(note.title);
                setNewNoteContent(note.content);
                setIsAddingNote(true);
              }}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-stone-900 truncate pr-4">{note.title}</h3>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNote(note.id);
                  }}
                  className="p-2 text-stone-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-stone-500 line-clamp-3 mb-4 leading-relaxed">
                {note.content || "No content yet..."}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                <Clock className="w-3 h-3" />
                <span>Updated {new Date(note.updatedAt).toLocaleDateString()}</span>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-stone-50 rounded-[3rem] border-2 border-dashed border-stone-200">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Edit2 className="w-8 h-8 text-stone-200" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 mb-1">No Notes Yet</h3>
            <p className="text-sm text-stone-500 max-w-[240px] mx-auto">Start documenting your project requirements and ideas.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAddingNote && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingNote(false);
                setEditingNote(null);
                setNewNoteTitle('');
                setNewNoteContent('');
              }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-stone-900">{editingNote ? 'Edit Note' : 'New Note'}</h2>
                <button 
                  onClick={() => {
                    setIsAddingNote(false);
                    setEditingNote(null);
                    setNewNoteTitle('');
                    setNewNoteContent('');
                  }}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto flex-1 space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Note Title</label>
                  <input 
                    type="text"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder="e.g., Project Requirements"
                    className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all font-bold text-lg"
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Content</label>
                  <textarea 
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Start writing your notes here..."
                    className="w-full flex-1 min-h-[300px] bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all resize-none leading-relaxed"
                  />
                </div>
              </div>
              <div className="p-8 border-t border-stone-100 bg-white">
                <button 
                  onClick={handleSaveNote}
                  className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-stone-800 active:scale-[0.98] transition-all shadow-xl shadow-stone-200"
                >
                  {editingNote ? 'Update Note' : 'Save Note'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProjectTasksView: React.FC<ProjectTasksViewProps> = ({ 
  course, 
  onBack, 
  tasks, 
  onAddTask, 
  onUpdateTask, 
  onDeleteTask,
  googleConnected,
  onConnectGoogle,
  onSyncToGoogleCalendar
}) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [newTaskStatus, setNewTaskStatus] = useState<'To Do' | 'In Progress' | 'Done'>('To Do');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!googleConnected) {
      onConnectGoogle();
      return;
    }

    setIsSyncing(true);
    try {
      const eventsToSync = tasks.filter(t => t.status !== 'Done').map(task => ({
        id: task.id,
        title: `[Project Task] ${task.title}`,
        description: `Course: ${course.name}\nPriority: ${task.priority}\n${task.description || ''}`,
        start: `${task.dueDate}T09:00:00Z`,
        end: `${task.dueDate}T10:00:00Z`,
        courseName: course.name
      }));

      if (eventsToSync.length === 0) {
        alert("No upcoming tasks to sync.");
        return;
      }

      await onSyncToGoogleCalendar(eventsToSync);
      alert(`Successfully synced ${eventsToSync.length} tasks to Google Calendar!`);
    } catch (error) {
      console.error("Sync error:", error);
      alert("Failed to sync with Google Calendar.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveTask = () => {
    if (!newTaskTitle.trim()) return;

    const taskData: ProjectTask = {
      id: editingTask?.id || Math.random().toString(36).substr(2, 9),
      courseId: course.id,
      uid: '',
      title: newTaskTitle,
      description: newTaskDesc,
      dueDate: newTaskDueDate,
      priority: newTaskPriority,
      status: newTaskStatus as any,
      createdAt: editingTask?.createdAt || new Date().toISOString()
    };

    if (editingTask) {
      onUpdateTask(taskData);
    } else {
      onAddTask(taskData);
    }

    setIsAddingTask(false);
    setEditingTask(null);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskDueDate('');
    setNewTaskPriority('Medium');
    setNewTaskStatus('To Do');
  };

  const columns = ['To Do', 'In Progress', 'Done'];

  return (
    <div className="px-6 pt-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 bg-white border border-stone-100 rounded-xl text-stone-400 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Task Board</h1>
            <p className="text-xs text-stone-500 mt-1">{course.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
              googleConnected 
                ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' 
                : 'bg-stone-50 text-stone-400 hover:bg-stone-100'
            }`}
          >
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Calendar className="w-3 h-3" />
            )}
            {googleConnected ? 'Sync Google' : 'Connect Google'}
          </button>
          <button 
            onClick={() => setIsAddingTask(true)}
            className="p-3 bg-stone-900 text-white rounded-2xl hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-32 no-scrollbar">
        {columns.map(column => (
          <div key={column} className="flex-shrink-0 w-80">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-stone-900 uppercase tracking-widest">{column}</h2>
                <span className="bg-stone-100 text-stone-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {tasks.filter(t => t.status === column).length}
                </span>
              </div>
            </div>
            
            <div className="space-y-4">
              {tasks.filter(t => t.status === column).map(task => (
                <motion.div 
                  key={task.id}
                  layoutId={task.id}
                  onClick={() => {
                    setEditingTask(task);
                    setNewTaskTitle(task.title);
                    setNewTaskDesc(task.description);
                    setNewTaskDueDate(task.dueDate);
                    setNewTaskPriority(task.priority);
                    setNewTaskStatus(task.status as any);
                    setIsAddingTask(true);
                  }}
                  className="bg-white border border-stone-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
                      task.priority === 'High' ? 'bg-red-50 text-red-600' :
                      task.priority === 'Medium' ? 'bg-amber-50 text-amber-600' :
                      'bg-emerald-50 text-emerald-600'
                    }`}>
                      {task.priority} Priority
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTask(task.id);
                      }}
                      className="p-1 text-stone-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h3 className="text-sm font-bold text-stone-900 mb-1">{task.title}</h3>
                  <p className="text-xs text-stone-500 line-clamp-2 mb-4">{task.description}</p>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-1.5 text-stone-400">
                      <Calendar className="w-3 h-3" />
                      <span className="text-[10px] font-bold">{task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}</span>
                    </div>
                    {task.status !== 'Done' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateTask({ ...task, status: column === 'To Do' ? 'In Progress' : 'Done' });
                        }}
                        className="p-1.5 bg-stone-50 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
              
              {tasks.filter(t => t.status === column).length === 0 && (
                <div className="py-12 border-2 border-dashed border-stone-100 rounded-[2rem] flex flex-col items-center justify-center text-stone-300">
                  <CheckCircle2 className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Empty</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isAddingTask && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingTask(false);
                setEditingTask(null);
                setNewTaskTitle('');
                setNewTaskDesc('');
                setNewTaskDueDate('');
                setNewTaskPriority('Medium');
                setNewTaskStatus('To Do');
              }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-stone-900">{editingTask ? 'Edit Task' : 'New Task'}</h2>
                <button 
                  onClick={() => setIsAddingTask(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Task Title</label>
                  <input 
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="e.g., Design UI Mockups"
                    className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Description</label>
                  <textarea 
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    placeholder="What needs to be done?"
                    className="w-full h-24 bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Due Date</label>
                    <input 
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Priority</label>
                    <select 
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as any)}
                      className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Status</label>
                  <div className="flex gap-2">
                    {columns.map(col => (
                      <button
                        key={col}
                        onClick={() => setNewTaskStatus(col as any)}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                          newTaskStatus === col ? 'bg-stone-900 text-white shadow-lg' : 'bg-stone-50 text-stone-400 hover:bg-stone-100'
                        }`}
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleSaveTask}
                  className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-stone-800 active:scale-[0.98] transition-all shadow-xl shadow-stone-200 mt-4"
                >
                  {editingTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProjectMilestonesView: React.FC<ProjectMilestonesViewProps> = ({ 
  course, 
  onBack, 
  milestones, 
  onAddMilestone, 
  onUpdateMilestone, 
  onDeleteMilestone,
  googleConnected,
  onConnectGoogle,
  onSyncToGoogleCalendar
}) => {
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!googleConnected) {
      onConnectGoogle();
      return;
    }

    setIsSyncing(true);
    try {
      const eventsToSync = milestones.filter(m => m.status !== 'Completed').map(milestone => ({
        id: milestone.id,
        title: `[Milestone] ${milestone.title}`,
        description: `Course: ${course.name}`,
        start: `${milestone.dueDate}T09:00:00Z`,
        end: `${milestone.dueDate}T10:00:00Z`,
        courseName: course.name
      }));

      if (eventsToSync.length === 0) {
        alert("No upcoming milestones to sync.");
        return;
      }

      await onSyncToGoogleCalendar(eventsToSync);
      alert(`Successfully synced ${eventsToSync.length} milestones to Google Calendar!`);
    } catch (error) {
      console.error("Sync error:", error);
      alert("Failed to sync with Google Calendar.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveMilestone = () => {
    if (!newMilestoneTitle.trim()) return;

    const milestoneData: ProjectMilestone = {
      id: Math.random().toString(36).substr(2, 9),
      courseId: course.id,
      uid: '',
      title: newMilestoneTitle,
      dueDate: newMilestoneDate,
      status: 'Upcoming'
    };

    onAddMilestone(milestoneData);
    setIsAddingMilestone(false);
    setNewMilestoneTitle('');
    setNewMilestoneDate('');
  };

  return (
    <div className="px-6 pt-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 bg-white border border-stone-100 rounded-xl text-stone-400 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Milestones</h1>
            <p className="text-xs text-stone-500 mt-1">{course.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
              googleConnected 
                ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' 
                : 'bg-stone-50 text-stone-400 hover:bg-stone-100'
            }`}
          >
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Calendar className="w-3 h-3" />
            )}
            {googleConnected ? 'Sync Google' : 'Connect Google'}
          </button>
          <button 
            onClick={() => setIsAddingMilestone(true)}
            className="p-3 bg-stone-900 text-white rounded-2xl hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto pb-32">
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-stone-100" />
          
          <div className="space-y-12 relative">
            {milestones.length > 0 ? (
              milestones.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map((milestone, idx) => (
                <motion.div 
                  key={milestone.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-start gap-8"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 z-10 shadow-sm ${
                    milestone.status === 'Completed' ? 'bg-emerald-500 text-white' : 'bg-white border-4 border-stone-50 text-stone-300'
                  }`}>
                    {milestone.status === 'Completed' ? <Check className="w-6 h-6" /> : <Target className="w-5 h-5" />}
                  </div>
                  
                  <div className="flex-1 bg-white border border-stone-100 rounded-[2rem] p-6 shadow-sm group hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className={`text-lg font-bold ${milestone.status === 'Completed' ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
                          {milestone.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          <span className="text-xs font-bold text-stone-400">
                            {milestone.dueDate ? new Date(milestone.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'No date set'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => onUpdateMilestone({ ...milestone, status: milestone.status === 'Completed' ? 'Upcoming' : 'Completed' })}
                          className={`p-2 rounded-xl transition-all ${
                            milestone.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-50 text-stone-400 hover:text-stone-900'
                          }`}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => onDeleteMilestone(milestone.id)}
                          className="p-2 text-stone-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="pl-20 py-20 text-center">
                <div className="w-16 h-16 bg-stone-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-dashed border-stone-200">
                  <Target className="w-8 h-8 text-stone-200" />
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-1">No Milestones</h3>
                <p className="text-sm text-stone-500 max-w-[200px] mx-auto">Break your project down into major checkpoints.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAddingMilestone && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingMilestone(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-stone-900">New Milestone</h2>
                <button 
                  onClick={() => setIsAddingMilestone(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Milestone Title</label>
                  <input 
                    type="text"
                    value={newMilestoneTitle}
                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                    placeholder="e.g., MVP Completion"
                    className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Target Date</label>
                  <input 
                    type="date"
                    value={newMilestoneDate}
                    onChange={(e) => setNewMilestoneDate(e.target.value)}
                    className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                  />
                </div>

                <button 
                  onClick={handleSaveMilestone}
                  className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-stone-800 active:scale-[0.98] transition-all shadow-xl shadow-stone-200 mt-4"
                >
                  Add Milestone
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProjectInsightsView: React.FC<ProjectInsightsViewProps> = ({ course, onBack, insights, onAddInsight, onDeleteInsight }) => {
  const [isAddingInsight, setIsAddingInsight] = useState(false);
  const [newInsightContent, setNewInsightContent] = useState('');
  const [newInsightSource, setNewInsightSource] = useState('');

  const handleSaveInsight = () => {
    if (!newInsightContent.trim()) return;

    const insightData: ProjectInsight = {
      id: Math.random().toString(36).substr(2, 9),
      courseId: course.id,
      uid: '',
      content: newInsightContent,
      source: newInsightSource || 'Professor',
      date: new Date().toISOString()
    };

    onAddInsight(insightData);
    setIsAddingInsight(false);
    setNewInsightContent('');
    setNewInsightSource('');
  };

  return (
    <div className="px-6 pt-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 bg-white border border-stone-100 rounded-xl text-stone-400 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Professor Insights</h1>
            <p className="text-xs text-stone-500 mt-1">{course.name}</p>
          </div>
        </div>
        <button 
          onClick={() => setIsAddingInsight(true)}
          className="p-3 bg-stone-900 text-white rounded-2xl hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-6 pb-32">
        {insights.length > 0 ? (
          insights.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((insight, idx) => (
            <motion.div 
              key={insight.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white border border-stone-100 rounded-[2.5rem] p-8 shadow-sm relative group"
            >
              <div className="absolute top-8 right-8">
                <button 
                  onClick={() => onDeleteInsight(insight.id)}
                  className="p-2 text-stone-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900">{insight.source}</h4>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{new Date(insight.date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <p className="text-stone-700 leading-relaxed italic">
                "{insight.content}"
              </p>
            </motion.div>
          ))
        ) : (
          <div className="py-20 text-center bg-stone-50 rounded-[3rem] border-2 border-dashed border-stone-200">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Lightbulb className="w-8 h-8 text-stone-200" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 mb-1">No Insights Yet</h3>
            <p className="text-sm text-stone-500 max-w-[240px] mx-auto">Record feedback and guidance from your professor or project lead.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAddingInsight && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingInsight(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-stone-900">Add Insight</h2>
                <button 
                  onClick={() => setIsAddingInsight(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Source</label>
                  <input 
                    type="text"
                    value={newInsightSource}
                    onChange={(e) => setNewInsightSource(e.target.value)}
                    placeholder="e.g., Prof. Smith, Project Lead"
                    className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Insight / Feedback</label>
                  <textarea 
                    value={newInsightContent}
                    onChange={(e) => setNewInsightContent(e.target.value)}
                    placeholder="What was the feedback?"
                    className="w-full h-32 bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all resize-none italic"
                  />
                </div>

                <button 
                  onClick={handleSaveInsight}
                  className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-stone-800 active:scale-[0.98] transition-all shadow-xl shadow-stone-200 mt-4"
                >
                  Save Insight
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<AppView>('home');
  
  // Auth & Profile State
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSemesterUpdateOpen, setIsSemesterUpdateOpen] = useState(false);

  // Onboarding State
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState({
    firstName: 'Chinelo',
    email: '',
    password: '',
    universityName: 'Furtwangen University',
    courseOfStudy: 'International Business Information System',
    currentSemester: 6,
    pastCourses: [] as string[],
    profilePicture: 'https://drive.google.com/uc?export=view&id=1NzAsywgVnWa8tIBA490cQsfUThV01XAU'
  });
  const [newPastCourse, setNewPastCourse] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Topics State
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [currentCreationTopicId, setCurrentCreationTopicId] = useState<string | null>(null);
  const [pendingFlashcardAction, setPendingFlashcardAction] = useState<{
    type: 'AI' | 'Import' | 'Manual' | 'Group',
    data?: any
  } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const profileDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (profileDoc.exists()) {
            const profileData = profileDoc.data() as UserProfile;
            // Ensure Chinelo's profile picture is set if missing
            if (!profileData.profilePicture) {
              profileData.profilePicture = 'https://drive.google.com/uc?export=view&id=1NzAsywgVnWa8tIBA490cQsfUThV01XAU';
            }
            setProfile(profileData);
            
            // Check for semester update (every 6 months)
            const lastUpdate = profileData.lastSemesterUpdate ? new Date(profileData.lastSemesterUpdate) : new Date();
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            
            if (lastUpdate < sixMonthsAgo) {
              setIsSemesterUpdateOpen(true);
            }
            
            // Load user data
            const [userCourses, userEvents, userGoals] = await Promise.all([
              api.getCourses(currentUser.uid),
              api.getCalendarEvents(currentUser.uid),
              api.getDailyGoals(currentUser.uid)
            ]);
            setCourses(userCourses);
            setEvents(userEvents);
            setDailyGoals(userGoals);
          } else {
            // Set default profile for Chinelo if none exists
            setProfile({
              uid: currentUser.uid,
              email: currentUser.email || '',
              firstName: 'Chinelo',
              universityName: 'Furtwangen University',
              courseOfStudy: 'International Business Information System',
              currentSemester: 6,
              pastCourses: [],
              profilePicture: 'https://drive.google.com/uc?export=view&id=1NzAsywgVnWa8tIBA490cQsfUThV01XAU',
              lastSemesterUpdate: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      } else {
        setProfile(null);
        setCourses([]);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateSemester = async () => {
    if (!user || !profile) return;
    
    try {
      // Move active courses to past
      const updatedCourses = courses.map(c => {
        if (c.status === 'Active') {
          return { ...c, status: 'Past' as const };
        }
        return c;
      });
      
      // Update in Firestore
      await Promise.all(updatedCourses.map(c => api.saveCourse(user.uid, c)));
      
      // Update profile
      const newProfile = {
        ...profile,
        currentSemester: profile.currentSemester + 1,
        lastSemesterUpdate: new Date().toISOString()
      };
      await api.saveProfile(newProfile);
      
      setCourses(updatedCourses);
      setProfile(newProfile);
      setIsSemesterUpdateOpen(false);
    } catch (error) {
      console.error("Error updating semester:", error);
    }
  };

  const handleEditProfile = async (e: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!user || !profile) {
      console.warn("Cannot save profile: user or profile is missing", { user, profile });
      return;
    }
    
    setIsAuthLoading(true);
    try {
      if (!profile.uid) {
        throw new Error("Profile UID is missing. Please try logging out and back in.");
      }
      if (!profile.email) {
        throw new Error("Profile email is missing. Please try logging out and back in.");
      }
      console.log("Saving profile:", profile);
      await api.saveProfile(profile);
      setIsEditingProfile(false);
      // Success feedback could be added here
    } catch (error) {
      console.error("Error editing profile:", error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, onboardingData.email, onboardingData.password);
      const user = userCredential.user;
      
      const newProfile: UserProfile = {
        uid: user.uid,
        firstName: onboardingData.firstName,
        email: onboardingData.email,
        universityName: onboardingData.universityName,
        courseOfStudy: onboardingData.courseOfStudy,
        currentSemester: onboardingData.currentSemester,
        pastCourses: onboardingData.pastCourses,
        profilePicture: onboardingData.profilePicture,
        lastSemesterUpdate: new Date().toISOString()
      };
      
      await api.saveProfile(newProfile);
      setProfile(newProfile);
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, onboardingData.email, onboardingData.password);
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setProfile(null);
    setCourses([]);
    setView('home');
    setIsProfileOpen(false);
  };

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isStudyMenuOpen, setIsStudyMenuOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseType, setNewCourseType] = useState<CourseType>('Exam');
  const [newCourseColor, setNewCourseColor] = useState('bg-stone-100');

  const presetColors = [
    { name: 'Stone', class: 'bg-stone-100' },
    { name: 'Indigo', class: 'bg-indigo-50' },
    { name: 'Emerald', class: 'bg-emerald-50' },
    { name: 'Amber', class: 'bg-amber-50' },
    { name: 'Rose', class: 'bg-rose-50' },
    { name: 'Sky', class: 'bg-sky-50' },
    { name: 'Violet', class: 'bg-violet-50' },
  ];

  // Lecture Materials State
  const [lectureFiles, setLectureFiles] = useState<LectureFile[]>([]);
  const [pastQuestions, setPastQuestions] = useState<PastQuestion[]>([]);
  const [isPastQuestionModalOpen, setIsPastQuestionModalOpen] = useState(false);
  const [newPQTitle, setNewPQTitle] = useState('');
  const [newPQYear, setNewPQYear] = useState('');
  const [newPQSemester, setNewPQSemester] = useState('Spring');
  const [newPQContent, setNewPQContent] = useState('');
  const [selectedPQ, setSelectedPQ] = useState<PastQuestion | null>(null);
  const [examStyle, setExamStyle] = useState('');
  const [personalNotes, setPersonalNotes] = useState('');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Flashcards State
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashcardSearch, setFlashcardSearch] = useState('');
  const [isGroupingMode, setIsGroupingMode] = useState(false);
  const [groupingTopicId, setGroupingTopicId] = useState<string | null>(null);
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>(() => {
    const saved = localStorage.getItem('dailyGoals');
    return saved ? JSON.parse(saved) : [];
  });
  // Check if daily goals are for today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const goalsForToday = dailyGoals.filter(g => g.date === today);
    if (dailyGoals.length > 0 && goalsForToday.length === 0) {
      // If we have goals but none are for today, clear them (or keep them if user wants?)
      // The user said "ai can generate a new one based on my timetable", so we should probably clear old ones
      // but only if it's a new day.
      setDailyGoals([]);
    }
  }, []);
  const [isGeneratingGoals, setIsGeneratingGoals] = useState(false);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, QuizEvaluation[]>>({});
  const [examSimulations, setExamSimulations] = useState<ExamSimulationSession[]>([]);
  const [isAddingSimulation, setIsAddingSimulation] = useState(false);
  const [newSimCourseId, setNewSimCourseId] = useState('');
  const [newSimDay, setNewSimDay] = useState('Monday');
  const [newSimTime, setNewSimTime] = useState('10:00');
  const [isGeneratingWeeklyPlan, setIsGeneratingWeeklyPlan] = useState(false);
  const [activeSimMenuId, setActiveSimMenuId] = useState<string | null>(null);

  useEffect(() => {
    const getWeekNumber = (d: Date) => {
      const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return weekNo;
    };

    const currentWeek = getWeekNumber(new Date());
    const storedWeek = localStorage.getItem('lastResetWeek');
    
    if (storedWeek !== currentWeek.toString() || weeklySimulations.length === 0) {
      if (courses.length === 0) return; // Wait for courses
      
      const examCourses = courses.filter(c => c.type === 'Exam');
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const generated: WeeklySimulation[] = examCourses.map((course, index) => ({
        id: `sim-${course.id}-${Date.now()}`,
        courseId: course.id,
        courseName: course.name,
        title: 'Weekly Exam Simulation',
        durationMinutes: 90,
        day: days[index % days.length],
        time: '18:00',
        status: 'NotStarted' as const
      }));
      
      setWeeklySimulations(generated);
      localStorage.setItem('lastResetWeek', currentWeek.toString());
      if (user) {
        generated.forEach(sim => api.saveWeeklySimulation(user.uid, sim));
      }
    }
  }, [courses]);

  const addSimulation = (courseId: string, day: string, time: string) => {
    console.log("Adding simulation:", { courseId, day, time });
    const course = courses.find(c => c.id === courseId);
    if (!course) {
      console.error("Course not found for ID:", courseId);
      return;
    }

    const newSim: WeeklySimulation = {
      id: `sim-${Date.now()}`,
      courseId,
      courseName: course.name,
      title: 'Weekly Exam Simulation',
      durationMinutes: 90,
      day,
      time: time || '18:00',
      status: 'NotStarted'
    };

    setWeeklySimulations(prev => {
      const updated = [...prev, newSim];
      localStorage.setItem('weeklySimulations', JSON.stringify(updated));
      return updated;
    });
    setIsAddingSimulation(false);
    setNewSimCourseId('');
  };

  const deleteSimulation = (id: string) => {
    setWeeklySimulations(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('weeklySimulations', JSON.stringify(updated));
      return updated;
    });
  };

  const getCourseColor = (courseName: string) => {
    const colors = [
      'bg-rose-50 text-rose-500 border-rose-100',
      'bg-amber-50 text-amber-500 border-amber-100',
      'bg-emerald-50 text-emerald-500 border-emerald-100',
      'bg-blue-50 text-blue-500 border-blue-100',
      'bg-indigo-50 text-indigo-500 border-indigo-100',
      'bg-violet-50 text-violet-500 border-violet-100',
      'bg-fuchsia-50 text-fuchsia-500 border-fuchsia-100',
    ];
    let hash = 0;
    for (let i = 0; i < courseName.length; i++) {
      hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const generateWeeklyPlanWithAI = async () => {
    if (isGeneratingWeeklyPlan) return;
    setIsGeneratingWeeklyPlan(true);
    console.log("Starting AI plan generation...");
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const examCourses = courses.filter(c => c.type === 'Exam');
      
      if (examCourses.length === 0) {
        console.log("No exam-based courses found.");
        setIsGeneratingWeeklyPlan(false);
        return;
      }

      const prompt = `
        Generate a weekly exam practice schedule for these courses: ${examCourses.map(c => c.name).join(', ')}.
        
        Rules:
        - One 90-min session per week for each course.
        - Spread across different days (Monday-Sunday).
        - Use 24h format for time (e.g. 14:00, 18:30).
        - Return ONLY a JSON array: [{"courseName": "...", "day": "...", "time": "..."}]
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      console.log("AI Response received");
      const plan = JSON.parse(result.text);
      
      const newSimulations: WeeklySimulation[] = plan.map((item: any) => {
        const course = examCourses.find(c => c.name === item.courseName) || examCourses[0];
        return {
          id: `sim-ai-${course.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          courseId: course.id,
          courseName: course.name,
          title: 'Weekly Exam Simulation',
          durationMinutes: 90,
          day: item.day,
          time: item.time || '18:00',
          status: 'NotStarted'
        };
      });

      setWeeklySimulations(newSimulations);
      localStorage.setItem('weeklySimulations', JSON.stringify(newSimulations));
      console.log("Weekly plan updated successfully");
    } catch (error) {
      console.error("Error in generateWeeklyPlanWithAI:", error);
      // Fallback
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const fallback = courses.filter(c => c.type === 'Exam').map((c, i) => ({
        id: `sim-fb-${c.id}-${Date.now()}`,
        courseId: c.id,
        courseName: c.name,
        title: 'Weekly Exam Simulation',
        durationMinutes: 90,
        day: days[i % 7],
        time: '18:00',
        status: 'NotStarted' as const
      }));
      setWeeklySimulations(fallback);
      localStorage.setItem('weeklySimulations', JSON.stringify(fallback));
    } finally {
      setIsGeneratingWeeklyPlan(false);
    }
  };

  const updateSimulationStatus = (courseId: string, status: 'NotStarted' | 'InProgress' | 'Completed') => {
    setWeeklySimulations(prev => {
      const updated = prev.map(sim => sim.courseId === courseId ? { ...sim, status } : sim);
      localStorage.setItem('weeklySimulations', JSON.stringify(updated));
      return updated;
    });
  };

  const SemesterProgressBar = () => {
    const classEvents = allTimetableOccurrences;
    
    if (classEvents.length === 0) {
      return (
        <div className="w-full bg-white/80 backdrop-blur-md border-b border-stone-100 px-6 py-3 sticky top-0 z-[60]">
          <div className="max-w-md mx-auto">
            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden mb-1.5">
              <div className="h-full bg-stone-200 w-0" />
            </div>
            <p className="text-[10px] text-stone-500 font-medium text-center">
              Add your class timetable to start tracking semester progress.
            </p>
          </div>
        </div>
      );
    }

    const start = new Date(semesterStart);
    const end = new Date(semesterEnd);
    const now = new Date();
    
    // Calculate semester progress
    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    const progress = totalDuration > 0 ? Math.max(0, Math.min(100, (elapsed / totalDuration) * 100)) : 0;

    // Calculate weeks
    const totalWeeks = Math.max(1, Math.ceil(totalDuration / (1000 * 60 * 60 * 24 * 7)));
    const currentWeek = Math.max(1, Math.min(totalWeeks, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7))));
    const weeksLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7)));

    return (
      <div className="w-full bg-white/80 backdrop-blur-md border-b border-stone-100 px-6 py-3 sticky top-0 z-[60]">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-end mb-1">
            <span className="text-[10px] font-bold text-stone-900 uppercase tracking-wider">
              {weeksLeft} {weeksLeft === 1 ? 'Week' : 'Weeks'} until Exams
            </span>
            <span className="text-[10px] font-bold text-stone-900">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-stone-900 rounded-full"
            />
          </div>
        </div>
      </div>
    );
  };

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isStudySessionActive, setIsStudySessionActive] = useState(false);
  const [isAudioModeActive, setIsAudioModeActive] = useState(false);

  useEffect(() => {
    if (isStudySessionActive && selectedCourse) {
      localStorage.setItem(`flashcardProgress_${selectedCourse.id}`, currentCardIndex.toString());
    }
  }, [currentCardIndex, isStudySessionActive, selectedCourse]);

  const startStudySession = (isAudio: boolean = false) => {
    if (!selectedCourse) return;
    const saved = localStorage.getItem(`flashcardProgress_${selectedCourse.id}`);
    const index = saved ? parseInt(saved) : 0;
    
    // If we're at the end, start over
    const courseCards = flashcards.filter(f => f.courseId === selectedCourse.id);
    if (index >= courseCards.length - 1) {
      setCurrentCardIndex(0);
    } else {
      setCurrentCardIndex(index);
    }
    
    setIsStudySessionActive(true);
    setStudySessionStartTime(Date.now());
    setIsAudioModeActive(isAudio);
    setIsCardFlipped(false);
  };
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportingAI, setIsImportingAI] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [useGoogleDrive, setUseGoogleDrive] = useState(() => {
    const saved = localStorage.getItem('useGoogleDrive');
    return saved === 'true';
  });
  useEffect(() => {
    localStorage.setItem('useGoogleDrive', useGoogleDrive.toString());
  }, [useGoogleDrive]);
  const [googleSecretsMissing, setGoogleSecretsMissing] = useState(false);
  const [isGoogleHelpOpen, setIsGoogleHelpOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; type: string } | null>(null);
  const [importText, setImportText] = useState('');
  const [manualQuestion, setManualQuestion] = useState('');
  const [manualAnswer, setManualAnswer] = useState('');
  const [flashcardFilter, setFlashcardFilter] = useState<'All' | 'Easy' | 'Medium' | 'Hard' | 'AI' | 'Imported' | 'Manual'>('All');
  const [weeklySimulations, setWeeklySimulations] = useState<WeeklySimulation[]>(() => {
    const saved = localStorage.getItem('weeklySimulations');
    return saved ? JSON.parse(saved) : [];
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [tasks, setTasks] = useState<AcademicTask[]>([]);
  const [insights, setInsights] = useState<ProfessorInsight[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [projectMilestones, setProjectMilestones] = useState<ProjectMilestone[]>([]);
  const [projectNotes, setProjectNotes] = useState<ProjectNote[]>([]);
  const [projectInsights, setProjectInsights] = useState<ProjectInsight[]>([]);
  const [semesterStart, setSemesterStart] = useState<string>(() => {
    return localStorage.getItem('semesterStart') || '2026-03-01';
  });
  const [semesterEnd, setSemesterEnd] = useState<string>(() => {
    return localStorage.getItem('semesterEnd') || '2026-07-01';
  });

  const [studyLogs, setStudyLogs] = useState<StudySessionLog[]>([]);
  const [studySessionStartTime, setStudySessionStartTime] = useState<number | null>(null);

  const getTimetableOccurrences = (entry: TimetableEntry) => {
    const occurrences: any[] = [];
    const dayMap: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    const targetDay = dayMap[entry.dayOfWeek];
    
    try {
      let current = parseISO(entry.semesterStart);
      const semEnd = parseISO(entry.semesterEnd);
      
      while (current <= semEnd) {
        if (current.getDay() === targetDay) {
          occurrences.push({
            ...entry,
            date: format(current, 'yyyy-MM-dd'),
            type: 'Class'
          });
        }
        current = addDays(current, 1);
      }
    } catch (e) { console.error("Error generating occurrences", e); }
    return occurrences;
  };

  const allTimetableOccurrences = useMemo(() => {
    return timetable.flatMap(entry => getTimetableOccurrences(entry));
  }, [timetable]);

  const filteredFlashcards = useMemo(() => {
    if (!selectedCourse) return [];
    return flashcards.filter(fc => {
      if (fc.courseId !== selectedCourse.id) return false;
      if (selectedTopicId !== 'all' && fc.topicId !== selectedTopicId) return false;
      
      // Search filter
      if (flashcardSearch.trim()) {
        const search = flashcardSearch.toLowerCase();
        if (!fc.question.toLowerCase().includes(search) && !fc.answer.toLowerCase().includes(search)) {
          return false;
        }
      }

      if (flashcardFilter === 'All') return true;
      if (['Easy', 'Medium', 'Hard'].includes(flashcardFilter)) return fc.difficulty === flashcardFilter;
      if (['AI', 'Imported', 'Manual'].includes(flashcardFilter)) return fc.type === flashcardFilter;
      return fc.source === flashcardFilter || fc.topic === flashcardFilter;
    });
  }, [flashcards, selectedCourse, selectedTopicId, flashcardFilter, flashcardSearch]);

  const handleStudyComplete = async (durationMinutes: number) => {
    if (!selectedCourse || !user) return;
    
    const newLog: StudySessionLog = {
      id: Math.random().toString(36).substr(2, 9),
      courseId: selectedCourse.id,
      courseName: selectedCourse.name,
      durationMinutes,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    try {
      await api.saveStudyLog(user.uid, newLog);
      setStudyLogs(prev => [...prev, newLog]);
    } catch (error) {
      console.error("Error logging study session:", error);
    }
  };

  const handleTopicSelected = (topicId: string) => {
    setCurrentCreationTopicId(topicId);
    setIsTopicModalOpen(false);
    
    if (pendingFlashcardAction) {
      if (pendingFlashcardAction.type === 'AI') {
        // If topic corresponds to a file, pre-select that file for generation
        const topic = topics.find(t => t.id === topicId);
        if (topic) {
          const file = lectureFiles.find(f => f.name === topic.name && f.courseId === selectedCourse?.id);
          if (file) {
            setSelectedGenerationFiles([file.id]);
            setGenerationSourceType('File');
          } else {
            setGenerationTopic(topic.name);
            setGenerationSourceType('Topic');
          }
        }
        setGenerationOptionsOpen(true);
      }
      else if (pendingFlashcardAction.type === 'Import') setIsImportModalOpen(true);
      else if (pendingFlashcardAction.type === 'Manual') setIsManualModalOpen(true);
      else if (pendingFlashcardAction.type === 'Group') {
        if (selectedFlashcardIds.length > 0) {
          groupSelectedFlashcards(topicId);
        } else {
          setIsGroupingMode(true);
          setGroupingTopicId(topicId);
          setSelectedTopicId('all'); // Show all cards to allow selection
        }
      }
      setPendingFlashcardAction(null);
    }
  };

  const groupSelectedFlashcards = async (topicId: string, ids?: string[]) => {
    const targetIds = ids || selectedFlashcardIds;
    if (!user || targetIds.length === 0) return;
    
    const updatedCards = flashcards.map(card => {
      if (targetIds.includes(card.id)) {
        return { ...card, topicId };
      }
      return card;
    });
    
    setFlashcards(updatedCards);
    await Promise.all(
      targetIds.map(id => {
        const card = updatedCards.find(c => c.id === id);
        if (card) return api.saveFlashcard(user.uid, card);
        return Promise.resolve();
      })
    );
    
    if (!ids) setSelectedFlashcardIds([]);
    setIsGroupingMode(false);
    setGroupingTopicId(null);
    setSelectedTopicId(topicId);
  };

  const TopicSelectionModal = () => {
    const [isCreating, setIsCreating] = useState(false);
    const [topicName, setTopicName] = useState('');

    const handleCreate = async (name: string) => {
      if (!name.trim() || !user || !selectedCourse) return;
      
      // Check if topic already exists
      const existingTopic = topics.find(t => t.name.toLowerCase() === name.trim().toLowerCase());
      if (existingTopic) {
        handleTopicSelected(existingTopic.id);
        return;
      }

      const newTopic: Topic = {
        id: Math.random().toString(36).substr(2, 9),
        uid: user.uid,
        name: name.trim(),
        courseId: selectedCourse.id
      };
      await api.saveTopic(user.uid, newTopic);
      setTopics(prev => [...prev, newTopic]);
      handleTopicSelected(newTopic.id);
    };

    return (
      <AnimatePresence>
        {isTopicModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-end justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTopicModalOpen(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-stone-900">Select Topic</h2>
                <button onClick={() => setIsTopicModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>

              {!isCreating ? (
                <div className="space-y-6">
                  {/* Existing Topics */}
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3 px-1">Existing Topics</p>
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                      {topics.map(topic => (
                        <button
                          key={topic.id}
                          onClick={() => handleTopicSelected(topic.id)}
                          className="w-full p-4 bg-stone-50 hover:bg-stone-100 rounded-2xl text-left font-bold text-stone-900 transition-all flex items-center justify-between group"
                        >
                          {topic.name}
                          <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-stone-900 transition-colors" />
                        </button>
                      ))}
                      {topics.length === 0 && (
                        <p className="text-center py-4 text-stone-400 text-[10px] font-bold uppercase tracking-widest">No topics yet</p>
                      )}
                    </div>
                  </div>

                  {/* Uploaded Files as Topics */}
                  {lectureFiles.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3 px-1">Use Uploaded File as Topic</p>
                      <div className="max-h-40 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                        {lectureFiles.map(file => (
                          <button
                            key={file.id}
                            onClick={() => handleCreate(file.name)}
                            className="w-full p-4 bg-stone-50 hover:bg-stone-100 rounded-2xl text-left font-bold text-stone-900 transition-all flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-stone-400" />
                              <span className="truncate max-w-[200px]">{file.name}</span>
                            </div>
                            <Plus className="w-4 h-4 text-stone-300 group-hover:text-stone-900 transition-colors" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={() => setIsCreating(true)}
                    className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-stone-800 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Create Custom Topic
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <input 
                    autoFocus
                    type="text"
                    value={topicName}
                    onChange={(e) => setTopicName(e.target.value)}
                    placeholder="Topic Name (e.g. Pandas, Regression)"
                    className="w-full bg-stone-50 border-none rounded-2xl p-4 text-sm text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all"
                  />
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsCreating(false)}
                      className="flex-1 py-4 bg-stone-50 text-stone-600 rounded-2xl font-bold text-sm hover:bg-stone-100 transition-all"
                    >
                      Back
                    </button>
                    <button 
                      onClick={() => handleCreate(topicName)}
                      disabled={!topicName.trim()}
                      className="flex-2 py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm hover:bg-stone-800 transition-all disabled:opacity-50"
                    >
                      Create & Select
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  };
  const [globalFlashcards, setGlobalFlashcards] = useState<Flashcard[]>([]);
  const [globalSimulations, setGlobalSimulations] = useState<ExamSimulationSession[]>([]);

  useEffect(() => {
    console.log("CONNECTED");
    
    // Suppress benign Vite HMR WebSocket errors in the console
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes('WebSocket closed without opened')) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        const [fetchedCourses, fetchedLogs, fetchedCards, fetchedSims, fetchedTimetable, fetchedTasks, fetchedInsights, fetchedWeeklySims] = await Promise.all([
          api.getCourses(user.uid),
          api.getStudyLogs(user.uid),
          api.getAllFlashcards(user.uid),
          api.getAllExamSimulations(user.uid),
          api.getTimetable(user.uid),
          api.getTasks(user.uid),
          api.getInsights(user.uid),
          api.getWeeklySimulations(user.uid)
        ]);
        
        const coursesArr = (fetchedCourses || []) as Course[];
        const logsArr = (fetchedLogs || []) as StudySessionLog[];
        const cardsArr = (fetchedCards || []) as Flashcard[];
        const simsArr = (fetchedSims || []) as ExamSimulationSession[];
        const timetableArr = (fetchedTimetable || []) as TimetableEntry[];
        const tasksArr = (fetchedTasks || []) as AcademicTask[];
        const insightsArr = (fetchedInsights || []) as ProfessorInsight[];
        const weeklySimsArr = (fetchedWeeklySims || []) as WeeklySimulation[];

        if (coursesArr.length > 0) {
          setCourses(coursesArr);
        }
        setStudyLogs(logsArr);
        setGlobalFlashcards(cardsArr);
        setGlobalSimulations(simsArr);
        setTimetable(timetableArr);
        setTasks(tasksArr);
        setInsights(insightsArr);
        setWeeklySimulations(weeklySimsArr);
      };
      fetchData();
    }
  }, [user]);

  // Update global stats when local data changes
  useEffect(() => {
    if (user) {
      api.getAllFlashcards(user.uid).then(setGlobalFlashcards);
    }
  }, [user, flashcards]);

  useEffect(() => {
    if (user) {
      api.getAllExamSimulations(user.uid).then(setGlobalSimulations);
    }
  }, [user, examSimulations]);

  const totalStudyHours = (studyLogs.reduce((acc, log) => acc + log.durationMinutes, 0) / 60).toFixed(1);

  useEffect(() => {
    if (selectedCourse && user) {
      const fetchCourseData = async () => {
        if (selectedCourse.type === 'Project') {
          const [tasks, milestones, notes, insightsData] = await Promise.all([
            api.getProjectTasks(user.uid, selectedCourse.id),
            api.getProjectMilestones(user.uid, selectedCourse.id),
            api.getProjectNotes(user.uid, selectedCourse.id),
            api.getProjectInsights(user.uid, selectedCourse.id)
          ]);
          setProjectTasks(tasks);
          setProjectMilestones(milestones);
          setProjectNotes(notes);
          setProjectInsights(insightsData);
        } else {
          const [files, cards, quiz, exam, evals, sims, topicsData] = await Promise.all([
            api.getFiles(user.uid, selectedCourse.id),
            api.getFlashcards(user.uid, selectedCourse.id),
            api.getQuizQuestions(user.uid, selectedCourse.id),
            api.getExamQuestions(user.uid, selectedCourse.id),
            api.getEvaluations(user.uid, selectedCourse.id),
            api.getExamSimulations(user.uid, selectedCourse.id),
            api.getTopics(user.uid, selectedCourse.id)
          ]);
          
          const filesArr = (files || []) as LectureFile[];
          const cardsArr = (cards || []) as Flashcard[];
          const quizArr = (quiz || []) as QuizQuestion[];
          const examArr = (exam || []) as ExamQuestion[];
          const evalsArr = (evals || []) as QuizEvaluation[];
          const simsArr = (sims || []) as ExamSimulationSession[];
          const topicsArr = (topicsData || []) as Topic[];

          setLectureFiles(filesArr);
          setFlashcards(cardsArr);
          setQuizQuestions(quizArr);
          setExamQuestions(examArr);
          setExamSimulations(simsArr);
          setTopics(topicsArr);
          
          // Group evaluations by questionId
          const groupedEvals: Record<string, QuizEvaluation[]> = {};
          evalsArr.forEach((e: any) => {
            if (!groupedEvals[e.questionId]) groupedEvals[e.questionId] = [];
            groupedEvals[e.questionId].push(e);
          });
          setEvaluations(groupedEvals);
        }
      };
      fetchCourseData();
    }
  }, [selectedCourse?.id]);

  // Persistence Effects (Keep localStorage as backup, but primary is DB)
  useEffect(() => { localStorage.setItem('courses', JSON.stringify(courses)); }, [courses]);
  useEffect(() => { localStorage.setItem('lectureFiles', JSON.stringify(lectureFiles)); }, [lectureFiles]);
  useEffect(() => { localStorage.setItem('pastQuestions', JSON.stringify(pastQuestions)); }, [pastQuestions]);
  useEffect(() => { localStorage.setItem('flashcards', JSON.stringify(flashcards)); }, [flashcards]);
  useEffect(() => { 
    localStorage.setItem('dailyGoals', JSON.stringify(dailyGoals));
    if (user) {
      dailyGoals.forEach(goal => api.saveDailyGoal(user.uid, goal));
    }
  }, [dailyGoals, user]);
  useEffect(() => { 
    localStorage.setItem('weeklySimulations', JSON.stringify(weeklySimulations));
    if (user) {
      weeklySimulations.forEach(sim => api.saveWeeklySimulation(user.uid, sim));
    }
  }, [weeklySimulations, user]);
  useEffect(() => { localStorage.setItem('quizQuestions', JSON.stringify(quizQuestions)); }, [quizQuestions]);
  useEffect(() => { localStorage.setItem('examQuestions', JSON.stringify(examQuestions)); }, [examQuestions]);
  useEffect(() => { localStorage.setItem('events', JSON.stringify(events)); }, [events]);
  useEffect(() => { localStorage.setItem('semesterStart', semesterStart); }, [semesterStart]);
  useEffect(() => { localStorage.setItem('semesterEnd', semesterEnd); }, [semesterEnd]);

  // Auto-calculate semester dates based on class timetable
  useEffect(() => {
    const classEvents = allTimetableOccurrences;
    if (classEvents.length > 0) {
      const dates = classEvents.map(e => new Date(e.date).getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      
      const startStr = minDate.toISOString().split('T')[0];
      const endStr = maxDate.toISOString().split('T')[0];
      
      if (startStr !== semesterStart) setSemesterStart(startStr);
      if (endStr !== semesterEnd) setSemesterEnd(endStr);
    }
  }, [allTimetableOccurrences, semesterStart, semesterEnd]);

  // Dynamic Course Stats
  const enrichedCourses = courses.map(course => ({
    ...course,
    flashcardsCount: flashcards.filter(f => f.courseId === course.id).length,
    lecturesCount: lectureFiles.filter(f => f.courseId === course.id).length,
    quizQuestionsCount: quizQuestions.filter(q => q.courseId === course.id).length,
    examSimulationsCount: examSimulations.filter(s => s.courseId === course.id).length,
  }));

  // Generation State
  const [isGeneratingStudyMaterials, setIsGeneratingStudyMaterials] = useState(false);
  const [selectedFlashcardIds, setSelectedFlashcardIds] = useState<string[]>([]);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const openConfirm = (title: string, message: string, onConfirm: () => void, confirmText = 'Delete', cancelText = 'Cancel') => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, confirmText, cancelText });
  };
  const [generationStep, setGenerationStep] = useState('');
  const [generationOptionsOpen, setGenerationOptionsOpen] = useState(false);
  const [generationModalStep, setGenerationModalStep] = useState<'Source' | 'Detail' | 'Materials'>('Source');
  const [generationSourceType, setGenerationSourceType] = useState<'Entire' | 'File' | 'Topic' | 'MultiFile'>('Entire');
  const [selectedGenerationFiles, setSelectedGenerationFiles] = useState<string[]>([]);
  const [generationTopic, setGenerationTopic] = useState('');
  const [generationResults, setGenerationResults] = useState<{ flashcards: number, quiz: number, exam: number, isExisting: boolean } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const fetchAsBase64 = useCallback(async (url: string): Promise<{ mimeType: string, data: string } | null> => {
    try {
      // Handle Google Drive URLs - more robust regex
      const driveMatch = url.match(/(?:id=|\/d\/|file\/d\/)([a-zA-Z0-9_-]{25,})/);
      if (driveMatch && user) {
        if (!googleDriveConnected) {
          console.warn("Google Drive file detected but account not connected.");
          setGenerationError("Google Drive file detected but your account is not connected. Please connect your Google account in the dashboard.");
        } else {
          const fileId = driveMatch[1];
          const response = await fetch(`/api/drive/download?uid=${user.uid}&fileId=${fileId}`);
          if (response.ok) {
            return await response.json();
          }
          
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || `Drive download failed with status ${response.status}`;
          console.error(errorMessage);

          if (response.status === 401 || response.status === 403) {
            setGenerationError("Google Drive access failed. Please ensure you've connected your Google account in the dashboard.");
            return null; // Don't fall through to proxy for Drive files if auth failed
          }
          
          if (response.status === 404) {
            setGenerationError("Google Drive file not found. Please check if the file exists and you have permission to access it.");
            return null; // Don't fall through to proxy for Drive files if not found
          }
          
          // For other errors, we might try proxy as a last resort if it's a public link
        }
      }

      let blob: Blob;
      
      // Support both firebasestorage and storage.googleapis.com
      if (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com')) {
        try {
          const storageRef = ref(storage, url);
          blob = await getBlob(storageRef);
        } catch (storageError) {
          console.error("Firebase Storage fetch failed, falling back to standard fetch:", storageError);
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          blob = await response.blob();
        }
      } else {
        // Use proxy for other external URLs to avoid CORS issues
        const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
        if (response.ok) {
          return await response.json();
        }

        // If proxy returned a specific error (like 401/403), don't fallback to direct fetch
        if (response.status === 401 || response.status === 403) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.message || `Proxy failed with ${response.status}. This resource likely requires authentication.`;
          console.error(errorMessage);
          
          // If it's a Drive URL, give a specific hint
          if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
            setGenerationError("Google Drive file access failed. Please ensure you've connected your Google account and the file is shared correctly.");
          }
          
          return null;
        }

        const directResponse = await fetch(url);
        if (!directResponse.ok) throw new Error(`HTTP error! status: ${directResponse.status}`);
        blob = await directResponse.blob();
      }
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({ mimeType: blob.type, data: base64 });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Failed to fetch file as base64:", error);
      return null;
    }
  }, [user, googleDriveConnected]);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const generateDailyGoals = async () => {
    setIsGeneratingGoals(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const prompt = `Based on the following student data, generate 3-5 specific, actionable daily study goals for today.
      Courses: ${courses.map(c => c.name).join(', ')}
      Timetable: ${JSON.stringify(timetable)}
      Calendar Events & Assignments: ${events.slice(0, 8).map(e => `${e.title} (${e.type}) on ${e.date}`).join(', ')}
      Long term goal: Master all courses and excel in upcoming exams.
      
      Return the goals as a JSON array of objects with the following structure:
      { "title": string, "category": "Study" | "Review" | "Practice" | "Exam" }
      Keep titles concise and motivating. Ensure at least one goal relates to an upcoming assignment or exam if any are listed.`;

      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || "[]");
      const today = new Date().toISOString().split('T')[0];
      const newGoals: DailyGoal[] = result.map((g: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        title: g.title,
        completed: false,
        category: g.category || 'Study',
        date: today
      }));

      setDailyGoals(newGoals);
    } catch (error) {
      console.error("Error generating goals:", error);
      // Fallback to some default goals if AI fails
      const today = new Date().toISOString().split('T')[0];
      setDailyGoals([
        { id: 'f1', title: 'Review today\'s lecture notes', completed: false, category: 'Study', date: today },
        { id: 'f2', title: 'Practice 10 flashcards', completed: false, category: 'Review', date: today },
        { id: 'f3', title: 'Plan for next week\'s simulation', completed: false, category: 'Exam', date: today },
      ]);
    } finally {
      setIsGeneratingGoals(false);
    }
  };

  const toggleGoal = (id: string) => {
    setDailyGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  };

  useEffect(() => {
    if (user) {
      checkGoogleDriveStatus();
      
      // Check if Google secrets are missing
      const apiKey = (process.env as any).GOOGLE_API_KEY;
      const clientId = (process.env as any).GOOGLE_CLIENT_ID;
      
      if (!apiKey || apiKey === 'YOUR_GOOGLE_API_KEY' || !clientId) {
        setGoogleSecretsMissing(true);
      }
    }
  }, [user]);

  const checkGoogleDriveStatus = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/drive/status?uid=${user.uid}`);
      const data = await response.json();
      setGoogleDriveConnected(data.connected);
    } catch (error) {
      console.error("Error checking Drive status:", error);
    }
  };

  const connectGoogleDrive = async () => {
    if (!user) return;
    setIsConnectingDrive(true);
    try {
      const response = await fetch(`/api/auth/google/url?uid=${user.uid}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to get auth URL");
      }
      
      const { url } = data;
      
      const authWindow = window.open(url, 'google_auth_popup', 'width=600,height=700');
      
      if (!authWindow) {
        alert('Please allow popups to connect Google Drive.');
        setIsConnectingDrive(false);
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' && event.data?.uid === user.uid) {
          setGoogleDriveConnected(true);
          setUseGoogleDrive(true);
          setIsConnectingDrive(false);
          window.removeEventListener('message', handleMessage);
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error("Error connecting Drive:", error);
      alert(error instanceof Error ? error.message : "Failed to connect Google Drive");
      setIsConnectingDrive(false);
    }
  };

  const disconnectGoogleDrive = async () => {
    if (!user) return;
    try {
      await fetch(`/api/drive/disconnect?uid=${user.uid}`, { method: 'POST' });
      setGoogleDriveConnected(false);
      setUseGoogleDrive(false);
    } catch (error) {
      console.error("Error disconnecting Drive:", error);
    }
  };

  const openGooglePicker = async (type: 'lecture' | 'exam') => {
    if (!user || !googleDriveConnected) return;
    
    try {
      const response = await fetch(`/api/drive/token?uid=${user.uid}`);
      const { accessToken } = await response.json();
      
      if (!accessToken) throw new Error("Could not get access token");

      const loadPicker = () => {
        (window as any).gapi.load('picker', {
          callback: () => {
            const picker = new (window as any).google.picker.PickerBuilder()
              .addView((window as any).google.picker.ViewId.DOCS)
              .setOAuthToken(accessToken)
              .setDeveloperKey(process.env.GOOGLE_API_KEY || '') // Optional but recommended
              .setCallback(async (data: any) => {
                if (data.action === (window as any).google.picker.Action.PICKED) {
                  const doc = data.docs[0];
                  const fileId = doc.id;
                  const fileUrl = `https://drive.google.com/file/d/${fileId}/preview`;
                  const fileName = doc.name;
                  const fileType = doc.mimeType;
                  const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                  if (type === 'lecture') {
                    const newFile: LectureFile = {
                      id: Math.random().toString(36).substr(2, 9),
                      courseId: selectedCourse?.id || '',
                      name: fileName,
                      uploadDate: todayStr,
                      pages: 1,
                      fileUrl: fileUrl,
                      fileType
                    };
                    setLectureFiles(prev => [newFile, ...prev]);
                    await api.saveFile(user.uid, newFile);
                  } else {
                    const newPQ: PastQuestion = {
                      id: Math.random().toString(36).substr(2, 9),
                      courseId: selectedCourse?.id || '',
                      title: fileName.replace(/\.[^/.]+$/, ""),
                      year: new Date().getFullYear().toString(),
                      semester: 'Spring',
                      uploadDate: new Date().toISOString().split('T')[0],
                      fileUrl: fileUrl,
                      fileType
                    };
                    setPastQuestions(prev => [newPQ, ...prev]);
                    await api.savePastQuestion(user.uid, newPQ);
                  }
                }
              })
              .build();
            picker.setVisible(true);
          }
        });
      };

      loadPicker();
    } catch (error) {
      console.error("Error opening picker:", error);
      alert("Failed to open Google Drive. Please try reconnecting.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'lecture' | 'exam') => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    
    if (useGoogleDrive && googleSecretsMissing) {
      alert("Google Drive integration is not fully configured. Please set GOOGLE_CLIENT_ID and GOOGLE_API_KEY in environment variables.");
      return;
    }

    if (useGoogleDrive && !googleDriveConnected) {
      alert("Please connect to Google Drive first.");
      return;
    }

    if (!selectedCourse) {
      alert("Please select a course first.");
      return;
    }

    setIsUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        let fileUrl = '';

        if (useGoogleDrive && googleDriveConnected) {
          // Upload to Google Drive
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          const response = await fetch('/api/drive/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: user.uid,
              name: file.name,
              mimeType: file.type || 'application/octet-stream',
              content: base64
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Google Drive upload failed");
          }
          const driveData = await response.json();
          fileUrl = `https://drive.google.com/file/d/${driveData.id}/preview`;
        } else {
          // Use Firebase Storage for all files to avoid Firestore 1MB limit
          const storagePath = `users/${user.uid}/${type === 'lecture' ? 'files' : 'past_questions'}/${Date.now()}_${file.name}`;
          const storageRef = ref(storage, storagePath);
          
          const uploadTask = uploadBytesResumable(storageRef, file);

          await new Promise<void>((resolve, reject) => {
            uploadTask.on('state_changed', 
              (snapshot) => {
                const progress = snapshot.totalBytes > 0 ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 : 0;
                setUploadProgress(progress);
              }, 
              (error) => {
                console.error("Upload error:", error);
                reject(error);
              }, 
              () => resolve()
            );
          });

          fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
        }

        const fileType = file.type || file.name.split('.').pop() || 'unknown';
        const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        if (type === 'lecture') {
          const newFile: LectureFile = {
            id: Math.random().toString(36).substr(2, 9),
            courseId: selectedCourse?.id || '',
            name: file.name,
            uploadDate: todayStr,
            pages: Math.floor(Math.random() * 50) + 1,
            fileUrl: fileUrl,
            fileType
          };
          setLectureFiles(prev => [newFile, ...prev]);
          await api.saveFile(user.uid, newFile);
          
          // Update course lectures count
          if (selectedCourse) {
            const updatedCourse = { ...selectedCourse, lecturesCount: (selectedCourse.lecturesCount || 0) + 1 };
            setSelectedCourse(updatedCourse);
            setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
            await api.saveCourse(user.uid, updatedCourse);
          }
        } else {
          const newPQ: PastQuestion = {
            id: Math.random().toString(36).substr(2, 9),
            courseId: selectedCourse?.id || '',
            title: file.name.replace(/\.[^/.]+$/, ""),
            year: new Date().getFullYear().toString(),
            semester: 'Spring',
            uploadDate: new Date().toISOString().split('T')[0],
            fileUrl: fileUrl,
            fileType
          };
          setPastQuestions(prev => [newPQ, ...prev]);
          await api.savePastQuestion(user.uid, newPQ);
        }
      }

      setUploadStatus('success');
      setTimeout(() => {
        setIsUploading(false);
        setUploadStatus('idle');
      }, 2000);
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadStatus('error');
      alert(error instanceof Error ? error.message : "Upload failed. Please try again.");
      setTimeout(() => {
        setIsUploading(false);
        setUploadStatus('idle');
      }, 3000);
    }
  };

  const deleteCourse = (courseId: string) => {
    openConfirm(
      "Delete Course?",
      "Are you sure you want to delete this course? This will also remove all related materials, flashcards, and events.",
      async () => {
        if (user) {
          try {
            // Delete from Firestore
            await api.deleteCourse(user.uid, courseId);
            
            // Delete related files
            const courseFiles = lectureFiles.filter(f => f.courseId === courseId);
            for (const file of courseFiles) {
              await api.deleteFile(user.uid, file);
            }
            
            // Delete related flashcards
            const courseFlashcards = flashcards.filter(f => f.courseId === courseId);
            for (const fc of courseFlashcards) {
              await api.deleteFlashcard(user.uid, fc.id);
            }
            
            // Delete related quiz questions
            const courseQuiz = quizQuestions.filter(q => q.courseId === courseId);
            for (const q of courseQuiz) {
              await api.deleteQuizQuestion(user.uid, q.id);
            }
            
            // Delete related exam questions
            const courseExam = examQuestions.filter(q => q.courseId === courseId);
            for (const q of courseExam) {
              await api.deleteExamQuestion(user.uid, q.id);
            }
            
            // Delete related events
            const courseEvents = events.filter(e => e.courseId === courseId);
            for (const e of courseEvents) {
              await api.deleteCalendarEvent(user.uid, e.id);
            }
            
            // Delete related past questions
            const coursePQs = pastQuestions.filter(pq => pq.courseId === courseId);
            for (const pq of coursePQs) {
              await api.deletePastQuestion(user.uid, pq);
            }
          } catch (error) {
            console.error("Error deleting course data from Firestore:", error);
          }
        }

        setCourses(prev => prev.filter(c => c.id !== courseId));
        setLectureFiles(prev => prev.filter(f => f.courseId !== courseId));
        setPastQuestions(prev => prev.filter(pq => pq.courseId !== courseId));
        setFlashcards(prev => prev.filter(fc => fc.courseId !== courseId));
        setQuizQuestions(prev => prev.filter(q => q.courseId !== courseId));
        setExamQuestions(prev => prev.filter(q => q.courseId !== courseId));
        setEvents(prev => prev.filter(e => e.courseId !== courseId));
        setWeeklySimulations(prev => prev.filter(s => s.courseId !== courseId));
        if (selectedCourse?.id === courseId) {
          setSelectedCourse(null);
          setView('home');
        }
      }
    );
  };

  const deleteFlashcard = (id: string) => {
    openConfirm("Delete Flashcard?", "Are you sure you want to delete this flashcard?", async () => {
      setFlashcards(prev => prev.filter(fc => fc.id !== id));
      setSelectedFlashcardIds(prev => prev.filter(fid => fid !== id));
      if (user) {
        await api.deleteFlashcard(user.uid, id);
        
        // Update course flashcards count
        if (selectedCourse) {
          const updatedCourse = { ...selectedCourse, flashcardsCount: Math.max(0, (selectedCourse.flashcardsCount || 0) - 1) };
          setSelectedCourse(updatedCourse);
          setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
          await api.saveCourse(user.uid, updatedCourse);
        }
      }
    });
  };

  const deleteSelectedFlashcards = () => {
    if (selectedFlashcardIds.length === 0) return;
    openConfirm(
      "Delete Selected Flashcards?",
      `Are you sure you want to delete ${selectedFlashcardIds.length} flashcards?`,
      async () => {
        const ids = [...selectedFlashcardIds];
        const countToDelete = ids.length;
        setFlashcards(prev => prev.filter(fc => !ids.includes(fc.id)));
        setSelectedFlashcardIds([]);
        if (user) {
          for (const id of ids) await api.deleteFlashcard(user.uid, id);
          
          // Update course flashcards count
          if (selectedCourse) {
            const updatedCourse = { ...selectedCourse, flashcardsCount: Math.max(0, (selectedCourse.flashcardsCount || 0) - countToDelete) };
            setSelectedCourse(updatedCourse);
            setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
            await api.saveCourse(user.uid, updatedCourse);
          }
        }
      }
    );
  };

  const deleteQuizQuestion = (id: string) => {
    openConfirm("Delete Question?", "Are you sure you want to delete this quiz question?", async () => {
      setQuizQuestions(prev => prev.filter(q => q.id !== id));
      if (user) {
        await api.deleteQuizQuestion(user.uid, id);
        
        // Update course quiz questions count
        if (selectedCourse) {
          const updatedCourse = { ...selectedCourse, quizQuestionsCount: Math.max(0, (selectedCourse.quizQuestionsCount || 0) - 1) };
          setSelectedCourse(updatedCourse);
          setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
          await api.saveCourse(user.uid, updatedCourse);
        }
      }
    });
  };

  const deleteLectureFile = (id: string) => {
    openConfirm("Delete File?", "Are you sure you want to delete this lecture file?", async () => {
      const fileToDelete = lectureFiles.find(f => f.id === id);
      setLectureFiles(prev => prev.filter(f => f.id !== id));
      if (user && fileToDelete) {
        try {
          await api.deleteFile(user.uid, fileToDelete);
          
          // Update course lectures count
          if (selectedCourse) {
            const updatedCourse = { ...selectedCourse, lecturesCount: Math.max(0, (selectedCourse.lecturesCount || 0) - 1) };
            setSelectedCourse(updatedCourse);
            setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
            await api.saveCourse(user.uid, updatedCourse);
          }
        } catch (error) {
          console.error("Error deleting file:", error);
        }
      }
    });
  };

  const deletePastQuestion = (id: string) => {
    openConfirm("Delete Past Exam?", "Are you sure you want to delete this past exam?", async () => {
      const pqToDelete = pastQuestions.find(pq => pq.id === id);
      setPastQuestions(prev => prev.filter(pq => pq.id !== id));
      if (user && pqToDelete) {
        try {
          await api.deletePastQuestion(user.uid, pqToDelete);
        } catch (error) {
          console.error("Error deleting past question:", error);
        }
      }
    });
  };

  const deleteExamQuestion = (id: string) => {
    openConfirm("Delete Exam Question?", "Are you sure you want to delete this exam question?", async () => {
      setExamQuestions(prev => prev.filter(q => q.id !== id));
    if (user) {
      await api.deleteExamQuestion(user.uid, id);
    }
    });
  };

  const deleteEvent = (id: string) => {
    openConfirm("Delete Event?", "Are you sure you want to delete this calendar event?", async () => {
      setEvents(prev => prev.filter(e => e.id !== id));
      if (user) {
        await api.deleteCalendarEvent(user.uid, id);
      }
    });
  };

  const deleteGoal = (id: string) => {
    openConfirm("Delete Goal?", "Are you sure you want to delete this daily goal?", async () => {
      setDailyGoals(prev => prev.filter(g => g.id !== id));
      if (user) {
        await api.deleteDailyGoal(user.uid, id);
      }
    });
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    const newGoal: DailyGoal = {
      id: Math.random().toString(36).substr(2, 9),
      title: newGoalTitle,
      completed: false,
      category: 'Study',
      date: new Date().toISOString().split('T')[0]
    };
    setDailyGoals(prev => [newGoal, ...prev]);
    setNewGoalTitle('');
    setIsAddingGoal(false);
  };

  const handleGenerateStudyMaterials = async (options: { flashcards: boolean, quiz: boolean, exam: boolean, generateMore?: boolean }) => {
    if (!selectedCourse) return;
    
    // Determine source
    let sourceLabel = "Entire Course";
    let filteredLectures = lectureFiles.filter(f => f.courseId === selectedCourse.id);
    
    if (generationSourceType === 'File' && selectedGenerationFiles.length > 0) {
      const file = lectureFiles.find(f => f.id === selectedGenerationFiles[0]);
      sourceLabel = file ? `File: ${file.name}` : "Specific File";
      filteredLectures = filteredLectures.filter(f => f.id === selectedGenerationFiles[0]);
    } else if (generationSourceType === 'MultiFile' && selectedGenerationFiles.length > 0) {
      sourceLabel = `Selected Files (${selectedGenerationFiles.length})`;
      filteredLectures = filteredLectures.filter(f => selectedGenerationFiles.includes(f.id));
    } else if (generationSourceType === 'Topic' && generationTopic) {
      sourceLabel = `Topic: ${generationTopic}`;
    }

    if (filteredLectures.length === 0 && generationSourceType !== 'Topic') {
      setGenerationError("No lecture files found for the selected source. Please upload materials first.");
      return;
    }

    // Check for existing materials
    const existingFlashcards = flashcards.filter(f => f.courseId === selectedCourse.id && f.source === sourceLabel);
    const existingQuiz = quizQuestions.filter(q => q.courseId === selectedCourse.id && q.source === sourceLabel);
    const existingExam = examQuestions.filter(q => q.courseId === selectedCourse.id && q.source === sourceLabel);

    const hasExisting = (options.flashcards && existingFlashcards.length > 0) || 
                        (options.quiz && existingQuiz.length > 0) || 
                        (options.exam && existingExam.length > 0);

    if (hasExisting && !options.generateMore) {
      setGenerationResults({
        flashcards: existingFlashcards.length,
        quiz: existingQuiz.length,
        exam: existingExam.length,
        isExisting: true
      });
      return;
    }

    setIsGeneratingStudyMaterials(true);
    setGenerationError(null);
    setGenerationResults(null);
    setGenerationOptionsOpen(false);
    
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("Gemini API Key is missing. Please add GEMINI_API_KEY to your project secrets in Settings.");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";

      // Step 1: Analyze
      setGenerationStep("Analyzing lecture materials...");
      
      const filePartsPromises = filteredLectures.map(async f => {
        if (f.fileUrl) {
          if (f.fileUrl.startsWith('data:')) {
            const [mimeType, base64Data] = f.fileUrl.split(';base64,');
            return {
              inlineData: {
                mimeType: mimeType.replace('data:', ''),
                data: base64Data
              }
            };
          } else if (f.fileUrl.startsWith('http')) {
            const data = await fetchAsBase64(f.fileUrl);
            if (data) {
              return {
                inlineData: {
                  mimeType: data.mimeType,
                  data: data.data
                }
              };
            }
          }
        }
        return { text: `Lecture File: ${f.name}` };
      });

      const fileParts = await Promise.all(filePartsPromises);

      const context = {
        courseName: selectedCourse.name,
        lectures: filteredLectures.map(f => f.name),
        pastExams: pastQuestions.filter(pq => pq.courseId === selectedCourse.id).map(pq => pq.content),
        professorStyle: examStyle,
        studentNotes: personalNotes,
        specificTopic: generationSourceType === 'Topic' ? generationTopic : null
      };

      let newFlashcards: Flashcard[] = [];
      let newQuizQuestions: QuizQuestion[] = [];
      let newExamQuestions: ExamQuestion[] = [];

      const sourceContext = context.specificTopic 
        ? `Focus ONLY on the topic: "${context.specificTopic}" using available course context.`
        : `Focus on the following lecture(s): ${context.lectures.join(', ')}.`;

      if (options.flashcards) {
        setGenerationStep("Generating flashcards...");
        const flashcardPrompt = `Generate 10-15 high-quality flashcards for the course "${context.courseName}".
        ${sourceContext}
        Professor Style: ${context.professorStyle || 'Standard'}
        
        Return as a JSON array of objects: { "question": string, "answer": string, "topic": string }`;
        
        const response = await ai.models.generateContent({
          model,
          contents: [{ parts: [...fileParts, { text: flashcardPrompt }] }],
          config: { responseMimeType: "application/json" }
        });
        
        const text = response.text || "[]";
        const jsonMatch = text.match(/\[.*\]/s);
        const generated = JSON.parse(jsonMatch ? jsonMatch[0] : (text.startsWith('[') ? text : "[]"));
        
        newFlashcards = generated.map((f: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          courseId: selectedCourse.id,
          topicId: currentCreationTopicId || 'default',
          ...f,
          difficulty: 'None',
          type: 'AI',
          source: sourceLabel,
          createdAt: new Date().toISOString()
        }));
      }

      if (options.quiz) {
        setGenerationStep("Generating quiz questions...");
        const quizPrompt = `Generate 5-8 high-quality quiz questions for the course "${context.courseName}".
        ${sourceContext}
        Professor Style: ${context.professorStyle || 'Standard'}
        Past Exam Context: ${context.pastExams.length > 0 ? context.pastExams.join('\n') : 'No past exams provided.'}
        Student Notes: ${context.studentNotes || 'No notes provided.'}
        
        CRITICAL: 
        - Questions should be challenging and test deep understanding, not just recall.
        - Include a mix of conceptual and practical questions.
        - If the course involves coding, include code-related questions.
        - If the course involves calculations, include numerical problems.
        
        Return as a JSON array of objects: { "question": string, "suggestedAnswer": string, "topic": string, "type": "Definition" | "Explanation" | "Comparison" | "Code" | "Calculation" | "Diagram" }`;
        
        const response = await ai.models.generateContent({
          model,
          contents: [{ parts: [...fileParts, { text: quizPrompt }] }],
          config: { responseMimeType: "application/json" }
        });
        
        const text = response.text || "[]";
        const jsonMatch = text.match(/\[.*\]/s);
        const generated = JSON.parse(jsonMatch ? jsonMatch[0] : (text.startsWith('[') ? text : "[]"));
        
        newQuizQuestions = generated.map((q: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          courseId: selectedCourse.id,
          ...q,
          source: sourceLabel
        }));
      }

      if (options.exam) {
        setGenerationStep("Generating exam simulation questions...");
        const examPrompt = `Generate 5-8 rigorous exam-style questions for the course "${context.courseName}".
        ${sourceContext}
        Professor Style: ${context.professorStyle || 'Standard'}
        Past Exam Context: ${context.pastExams.length > 0 ? context.pastExams.join('\n') : 'No past exams provided.'}
        Student Notes: ${context.studentNotes || 'No notes provided.'}
        
        CRITICAL:
        - Questions must mimic the difficulty and structure of a final university exam.
        - Include point values (5 to 20 points per question).
        - Ensure a mix of Theory, Explanation, and Practical (Code/Calculation) questions.
        
        Return as a JSON array of objects: { "question": string, "suggestedAnswer": string, "topic": string, "type": "Theory" | "Explanation" | "CodeExplanation" | "CodeWriting" | "Diagram" | "Calculation" | "MultipleChoice", "points": number }`;
        
        const response = await ai.models.generateContent({
          model,
          contents: [{ parts: [...fileParts, { text: examPrompt }] }],
          config: { responseMimeType: "application/json" }
        });
        
        const text = response.text || "[]";
        const jsonMatch = text.match(/\[.*\]/s);
        const generated = JSON.parse(jsonMatch ? jsonMatch[0] : (text.startsWith('[') ? text : "[]"));
        
        newExamQuestions = generated.map((q: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          courseId: selectedCourse.id,
          ...q,
          source: sourceLabel
        }));
      }

      // Save results
      if (newFlashcards.length > 0 && user) {
        setFlashcards(prev => [...newFlashcards, ...prev]);
        await Promise.all(newFlashcards.map(fc => api.saveFlashcard(user.uid, fc)));
      }
      if (newQuizQuestions.length > 0 && user) {
        setQuizQuestions(prev => [...newQuizQuestions, ...prev]);
        await Promise.all(newQuizQuestions.map(q => api.saveQuizQuestion(user.uid, q)));
      }
      if (newExamQuestions.length > 0 && user) {
        setExamQuestions(prev => [...newExamQuestions, ...prev]);
        await Promise.all(newExamQuestions.map(q => api.saveExamQuestion(user.uid, q)));
      }

      setGenerationResults({
        flashcards: newFlashcards.length,
        quiz: newQuizQuestions.length,
        exam: newExamQuestions.length,
        isExisting: false
      });
      
    } catch (error: any) {
      console.error("Generation failed:", error);
      const errorMessage = error.message || "Unknown error occurred";
      
      if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("API key not valid")) {
        setGenerationError("Invalid Gemini API Key. Please check your project secrets.");
      } else if (errorMessage.includes("quota") || errorMessage.includes("429")) {
        setGenerationError("API quota exceeded. Please try again in a few minutes.");
      } else if (errorMessage.includes("safety")) {
        setGenerationError("The AI refused to generate content due to safety filters. Try different materials.");
      } else {
        setGenerationError(`Failed to generate study materials: ${errorMessage}`);
      }
    } finally {
      setIsGeneratingStudyMaterials(false);
      setGenerationStep('');
    }
  };

  const startWeeklySimulation = (sim: WeeklySimulation) => {
    const course = courses.find(c => c.id === sim.courseId);
    if (course) {
      setSelectedCourse(course);
      setView('exam-simulation');
      if (sim.status === 'NotStarted') {
        updateSimulationStatus(sim.courseId, 'InProgress');
      }
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim() || !user) return;

    const newCourse: Course = {
      id: Math.random().toString(36).substr(2, 9),
      uid: user.uid,
      name: newCourseName,
      type: newCourseType,
      color: newCourseColor,
      flashcardsCount: 0,
      lecturesCount: 0,
      quizQuestionsCount: 0,
      lastStudied: 'Never',
      status: 'Active',
      progress: 0
    };

    try {
      await api.saveCourse(user.uid, newCourse);
      setCourses([newCourse, ...courses]);
      setNewCourseName('');
      setNewCourseColor('bg-stone-100');
      setIsAddModalOpen(false);
    } catch (error) {
      console.error("Error adding course:", error);
    }
  };
  
  const handleAddPastQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPQTitle.trim() || !selectedCourse) return;

    const newPQ: PastQuestion = {
      id: Math.random().toString(36).substr(2, 9),
      courseId: selectedCourse.id,
      title: newPQTitle,
      year: newPQYear || new Date().getFullYear().toString(),
      semester: newPQSemester,
      content: newPQContent,
      uploadDate: new Date().toISOString().split('T')[0],
    };

    setPastQuestions([newPQ, ...pastQuestions]);
    if (user) {
      await api.savePastQuestion(user.uid, newPQ);
    }
    setNewPQTitle('');
    setNewPQYear('');
    setNewPQSemester('Spring');
    setNewPQContent('');
    setIsPastQuestionModalOpen(false);
  };

  const openWorkspace = (course: Course) => {
    setSelectedCourse(course);
    setView('workspace');
  };

  const startTask = (task: Task) => {
    const course = courses.find(c => c.name === task.course);
    if (!course) return;
    setSelectedCourse(course);
    if (task.type === 'Flashcards') {
      setView('flashcards');
    } else if (task.type === 'Quiz Practice') {
      setView('quiz-practice');
    } else if (task.type === 'Review Lecture') {
      setView('lecture-materials');
    }
  };

  const openTool = (toolId: string) => {
    if (toolId === 'lectures') {
      setView('lecture-materials');
    } else if (toolId === 'flashcards') {
      setView('flashcards');
    } else if (toolId === 'quiz') {
      setView('quiz-practice');
    } else if (toolId === 'simulation') {
      setView('exam-simulation');
    } else if (toolId === 'calendar') {
      setView('calendar');
    } else if (toolId === 'timer') {
      setView('study-timer');
    } else if (toolId === 'past-exams') {
      setView('past-exams');
    } else if (toolId === 'project-notes') {
      setView('project-notes');
    } else if (toolId === 'project-tasks') {
      setView('project-tasks');
    } else if (toolId === 'project-milestones') {
      setView('project-milestones');
    } else if (toolId === 'project-insights') {
      setView('project-insights');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#FDFCF8] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-stone-200 border-t-stone-900 rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FDFCF8] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-xl border border-stone-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-stone-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-stone-900">StudyPrep</h1>
            <p className="text-stone-500 text-sm mt-1">Your personal academic companion</p>
          </div>

          {authMode === 'signup' ? (
            <form onSubmit={handleSignUp} className="space-y-4">
              {onboardingStep === 1 ? (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <h2 className="text-lg font-bold text-stone-800 mb-4">Create Account</h2>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1 ml-1">First Name</label>
                    <input 
                      type="text" required
                      value={onboardingData.firstName}
                      onChange={e => setOnboardingData({...onboardingData, firstName: e.target.value})}
                      className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1 ml-1">Email Address</label>
                    <input 
                      type="email" required
                      value={onboardingData.email}
                      onChange={e => setOnboardingData({...onboardingData, email: e.target.value})}
                      className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                      placeholder="john@university.edu"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1 ml-1">Password</label>
                    <input 
                      type="password" required
                      value={onboardingData.password}
                      onChange={e => setOnboardingData({...onboardingData, password: e.target.value})}
                      className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => setOnboardingStep(2)}
                    className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all"
                  >
                    Next Step <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              ) : onboardingStep === 2 ? (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <h2 className="text-lg font-bold text-stone-800 mb-4">Academic Details</h2>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1 ml-1">University Name</label>
                    <input 
                      type="text" required
                      value={onboardingData.universityName}
                      onChange={e => setOnboardingData({...onboardingData, universityName: e.target.value})}
                      className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                      placeholder="Stanford University"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1 ml-1">Course of Study</label>
                    <input 
                      type="text" required
                      value={onboardingData.courseOfStudy}
                      onChange={e => setOnboardingData({...onboardingData, courseOfStudy: e.target.value})}
                      className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                      placeholder="Computer Science"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1 ml-1">Current Semester</label>
                    <input 
                      type="number" required min="1"
                      value={onboardingData.currentSemester}
                      onChange={e => setOnboardingData({...onboardingData, currentSemester: parseInt(e.target.value)})}
                      className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setOnboardingStep(1)}
                      className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                    >
                      Back
                    </button>
                    <button 
                      type="button"
                      onClick={() => setOnboardingStep(3)}
                      className="flex-1 py-4 bg-stone-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all"
                    >
                      Next Step <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <h2 className="text-lg font-bold text-stone-800 mb-4">Final Touches</h2>
                  
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1 ml-1">Profile Picture (Optional)</label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-dashed border-stone-200">
                        {onboardingData.profilePicture ? (
                          <img src={onboardingData.profilePicture} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Camera className="w-6 h-6 text-stone-300" />
                        )}
                      </div>
                      <label className="cursor-pointer bg-stone-50 hover:bg-stone-100 px-4 py-2 rounded-xl text-xs font-bold text-stone-600 transition-all">
                        Upload Photo
                        <input 
                          type="file" accept="image/*" className="hidden" 
                          onChange={async e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const compressed = await compressImage(file);
                                setOnboardingData({...onboardingData, profilePicture: compressed});
                              } catch (err) {
                                console.error("Error compressing image:", err);
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1 ml-1">Past Courses Completed</label>
                    <div className="flex gap-2 mb-2">
                      <input 
                        type="text"
                        value={newPastCourse}
                        onChange={e => setNewPastCourse(e.target.value)}
                        className="flex-1 bg-stone-50 border-none rounded-xl px-4 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                        placeholder="e.g. Intro to Programming"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (newPastCourse.trim()) {
                            setOnboardingData({...onboardingData, pastCourses: [...onboardingData.pastCourses, newPastCourse.trim()]});
                            setNewPastCourse('');
                          }
                        }}
                        className="bg-stone-900 text-white p-2 rounded-xl hover:bg-stone-800 transition-all"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {onboardingData.pastCourses.map((course, idx) => (
                        <span key={idx} className="bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                          {course}
                          <button onClick={() => setOnboardingData({...onboardingData, pastCourses: onboardingData.pastCourses.filter((_, i) => i !== idx)})}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {authError && <p className="text-rose-500 text-xs text-center">{authError}</p>}

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setOnboardingStep(2)}
                      className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                    >
                      Back
                    </button>
                    <button 
                      type="submit"
                      disabled={isAuthLoading}
                      className="flex-1 py-4 bg-stone-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all disabled:opacity-50"
                    >
                      {isAuthLoading ? 'Creating...' : 'Get Started'}
                    </button>
                  </div>
                </motion.div>
              )}
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1 ml-1">Email Address</label>
                <input 
                  type="email" required
                  value={onboardingData.email}
                  onChange={e => setOnboardingData({...onboardingData, email: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                  placeholder="john@university.edu"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1 ml-1">Password</label>
                <input 
                  type="password" required
                  value={onboardingData.password}
                  onChange={e => setOnboardingData({...onboardingData, password: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                  placeholder="••••••••"
                />
              </div>
              {authError && <p className="text-rose-500 text-xs text-center">{authError}</p>}
              <button 
                type="submit"
                disabled={isAuthLoading}
                className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all disabled:opacity-50"
              >
                {isAuthLoading ? 'Logging in...' : 'Sign In'}
              </button>
            </form>
          )}

          <div className="mt-8 text-center">
            <button 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthError('');
              }}
              className="text-stone-500 text-sm hover:underline"
            >
              {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSyncToGoogleCalendar = async (events: any[]) => {
    if (!user || !googleDriveConnected) return;
    
    try {
      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, events })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Sync failed");
      }
    } catch (error) {
      console.error("Sync Error:", error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-stone-800 font-sans pb-24">
      <SemesterProgressBar />
      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Dashboard Content */}
            <header className="px-6 pt-12 pb-6">
              <div className="flex items-start justify-between">
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{getGreeting()}, {profile?.firstName || user?.displayName?.split(' ')[0] || 'Chinelo'}</h1>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="Connected to Database" />
                  </div>
                  <p className="text-stone-500 text-sm mt-1">{today}</p>
                </motion.div>
                <button 
                  onClick={() => setIsProfileOpen(true)}
                  className="w-10 h-10 bg-white border border-stone-100 rounded-2xl flex items-center justify-center shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  {profile?.profilePicture ? (
                    <img src={profile.profilePicture} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon className="w-5 h-5 text-stone-400" />
                  )}
                </button>
              </div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mt-8 bg-stone-900 text-stone-100 rounded-3xl p-6 shadow-xl shadow-stone-200/50"
              >
                <div className="grid grid-cols-3 gap-4">
                  <button 
                    onClick={() => setView('study-timer')}
                    className="flex flex-col items-center text-center hover:bg-stone-800 transition-colors py-2 rounded-lg"
                  >
                    <Clock className="w-5 h-5 mb-2 text-stone-400" />
                    <span className="text-lg font-medium">{totalStudyHours}h</span>
                    <span className="text-[10px] uppercase tracking-wider text-stone-500">Study Time</span>
                  </button>
                  <button 
                    onClick={() => setView('flashcards')}
                    className="flex flex-col items-center text-center border-x border-stone-800 hover:bg-stone-800 transition-colors py-2 rounded-lg"
                  >
                    <Layers className="w-5 h-5 mb-2 text-stone-400" />
                    <span className="text-lg font-medium">{globalFlashcards.length}</span>
                    <span className="text-[10px] uppercase tracking-wider text-stone-500">Flashcards</span>
                  </button>
                  <button 
                    onClick={() => setView('calendar')}
                    className="flex flex-col items-center text-center hover:bg-stone-800 transition-colors py-2 rounded-lg"
                  >
                    <Calendar className="w-5 h-5 mb-2 text-stone-400" />
                    <span className="text-lg font-medium">{globalSimulations.length}</span>
                    <span className="text-[10px] uppercase tracking-wider text-stone-500">Simulations</span>
                  </button>
                </div>
              </motion.div>
            </header>

            <section className="px-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-stone-900">Daily Study Goals</h2>
                  <div className="px-2 py-0.5 bg-stone-100 rounded-full text-[10px] font-bold text-stone-500 uppercase tracking-widest">AI Powered</div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsAddingGoal(!isAddingGoal)}
                    className="p-1.5 bg-stone-100 rounded-lg text-stone-600 hover:bg-stone-200 transition-colors"
                  >
                    <Plus className={`w-4 h-4 transition-transform ${isAddingGoal ? 'rotate-45' : ''}`} />
                  </button>
                  <button 
                    onClick={generateDailyGoals}
                    disabled={isGeneratingGoals}
                    className="text-xs font-bold text-stone-900 flex items-center gap-1 hover:opacity-70 transition-opacity disabled:opacity-50"
                  >
                    <Sparkles className={`w-3 h-3 ${isGeneratingGoals ? 'animate-spin' : ''}`} />
                    {isGeneratingGoals ? 'Generating...' : 'Regenerate'}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isAddingGoal && (
                  <motion.form 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleAddGoal}
                    className="mb-4 overflow-hidden"
                  >
                    <div className="flex gap-2">
                      <input 
                        autoFocus
                        type="text"
                        value={newGoalTitle}
                        onChange={(e) => setNewGoalTitle(e.target.value)}
                        placeholder="Add a custom goal..."
                        className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-stone-900 outline-none"
                      />
                      <button 
                        type="submit"
                        className="bg-stone-900 text-white px-4 py-2 rounded-xl text-xs font-bold"
                      >
                        Add
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                {/* Unified Task List: Daily Goals + Today's Calendar Tasks */}
                {(() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const todayEvents = events.filter(e => 
                    e.date === todayStr && 
                    (e.type === 'Assignment Deadline' || e.type === 'Project' || e.type === 'Study Session' || e.type === 'Exam')
                  );

                  return (
                    <>
                      {dailyGoals.map((goal, index) => (
                        <motion.div 
                          key={goal.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + index * 0.05 }}
                          className={`group relative bg-white border ${goal.completed ? 'border-stone-100 opacity-60' : 'border-stone-100 shadow-sm'} rounded-2xl p-4 flex items-center justify-between transition-all hover:shadow-md`}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <button 
                              onClick={() => toggleGoal(goal.id)}
                              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${goal.completed ? 'bg-stone-900 border-stone-900 text-white' : 'border-stone-200 hover:border-stone-400'}`}
                            >
                              {goal.completed && <Check className="w-4 h-4" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <h3 className={`text-sm font-medium truncate ${goal.completed ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
                                {goal.title}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${
                                  goal.category === 'Study' ? 'bg-blue-50 text-blue-600' :
                                  goal.category === 'Review' ? 'bg-orange-50 text-orange-600' :
                                  goal.category === 'Practice' ? 'bg-yellow-50 text-yellow-600' :
                                  'bg-red-50 text-red-600'
                                }`}>
                                  {goal.category}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => deleteGoal(goal.id)}
                            className="opacity-0 group-hover:opacity-100 p-2 text-stone-300 hover:text-red-500 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}

                      {todayEvents.map((event, index) => (
                        <motion.div 
                          key={event.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + (dailyGoals.length + index) * 0.05 }}
                          className={`group relative bg-white border ${event.status === 'Completed' ? 'border-stone-100 opacity-60' : 'border-stone-100 shadow-sm'} rounded-2xl p-4 flex items-center justify-between transition-all hover:shadow-md`}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <button 
                              onClick={() => {
                                const newStatus = event.status === 'Completed' ? 'Not Started' : 'Completed';
                                setEvents(events.map(e => e.id === event.id ? { ...e, status: newStatus } : e));
                              }}
                              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${event.status === 'Completed' ? 'bg-stone-900 border-stone-900 text-white' : 'border-stone-200 hover:border-stone-400'}`}
                            >
                              {event.status === 'Completed' && <Check className="w-4 h-4" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <h3 className={`text-sm font-medium truncate ${event.status === 'Completed' ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
                                {event.title}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600`}>
                                  {event.type}
                                </span>
                                {event.courseName && (
                                  <span className="text-[8px] font-bold text-stone-400 uppercase tracking-widest">
                                    {event.courseName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => setView('calendar')}
                            className="opacity-0 group-hover:opacity-100 p-2 text-stone-300 hover:text-stone-900 transition-all"
                            title="View in Calendar"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </>
                  );
                })()}

                {dailyGoals.length === 0 && events.filter(e => e.date === new Date().toISOString().split('T')[0]).length === 0 && !isGeneratingGoals && (
                  <div className="text-center py-8 bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200">
                    <p className="text-xs text-stone-400 font-medium">No goals set for today.</p>
                    <button 
                      onClick={generateDailyGoals}
                      className="mt-2 text-xs font-bold text-stone-900 underline"
                    >
                      Generate with AI
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section className="px-6 mt-10">
              <PerformanceTracker 
                courses={enrichedCourses} 
                studyLogs={studyLogs}
                flashcards={flashcards}
                evaluations={evaluations}
                quizQuestions={quizQuestions}
                examSimulations={examSimulations}
                setView={setView}
              />
            </section>

            <section className="mt-10 overflow-hidden">
              <div className="px-6 flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-stone-900 tracking-tight">Your Courses</h2>
                <button 
                  onClick={() => setView('courses')}
                  className="text-xs font-bold text-stone-400 hover:text-stone-900 transition-all bg-stone-100 px-3 py-1.5 rounded-full"
                >
                  Manage All
                </button>
              </div>
              <CourseCarousel 
                courses={enrichedCourses} 
                onCourseTap={openWorkspace} 
              />
            </section>

            <section className="px-6 mt-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Weekly Exam Simulation</h2>
                  <p className="text-sm text-stone-500 mt-1">Master your exams with scheduled practice</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative group">
                    <button 
                      onClick={() => {
                        console.log("Opening Add Simulation Modal");
                        setIsAddingSimulation(true);
                      }}
                      disabled={courses.filter(c => c.type === 'Exam').length === 0}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-2xl text-xs font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      Add Simulation
                    </button>
                    {courses.filter(c => c.type === 'Exam').length === 0 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-stone-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Add an Exam course first
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={generateWeeklyPlanWithAI}
                    disabled={isGeneratingWeeklyPlan || courses.filter(c => c.type === 'Exam').length === 0}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-2xl text-xs font-bold hover:bg-stone-50 transition-all shadow-sm disabled:opacity-50"
                  >
                    {isGeneratingWeeklyPlan ? (
                      <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-amber-500" />
                    )}
                    AI Plan
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {weeklySimulations.length > 0 ? (
                  weeklySimulations.map((sim) => {
                    const colorClass = getCourseColor(sim.courseName);
                    return (
                      <motion.div 
                        key={sim.id}
                        whileHover={{ y: -4, shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          const course = courses.find(c => c.id === sim.courseId);
                          if (course) openWorkspace(course);
                        }}
                        className="bg-white border border-stone-100 rounded-[2.5rem] p-6 shadow-sm transition-all cursor-pointer group relative overflow-visible flex flex-col justify-center min-h-[140px]"
                      >
                        {/* Decorative background element */}
                        <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 blur-2xl ${colorClass.split(' ')[0]}`} />

                        <div className="absolute top-6 right-6 z-20">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSimMenuId(activeSimMenuId === sim.id ? null : sim.id);
                            }}
                            className="p-2 text-stone-300 hover:text-stone-900 transition-all rounded-full hover:bg-stone-50"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          
                          <AnimatePresence>
                            {activeSimMenuId === sim.id && (
                              <>
                                <div 
                                  className="fixed inset-0 z-10" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveSimMenuId(null);
                                  }}
                                />
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                  className="absolute right-0 mt-2 w-32 bg-white rounded-2xl shadow-xl border border-stone-100 py-2 z-20"
                                >
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteSimulation(sim.id);
                                      setActiveSimMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm font-bold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${colorClass}`}>
                              <Timer className="w-7 h-7" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-stone-900 leading-tight group-hover:text-stone-700 transition-colors">{sim.courseName}</h3>
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex items-center gap-1 text-stone-500">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span className="text-xs font-semibold uppercase tracking-wider">{sim.day}</span>
                                </div>
                                <span className="text-stone-300">•</span>
                                <div className="flex items-center gap-1 text-stone-500">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span className="text-xs font-bold">{sim.time || '10:00'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="w-12 h-12 bg-stone-900 text-white rounded-2xl flex items-center justify-center shadow-md shadow-stone-100 group-hover:bg-stone-800 transition-all shrink-0">
                            <Play className="w-5 h-5 fill-current" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="md:col-span-2 bg-stone-50 rounded-[2.5rem] p-12 text-center border border-dashed border-stone-200">
                    <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm mx-auto mb-6">
                      <Calendar className="w-8 h-8 text-stone-300" />
                    </div>
                    <h3 className="text-lg font-bold text-stone-900">No simulations scheduled yet</h3>
                    <p className="text-sm text-stone-500 mt-2 max-w-[280px] mx-auto">
                      Schedule practice sessions manually or use AI to generate a balanced weekly plan.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
                      <button 
                        onClick={() => setIsAddingSimulation(true)}
                        disabled={courses.filter(c => c.type === 'Exam').length === 0}
                        className="w-full sm:w-auto px-6 py-3 bg-stone-900 text-white rounded-2xl text-sm font-bold hover:bg-stone-800 transition-all disabled:opacity-50"
                      >
                        Add Simulation
                      </button>
                      <button 
                        onClick={generateWeeklyPlanWithAI}
                        disabled={isGeneratingWeeklyPlan || courses.filter(c => c.type === 'Exam').length === 0}
                        className="w-full sm:w-auto px-6 py-3 bg-white border border-stone-200 text-stone-700 rounded-2xl text-sm font-bold hover:bg-stone-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        Generate Weekly Plan with AI
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </motion.div>
        )}

        {view === 'calendar' && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <StudyCalendar 
              timetable={timetable}
              setTimetable={setTimetable}
              tasks={tasks}
              setTasks={setTasks}
              insights={insights}
              setInsights={setInsights}
              projectTasks={projectTasks}
              projectMilestones={projectMilestones}
              semesterStart={semesterStart}
              setSemesterStart={setSemesterStart}
              semesterEnd={semesterEnd}
              setSemesterEnd={setSemesterEnd}
              setView={setView}
              courses={courses}
              studyLogs={studyLogs}
              user={user}
              googleConnected={googleDriveConnected}
              onConnectGoogle={connectGoogleDrive}
              onSyncToGoogleCalendar={handleSyncToGoogleCalendar}
            />
          </motion.div>
        )}

        {view === 'study-timer' && (
          <motion.div
            key="study-timer"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <StudyTimer 
              courses={enrichedCourses} 
              logs={studyLogs}
              onSaveLog={async (log) => {
                if (user) {
                  await api.saveStudyLog(user.uid, log);
                  setStudyLogs(prev => [log, ...prev]);
                }
              }}
            />
          </motion.div>
        )}

        {view === 'progress' && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <ProgressTracking 
              courses={enrichedCourses}
              studyLogs={studyLogs}
              flashcards={globalFlashcards}
              examSimulations={globalSimulations}
              tasks={tasks}
              projectTasks={projectTasks}
              projectMilestones={projectMilestones}
              onBack={() => setView('home')}
            />
          </motion.div>
        )}

        {view === 'courses' && (
          <motion.div 
            key="courses"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="px-6 pt-12"
          >
            {/* Courses Screen Content */}
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-stone-900">Courses</h1>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-stone-900 text-white px-4 py-2 rounded-2xl text-sm font-medium flex items-center gap-2 hover:bg-stone-800 active:scale-95 transition-all shadow-lg shadow-stone-200"
              >
                <Plus className="w-4 h-4" />
                Add Course
              </button>
            </div>

            <div className="space-y-4">
              {enrichedCourses.map((course, index) => (
                <motion.div 
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white border border-stone-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                  onClick={() => openWorkspace(course)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl ${course.color} flex items-center justify-center`}>
                        {course.type === 'Exam' ? (
                          <FileText className="w-6 h-6 text-stone-700" />
                        ) : (
                          <Briefcase className="w-6 h-6 text-stone-700" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-stone-900 group-hover:text-stone-700 transition-colors">{course.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${course.type === 'Exam' ? 'bg-stone-100 text-stone-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            {course.type}
                          </span>
                          <span className="text-[10px] text-stone-400 font-medium uppercase tracking-widest">
                            Last studied: {course.lastStudied}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCourse(course.id);
                      }}
                      className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Delete Course"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-stone-50 rounded-2xl p-3 flex items-center gap-3">
                      <Layers className="w-4 h-4 text-stone-400" />
                      <div>
                        <p className="text-sm font-bold text-stone-900">{course.flashcardsCount}</p>
                        <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">Flashcards</p>
                      </div>
                    </div>
                    <div className="bg-stone-50 rounded-2xl p-3 flex items-center gap-3">
                      <FileUp className="w-4 h-4 text-stone-400" />
                      <div>
                        <p className="text-sm font-bold text-stone-900">{course.lecturesCount} PDFs</p>
                        <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">Lectures</p>
                      </div>
                    </div>
                  </div>

                  {/* Subtle arrow indicator */}
                  <div className="absolute right-6 bottom-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-5 h-5 text-stone-400" />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {view === 'workspace' && selectedCourse && (
          <motion.div 
            key="workspace"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="px-6 pt-12"
          >
            {selectedCourse.type === 'Project' ? (
              <ProjectWorkspace 
                course={selectedCourse} 
                onBack={() => setView('courses')} 
                openTool={openTool} 
              />
            ) : (
              <>
                {/* Workspace Screen Content */}
                <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={() => setView('courses')}
                className="p-2 bg-white border border-stone-100 rounded-xl text-stone-400 hover:text-stone-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">{selectedCourse.name}</h1>
            </div>

            {/* Course Metadata Header */}
            <div className="bg-white border border-stone-100 rounded-[2rem] p-6 mb-8 shadow-sm">
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Type</p>
                  <div className="flex items-center gap-2">
                    {selectedCourse.type === 'Exam' ? <FileText className="w-4 h-4 text-stone-600" /> : <Briefcase className="w-4 h-4 text-stone-600" />}
                    <span className="text-sm font-bold text-stone-900">{selectedCourse.type} Course</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Flashcards</p>
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-stone-600" />
                    <span className="text-sm font-bold text-stone-900">{selectedCourse.flashcardsCount} Available</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Lectures</p>
                  <div className="flex items-center gap-2">
                    <FileUp className="w-4 h-4 text-stone-600" />
                    <span className="text-sm font-bold text-stone-900">{selectedCourse.lecturesCount} Uploaded</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Last Studied</p>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-stone-600" />
                    <span className="text-sm font-bold text-stone-900">{selectedCourse.lastStudied}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Course Tools */}
            <div className="space-y-4 pb-32">
              {WORKSPACE_TOOLS.map((tool, index) => (
                <motion.div 
                  key={tool.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white border border-stone-100 rounded-[2rem] p-6 flex items-start gap-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => openTool(tool.id)}
                >
                  <div className={`w-14 h-14 rounded-2xl ${tool.color} flex items-center justify-center flex-shrink-0`}>
                    {tool.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-lg font-bold text-stone-900 group-hover:text-stone-700 transition-colors">{tool.title}</h3>
                      <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-500 transition-colors" />
                    </div>
                    <p className="text-xs text-stone-500 leading-relaxed">{tool.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}

            {/* Floating Study Session Button */}
            <div className="fixed bottom-24 left-0 right-0 px-6 pointer-events-none">
              <div className="max-w-md mx-auto relative pointer-events-auto">
                <AnimatePresence>
                  {isStudyMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 20, scale: 0.9 }}
                      className="absolute bottom-full left-0 right-0 mb-4 bg-white border border-stone-100 rounded-[2.5rem] p-4 shadow-2xl overflow-hidden"
                    >
                      <div className="space-y-2">
                        <button 
                          onClick={() => { setView('study-timer'); setIsStudyMenuOpen(false); }}
                          className="w-full p-4 rounded-2xl hover:bg-emerald-50 flex items-center gap-4 transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <Timer className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-bold text-stone-800 group-hover:text-emerald-700">Start Focus Timer</span>
                        </button>
                        <button 
                          onClick={() => { setView('flashcards'); setIsStudyMenuOpen(false); }}
                          className="w-full p-4 rounded-2xl hover:bg-orange-50 flex items-center gap-4 transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                            <Layers className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-bold text-stone-800 group-hover:text-orange-700">Study Flashcards</span>
                        </button>
                        <button 
                          onClick={() => { setView('quiz-practice'); setIsStudyMenuOpen(false); }}
                          className="w-full p-4 rounded-2xl hover:bg-yellow-50 flex items-center gap-4 transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center text-yellow-600">
                            <Zap className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-bold text-stone-800 group-hover:text-yellow-700">Take Quiz</span>
                        </button>
                        <button 
                          onClick={() => { setView('exam-simulation'); setIsStudyMenuOpen(false); }}
                          className="w-full p-4 rounded-2xl hover:bg-red-50 flex items-center gap-4 transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                            <Clock className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-bold text-stone-800 group-hover:text-red-700">Run Exam Simulation</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button 
                  onClick={() => setIsStudyMenuOpen(!isStudyMenuOpen)}
                  className="w-full py-5 bg-stone-900 text-white rounded-[2rem] font-bold text-lg flex items-center justify-center gap-3 hover:bg-stone-800 active:scale-[0.98] transition-all shadow-2xl shadow-stone-300"
                >
                  <Sparkles className="w-6 h-6 text-yellow-400" />
                  Start Study Session
                  {isStudyMenuOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'exam-simulation' && selectedCourse && (
          <ExamSimulation 
            course={selectedCourse} 
            onBack={() => setView('workspace')} 
            questions={examQuestions.filter(q => q.courseId === selectedCourse.id)}
            professorStyle={examStyle}
            onUpdateProfessorStyle={setExamStyle}
            onFinish={() => updateSimulationStatus(selectedCourse.id, 'Completed')}
            onDeleteQuestion={deleteExamQuestion}
            onStudyComplete={handleStudyComplete}
            onAddQuestions={(newQs) => {
              setExamQuestions(prev => [...prev, ...newQs]);
              if (user) {
                newQs.forEach(q => api.saveExamQuestion(user.uid, q));
              }
            }}
            user={user}
            lectureFiles={lectureFiles}
            pastQuestions={pastQuestions}
            fetchAsBase64={fetchAsBase64}
          />
        )}

        {view === 'lecture-materials' && selectedCourse && (
          <motion.div 
            key="lecture-materials"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="px-6 pt-12"
          >
            <div className="flex items-center gap-4 mb-6">
              <button 
                onClick={() => setView('workspace')}
                className="p-2 bg-white border border-stone-100 rounded-xl text-stone-400 hover:text-stone-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-stone-900">{selectedCourse.name}</h1>
                <div className="flex gap-3 mt-1">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Lectures: {selectedCourse.lecturesCount}</span>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Flashcards: {selectedCourse.flashcardsCount}</span>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Questions: {selectedCourse.quizQuestionsCount}</span>
                </div>
              </div>
            </div>

            <div className="space-y-8 pb-32">
              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100 mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${googleDriveConnected ? 'bg-green-50 text-green-600' : 'bg-stone-100 text-stone-400'}`}>
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Google Drive Storage</h4>
                    {googleSecretsMissing ? (
                      <button 
                        onClick={() => setIsGoogleHelpOpen(true)}
                        className="flex items-center gap-1 text-[8px] text-red-500 font-bold uppercase tracking-tighter hover:underline"
                      >
                        <AlertCircle className="w-2 h-2" />
                        Setup Required
                      </button>
                    ) : (
                      <button 
                        onClick={() => setIsGoogleHelpOpen(true)}
                        className="flex items-center gap-1 text-[8px] text-stone-400 font-bold uppercase tracking-tighter hover:text-stone-900"
                      >
                        <Settings2 className="w-2 h-2" />
                        Config Help
                      </button>
                    )}
                    <p className="text-[10px] text-stone-500 font-medium uppercase tracking-widest">
                      {googleDriveConnected ? 'Connected' : 'Not Connected'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {googleDriveConnected ? (
                    <>
                      <button 
                        onClick={() => setUseGoogleDrive(!useGoogleDrive)}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${useGoogleDrive ? 'bg-stone-900' : 'bg-stone-200'}`}
                        title={useGoogleDrive ? "Using Google Drive" : "Using Firebase Storage"}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${useGoogleDrive ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                      <button 
                        onClick={disconnectGoogleDrive}
                        className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                        title="Disconnect Google Drive"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={connectGoogleDrive}
                      disabled={isConnectingDrive}
                      className="px-4 py-2 bg-stone-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50"
                    >
                      {isConnectingDrive ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-stone-900">Lecture File Storage</h2>
                  <div className="flex gap-2">
                    {googleDriveConnected && (
                      <button 
                        onClick={() => openGooglePicker('lecture')}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all"
                      >
                        <Cloud className="w-4 h-4" />
                        Select from Drive
                      </button>
                    )}
                    <label className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Upload Lecture File
                      <input 
                        type="file" 
                        className="hidden" 
                        multiple 
                        accept=".pdf,.ppt,.pptx,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload(e, 'lecture')}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  {lectureFiles.filter(f => f.courseId === selectedCourse.id).map((file) => (
                    <div 
                      key={file.id} 
                      onClick={() => setPreviewFile({ name: file.name, url: file.fileUrl || '', type: file.fileType || 'pdf' })}
                      className="bg-white border border-stone-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm group hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-stone-50 flex items-center justify-center text-stone-400 group-hover:text-stone-600 transition-colors">
                        {file.fileType?.startsWith('image') ? <Upload className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-stone-900 truncate">{file.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-stone-400 font-medium">Uploaded {file.uploadDate}</span>
                          <span className="text-[10px] text-stone-400 font-medium">•</span>
                          <span className="text-[10px] text-stone-400 font-medium uppercase">{file.fileType?.split('/').pop() || 'PDF'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLectureFile(file.id);
                          }}
                          className="p-2 text-stone-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          title="Delete File"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-stone-200 group-hover:text-stone-400 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-stone-900">Diagrams & Visuals</h2>
                  <label className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-200 transition-all cursor-pointer">
                    <Plus className="w-4 h-4" />
                    Add Diagram
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'lecture')}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {lectureFiles.filter(f => f.courseId === selectedCourse.id && f.fileType?.startsWith('image')).length > 0 ? (
                    lectureFiles.filter(f => f.courseId === selectedCourse.id && f.fileType?.startsWith('image')).map(file => (
                      <div 
                        key={file.id} 
                        onClick={() => setPreviewFile({ name: file.name, url: file.fileUrl || '', type: file.fileType || 'image/png' })}
                        className="aspect-square bg-white border border-stone-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer relative group"
                      >
                        <img src={file.fileUrl} alt={file.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                          <Eye className="w-6 h-6 text-white" />
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteLectureFile(file.id);
                            }}
                            className="p-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all"
                            title="Delete Diagram"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 py-8 text-center bg-stone-50 rounded-3xl border border-dashed border-stone-200">
                      <p className="text-xs text-stone-400">No diagrams uploaded yet.</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="bg-orange-50 rounded-[2rem] p-8 border border-orange-100">
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="w-6 h-6 text-orange-500" />
                  <h2 className="text-lg font-bold text-stone-900">AI Study Generator</h2>
                </div>
                <p className="text-sm text-stone-600 leading-relaxed mb-6">
                  Our AI can analyze your lecture materials to generate flashcards and quiz questions that match your professor's style.
                </p>
                <button 
                  onClick={() => setGenerationOptionsOpen(true)}
                  className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
                >
                  Generate Study Materials
                </button>
              </section>
            </div>
          </motion.div>
        )}

        {view === 'past-exams' && selectedCourse && (
          <motion.div 
            key="past-exams"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="px-6 pt-12"
          >
            <div className="flex items-center gap-4 mb-6">
              <button 
                onClick={() => setView('workspace')}
                className="p-2 bg-white border border-stone-100 rounded-xl text-stone-400 hover:text-stone-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-stone-900">Past Exams</h1>
                <p className="text-xs text-stone-500 mt-1">{selectedCourse.name}</p>
              </div>
            </div>

            <div className="space-y-8 pb-32">
              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100 mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${googleDriveConnected ? 'bg-green-50 text-green-600' : 'bg-stone-100 text-stone-400'}`}>
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Google Drive Storage</h4>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-stone-500 font-medium uppercase tracking-widest">
                        {googleDriveConnected ? 'Connected' : 'Not Connected'}
                      </p>
                      {googleSecretsMissing ? (
                        <button 
                          onClick={() => setIsGoogleHelpOpen(true)}
                          className="flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-600 rounded-md text-[8px] font-bold uppercase tracking-tighter hover:bg-red-100 transition-colors"
                        >
                          <AlertCircle className="w-2 h-2" />
                          Setup Required
                        </button>
                      ) : (
                        <button 
                          onClick={() => setIsGoogleHelpOpen(true)}
                          className="flex items-center gap-1 px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded-md text-[8px] font-bold uppercase tracking-tighter hover:bg-stone-200 transition-colors"
                        >
                          <Settings2 className="w-2 h-2" />
                          Config Help
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {googleDriveConnected ? (
                    <>
                      <button 
                        onClick={() => setUseGoogleDrive(!useGoogleDrive)}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${useGoogleDrive ? 'bg-stone-900' : 'bg-stone-200'}`}
                        title={useGoogleDrive ? "Using Google Drive" : "Using Firebase Storage"}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${useGoogleDrive ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                      <button 
                        onClick={disconnectGoogleDrive}
                        className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                        title="Disconnect Google Drive"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={connectGoogleDrive}
                      disabled={isConnectingDrive}
                      className="px-4 py-2 bg-stone-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50"
                    >
                      {isConnectingDrive ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-stone-900">Exam Repository</h2>
                  <div className="flex gap-2">
                    {googleDriveConnected && (
                      <button 
                        onClick={() => openGooglePicker('exam')}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all"
                      >
                        <Cloud className="w-4 h-4" />
                        Select from Drive
                      </button>
                    )}
                    <label className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Upload Past Exam
                      <input 
                        type="file" 
                        className="hidden" 
                        multiple 
                        accept=".pdf,.ppt,.pptx,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload(e, 'exam')}
                      />
                    </label>
                    <button 
                      onClick={() => setIsPastQuestionModalOpen(true)}
                      className="p-2 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {pastQuestions.filter(pq => pq.courseId === selectedCourse.id).length > 0 ? (
                    pastQuestions.filter(pq => pq.courseId === selectedCourse.id).map((pq) => (
                      <div 
                        key={pq.id} 
                        className="bg-white border border-stone-100 rounded-2xl p-5 flex items-center justify-between shadow-sm group hover:shadow-md transition-all cursor-pointer"
                        onClick={() => {
                          if (pq.fileUrl) {
                            setPreviewFile({ name: pq.title, url: pq.fileUrl, type: pq.fileType || 'pdf' });
                          } else {
                            setSelectedPQ(pq);
                          }
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover:text-stone-900 transition-colors">
                            {pq.fileType?.startsWith('image') ? <Upload className="w-6 h-6" /> : <History className="w-6 h-6" />}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-stone-900">{pq.title}</h3>
                            <p className="text-[10px] text-stone-400 font-medium uppercase tracking-widest">
                              {pq.fileUrl ? `Uploaded ${new Date(pq.uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : `${pq.year} • ${pq.semester} Semester`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePastQuestion(pq.id);
                            }}
                            className="p-2 text-stone-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            title="Delete Past Exam"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-900 transition-colors" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-stone-50 border-2 border-dashed border-stone-200 rounded-3xl p-12 text-center">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <History className="w-8 h-8 text-stone-300" />
                      </div>
                      <h3 className="text-sm font-bold text-stone-900 mb-1">No Past Exams Yet</h3>
                      <p className="text-xs text-stone-500 max-w-[200px] mx-auto">Upload past exam papers to help AI generate better practice questions.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Past Question Detail Modal */}
            <AnimatePresence>
              {selectedPQ && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedPQ(null)}
                    className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative w-full max-w-lg bg-white rounded-[2.5rem] flex flex-col max-h-[80vh] shadow-2xl overflow-hidden"
                  >
                    <div className="p-8 border-b border-stone-100">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h2 className="text-2xl font-bold text-stone-900">{selectedPQ.title}</h2>
                          <p className="text-xs text-stone-500 mt-1">{selectedPQ.year} • {selectedPQ.semester} Semester</p>
                        </div>
                        <button onClick={() => setSelectedPQ(null)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                          <X className="w-6 h-6 text-stone-400" />
                        </button>
                      </div>
                    </div>
                    <div className="p-8 overflow-y-auto flex-1 bg-stone-50/50">
                      <div className="bg-white border border-stone-100 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-stone-400">
                          <FileText className="w-4 h-4" />
                          <h4 className="text-[10px] font-bold uppercase tracking-widest">Exam Content</h4>
                        </div>
                        <div className="prose prose-stone prose-sm max-w-none">
                          <pre className="whitespace-pre-wrap font-sans text-stone-700 leading-relaxed">
                            {selectedPQ.content || "No content available for this exam."}
                          </pre>
                        </div>
                      </div>
                    </div>
                    <div className="p-8 border-t border-stone-100 bg-white">
                      <button 
                        onClick={() => { 
                          setGenerationOptionsOpen(true);
                          setSelectedPQ(null); 
                        }}
                        className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
                      >
                        <Zap className="w-4 h-4" />
                        Generate Quiz from this Exam
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Upload Modal */}
            <AnimatePresence>
              {isPastQuestionModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsPastQuestionModalOpen(false)}
                    className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
                  >
                    <div className="flex justify-between items-center mb-8">
                      <h2 className="text-2xl font-bold text-stone-900">Upload Past Exam</h2>
                      <button onClick={() => setIsPastQuestionModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-stone-400" />
                      </button>
                    </div>

                    <form onSubmit={handleAddPastQuestion} className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Exam Title</label>
                        <input 
                          type="text"
                          value={newPQTitle}
                          onChange={(e) => setNewPQTitle(e.target.value)}
                          placeholder="e.g., Final Exam 2024"
                          className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all"
                          required
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Year</label>
                          <input 
                            type="text"
                            value={newPQYear}
                            onChange={(e) => setNewPQYear(e.target.value)}
                            placeholder="2024"
                            className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Semester</label>
                          <select 
                            value={newPQSemester}
                            onChange={(e) => setNewPQSemester(e.target.value)}
                            className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all"
                          >
                            <option value="Spring">Spring</option>
                            <option value="Fall">Fall</option>
                            <option value="Summer">Summer</option>
                            <option value="Winter">Winter</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Exam Content (Text)</label>
                        <textarea 
                          value={newPQContent}
                          onChange={(e) => setNewPQContent(e.target.value)}
                          placeholder="Paste the exam questions here..."
                          className="w-full h-32 bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all resize-none"
                        />
                      </div>

                      <div className="relative p-6 border-2 border-dashed border-stone-200 rounded-2xl text-center group hover:border-stone-900 transition-all cursor-pointer">
                        <input 
                          type="file" 
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                          accept=".pdf,.ppt,.pptx,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            handleFileUpload(e, 'exam');
                            setIsPastQuestionModalOpen(false);
                          }}
                        />
                        <Upload className="w-8 h-8 text-stone-300 mx-auto mb-2 group-hover:text-stone-900 transition-colors" />
                        <p className="text-xs text-stone-500 group-hover:text-stone-900 transition-colors font-medium">Tap to select or drag and drop file</p>
                        <p className="text-[10px] text-stone-400 mt-1">PDF, PPT, Images supported</p>
                      </div>

                      <div className="relative py-4 flex items-center gap-4">
                        <div className="flex-1 h-px bg-stone-100" />
                        <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">Or</span>
                        <div className="flex-1 h-px bg-stone-100" />
                      </div>

                      <button 
                        type="submit"
                        className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-stone-800 active:scale-[0.98] transition-all shadow-xl shadow-stone-200"
                      >
                        Save Text Exam
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {view === 'project-notes' && selectedCourse && (
          <motion.div
            key="project-notes"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <ProjectNotesView 
              course={selectedCourse}
              onBack={() => setView('workspace')}
              notes={projectNotes}
              onAddNote={(note) => {
                if (!user) return;
                const noteWithUid = { ...note, uid: user.uid };
                setProjectNotes(prev => [noteWithUid, ...prev]);
                api.saveProjectNote(user.uid, noteWithUid);
              }}
              onUpdateNote={(note) => {
                if (!user) return;
                const noteWithUid = { ...note, uid: user.uid };
                setProjectNotes(prev => prev.map(n => n.id === note.id ? noteWithUid : n));
                api.saveProjectNote(user.uid, noteWithUid);
              }}
              onDeleteNote={(id) => {
                setProjectNotes(prev => prev.filter(n => n.id !== id));
                if (user) api.deleteProjectNote(user.uid, id);
              }}
            />
          </motion.div>
        )}

        {view === 'project-tasks' && selectedCourse && (
          <motion.div
            key="project-tasks"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <ProjectTasksView 
              course={selectedCourse}
              onBack={() => setView('workspace')}
              tasks={projectTasks}
              onAddTask={(task) => {
                if (!user) return;
                const taskWithUid = { ...task, uid: user.uid };
                setProjectTasks(prev => [taskWithUid, ...prev]);
                api.saveProjectTask(user.uid, taskWithUid);
              }}
              onUpdateTask={(task) => {
                if (!user) return;
                const taskWithUid = { ...task, uid: user.uid };
                setProjectTasks(prev => prev.map(t => t.id === task.id ? taskWithUid : t));
                api.saveProjectTask(user.uid, taskWithUid);
              }}
              onDeleteTask={(id) => {
                setProjectTasks(prev => prev.filter(t => t.id !== id));
                if (user) api.deleteProjectTask(user.uid, id);
              }}
              googleConnected={googleDriveConnected}
              onConnectGoogle={connectGoogleDrive}
              onSyncToGoogleCalendar={handleSyncToGoogleCalendar}
            />
          </motion.div>
        )}

        {view === 'project-milestones' && selectedCourse && (
          <motion.div
            key="project-milestones"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <ProjectMilestonesView 
              course={selectedCourse}
              onBack={() => setView('workspace')}
              milestones={projectMilestones}
              onAddMilestone={(milestone) => {
                if (!user) return;
                const milestoneWithUid = { ...milestone, uid: user.uid };
                setProjectMilestones(prev => [milestoneWithUid, ...prev]);
                api.saveProjectMilestone(user.uid, milestoneWithUid);
              }}
              onUpdateMilestone={(milestone) => {
                if (!user) return;
                const milestoneWithUid = { ...milestone, uid: user.uid };
                setProjectMilestones(prev => prev.map(m => m.id === milestone.id ? milestoneWithUid : m));
                api.saveProjectMilestone(user.uid, milestoneWithUid);
              }}
              onDeleteMilestone={(id) => {
                setProjectMilestones(prev => prev.filter(m => m.id !== id));
                if (user) api.deleteProjectMilestone(user.uid, id);
              }}
              googleConnected={googleDriveConnected}
              onConnectGoogle={connectGoogleDrive}
              onSyncToGoogleCalendar={handleSyncToGoogleCalendar}
            />
          </motion.div>
        )}

        {view === 'project-insights' && selectedCourse && (
          <motion.div
            key="project-insights"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <ProjectInsightsView 
              course={selectedCourse}
              onBack={() => setView('workspace')}
              insights={projectInsights}
              onAddInsight={(insight) => {
                if (!user) return;
                const insightWithUid = { ...insight, uid: user.uid };
                setProjectInsights(prev => [insightWithUid, ...prev]);
                api.saveProjectInsight(user.uid, insightWithUid);
              }}
              onDeleteInsight={(id) => {
                setProjectInsights(prev => prev.filter(i => i.id !== id));
                if (user) api.deleteProjectInsight(user.uid, id);
              }}
            />
          </motion.div>
        )}

        {view === 'flashcards' && selectedCourse && (
          <motion.div 
            key="flashcards"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="px-6 pt-12"
          >
            {/* Flashcards Header */}
            <div className="flex items-center gap-4 mb-6">
              <button 
                onClick={() => {
                  if (studySessionStartTime) {
                    const duration = Math.round((Date.now() - studySessionStartTime) / 60000);
                    handleStudyComplete(duration);
                  }
                  setView('workspace');
                  setIsStudySessionActive(false);
                }}
                className="p-2 bg-white border border-stone-100 rounded-xl text-stone-400 hover:text-stone-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-stone-900">{selectedCourse.name}</h1>
                <div className="flex gap-3 mt-1">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total: {flashcards.filter(f => f.courseId === selectedCourse.id).length}</span>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Studied Today: 32</span>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Accuracy: 78%</span>
                </div>
              </div>
            </div>

            {!isStudySessionActive ? (
              <div className="space-y-8 pb-32">
                {/* Management Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-stone-900">Manage Flashcards</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        setPendingFlashcardAction({ type: 'AI' });
                        setIsTopicModalOpen(true);
                      }}
                      className="bg-white border border-stone-100 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 group-hover:text-stone-900">Generate AI</span>
                    </button>
                    <button 
                      onClick={() => {
                        setPendingFlashcardAction({ type: 'Import' });
                        setIsTopicModalOpen(true);
                      }}
                      className="bg-white border border-stone-100 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <FileUp className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 group-hover:text-stone-900">Import Cards</span>
                    </button>
                    <button 
                      onClick={() => {
                        setPendingFlashcardAction({ type: 'Manual' });
                        setIsTopicModalOpen(true);
                      }}
                      className="bg-white border border-stone-100 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 group-hover:text-stone-900">Manual Add</span>
                    </button>
                    <button className="bg-white border border-stone-100 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-all group">
                      <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-600">
                        <History className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 group-hover:text-stone-900">History</span>
                    </button>
                  </div>
                </section>

                {/* Topic Filters */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-stone-900">Topics</h2>
                  </div>
                  <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2">
                    <button 
                      onClick={() => setSelectedTopicId('all')}
                      className={`flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${selectedTopicId === 'all' ? 'bg-stone-900 text-white' : 'bg-white border border-stone-100 text-stone-400 hover:text-stone-600'}`}
                    >
                      All Topics
                    </button>
                    {topics.map((topic) => (
                      <button 
                        key={topic.id}
                        onClick={() => setSelectedTopicId(topic.id)}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${selectedTopicId === topic.id ? 'bg-orange-500 text-white border-orange-500' : 'bg-white border border-stone-100 text-stone-400 hover:text-stone-600'}`}
                      >
                        {topic.name}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Search & Filters */}
                <section className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input 
                      type="text"
                      value={flashcardSearch}
                      onChange={(e) => setFlashcardSearch(e.target.value)}
                      placeholder="Search flashcards..."
                      className="w-full bg-white border border-stone-100 rounded-2xl pl-11 pr-4 py-3 text-sm text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-stone-900">Filter & Sort</h2>
                  </div>
                  <div className="space-y-3">
                    <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2">
                      {['All', 'Easy', 'Medium', 'Hard', 'AI', 'Imported', 'Manual'].map((filter) => (
                        <button 
                          key={filter}
                          onClick={() => setFlashcardFilter(filter as any)}
                          className={`flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${flashcardFilter === filter ? 'bg-stone-900 text-white' : 'bg-white border border-stone-100 text-stone-400 hover:text-stone-600'}`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Quick Study Mode */}
                <section className="space-y-4">
                  <button 
                    onClick={() => startStudySession(false)}
                    className="w-full py-6 bg-orange-500 text-white rounded-[2rem] font-bold text-lg flex items-center justify-center gap-4 hover:bg-orange-600 active:scale-[0.98] transition-all shadow-xl shadow-orange-200"
                  >
                    <Play className="w-6 h-6 fill-current" />
                    Start Quick Study
                  </button>
                  
                  <button 
                    onClick={() => startStudySession(true)}
                    className="w-full py-6 bg-white border-2 border-orange-500 text-orange-600 rounded-[2rem] font-bold text-lg flex items-center justify-center gap-4 hover:bg-orange-50 active:scale-[0.98] transition-all"
                  >
                    <Volume2 className="w-6 h-6" />
                    Start Audio Mode
                  </button>
                  <p className="text-center text-[10px] text-stone-400 uppercase tracking-widest font-bold">Hands-free review with TTS</p>
                </section>

                {/* Flashcard List Preview */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-stone-900">Your Cards</h2>
                    <div className="flex gap-2">
                      {isGroupingMode ? (
                        <>
                          <button 
                            onClick={() => {
                              setIsGroupingMode(false);
                              setGroupingTopicId(null);
                              setSelectedFlashcardIds([]);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-stone-100 text-stone-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-200 transition-all"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => {
                              if (groupingTopicId) groupSelectedFlashcards(groupingTopicId);
                            }}
                            disabled={selectedFlashcardIds.length === 0}
                            className="flex items-center gap-2 px-3 py-1.5 bg-stone-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50"
                          >
                            Confirm ({selectedFlashcardIds.length})
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => {
                              if (selectedFlashcardIds.length === filteredFlashcards.length && filteredFlashcards.length > 0) {
                                setSelectedFlashcardIds([]);
                              } else {
                                setSelectedFlashcardIds(filteredFlashcards.map(f => f.id));
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 text-stone-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-100 transition-all"
                          >
                            {selectedFlashcardIds.length === filteredFlashcards.length && filteredFlashcards.length > 0 ? 'Deselect All' : 'Select All'}
                          </button>
                          <button 
                            onClick={() => {
                              setPendingFlashcardAction({ type: 'Group' });
                              setIsTopicModalOpen(true);
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${selectedFlashcardIds.length > 0 ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-stone-50 text-stone-400 hover:text-stone-900'}`}
                          >
                            <Layers className="w-3.5 h-3.5" />
                            {selectedFlashcardIds.length > 0 ? `Group (${selectedFlashcardIds.length})` : 'Group Cards'}
                          </button>
                          {selectedFlashcardIds.length > 0 && (
                            <button 
                              onClick={deleteSelectedFlashcards}
                              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-100 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete ({selectedFlashcardIds.length})
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  {isGroupingMode && groupingTopicId && (
                    <div className="mb-6 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Grouping Mode</p>
                        <p className="text-sm font-bold text-orange-900">Selecting cards for: <span className="underline">{topics.find(t => t.id === groupingTopicId)?.name}</span></p>
                      </div>
                      <Layers className="w-6 h-6 text-orange-300" />
                    </div>
                  )}
                  
                  {/* Topic Filter */}
                  <div className="mb-6">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3 px-1">Topics</p>
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => setSelectedTopicId('all')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${selectedTopicId === 'all' ? 'bg-stone-900 text-white shadow-md' : 'bg-white border border-stone-100 text-stone-400 hover:text-stone-900'}`}
                      >
                        All Topics
                      </button>
                      {topics.map(topic => (
                        <button 
                          key={topic.id}
                          onClick={() => setSelectedTopicId(topic.id)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${selectedTopicId === topic.id ? 'bg-stone-900 text-white shadow-md' : 'bg-white border border-stone-100 text-stone-400 hover:text-stone-900'}`}
                        >
                          {topic.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {filteredFlashcards.length > 0 ? (
                      filteredFlashcards
                        .map((fc) => (
                          <div key={fc.id} className="bg-white border border-stone-100 rounded-2xl p-4 shadow-sm group flex gap-4 items-start">
                            <button 
                              onClick={() => {
                                setSelectedFlashcardIds(prev => 
                                  prev.includes(fc.id) ? prev.filter(id => id !== fc.id) : [...prev, fc.id]
                                );
                              }}
                              className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${selectedFlashcardIds.includes(fc.id) ? 'bg-stone-900 border-stone-900 text-white' : 'border-stone-200 hover:border-stone-400'}`}
                            >
                              {selectedFlashcardIds.includes(fc.id) && <Check className="w-3.5 h-3.5" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-2">
                                <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${fc.type === 'AI' ? 'bg-orange-50 text-orange-600' : fc.type === 'Imported' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                  {fc.type}
                                </span>
                                <div className="flex gap-2">
                                  {fc.topicId && (
                                    <span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                                      {topics.find(t => t.id === fc.topicId)?.name || 'Topic'}
                                    </span>
                                  )}
                                  {fc.difficulty !== 'None' && (
                                    <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${fc.difficulty === 'Easy' ? 'bg-green-50 text-green-600' : fc.difficulty === 'Medium' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>
                                      {fc.difficulty}
                                    </span>
                                  )}
                                  <button 
                                    onClick={() => deleteFlashcard(fc.id)}
                                    className="p-1 text-stone-200 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <h3 className="text-sm font-medium text-stone-800 line-clamp-2">{fc.question}</h3>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="bg-stone-50 border-2 border-dashed border-stone-200 rounded-3xl p-12 text-center">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                          <Layers className="w-8 h-8 text-stone-300" />
                        </div>
                        <h3 className="text-sm font-bold text-stone-900 mb-1">No Flashcards Yet</h3>
                        <p className="text-xs text-stone-500 max-w-[200px] mx-auto">Generate cards with AI or add them manually to start studying.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[70vh] pb-32 px-6">
                {/* Card Counter */}
                <div className="mb-6 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-1">
                    Card {currentCardIndex + 1} of {filteredFlashcards.length}
                  </span>
                  <div className="w-32 h-1 bg-stone-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-stone-900"
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentCardIndex + 1) / filteredFlashcards.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Study Session Mode */}
                <div className="w-full max-w-md relative">
                  <motion.div 
                    key={currentCardIndex}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -100 && currentCardIndex < filteredFlashcards.length - 1) {
                          setCurrentCardIndex(currentCardIndex + 1);
                          setIsCardFlipped(false);
                        } else if (info.offset.x > 100 && currentCardIndex > 0) {
                          setCurrentCardIndex(currentCardIndex - 1);
                          setIsCardFlipped(false);
                        }
                      }}
                    className="relative w-full h-[400px] cursor-pointer"
                    style={{ perspective: 1000 }}
                  >
                    <motion.div 
                      className="w-full h-full relative"
                      style={{ transformStyle: 'preserve-3d' }}
                      animate={{ rotateY: isCardFlipped ? 180 : 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                      onClick={() => setIsCardFlipped(!isCardFlipped)}
                    >
                      {/* Front Side */}
                      <div 
                        className="absolute inset-0 bg-white border border-stone-100 rounded-[3rem] p-10 flex flex-col shadow-2xl shadow-stone-200/50"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <div className="absolute top-8 left-0 right-0 flex justify-center z-10">
                          <span className="px-3 py-1 bg-stone-50 rounded-full text-[8px] font-bold text-stone-400 uppercase tracking-widest">Front</span>
                        </div>
                        <div className="w-full h-full overflow-y-auto mt-8 mb-12 scrollbar-hide flex flex-col">
                          <div className="my-auto py-8 w-full text-center">
                            <h3 className="text-2xl font-bold text-stone-900 leading-tight px-4">
                              {filteredFlashcards[currentCardIndex]?.question}
                            </h3>
                          </div>
                        </div>
                        <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-2 text-stone-300 z-10">
                          <div className="flex items-center gap-2">
                            <MousePointer2 className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Tap to Reveal</span>
                          </div>
                        </div>
                      </div>

                      {/* Back Side */}
                      <div 
                        className="absolute inset-0 bg-stone-900 border border-stone-800 rounded-[3rem] p-10 flex flex-col shadow-2xl"
                        style={{ 
                          backfaceVisibility: 'hidden', 
                          transform: 'rotateY(180deg)' 
                        }}
                      >
                        <div className="absolute top-8 left-0 right-0 flex justify-center z-10">
                          <span className="px-3 py-1 bg-stone-800 rounded-full text-[8px] font-bold text-stone-500 uppercase tracking-widest">Back</span>
                        </div>
                        <div className="w-full h-full overflow-y-auto mt-8 mb-12 scrollbar-hide flex flex-col">
                          <div className="my-auto py-8 w-full text-center">
                            <h3 className="text-2xl font-bold text-stone-100 leading-tight px-4">
                              {filteredFlashcards[currentCardIndex]?.answer}
                            </h3>
                          </div>
                        </div>
                        <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-2 text-stone-700 z-10">
                          <span className="text-[10px] font-bold uppercase tracking-widest">Tap to Flip Back</span>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                </div>

                {/* Controls */}
                {isAudioModeActive ? (
                  <AudioFlashcardPlayer 
                    flashcards={filteredFlashcards}
                    currentIndex={currentCardIndex}
                    onIndexChange={setCurrentCardIndex}
                    onClose={() => {
                      if (studySessionStartTime) {
                        const duration = Math.round((Date.now() - studySessionStartTime) / 60000);
                        handleStudyComplete(duration);
                      }
                      setIsAudioModeActive(false);
                      setIsStudySessionActive(false);
                    }}
                    isFlipped={isCardFlipped}
                    setIsFlipped={setIsCardFlipped}
                  />
                ) : (
                  <div className="mt-10 w-full max-w-md space-y-6">
                  {/* Reveal/Next Action */}
                  {!isCardFlipped ? (
                    <button 
                      onClick={() => setIsCardFlipped(true)}
                      className="w-full py-5 bg-stone-900 text-white rounded-[2rem] font-bold text-lg flex items-center justify-center gap-3 hover:bg-stone-800 active:scale-[0.98] transition-all shadow-xl shadow-stone-200"
                    >
                      <Eye className="w-5 h-5" />
                      Reveal Answer
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest text-center">Rate Difficulty</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Easy', color: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' },
                        { label: 'Medium', color: 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100' },
                        { label: 'Hard', color: 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100' },
                        { label: 'Repeat', color: 'bg-stone-50 text-stone-600 border-stone-100 hover:bg-stone-100' }
                      ].map((btn) => (
                        <button 
                          key={btn.label}
                          onClick={() => {
                            if (btn.label === 'Repeat') {
                              setIsCardFlipped(false);
                              return;
                            }
                            if (currentCardIndex < flashcards.length - 1) {
                              setCurrentCardIndex(currentCardIndex + 1);
                              setIsCardFlipped(false);
                            } else {
                              if (studySessionStartTime) {
                                const duration = Math.round((Date.now() - studySessionStartTime) / 60000);
                                handleStudyComplete(duration);
                              }
                              setIsStudySessionActive(false);
                            }
                          }}
                          className={`py-4 rounded-2xl border font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 ${btn.color}`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between gap-4 pt-4">
                    <button 
                      onClick={() => {
                        if (currentCardIndex > 0) {
                          setCurrentCardIndex(currentCardIndex - 1);
                          setIsCardFlipped(false);
                        }
                      }}
                      disabled={currentCardIndex === 0}
                      className="flex-1 py-4 bg-white border border-stone-100 rounded-2xl text-stone-400 font-bold text-[10px] uppercase tracking-widest hover:text-stone-900 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Previous
                    </button>
                    <button 
                      onClick={() => {
                        setCurrentCardIndex(0);
                        setIsCardFlipped(false);
                      }}
                      className="p-4 bg-white border border-stone-100 rounded-2xl text-stone-400 hover:text-stone-900 transition-all"
                      title="Restart Deck"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        if (currentCardIndex < filteredFlashcards.length - 1) {
                          setCurrentCardIndex(currentCardIndex + 1);
                          setIsCardFlipped(false);
                        } else {
                          if (studySessionStartTime) {
                            const duration = Math.round((Date.now() - studySessionStartTime) / 60000);
                            handleStudyComplete(duration);
                          }
                          setIsStudySessionActive(false);
                        }
                      }}
                      className="flex-1 py-4 bg-white border border-stone-100 rounded-2xl text-stone-400 font-bold text-[10px] uppercase tracking-widest hover:text-stone-900 transition-all flex items-center justify-center gap-2"
                    >
                      {currentCardIndex === filteredFlashcards.length - 1 ? 'Finish' : 'Next'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
                  
                  {/* Swipe Hint */}
                <p className="mt-8 text-[10px] text-stone-400 font-bold uppercase tracking-[0.2em]">
                  Swipe left for next • Swipe right for previous
                </p>
              </div>
            )}

            {/* Import Modal */}
            <AnimatePresence>
              {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsImportModalOpen(false)}
                    className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold text-stone-900">Import Flashcards</h2>
                      <button onClick={() => setIsImportModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-stone-400" />
                      </button>
                    </div>
                    <p className="text-xs text-stone-500 mb-4 leading-relaxed">Paste your flashcards below. Use the format:<br/><span className="font-mono font-bold">Q: Question text<br/>A: Answer text</span></p>
                    <textarea 
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="Q: What is overfitting?&#10;A: Overfitting occurs when..."
                      className="w-full h-48 bg-stone-50 border-none rounded-2xl p-4 text-sm text-stone-800 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all resize-none mb-6"
                    />
                    <div className="flex flex-col gap-3">
                      <button 
                        disabled={isImportingAI || !importText.trim()}
                        onClick={async () => {
                          if (!importText.trim()) return;
                          setIsImportingAI(true);
                          try {
                            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
                            
                            const prompt = `Extract flashcards from the following text. 
                            Return ONLY a JSON array of objects with "question" and "answer" properties.
                            Text: ${importText}`;

                            const response = await ai.models.generateContent({
                              model: "gemini-3-flash-preview",
                              contents: prompt,
                            });
                            const text = response.text;
                            
                            // Extract JSON from response
                            if (text) {
                              const jsonMatch = text.match(/\[.*\]/s);
                              if (jsonMatch) {
                                const parsedCards = JSON.parse(jsonMatch[0]);
                                const newCards: Flashcard[] = parsedCards.map((card: any) => ({
                                  id: Math.random().toString(36).substr(2, 9),
                                  courseId: selectedCourse.id,
                                  question: card.question,
                                  answer: card.answer,
                                  difficulty: 'None',
                                  type: 'AI',
                                  topicId: currentCreationTopicId || 'default',
                                  createdAt: new Date().toISOString()
                                }));

                                setFlashcards(prev => [...newCards, ...prev]);
                                if (user) {
                                  await Promise.all(newCards.map(card => api.saveFlashcard(user.uid, card)));
                                }
                                setImportText('');
                                setIsImportModalOpen(false);
                              } else {
                                throw new Error("Could not parse AI response");
                              }
                            } else {
                              throw new Error("Empty AI response");
                            }
                          } catch (error) {
                            console.error("Smart Import Error:", error);
                            alert("Failed to extract flashcards using AI. Please try the manual format (Q: A:).");
                          } finally {
                            setIsImportingAI(false);
                          }
                        }}
                        className="w-full py-4 bg-stone-900 text-white rounded-[1.5rem] font-bold text-sm flex items-center justify-center gap-3 hover:bg-stone-800 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {isImportingAI ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Sparkles className="w-5 h-5" />
                        )}
                        Smart Import (AI)
                      </button>

                      <button 
                        disabled={isImportingAI || !importText.trim()}
                        onClick={async () => {
                          if (!importText.trim()) return;
                          // Simple parser
                          const lines = importText.split('\n');
                          const newCards: Flashcard[] = [];
                          let currentQ = '';
                          let currentA = '';
                          lines.forEach(line => {
                            const trimmed = line.trim();
                            if (trimmed.startsWith('Q:')) currentQ = trimmed.replace('Q:', '').trim();
                            else if (trimmed.startsWith('A:')) {
                              currentA = trimmed.replace('A:', '').trim();
                              if (currentQ && currentA) {
                                newCards.push({
                                  id: Math.random().toString(36).substr(2, 9),
                                  courseId: selectedCourse.id,
                                  question: currentQ,
                                  answer: currentA,
                                  difficulty: 'None',
                                  type: 'Imported',
                                  topicId: currentCreationTopicId || 'default',
                                  createdAt: new Date().toISOString()
                                });
                                currentQ = '';
                                currentA = '';
                              }
                            }
                          });

                          if (newCards.length > 0) {
                            setFlashcards(prev => [...newCards, ...prev]);
                            if (user) {
                              for (const card of newCards) {
                                await api.saveFlashcard(user.uid, card);
                              }
                            }
                            setImportText('');
                            setIsImportModalOpen(false);
                          } else {
                            alert("No cards found. Please use the Q: Question A: Answer format.");
                          }
                        }}
                        className="w-full py-4 bg-white border-2 border-stone-900 text-stone-900 rounded-[1.5rem] font-bold text-sm flex items-center justify-center gap-3 hover:bg-stone-50 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        <Check className="w-5 h-5" />
                        Manual Import (Q: A:)
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Manual Add Modal */}
            <AnimatePresence>
              {isManualModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsManualModalOpen(false)}
                    className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold text-stone-900">Create Flashcard</h2>
                      <button onClick={() => setIsManualModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-stone-400" />
                      </button>
                    </div>
                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Question</label>
                        <input 
                          type="text" 
                          value={manualQuestion}
                          onChange={(e) => setManualQuestion(e.target.value)}
                          placeholder="Enter question..."
                          className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Answer</label>
                        <textarea 
                          value={manualAnswer}
                          onChange={(e) => setManualAnswer(e.target.value)}
                          placeholder="Enter answer..."
                          className="w-full h-24 bg-stone-50 border-none rounded-2xl p-4 text-sm text-stone-800 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all resize-none"
                        />
                      </div>
                    </div>
                    <button 
                      disabled={!manualQuestion.trim() || !manualAnswer.trim()}
                      onClick={async () => {
                        if (manualQuestion.trim() && manualAnswer.trim() && selectedCourse) {
                          const newCard: Flashcard = {
                            id: Math.random().toString(36).substr(2, 9),
                            courseId: selectedCourse.id,
                            topicId: currentCreationTopicId || 'default',
                            question: manualQuestion.trim(),
                            answer: manualAnswer.trim(),
                            difficulty: 'None',
                            type: 'Manual',
                            createdAt: new Date().toISOString()
                          };
                          setFlashcards(prev => [newCard, ...prev]);
                          if (user) {
                            await api.saveFlashcard(user.uid, newCard);
                          }
                          setManualQuestion('');
                          setManualAnswer('');
                          setIsManualModalOpen(false);
                        }
                      }}
                      className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg flex items-center justify-center gap-3 hover:bg-stone-800 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      <Check className="w-6 h-6" />
                      Save Flashcard
                    </button>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
            <TopicSelectionModal />
          </motion.div>
        )}

        {view === 'quiz-practice' && selectedCourse && (
          <motion.div 
            key="quiz-practice"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <QuizPractice 
              course={selectedCourse} 
              onBack={() => setView('workspace')} 
              questions={quizQuestions.filter(q => q.courseId === selectedCourse.id)}
              onAddQuestions={(newQs) => setQuizQuestions(prev => [...newQs, ...prev])}
              onDeleteQuestion={deleteQuizQuestion}
              user={user}
              lectureFiles={lectureFiles.filter(f => f.courseId === selectedCourse.id)}
              onGenerateQuiz={() => handleGenerateStudyMaterials({ flashcards: false, quiz: true, exam: false, generateMore: true })}
              isGenerating={isGeneratingStudyMaterials}
              onStudyComplete={handleStudyComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Simulation Modal */}
      <AnimatePresence>
        {isAddingSimulation && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingSimulation(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl z-[70]"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-stone-900">Schedule Practice</h2>
                  <p className="text-sm text-stone-400 mt-1">Pick a time for your simulation</p>
                </div>
                <button 
                  onClick={() => setIsAddingSimulation(false)}
                  className="p-3 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-3 px-1">Select Course</label>
                  <div className="relative">
                    <select 
                      value={newSimCourseId}
                      onChange={(e) => setNewSimCourseId(e.target.value)}
                      className="w-full bg-stone-50 border-2 border-stone-50 rounded-2xl px-5 py-4 text-stone-900 font-semibold focus:ring-0 focus:border-stone-900 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Choose an exam course...</option>
                      {courses.filter(c => c.type === 'Exam').map(course => (
                        <option key={course.id} value={course.id}>{course.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                      <ChevronRight className="w-5 h-5 rotate-90" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-3 px-1">Day of the Week</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                      <button
                        key={day}
                        onClick={() => setNewSimDay(day)}
                        className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border-2 ${
                          newSimDay === day ? 'bg-stone-900 text-white border-stone-900 shadow-md' : 'bg-white text-stone-500 border-stone-100 hover:border-stone-200'
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-3 px-1">Time of Day</label>
                  <div className="relative">
                    <input 
                      type="time" 
                      value={newSimTime}
                      onChange={(e) => setNewSimTime(e.target.value)}
                      className="w-full bg-stone-50 border-2 border-stone-50 rounded-2xl px-5 py-4 text-stone-900 font-bold focus:ring-0 focus:border-stone-900 transition-all cursor-pointer"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => addSimulation(newSimCourseId, newSimDay, newSimTime)}
                  disabled={!newSimCourseId}
                  className="w-full bg-stone-900 text-white py-5 rounded-[1.5rem] font-bold uppercase tracking-[0.15em] hover:bg-stone-800 transition-all shadow-xl shadow-stone-200 disabled:opacity-50 disabled:shadow-none active:scale-95"
                >
                  Confirm Schedule
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Course Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-stone-900">Add New Course</h2>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>

              <form onSubmit={handleAddCourse} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Course Name</label>
                  <input 
                    type="text" 
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    placeholder="e.g. Advanced Calculus"
                    className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-stone-900 placeholder-stone-300 focus:ring-2 focus:ring-stone-900 transition-all"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Course Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button"
                      onClick={() => setNewCourseType('Exam')}
                      className={`py-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${newCourseType === 'Exam' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-100 bg-white text-stone-500 hover:border-stone-200'}`}
                    >
                      <FileText className="w-6 h-6" />
                      <span className="text-xs font-bold uppercase tracking-wider">Exam</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewCourseType('Project')}
                      className={`py-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${newCourseType === 'Project' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-100 bg-white text-stone-500 hover:border-stone-200'}`}
                    >
                      <Briefcase className="w-6 h-6" />
                      <span className="text-xs font-bold uppercase tracking-wider">Project</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">Course Color</label>
                  <div className="flex flex-wrap gap-3 px-1">
                    {presetColors.map((color) => (
                      <button
                        key={color.class}
                        type="button"
                        onClick={() => setNewCourseColor(color.class)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${color.class} ${newCourseColor === color.class ? 'border-stone-900 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-bold text-lg flex items-center justify-center gap-3 hover:bg-stone-800 active:scale-[0.98] transition-all shadow-xl shadow-stone-200"
                >
                  <Check className="w-6 h-6" />
                  Save Course
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-stone-100 px-8 py-4 z-40">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <button 
            onClick={() => setView('home')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'home' ? 'text-stone-900 scale-110' : 'text-stone-300 hover:text-stone-500'}`}
          >
            <Home className={`w-6 h-6 ${view === 'home' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
          </button>
          <button 
            onClick={() => setView('calendar')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'calendar' ? 'text-stone-900 scale-110' : 'text-stone-300 hover:text-stone-50'}`}
          >
            <Calendar className={`w-6 h-6 ${view === 'calendar' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Calendar</span>
          </button>
          <button 
            onClick={() => setView('progress')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'progress' ? 'text-stone-900 scale-110' : 'text-stone-300 hover:text-stone-50'}`}
          >
            <BarChart2 className={`w-6 h-6 ${view === 'progress' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Progress</span>
          </button>
          <button 
            onClick={() => setView('study-timer')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'study-timer' ? 'text-stone-900 scale-110' : 'text-stone-300 hover:text-stone-500'}`}
          >
            <Timer className={`w-6 h-6 ${view === 'study-timer' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Timer</span>
          </button>
          <button 
            onClick={() => setView('courses')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'courses' || view === 'workspace' ? 'text-stone-900 scale-110' : 'text-stone-300 hover:text-stone-500'}`}
          >
            <Book className={`w-6 h-6 ${view === 'courses' || view === 'workspace' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Courses</span>
          </button>
        </div>
      </nav>

      {/* File Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <FilePreviewModal 
            file={previewFile} 
            onClose={() => setPreviewFile(null)} 
          />
        )}
      </AnimatePresence>

      {/* Upload Feedback Overlay */}
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-stone-900/20 backdrop-blur-[2px]"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-6 max-w-xs w-full"
            >
              <div className="relative w-20 h-20">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle className="text-stone-100 stroke-current" strokeWidth="8" fill="transparent" r="40" cx="50" cy="50" />
                  <motion.circle 
                    className="text-stone-900 stroke-current" 
                    strokeWidth="8" 
                    strokeLinecap="round" 
                    fill="transparent" 
                    r="40" 
                    cx="50" 
                    cy="50"
                    initial={{ strokeDasharray: "0 251.2" }}
                    animate={{ strokeDasharray: `${(uploadProgress / 100) * 251.2} 251.2` }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  {uploadStatus === 'success' ? (
                    <Check className="w-8 h-8 text-emerald-500" />
                  ) : uploadStatus === 'error' ? (
                    <X className="w-8 h-8 text-red-500" />
                  ) : (
                    <Upload className="w-8 h-8 text-stone-900 animate-bounce" />
                  )}
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-stone-900">
                  {uploadStatus === 'uploading' ? 'Uploading file...' : 
                   uploadStatus === 'success' ? 'Upload successful' : 
                   'Upload failed'}
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  {uploadStatus === 'error' ? 'Something went wrong. Please check the file size.' : 'Please wait while we process your materials.'}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-stone-900 mb-2">{confirmModal.title}</h2>
              <p className="text-sm text-stone-500 mb-8 leading-relaxed">{confirmModal.message}</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold text-sm hover:bg-stone-200 transition-all"
                >
                  {confirmModal.cancelText}
                </button>
                <button 
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generation Options Modal */}
      <AnimatePresence>
        {generationOptionsOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setGenerationOptionsOpen(false);
                setGenerationError(null);
                setGenerationModalStep('Source');
              }}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl max-h-[80vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  {generationModalStep !== 'Source' && (
                    <button 
                      onClick={() => setGenerationModalStep(generationModalStep === 'Materials' ? 'Detail' : 'Source')}
                      className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5 text-stone-600" />
                    </button>
                  )}
                  <h2 className="text-2xl font-bold text-stone-900">
                    {generationModalStep === 'Source' ? 'Study Source' : 
                     generationModalStep === 'Detail' ? 'Configure Source' : 'Generate Materials'}
                  </h2>
                </div>
                <button onClick={() => {
                  setGenerationOptionsOpen(false);
                  setGenerationError(null);
                  setGenerationModalStep('Source');
                }} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>
              
              {generationModalStep === 'Source' && (
                <div className="space-y-3">
                  <p className="text-sm text-stone-500 mb-4">Where should the AI get the information from?</p>
                  <button 
                    onClick={() => { setGenerationSourceType('Entire'); setGenerationModalStep('Materials'); }}
                    className="w-full p-5 bg-stone-50 hover:bg-stone-100 rounded-2xl border border-stone-100 flex items-center gap-4 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-stone-200 text-stone-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-stone-900">Entire Course</p>
                      <p className="text-[10px] text-stone-400 uppercase tracking-wider">All uploaded materials</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => { setGenerationSourceType('File'); setGenerationModalStep('Detail'); }}
                    className="w-full p-5 bg-stone-50 hover:bg-stone-100 rounded-2xl border border-stone-100 flex items-center gap-4 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-stone-900">Specific Lecture File</p>
                      <p className="text-[10px] text-stone-400 uppercase tracking-wider">Choose one document</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => { setGenerationSourceType('MultiFile'); setGenerationModalStep('Detail'); }}
                    className="w-full p-5 bg-stone-50 hover:bg-stone-100 rounded-2xl border border-stone-100 flex items-center gap-4 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-stone-900">Selected Files</p>
                      <p className="text-[10px] text-stone-400 uppercase tracking-wider">Choose multiple documents</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => { setGenerationSourceType('Topic'); setGenerationModalStep('Detail'); }}
                    className="w-full p-5 bg-stone-50 hover:bg-stone-100 rounded-2xl border border-stone-100 flex items-center gap-4 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Target className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-stone-900">Specific Topic</p>
                      <p className="text-[10px] text-stone-400 uppercase tracking-wider">Type a topic name</p>
                    </div>
                  </button>
                </div>
              )}

              {generationModalStep === 'Detail' && (
                <div className="space-y-4">
                  {generationSourceType === 'Topic' ? (
                    <div className="space-y-4">
                      <p className="text-sm text-stone-500">What topic should the AI focus on?</p>
                      <input 
                        type="text"
                        value={generationTopic}
                        onChange={(e) => setGenerationTopic(e.target.value)}
                        placeholder="e.g. Regression Analysis"
                        className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all font-medium"
                      />
                      <button 
                        disabled={!generationTopic.trim()}
                        onClick={() => setGenerationModalStep('Materials')}
                        className="w-full py-5 bg-stone-900 text-white rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Continue
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-stone-500">
                        {generationSourceType === 'File' ? 'Select a lecture file:' : 'Select lecture files:'}
                      </p>
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-2 no-scrollbar">
                        {lectureFiles.filter(f => f.courseId === selectedCourse?.id).map(file => (
                          <button 
                            key={file.id}
                            onClick={() => {
                              if (generationSourceType === 'File') {
                                setSelectedGenerationFiles([file.id]);
                              } else {
                                setSelectedGenerationFiles(prev => 
                                  prev.includes(file.id) ? prev.filter(id => id !== file.id) : [...prev, file.id]
                                );
                              }
                            }}
                            className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between ${
                              selectedGenerationFiles.includes(file.id) 
                                ? 'bg-stone-900 border-stone-900 text-white' 
                                : 'bg-stone-50 border-stone-100 text-stone-600 hover:bg-stone-100'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <FileText className={`w-4 h-4 ${selectedGenerationFiles.includes(file.id) ? 'text-stone-400' : 'text-stone-400'}`} />
                              <span className="text-sm font-bold truncate max-w-[200px]">{file.name}</span>
                            </div>
                            {selectedGenerationFiles.includes(file.id) && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                      <button 
                        disabled={selectedGenerationFiles.length === 0}
                        onClick={() => setGenerationModalStep('Materials')}
                        className="w-full py-5 bg-stone-900 text-white rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Continue
                      </button>
                    </div>
                  )}
                </div>
              )}

              {generationModalStep === 'Materials' && (
                <div className="space-y-3">
                  <p className="text-sm text-stone-500 mb-4">Select what you'd like the AI to generate.</p>
                  <button 
                    onClick={() => handleGenerateStudyMaterials({ flashcards: true, quiz: false, exam: false })}
                    className="w-full p-5 bg-stone-50 hover:bg-stone-100 rounded-2xl border border-stone-100 flex items-center gap-4 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-stone-900">Flashcards</p>
                      <p className="text-[10px] text-stone-400 uppercase tracking-wider">10-15 cards</p>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => handleGenerateStudyMaterials({ flashcards: false, quiz: true, exam: false })}
                    className="w-full p-5 bg-stone-50 hover:bg-stone-100 rounded-2xl border border-stone-100 flex items-center gap-4 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Brain className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-stone-900">Quiz Questions</p>
                      <p className="text-[10px] text-stone-400 uppercase tracking-wider">5-8 practice questions</p>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => handleGenerateStudyMaterials({ flashcards: false, quiz: false, exam: true })}
                    className="w-full p-5 bg-stone-50 hover:bg-stone-100 rounded-2xl border border-stone-100 flex items-center gap-4 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-stone-900">Exam Simulation</p>
                      <p className="text-[10px] text-stone-400 uppercase tracking-wider">5 exam-style questions</p>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => handleGenerateStudyMaterials({ flashcards: true, quiz: true, exam: true })}
                    className="w-full p-5 bg-stone-900 text-white rounded-2xl flex items-center gap-4 transition-all hover:bg-stone-800"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold">Generate All Materials</p>
                      <p className="text-[10px] text-stone-400 uppercase tracking-wider">Complete study package</p>
                    </div>
                  </button>
                </div>
              )}

              {generationError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 mt-4">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">{generationError}</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generation Progress Overlay */}
      <AnimatePresence>
        {isGeneratingStudyMaterials && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[3rem] p-10 shadow-2xl flex flex-col items-center gap-8 max-w-sm w-full text-center"
            >
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-stone-100 rounded-full" />
                <motion.div 
                  className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-orange-500 animate-pulse" />
                </div>
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-stone-900 mb-2">{generationStep}</h3>
                <p className="text-sm text-stone-400">Our AI is crafting personalized materials for your success.</p>
              </div>
              
              <div className="w-full bg-stone-50 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Processing Lecture Content</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generation Results Modal */}
      <AnimatePresence>
        {generationResults && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[3rem] p-10 shadow-2xl max-w-md w-full"
            >
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  {generationResults.isExisting ? <Layers className="w-10 h-10" /> : <Check className="w-10 h-10" />}
                </div>
                <h3 className="text-2xl font-bold text-stone-900">
                  {generationResults.isExisting ? 'Materials Already Exist!' : 'Materials Generated!'}
                </h3>
                <p className="text-sm text-stone-500 mt-2">
                  {generationResults.isExisting 
                    ? 'We found existing study resources for this selection. You can review them or generate additional ones.' 
                    : 'Your study resources are ready and saved to their sections.'}
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-stone-50 p-4 rounded-2xl text-center">
                  <p className="text-2xl font-bold text-stone-900">{generationResults.flashcards}</p>
                  <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">Flashcards</p>
                </div>
                <div className="bg-stone-50 p-4 rounded-2xl text-center">
                  <p className="text-2xl font-bold text-stone-900">{generationResults.quiz}</p>
                  <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">Quiz Qs</p>
                </div>
                <div className="bg-stone-50 p-4 rounded-2xl text-center">
                  <p className="text-2xl font-bold text-stone-900">{generationResults.exam}</p>
                  <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">Exam Qs</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={() => setGenerationResults(null)}
                  className="w-full py-5 bg-stone-900 text-white rounded-2xl font-bold text-lg hover:bg-stone-800 transition-all"
                >
                  {generationResults.isExisting ? 'Review Existing' : "Awesome, let's study!"}
                </button>
                
                {generationResults.isExisting && (
                  <button 
                    onClick={() => {
                      const options = {
                        flashcards: generationResults.flashcards > 0,
                        quiz: generationResults.quiz > 0,
                        exam: generationResults.exam > 0,
                        generateMore: true
                      };
                      setGenerationResults(null);
                      handleGenerateStudyMaterials(options);
                    }}
                    className="w-full py-5 bg-stone-50 text-stone-900 border border-stone-200 rounded-2xl font-bold text-lg hover:bg-stone-100 transition-all"
                  >
                    Generate More
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProfileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsProfileOpen(false)}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-4xl rounded-t-[3rem] md:rounded-[3rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-[80vh] relative mt-auto md:mt-0"
            >
              {/* Back Button for Mobile/Desktop */}
              <button 
                onClick={() => setIsProfileOpen(false)}
                className="absolute top-6 left-6 z-10 p-3 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-stone-100 text-stone-600 hover:bg-stone-50 transition-all md:hidden"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Left Side: Profile Info */}
              <div className="w-full md:w-1/3 bg-stone-50 p-8 pt-16 md:pt-8 flex flex-col items-center text-center border-r border-stone-100">
                <div className="hidden md:block absolute top-6 left-6">
                  <button 
                    onClick={() => setIsProfileOpen(false)}
                    className="p-2 hover:bg-stone-100 rounded-xl transition-all text-stone-400"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                </div>
                <div className="relative group">
                  <div className="w-32 h-32 bg-white rounded-[2.5rem] shadow-lg overflow-hidden border-4 border-white mb-6">
                    {profile?.profilePicture ? (
                      <img src={profile.profilePicture} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-100">
                        <UserIcon className="w-12 h-12 text-stone-300" />
                      </div>
                    )}
                  </div>
                  {isEditingProfile && (
                    <label className="absolute bottom-4 right-0 w-10 h-10 bg-stone-900 text-white rounded-2xl flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform">
                      <Camera className="w-5 h-5" />
                      <input 
                        type="file" accept="image/*" className="hidden" 
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (file && profile) {
                            try {
                              const compressed = await compressImage(file);
                              setProfile({...profile, profilePicture: compressed});
                            } catch (err) {
                              console.error("Error compressing image:", err);
                            }
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                {isEditingProfile ? (
                  <div className="w-full space-y-4">
                    <input 
                      type="text"
                      value={profile?.firstName || ''}
                      onChange={e => profile && setProfile({...profile, firstName: e.target.value})}
                      className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm text-center"
                      placeholder="First Name"
                    />
                    <input 
                      type="text"
                      value={profile?.universityName || ''}
                      onChange={e => profile && setProfile({...profile, universityName: e.target.value})}
                      className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm text-center"
                      placeholder="University"
                    />
                    <input 
                      type="text"
                      value={profile?.courseOfStudy || ''}
                      onChange={e => profile && setProfile({...profile, courseOfStudy: e.target.value})}
                      className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm text-center"
                      placeholder="Course"
                    />
                    <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-4 py-2">
                      <span className="text-sm text-stone-500 whitespace-nowrap">Semester:</span>
                      <input 
                        type="number"
                        value={profile?.currentSemester || 1}
                        onChange={e => profile && setProfile({...profile, currentSemester: parseInt(e.target.value) || 1})}
                        className="w-full text-sm text-center focus:outline-none"
                        min="1"
                        max="20"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-stone-900">{profile?.firstName}</h2>
                    <p className="text-stone-500 text-sm mt-1">{profile?.universityName}</p>
                    <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-white rounded-2xl shadow-sm border border-stone-100">
                      <GraduationCap className="w-4 h-4 text-stone-400" />
                      <span className="text-xs font-bold text-stone-600">{profile?.courseOfStudy}</span>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-2xl shadow-lg shadow-stone-200">
                      <GraduationCap className="w-4 h-4 text-stone-400" />
                      <span className="text-sm font-bold tracking-tight">Semester {profile?.currentSemester}</span>
                    </div>
                  </>
                )}

                <div className="mt-auto pt-8 w-full space-y-3">
                  {isEditingProfile ? (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsEditingProfile(false)}
                        className="flex-1 py-3 bg-stone-200 text-stone-600 rounded-2xl font-bold text-xs"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleEditProfile}
                        className="flex-1 py-3 bg-stone-900 text-white rounded-2xl font-bold text-xs"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setIsEditingProfile(true)}
                      className="w-full py-3 bg-white border border-stone-200 text-stone-600 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-stone-50 transition-all"
                    >
                      <Edit2 className="w-4 h-4" /> Edit Profile
                    </button>
                  )}
                  <button 
                    onClick={() => setIsSemesterUpdateOpen(true)}
                    className="w-full py-3 bg-stone-100 text-stone-600 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-stone-200 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" /> Update Semester
                  </button>
                  <button 
                    onClick={handleSignOut}
                    className="w-full py-3 text-rose-500 font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-50 rounded-2xl transition-all"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>

              {/* Right Side: Courses History */}
              <div className="flex-1 p-8 overflow-y-auto no-scrollbar">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-stone-900">Academic History</h3>
                  <button onClick={() => setIsProfileOpen(false)} className="p-2 hover:bg-stone-100 rounded-xl transition-all">
                    <X className="w-6 h-6 text-stone-400" />
                  </button>
                </div>

                <div className="space-y-8">
                  <section>
                    <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">Active Courses</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {courses.filter(c => c.status === 'Active').map(course => (
                        <div key={course.id} className="p-4 bg-white border border-stone-100 rounded-3xl shadow-sm flex items-center gap-4">
                          <div className={`w-10 h-10 ${course.color || 'bg-stone-100'} rounded-2xl flex items-center justify-center`}>
                            <BookOpen className="w-5 h-5 text-stone-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-stone-900">{course.name}</p>
                            <p className="text-[10px] text-stone-500">{course.type}</p>
                          </div>
                        </div>
                      ))}
                      {courses.filter(c => c.status === 'Active').length === 0 && (
                        <p className="text-xs text-stone-400 italic">No active courses</p>
                      )}
                    </div>
                  </section>

                  <section>
                    <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">Past Completed Courses</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* From Profile Data */}
                      {profile?.pastCourses.map((course, idx) => (
                        <div key={`past-${idx}`} className="p-4 bg-stone-50 border border-stone-100 rounded-3xl flex items-center gap-4 opacity-70">
                          <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center">
                            <Check className="w-5 h-5 text-emerald-500" />
                          </div>
                          <p className="text-sm font-medium text-stone-600">{course}</p>
                        </div>
                      ))}
                      {/* From Courses Collection (Status Past) */}
                      {courses.filter(c => c.status === 'Past').map(course => (
                        <div key={course.id} className="p-4 bg-stone-50 border border-stone-100 rounded-3xl flex items-center gap-4 opacity-70">
                          <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center">
                            <Check className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-stone-600">{course.name}</p>
                            <p className="text-[10px] text-stone-400">Semester {profile?.currentSemester ? profile.currentSemester - 1 : ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSemesterUpdateOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSemesterUpdateOpen(false)}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-[3rem] p-10 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-amber-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <RefreshCw className="w-10 h-10 text-amber-500 animate-spin-slow" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 mb-2">New Semester?</h2>
              <p className="text-stone-500 text-sm leading-relaxed mb-8">
                It's been 6 months since your last update. Would you like to move your current courses to history and start Semester {profile?.currentSemester ? profile.currentSemester + 1 : ''}?
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={handleUpdateSemester}
                  className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold shadow-lg hover:bg-stone-800 transition-all"
                >
                  Yes, Update Semester
                </button>
                <button 
                  onClick={() => setIsSemesterUpdateOpen(false)}
                  className="w-full py-4 bg-stone-100 text-stone-500 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                >
                  Not Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGoogleHelpOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            onClick={() => setIsGoogleHelpOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl overflow-hidden relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-900">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-stone-900">Google Drive Setup</h2>
                    <p className="text-xs text-stone-500 font-medium uppercase tracking-widest">Configuration Guide</p>
                  </div>
                </div>
                <button onClick={() => setIsGoogleHelpOpen(false)} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
                <section>
                  <h3 className="text-sm font-bold text-stone-900 mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 bg-stone-900 text-white rounded-full flex items-center justify-center text-[10px]">1</span>
                    Required Secrets
                  </h3>
                  <p className="text-xs text-stone-500 leading-relaxed mb-3">
                    Go to <strong>Settings (⚙️) &gt; Secrets</strong> and add the following:
                  </p>
                  <div className="space-y-2">
                    {[
                      { name: 'GOOGLE_CLIENT_ID', desc: 'OAuth 2.0 Client ID' },
                      { name: 'GOOGLE_CLIENT_SECRET', desc: 'OAuth 2.0 Client Secret' },
                      { name: 'GOOGLE_API_KEY', desc: 'API Key (Developer Key)' }
                    ].map(secret => (
                      <div key={secret.name} className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                        <code className="text-[10px] font-bold text-stone-900">{secret.name}</code>
                        <p className="text-[10px] text-stone-400 mt-1">{secret.desc}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-bold text-stone-900 mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 bg-stone-900 text-white rounded-full flex items-center justify-center text-[10px]">2</span>
                    "Invalid API" Error?
                  </h3>
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                    <p className="text-xs text-red-700 leading-relaxed">
                      If you see <strong>"Invalid API"</strong> in the Google Picker, it means your <code>GOOGLE_API_KEY</code> is incorrect or the <strong>Google Picker API</strong> is not enabled in your Google Cloud project.
                    </p>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-bold text-stone-900 mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 bg-stone-900 text-white rounded-full flex items-center justify-center text-[10px]">3</span>
                    Google Cloud Console
                  </h3>
                  <ul className="space-y-2">
                    {[
                      'Enable "Google Drive API" and "Google Picker API"',
                      'Configure OAuth Consent Screen (External)',
                      'Add Authorized Redirect URIs (see below)',
                      'Create an API Key and restrict it to "Google Picker API"'
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-stone-500">
                        <Check className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                        {step}
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3 className="text-sm font-bold text-stone-900 mb-2">Redirect URIs</h3>
                  <div className="p-3 bg-stone-900 text-white rounded-xl font-mono text-[9px] break-all">
                    {window.location.origin}/auth/google/callback
                  </div>
                </section>
              </div>

              <div className="mt-8">
                <button 
                  onClick={() => setIsGoogleHelpOpen(false)}
                  className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold shadow-lg hover:bg-stone-800 transition-all"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Styles for hidden scrollbar */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
