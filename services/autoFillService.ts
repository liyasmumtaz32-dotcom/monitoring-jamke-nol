
import { StudentScore, SubjectType, AttendanceStatus } from '../types';
import { SMART_TEACHER_NOTES, TILAWATI_JILID_OPTIONS } from '../constants';

// Helper for weighted random
const weightedRandom = (options: {value: any, weight: number}[]) => {
    let sum = 0;
    const r = Math.random();
    for (const opt of options) {
        sum += opt.weight;
        if (r <= sum) return opt.value;
    }
    return options[0].value;
}

export const generateRandomStudentScores = (students: { id: string; name: string }[], subject: SubjectType): StudentScore[] => {
    return students.map(s => {
        // 1. Attendance Logic (Realistic Distribution)
        // 90-95% Hadir
        const attendance = weightedRandom([
            { value: AttendanceStatus.PRESENT, weight: 0.92 },
            { value: AttendanceStatus.LATE, weight: 0.04 },
            { value: AttendanceStatus.SICK, weight: 0.02 },
            { value: AttendanceStatus.PERMISSION, weight: 0.01 },
            { value: AttendanceStatus.ABSENT, weight: 0.01 } 
        ]);

        const isPresent = attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE;

        // 2. Score Logic (1-4)
        const getScore = () => isPresent ? weightedRandom([
            { value: 4, weight: 0.35 }, 
            { value: 3, weight: 0.50 }, 
            { value: 2, weight: 0.10 }, 
            { value: 1, weight: 0.05 }  
        ]) : 0; 

        const baseScore: StudentScore = {
            studentId: s.id,
            studentName: s.name,
            attendance,
            activeInvolvement: getScore(),
            fluency: getScore(),
            tajwid: getScore(),
            adab: isPresent ? weightedRandom([{value:4, weight:0.8}, {value:3, weight:0.15}, {value:2, weight:0.05}]) : 0,
            notes: ''
        };

        // 3. Subject Specific Logic
        if (subject === SubjectType.TILAWATI) {
            baseScore.jilid = TILAWATI_JILID_OPTIONS[Math.floor(Math.random() * TILAWATI_JILID_OPTIONS.length)];
            baseScore.page = Math.floor(Math.random() * 40 + 1).toString();
            
            if(isPresent) {
                 const perf = baseScore.fluency >= 3 ? 'HIGH' : (baseScore.fluency === 2 ? 'MEDIUM' : 'LOW');
                 // @ts-ignore
                 const notesPool = SMART_TEACHER_NOTES[SubjectType.TILAWATI]?.[perf] || SMART_TEACHER_NOTES.GENERAL.MEDIUM;
                 baseScore.notes = notesPool[Math.floor(Math.random() * notesPool.length)];
            }
        } else if (subject === SubjectType.LITERASI) {
             if(isPresent) {
                 const total = 10;
                 const correct = weightedRandom([
                    { value: 10, weight: 0.3 },
                    { value: 9, weight: 0.3 },
                    { value: 8, weight: 0.2 },
                    { value: 7, weight: 0.1 },
                    { value: 6, weight: 0.1 }
                 ]);
                 
                 baseScore.literacyTotalQuestions = total;
                 baseScore.literacyCorrect = correct;
                 baseScore.literacyWrong = total - correct;
                 baseScore.literacyScore = correct * 10;
                 
                 const perf = baseScore.literacyScore >= 80 ? 'HIGH' : (baseScore.literacyScore >= 60 ? 'MEDIUM' : 'LOW');
                 // @ts-ignore
                 const notesPool = SMART_TEACHER_NOTES[SubjectType.LITERASI]?.[perf] || SMART_TEACHER_NOTES.GENERAL.MEDIUM;
                 baseScore.notes = notesPool[Math.floor(Math.random() * notesPool.length)];
             } else {
                 baseScore.literacyScore = 0;
             }
        } else {
            if(isPresent) {
                 const notes = ["Aktif mengikuti kegiatan.", "Cukup kondusif.", "Perlu ditingkatkan kefokusannya.", "Sangat baik."];
                 baseScore.notes = notes[Math.floor(Math.random() * notes.length)];
            }
        }

        return baseScore;
    });
};

// MENGGUNAKAN TEMPLATE BAKU AGAR PASTI BERHASIL & CEPAT
export const generateClassReportTemplate = (
    className: string, 
    teacherName: string, 
    subject: SubjectType, 
    scores: StudentScore[]
): {teacherAnalysis: string, recommendations: any} => {
    
    const presentCount = scores.filter(s => s.attendance === 'H').length;
    const lateCount = scores.filter(s => s.attendance === 'TL').length;
    const absentCount = scores.length - presentCount - lateCount;
    
    let quality = "Kondusif";
    if (lateCount > 5) quality = "Perlu Penertiban";
    if (absentCount > 5) quality = "Kurang Efektif (Banyak Absen)";

    const analysisTemplates = [
        `Kegiatan ${subject} berjalan dengan ${quality}. Tingkat kehadiran siswa mencapai ${Math.round(((presentCount + lateCount)/scores.length)*100)}%.`,
        `Alhamdulillah, pelaksanaan ${subject} hari ini lancar. Siswa mengikuti arahan dengan baik.`,
        `Secara umum kegiatan ${subject} berlangsung tertib. Perlu perhatian lebih pada siswa yang datang terlambat.`
    ];

    return {
        teacherAnalysis: analysisTemplates[Math.floor(Math.random() * analysisTemplates.length)],
        recommendations: {
            specialAttention: lateCount > 0 ? `${lateCount} siswa terlambat perlu pembinaan kedisiplinan.` : "Nihil.",
            methodImprovement: "Mempertahankan konsistensi kegiatan.",
            nextWeekPlan: "Melanjutkan pembiasaan rutin sesuai jadwal."
        }
    };
};
