
import { GoogleGenAI } from "@google/genai";
import { DailyRecord, StudentScore, SubjectType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateDailyReportAnalysis = async (record: DailyRecord) => {
  const stats = calculateStats(record.studentScores);
  
  let specificStats = '';
  let metric1 = '', metric2 = '', metric3 = '', metric4 = '';

  if (record.subject === SubjectType.TILAWATI) {
      metric1 = 'Fashohah/Kelancaran';
      metric2 = 'Tajwid';
      metric3 = 'Adab';
      specificStats = `
      - Rata-rata ${metric1}: ${stats.avgFluency.toFixed(2)}
      - Rata-rata ${metric2}: ${stats.avgTajwid.toFixed(2)}
      - Rata-rata ${metric3}: ${stats.avgAdab.toFixed(2)}
      `;
  } else if (record.subject === SubjectType.LITERASI) {
      specificStats = `
      - Rata-rata Nilai Literasi: ${stats.avgLitScore} (Skala 100)
      `;
  } else if (record.subject === SubjectType.KONSULTASI) {
      metric1 = 'Kerapian (Inv)';
      metric2 = 'Kelengkapan Atribut (Flu)';
      metric3 = 'Kesehatan Fisik (Taj)';
      metric4 = 'Respon Konseling (Adab)';
      specificStats = `
      - Rata-rata ${metric1}: ${stats.avgInvolvement.toFixed(2)}
      - Rata-rata ${metric2}: ${stats.avgFluency.toFixed(2)}
      - Rata-rata ${metric3}: ${stats.avgTajwid.toFixed(2)}
      - Rata-rata ${metric4}: ${stats.avgAdab.toFixed(2)}
      `;
  } else {
      // General / Ibadah
      metric1 = 'Keaktifan';
      metric2 = 'Kelancaran';
      metric3 = 'Tajwid/Fokus';
      metric4 = 'Adab';
      specificStats = `
      - Rata-rata ${metric1}: ${stats.avgInvolvement.toFixed(2)}
      - Rata-rata ${metric2}: ${stats.avgFluency.toFixed(2)}
      - Rata-rata ${metric3}: ${stats.avgTajwid.toFixed(2)}
      - Rata-rata ${metric4}: ${stats.avgAdab.toFixed(2)}
      `;
  }

  const prompt = `
    Analisis data monitoring "Jam ke-0" (${record.subject}) untuk kelas ${record.classId} pada tanggal ${record.date}.
    
    Data Statistik:
    - Hadir: ${stats.present}
    - Terlambat: ${stats.late}
    ${specificStats}
    
    Catatan Guru:
    ${record.teacherAnalysis}
    
    Bertindaklah sebagai konsultan pendidikan senior. Berikan:
    1. Evaluasi objektif berdasarkan data angka di atas (Sebutkan nama variabel yang sesuai seperti "${metric1 || 'Nilai'}" atau "${metric2 || 'Atribut'}").
    2. Identifikasi pola masalah (misal: jika ${metric2 || 'nilai'} rendah tapi ${metric1 || 'kehadiran'} tinggi).
    3. 3 Saran konkret dan praktis untuk wali kelas guna perbaikan minggu depan.
    
    Gunakan Bahasa Indonesia yang formal namun suportif.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah analis data pendidikan AI untuk SMA Islam Al-Ghozali. Gunakan istilah variabel yang sesuai dengan konteks mata pelajaran.",
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

export const generateEvaluationSummary = async (records: DailyRecord[], periodType: 'Harian' | 'Triwulan' | 'Bulanan') => {
    if (records.length === 0) return "Tidak ada data laporan untuk periode ini.";

    // Pre-process data to save tokens and focus on key metrics
    const dataSummary = records.map(r => {
        const stats = calculateStats(r.studentScores);
        
        // Determine label context for summary
        let contextLabel = "Nilai/Performa";
        if (r.subject === SubjectType.KONSULTASI) contextLabel = "Kerapian/Kesehatan";
        else if (r.subject === SubjectType.TILAWATI) contextLabel = "Fashohah/Tajwid";
        
        const lowPerformanceStudents = r.studentScores
            .filter(s => s.fluency < 2 || s.tajwid < 2 || s.adab < 2 || (s.literacyScore !== undefined && s.literacyScore < 60))
            .map(s => s.studentName)
            .join(", ");

        return `
        - Tanggal: ${r.date} (${r.subject})
        - Kehadiran: Hadir ${stats.present}, Telat ${stats.late}
        - Fokus Data (${contextLabel}): ${stats.avgTajwid || stats.avgLitScore} (Rata-rata)
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
        2. **Capaian Pembelajaran & Karakter**: Analisis berdasarkan konteks mapel (misal: Tilawati=Mengaji, Konsultasi=Kerapian/Masalah Siswa, Literasi=Nilai). Jangan menyamaratakan istilah.
        3. **Isu Krusial**: Sebutkan nama siswa yang muncul berulang kali sebagai "Perlu Perhatian" dan masalah spesifiknya.
        4. **Evaluasi Kinerja Guru**: Berdasarkan "Rencana Tindak Lanjut", seberapa efektif strategi yang sudah dijalankan?
        5. **KESIMPULAN AKHIR OTOMATIS**:
           - STATUS KELAS: [BERMASALAH / CUKUP / BAIK / SANGAT BAIK]
           - FOKUS PERBAIKAN UTAMA: [Satu kalimat singkat]
        6. **Rekomendasi Strategis**: Saran konkret untuk ${periodType === 'Harian' ? 'besok' : periodType === 'Triwulan' ? 'Triwulan depan' : 'bulan depan'}.

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
