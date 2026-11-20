export type SourceContext = {
  courseId: string;
  unitId?: string;
  activityId?: string;
  activityTitle?: string;
  activityPrompt?: string;
  materialId?: string;
  materialTitle?: string;
  page?: number;
  selectionId?: string;
  selectionText?: string;
};

export type Task = {
  id: string;
  title: string;
  completed: boolean;
  courseId?: string;
  dueDate?: string;
  source?: SourceContext;
  reviewProposalId?: string;
};
export type Course = {
  id: string;
  title: string;
  subject: string;
  description: string;
  progress: number;
  currentUnit: string;
  units: { id: string; title: string; status: "done" | "current" | "next" }[];
  materials: {
    id: string;
    title: string;
    description: string;
    pages: number;
  }[];
};
export type Today = {
  tasks: Task[];
  suggestion: { title: string; body: string; courseId: string } | null;
  continueCourse: Course;
};
export type Material = {
  id: string;
  courseId: string;
  title: string;
  fileUrl: string;
  pageCount: number;
  exercisePage: number;
  exercise: { id: string; label: string; prompt: string; equation: string };
};
export type ArtifactKind =
  | "note"
  | "recap"
  | "summary"
  | "flashcards"
  | "quiz"
  | "mindmap"
  | "podcast"
  | "storyboard"
  | "photo"
  | "explain"
  | "reflection";
export type ArtifactContent =
  | { type: "photo"; equation: string; checks: string[] }
  | { type: "explain"; steps: { title: string; text: string }[] }
  | { type: "summary"; sections: { title: string; text: string }[] }
  | {
      type: "mindmap";
      root: string;
      branches: { label: string; children: string[] }[];
    }
  | { type: "podcast"; lines: { speaker: string; text: string }[] }
  | { type: "flashcards"; cards: { front: string; back: string }[] }
  | {
      type: "quiz";
      questions: {
        prompt: string;
        choices: string[];
        correctIndex: number;
        explanation: string;
      }[];
    }
  | {
      type: "storyboard";
      scenes: { title: string; narration: string; visual: string }[];
    };
export type ArtifactInput = {
  kind: ArtifactKind;
  title: string;
  body: string;
  source?: SourceContext;
  content?: ArtifactContent;
  sampleId?: string;
};
export type Artifact = ArtifactInput & {
  id: string;
  createdAt: string;
  simulated: true;
};
export type Evidence = {
  id: string;
  title: string;
  body: string;
  kind: "mastery" | "discovery" | "creation";
  basis: "activity" | "student-confirmed" | "ai-inference";
  createdAt: string;
  source?: SourceContext;
  practiceMode?: "assisted" | "independent";
  taskId?: string;
  artifactId?: string;
};
export type ToolInput = {
  toolId: string;
  input: string;
  sampleId?: string;
  source?: SourceContext;
};
export type ToolResult = ArtifactInput & { simulated: true };
export type TurnInput = {
  clientTurnId: string;
  message: string;
  mode: "hint" | "reply" | "practice";
  context: SourceContext | null;
};
export type Recap = {
  id: string;
  actionId: string;
  title: string;
  body: string;
  source?: SourceContext;
};

export type ReviewProposal = {
  id: string;
  title: string;
  dueDate: string;
  source: SourceContext;
  status: "pending" | "confirmed" | "rejected";
  taskId?: string;
};

export type ReviewDecisionInput = {
  decision: "confirm" | "reject";
  title?: string;
  dueDate?: string;
};

export type ReviewPractice = {
  task: Task;
  question: string;
};

export type PracticeResult = {
  correct: boolean;
  message: string;
  evidence?: Evidence;
};
