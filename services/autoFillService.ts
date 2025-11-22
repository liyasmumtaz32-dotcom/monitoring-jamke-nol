
import { StudentScore, SubjectType, AttendanceStatus } from '../types';
import { SMART_TEACHER_NOTES, TILAWATI_JILID_OPTIONS } from '../constants';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
        // 92% Hadir, sisanya terbagi antara Telat, Sakit, Izin, Alpha
        const attendance = weightedRandom([
            { value: AttendanceStatus.PRESENT, weight: 0.92 },
            { value: AttendanceStatus.LATE, weight: 0.03 },
            { value: AttendanceStatus.SICK, weight: 0.02 },
            { value: AttendanceStatus.PERMISSION, weight: 0.02 },
            { value: AttendanceStatus.ABSENT, weight: 0.01 } 
        ]);

        const isPresent = attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE;

        // 2. Score Logic (1-4) - Bias towards 3 (Good) and 4 (Very Good)
        const getScore = () => isPresent ? weightedRandom([
            { value: 4, weight: 0.30 }, // 30% Sangat Baik
            { value: 3, weight: 0.50 }, // 50% Baik
            { value: 2, weight: 0.15 }, // 15% Cukup
            { value: 1, weight: 0.05 }  // 5% Kurang
        ]) : 0; 

        const baseScore: StudentScore = {
            studentId: s.id,
            studentName: s.name,
            attendance,
            activeInvolvement: getScore(),
            fluency: getScore(),
            tajwid: getScore(),
            adab: isPresent ? weightedRandom([{value:4, weight:0.7}, {value:3, weight:0.25}, {value:2, weight:0.05}]) : 0,
            notes: ''
        };

        // 3. Subject Specific Logic
        if (subject === SubjectType.TILAWATI) {
            // Random Jilid & Page
            baseScore.jilid = TILAWATI_JILID_OPTIONS[Math.floor(Math.random() * TILAWATI_JILID_OPTIONS.length)];
            baseScore.page = Math.floor(Math.random() * 40 + 1).toString();
            
            // Smart Note based on performance
            if(isPresent) {
                 const perf = baseScore.fluency >= 3 ? 'HIGH' : (baseScore.fluency === 2 ? 'MEDIUM' : 'LOW');
                 // @ts-ignore
                 const notesPool = SMART_TEACHER_NOTES[SubjectType.TILAWATI]?.[perf] || SMART_TEACHER_NOTES.GENERAL.MEDIUM;
                 baseScore.notes = notesPool[Math.floor(Math.random() * notesPool.length)];
            }
        } else if (subject === SubjectType.LITERASI) {
             if(isPresent) {
                 const total = 10;
                 // Random correct answers biased towards 7-10
                 const correct = weightedRandom([
                    { value: 10, weight: 0.25 },
                    { value: 9, weight: 0.25 },
                    { value: 8, weight: 0.25 },
                    { value: 7, weight: 0.15 },
                    { value: 6, weight: 0.05 },
                    { value: 5, weight: 0.05 }
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
        } else if (subject === SubjectType.KONSULTASI) {
            // Random consultation metrics
            if(isPresent) {
                baseScore.activeInvolvement = weightedRandom([{value:4, weight:0.6}, {value:3, weight:0.3}, {value:2, weight:0.1}]); // Kerapian
                baseScore.fluency = weightedRandom([{value:4, weight:0.7}, {value:3, weight:0.2}, {value:2, weight:0.1}]); // Atribut
                baseScore.tajwid = weightedRandom([{value:4, weight:0.9}, {value:3, weight:0.05}, {value:2, weight:0.05}]); // Kesehatan
                baseScore.adab = 4; // Respon usually good
                
                // Randomize topic if score is low (Simulate real issues)
                if(baseScore.activeInvolvement <= 2 || baseScore.fluency <= 2) {
                     const topics = ["Rambut Panjang", "Kuku Panjang", "Tidak Pakai Dasi", "Sepatu Tidak Hitam", "Lupa Bawa Buku", "Kondisi Kurang Fit"];
                     baseScore.notes = topics[Math.floor(Math.random() * topics.length)];
                } else {
                     baseScore.notes = weightedRandom([{value: "Aman/Nihil", weight: 0.8}, {value: "Sangat Rapi", weight: 0.2}]);
                }
            }
        }

        return baseScore;
    });
};

export const generateClassReportAI = async (
    className: string, 
    teacherName: string, 
    subject: SubjectType, 
    date: string, 
    scores: StudentScore[]
): Promise<{teacherAnalysis: string, recommendations: any}> => {
    
    // Calculate stats locally to send to AI context
    const presentCount = scores.filter(s => s.attendance === 'H').length;
    const lateCount = scores.filter(s => s.attendance === 'TL').length;
    
    // Fallback templates (Varied slightly to avoid looking completely identical)
    const templates = [
        `Kegiatan ${subject} berjalan dengan kondusif. Tingkat kehadiran siswa ${Math.round((presentCount/scores.length)*100)}%. Secara umum siswa mengikuti kegiatan dengan baik.`,
        `Alhamdulillah, kegiatan ${subject} hari ini lancar. Sebagian besar siswa hadir tepat waktu, hanya ${lateCount} siswa yang terlambat.`,
        `Monitoring ${subject} menunjukkan hasil positif. Siswa terlihat antusias dan tertib selama kegiatan berlangsung.`
    ];
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];

    const defaultResult = {
        teacherAnalysis: randomTemplate,
        recommendations: {
            specialAttention: lateCount > 0 ? `${lateCount} siswa terlambat perlu pembinaan.` : "Nihil.",
            methodImprovement: "Pertahankan kedisiplinan.",
            nextWeekPlan: "Melanjutkan program pembiasaan."
        }
    };

    try {
        const prompt = `
            Bertindak sebagai Wali Kelas SD/SMP/SMA Islam. Buat narasi laporan evaluasi singkat (maksimal 3 kalimat) untuk kegiatan pagi "Jam Ke-0" mapel ${subject}.
            
            Konteks:
            - Kelas: ${className}
            - Guru: ${teacherName}
            - Data: ${presentCount} Hadir, ${lateCount} Terlambat dari total ${scores.length} siswa.

            Output JSON:
            {
                "teacherAnalysis": "Narasi evaluasi guru yang profesional dan memotivasi...",
                "recommendations": {
                    "specialAttention": "Nama/kondisi siswa yang butuh perhatian (jika ada yang telat/nilai rendah)...",
                    "methodImprovement": "Saran singkat metode...",
                    "nextWeekPlan": "Rencana minggu depan..."
                }
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { 
                responseMimeType: 'application/json',
                temperature: 0.8 // Higher temperature for more variance
            }
        });
        
        if(response.text) {
            return JSON.parse(response.text);
        }
        return defaultResult;

    } catch (e) {
        console.warn("AI Report Generation failed, falling back to template.", e);
        return defaultResult;
    }
};
