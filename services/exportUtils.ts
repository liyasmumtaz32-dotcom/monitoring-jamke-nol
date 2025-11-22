import { DailyRecord, SubjectType, StudentScore } from '../types';
import { CONSULTATION_OPTIONS } from '../constants';

const convertScoreToText = (val: number) => {
    if (val === 4) return "Sangat Baik";
    if (val === 3) return "Baik";
    if (val === 2) return "Cukup";
    return "Kurang";
};

const getConsultationLabel = (key: 'kerapian' | 'atribut' | 'kesehatan' | 'respon', val: number) => {
    const option = CONSULTATION_OPTIONS[key].find(o => o.value === val);
    return option ? option.label : val.toString();
};

export const generateReportHTML = (dataToExport: DailyRecord[], title: string) => {
    const content = dataToExport.map((record, index) => {
        const isTilawati = record.subject === SubjectType.TILAWATI;
        const isLiterasi = record.subject === SubjectType.LITERASI;
        const isKonsultasi = record.subject === SubjectType.KONSULTASI;
        
        let tableHeaders = '';
        let tableBody: (s: StudentScore) => string;

        if (isTilawati) {
            tableHeaders = `
                <th style="background-color:#e0e0e0">Jilid</th><th style="background-color:#e0e0e0">Halaman</th>
                <th style="background-color:#e0e0e0">Fashohah</th><th style="background-color:#e0e0e0">Tajwid</th><th style="background-color:#e0e0e0">Adab</th>
            `;
            tableBody = (s: StudentScore) => `
                <td align="center">${s.jilid || '-'}</td><td align="center">${s.page || '-'}</td>
                <td align="center">${convertScoreToText(s.fluency)}</td>
                <td align="center">${convertScoreToText(s.tajwid)}</td>
                <td align="center">${convertScoreToText(s.adab)}</td>
            `;
        } else if (isLiterasi) {
            tableHeaders = `
                <th style="background-color:#e0e0e0">Jml Soal</th><th style="background-color:#e0e0e0">Benar</th><th style="background-color:#e0e0e0">Salah</th><th style="background-color:#e0e0e0">Nilai</th>
            `;
            tableBody = (s: StudentScore) => `
                <td align="center">${s.literacyTotalQuestions || 0}</td>
                <td align="center">${s.literacyCorrect || 0}</td>
                <td align="center">${s.literacyWrong || 0}</td>
                <td align="center"><strong>${s.literacyScore || 0}</strong></td>
            `;
        } else if (isKonsultasi) {
            tableHeaders = `
                <th style="background-color:#e0e0e0">Kerapian</th><th style="background-color:#e0e0e0">Atribut</th><th style="background-color:#e0e0e0">Kesehatan</th><th style="background-color:#e0e0e0">Respon</th>
            `;
            tableBody = (s: StudentScore) => `
                <td align="center">${getConsultationLabel('kerapian', s.activeInvolvement)}</td>
                <td align="center">${getConsultationLabel('atribut', s.fluency)}</td>
                <td align="center">${getConsultationLabel('kesehatan', s.tajwid)}</td>
                <td align="center">${getConsultationLabel('respon', s.adab)}</td>
            `;
        } else {
            tableHeaders = `
                <th style="background-color:#e0e0e0">Aktif</th><th style="background-color:#e0e0e0">Lancar</th><th style="background-color:#e0e0e0">Tajwid</th><th style="background-color:#e0e0e0">Adab</th>
            `;
            tableBody = (s: StudentScore) => `
                <td align="center">${s.activeInvolvement}</td>
                <td align="center">${s.fluency}</td>
                <td align="center">${s.tajwid}</td>
                <td align="center">${s.adab}</td>
            `;
        }

        const pageBreak = index > 0 ? '<br style="page-break-before: always"/>' : '';

        return `
            ${pageBreak}
            <div class="report-section">
                <h2 style="margin-bottom: 5px; font-size: 18px; color: #2c3e50; border-bottom: 2px solid #333; padding-bottom: 5px;">
                    KELAS: ${record.classId}
                </h2>
                <table style="width: 100%; border: none; margin-bottom: 10px;">
                    <tr>
                        <td style="border: none; width: 50%;"><strong>Mapel:</strong> ${record.subject}</td>
                        <td style="border: none; width: 50%;"><strong>Tanggal:</strong> ${record.date}</td>
                    </tr>
                    <tr>
                        <td style="border: none;"><strong>Wali Kelas:</strong> ${record.teacherName}</td>
                        <td style="border: none;"></td>
                    </tr>
                </table>
                
                <table border="1" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11px;">
                   <thead>
                     <tr style="background-color: #f0f0f0; text-align: center;">
                        <th style="padding: 5px;">No</th>
                        <th style="padding: 5px;">Nama</th>
                        <th style="padding: 5px;">Hadir</th>
                        ${tableHeaders}
                        <th style="padding: 5px;">Catatan</th>
                     </tr>
                   </thead>
                   <tbody>
                     ${record.studentScores.map((s, idx) => `
                        <tr>
                            <td style="text-align: center;">${idx + 1}</td>
                            <td>${s.studentName}</td>
                            <td style="text-align: center;">${s.attendance}</td>
                            ${tableBody(s)}
                            <td>${s.notes}</td>
                        </tr>
                     `).join('')}
                   </tbody>
                </table>
                <br/>
                <div style="border: 1px solid #ccc; padding: 10px; background-color: #f9f9f9; font-size: 11px;">
                    <p style="margin: 5px 0;"><strong>Analisis Guru:</strong> ${record.teacherAnalysis || '-'}</p>
                    <p style="margin: 5px 0;"><strong>Siswa Perlu Pendampingan:</strong> ${record.recommendations.specialAttention || '-'}</p>
                    <p style="margin: 5px 0;"><strong>Evaluasi Metode:</strong> ${record.recommendations.methodImprovement || '-'}</p>
                </div>
            </div>
        `;
    }).join('');

    return `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
      <head>
        <meta charset='utf-8'>
        <title>${title}</title>
        <style>
            body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 4px; font-size: 11px; }
            h2 { font-size: 16px; color: #333; }
        </style>
      </head>
      <body>
        <h1 style="text-align:center; font-size:24px; margin-bottom: 20px;">${title}</h1>
        <p style="text-align:center; font-size:12px;">Dicetak pada: ${new Date().toLocaleDateString('id-ID')} pukul ${new Date().toLocaleTimeString('id-ID')}</p>
        <br/>
        ${content}
        <br/><br/>
        <p style="text-align: center; color: #888; font-size: 10px;">Generated by Monit0r System - Admin Module</p>
      </body></html>
    `;
};

export const downloadDoc = (htmlContent: string, fileName: string) => {
    try {
        const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
        console.error("Export failed:", error);
        alert("Gagal mengunduh file. Terjadi kesalahan saat membuat dokumen.");
    }
};