import { GoogleGenAI } from "@google/genai";
import { DailyRecord, StudentScore } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateDailyReportAnalysis = async (record: DailyRecord) => {
  const stats = calculateStats(record.studentScores);
  
  const prompt = `
    Analisis data monitoring "Jam ke-0" (${record.subject}) untuk kelas ${record.classId} pada tanggal ${record.date}.
    
    Data Statistik:
    - Hadir: ${stats.present}
    - Terlambat: ${stats.late}
    - Rata-rata Keterlibatan: ${stats.avgInvolvement.toFixed(2)} (Skala 1-4)
    - Rata-rata Kelancaran: ${stats.avgFluency.toFixed(2)} (Skala 1-4)
    - Rata-rata Tajwid: ${stats.avgTajwid.toFixed(2)} (Skala 1-4)
    - Rata-rata Adab: ${stats.avgAdab.toFixed(2)} (Skala 1-4)
    
    Catatan Guru:
    ${record.teacherAnalysis}
    
    Bertindaklah sebagai konsultan pendidikan senior. Berikan:
    1. Evaluasi objektif berdasarkan data angka.
    2. Identifikasi pola masalah (misal: jika tajwid rendah tapi kelancaran tinggi).
    3. 3 Saran konkret dan praktis untuk wali kelas guna perbaikan minggu depan.
    
    Gunakan Bahasa Indonesia yang formal namun suportif.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah analis data pendidikan AI untuk SMA Islam Al-Ghozali.",
      }
    });
    return response.text;
  } catch (error) {
    console.error("Error generating analysis:", error);
    return "Maaf, gagal menghasilkan analisis AI saat ini.";
  }
};

export const generateComprehensiveReport = async (records: DailyRecord[], query: string) => {
    // Thinking mode for deeper analysis across multiple records
    const dataSummary = records.map(r => `Tgl: ${r.date}, Mapel: ${r.subject}, Analisis Guru: ${r.teacherAnalysis}`).join('\n');

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Data Historis:\n${dataSummary}\n\nPermintaan User: ${query}`,
            config: {
                thinkingConfig: { thinkingBudget: 1024 }, // Use thinking for complex trend analysis
            }
        });
        return response.text;
    } catch (error) {
        console.error("Error generating comprehensive report:", error);
        return "Gagal memproses laporan komprehensif.";
    }
}

export const generateEvaluationSummary = async (records: DailyRecord[], periodType: 'Harian' | 'Mingguan' | 'Bulanan') => {
    if (records.length === 0) return "Tidak ada data laporan untuk periode ini.";

    // Pre-process data to save tokens and focus on key metrics
    const dataSummary = records.map(r => {
        const stats = calculateStats(r.studentScores);
        const lowPerformanceStudents = r.studentScores
            .filter(s => s.fluency < 2 || s.tajwid < 2 || s.adab < 2 || (s.literacyScore !== undefined && s.literacyScore < 60))
            .map(s => s.studentName)
            .join(", ");

        return `
        - Tanggal: ${r.date} (${r.subject})
        - Kehadiran: Hadir ${stats.present}, Telat ${stats.late}
        - Rata-rata Kelas: Tajwid/Nilai ${stats.avgTajwid || stats.avgLitScore}
        - Siswa Perlu Perhatian: ${lowPerformanceStudents || "Nihil"}
        - Catatan Guru: ${r.teacherAnalysis}
        - Rencana Tindak Lanjut: ${r.recommendations.nextWeekPlan}
        `;
    }).join('\n');

    const prompt = `
        Buatkan Ringkasan Evaluasi ${periodType} untuk sesi rapat guru/wali kelas.
        
        Data Laporan:
        ${dataSummary}

        Instruksi Output (Format Markdown):
        1. **Tren Kehadiran & Kedisiplinan**: Analisis grafik kehadiran dan keterlambatan.
        2. **Capaian Pembelajaran (Tilawati/Literasi)**: Apakah ada peningkatan jilid/halaman atau nilai literasi? Apakah target tercapai?
        3. **Isu Krusial**: Sebutkan nama siswa yang muncul berulang kali sebagai "Perlu Perhatian" dan masalah spesifiknya.
        4. **Evaluasi Kinerja Guru**: Berdasarkan "Rencana Tindak Lanjut", seberapa efektif strategi yang sudah dijalankan?
        5. **Rekomendasi Strategis**: Saran konkret untuk ${periodType === 'Harian' ? 'besok' : periodType === 'Mingguan' ? 'minggu depan' : 'bulan depan'}.

        Gunakan nada profesional, analitis, dan solutif.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 2048 }, // Higher budget for deep evaluation
            }
        });
        return response.text;
    } catch (error) {
        console.error("Error generating evaluation summary:", error);
        return "Gagal memproses ringkasan evaluasi.";
    }
};

export const chatWithEducationConsultant = async (history: {role: string, text: string}[], newMessage: string) => {
    try {
        const chat = ai.chats.create({
            model: 'gemini-3-pro-preview',
            config: {
                systemInstruction: "Anda adalah konsultan pendidikan ahli. Anda membantu wali kelas mengatasi masalah kedisiplinan, metode mengajar Tilawati, dan manajemen kelas. Jika ditanya soal fakta terkini pendidikan, gunakan Google Search.",
                tools: [{googleSearch: {}}]
            },
            history: history.map(h => ({ role: h.role, parts: [{ text: h.text }] }))
        });

        const response = await chat.sendMessage({ message: newMessage });
        return response.text;
    } catch (e) {
        console.error(e);
        return "Maaf, saya sedang mengalami gangguan koneksi.";
    }
}


function calculateStats(scores: StudentScore[]) {
    const present = scores.filter(s => s.attendance === 'H').length;
    const late = scores.filter(s => s.attendance === 'TL').length;
    
    const avg = (key: keyof StudentScore) => {
        const sum = scores.reduce((acc, curr) => acc + (typeof curr[key] === 'number' ? (curr[key] as number) : 0), 0);
        return sum / (scores.length || 1);
    }

    // Average calculation for Literacy Score specifically if available
    const avgLitScore = scores.some(s => s.literacyScore !== undefined) 
        ? (scores.reduce((acc, curr) => acc + (curr.literacyScore || 0), 0) / scores.length).toFixed(1)
        : 0;

    return {
        present,
        late,
        avgInvolvement: avg('activeInvolvement'),
        avgFluency: avg('fluency'),
        avgTajwid: avg('tajwid'),
        avgAdab: avg('adab'),
        avgLitScore
    };
}