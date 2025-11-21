
export enum AttendanceStatus {
  PRESENT = 'H',
  LATE = 'TL',
  ABSENT = 'A',
  SICK = 'S',
  PERMISSION = 'I'
}

export enum SubjectType {
  TILAWATI = 'Tilawati',
  LITERASI = 'Literasi',
  IBADAH = 'Bimbingan Ibadah',
  KONSULTASI = 'Konsultasi & Evaluasi',
  GENERAL = 'Umum'
}

export interface StudentScore {
  studentId: string;
  studentName: string;
  attendance: AttendanceStatus;
  activeInvolvement: number; // 1-4
  fluency: number; // 1-4
  tajwid: number; // 1-4
  adab: number; // 1-4
  jilid?: string; // Optional: For Tilawati specific
  page?: string;  // Optional: For Tilawati specific
  
  // Literasi Specific
  literacyTotalQuestions?: number;
  literacyCorrect?: number;
  literacyWrong?: number;
  literacyScore?: number;

  notes: string;
}

export interface DailyRecord {
  id: string;
  date: string;
  classId: string;
  teacherName: string;
  subject: SubjectType;
  studentScores: StudentScore[];
  teacherAnalysis: string; // Section G in PDF
  recommendations: { // Section H in PDF
    specialAttention: string;
    methodImprovement: string;
    nextWeekPlan: string;
  };
  aiAnalysis?: string;
}

export interface ClassData {
  id: string;
  name: string;
  homeroomTeacher: string;
  students: { id: string; name: string }[];
}