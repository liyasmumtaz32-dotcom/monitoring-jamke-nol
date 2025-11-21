
import React, { useState } from 'react';
import { DailyRecord, SubjectType, StudentScore } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FileText, MessageSquare, Calendar, TrendingUp, BookOpen, CheckCircle, Download } from 'lucide-react';
import { generateComprehensiveReport, generateEvaluationSummary } from '../services/geminiService';

interface Props {
  records: DailyRecord[];
}

export const Dashboard: React.FC<Props> = ({ records }) => {
  const [chatQuery, setChatQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // Summary State
  const [summaryType, setSummaryType] = useState<'Harian' | 'Mingguan' | 'Bulanan'>('Harian');
  const [summaryResult, setSummaryResult] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const chartData = records.map(r => {
    // Normalize score to percentage or 1-4 scale for chart visualization
    let scoreVal = 0;
    if (r.subject === SubjectType.LITERASI) {
        const avgLit = r.studentScores.reduce((acc, curr) => acc + (curr.literacyScore || 0), 0) / r.studentScores.length;
        scoreVal = avgLit / 25; // Convert 100 scale to roughly 4 scale for chart consistency
    } else {
        scoreVal = r.studentScores.reduce((acc, curr) => acc + curr.activeInvolvement, 0) / r.studentScores.length;
    }

    return {
        date: r.date,
        kehadiran: r.studentScores.filter(s => s.attendance === 'H').length,
        rataRata: scoreVal.toFixed(2)
    };
  });

  const handleComprehensiveAsk = async () => {
    setIsThinking(true);
    const res = await generateComprehensiveReport(records, chatQuery);
    setAiResponse(res || "");
    setIsThinking(false);
  };

  const handleGenerateSummary = async (type: 'Harian' | 'Mingguan' | 'Bulanan') => {
      setSummaryType(type);
      setIsGeneratingSummary(true);
      setSummaryResult('');

      const today = new Date();
      let filteredRecords: DailyRecord[] = [];

      if (type === 'Harian') {
          // Get today's record or the latest one if today is empty
          const todayStr = today.toISOString().split('T')[0];
          filteredRecords = records.filter(r => r.date === todayStr);
          if (filteredRecords.length === 0 && records.length > 0) {
              filteredRecords = [records[0]]; // Fallback to latest
          }
      } else if (type === 'Mingguan') {
          // Last 7 days
          const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          filteredRecords = records.filter(r => new Date(r.date) >= lastWeek);
      } else if (type === 'Bulanan') {
          // Current Month
          filteredRecords = records.filter(r => {
              const d = new Date(r.date);
              return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
          });
      }

      const res = await generateEvaluationSummary(filteredRecords, type);
      setSummaryResult(res || "Gagal membuat ringkasan.");
      setIsGeneratingSummary(false);
  };

  // Helper for visual report export (rough translation back to text)
  const convertScoreToText = (val: number) => {
      if (val === 4) return "Sangat Baik";
      if (val === 3) return "Baik";
      if (val === 2) return "Cukup";
      return "Kurang";
  };

  const exportAllReportsToWord = () => {
    if (records.length === 0) {
        alert("Tidak ada data laporan untuk diekspor.");
        return;
    }

    const content = records.map(record => {
        const isTilawati = record.subject === SubjectType.TILAWATI;
        const isLiterasi = record.subject === SubjectType.LITERASI;
        
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

        return `
            <div class="report-section">
                <h2 style="margin-bottom: 5px; font-size: 16px;">Laporan Monitoring Jam Ke-0</h2>
                <table style="width: 100%; border: none; margin-bottom: 10px;">
                    <tr>
                        <td style="border: none; width: 50%;"><strong>Mapel:</strong> ${record.subject}</td>
                        <td style="border: none; width: 50%;"><strong>Kelas:</strong> ${record.classId}</td>
                    </tr>
                    <tr>
                        <td style="border: none;"><strong>Tanggal:</strong> ${record.date}</td>
                        <td style="border: none;"><strong>Guru:</strong> ${record.teacherName}</td>
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
                    <p style="margin: 5px 0;"><strong>Rencana Tindak Lanjut:</strong> ${record.recommendations.nextWeekPlan || '-'}</p>
                </div>
            </div>
            <br style="page-break-before: always"/>
        `;
    }).join('');

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
      <head>
        <meta charset='utf-8'>
        <title>Rekapitulasi Laporan Jam Ke-0</title>
        <style>
            body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 4px; font-size: 11px; }
            h2 { font-size: 16px; color: #333; }
        </style>
      </head>
      <body>
        ${content}
        <p style="text-align: center; color: #888; font-size: 10px;">Generated by Monit0r System</p>
      </body></html>
    `;
    
    const url = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(htmlContent);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rekap_Semua_Laporan_${new Date().toISOString().split('T')[0]}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyReportToClipboard = (record: DailyRecord) => {
    const isTilawati = record.subject === SubjectType.TILAWATI;
    const isLiterasi = record.subject === SubjectType.LITERASI;
    
    let tableHeaders = '';
    let tableBody: (s: StudentScore) => string;

    if (isTilawati) {
        tableHeaders = `
            <th>Jilid</th><th>Halaman</th>
            <th>Fashohah</th><th>Tajwid</th><th>Adab</th>
        `;
        tableBody = (s: StudentScore) => `
            <td>${s.jilid || '-'}</td><td>${s.page || '-'}</td>
            <td>${convertScoreToText(s.fluency)}</td>
            <td>${convertScoreToText(s.tajwid)}</td>
            <td>${convertScoreToText(s.adab)}</td>
        `;
    } else if (isLiterasi) {
        tableHeaders = `
            <th>Jml Soal</th><th>Benar</th><th>Salah</th><th>Nilai</th>
        `;
        tableBody = (s: StudentScore) => `
            <td>${s.literacyTotalQuestions || 0}</td>
            <td>${s.literacyCorrect || 0}</td>
            <td>${s.literacyWrong || 0}</td>
            <td><strong>${s.literacyScore || 0}</strong></td>
        `;
    } else {
        tableHeaders = `
            <th>Aktif</th><th>Lancar</th><th>Tajwid</th><th>Adab</th>
        `;
        tableBody = (s: StudentScore) => `
            <td>${s.activeInvolvement}</td>
            <td>${s.fluency}</td>
            <td>${s.tajwid}</td>
            <td>${s.adab}</td>
        `;
    }
    
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
      <head><meta charset='utf-8'><title>Laporan ${record.date}</title></head>
      <body>
        <h1>Laporan Monitoring Jam Ke-0 (${record.subject})</h1>
        <p><strong>Kelas:</strong> ${record.classId}</p>
        <p><strong>Tanggal:</strong> ${record.date}</p>
        <p><strong>Guru:</strong> ${record.teacherName}</p>
        <br/>
        <table border="1" style="border-collapse: collapse; width: 100%;">
           <thead style="background-color: #f0f0f0;">
             <tr>
                <th>Nama</th>
                <th>Hadir</th>
                ${tableHeaders}
                <th>Catatan</th>
             </tr>
           </thead>
           <tbody>
             ${record.studentScores.map(s => `
                <tr>
                    <td>${s.studentName}</td>
                    <td>${s.attendance}</td>
                    ${tableBody(s)}
                    <td>${s.notes}</td>
                </tr>
             `).join('')}
           </tbody>
        </table>
        <br/>
        <h3>Analisis & Evaluasi</h3>
        <p><strong>Analisis Guru:</strong> ${record.teacherAnalysis}</p>
        <p><strong>Siswa Perlu Pendampingan:</strong> ${record.recommendations.specialAttention}</p>
        <p><strong>Evaluasi Metode:</strong> ${record.recommendations.methodImprovement}</p>
        <p><strong>Rencana Minggu Depan:</strong> ${record.recommendations.nextWeekPlan}</p>
        <hr/>
        <p><em>Generated by Monit0r AI</em></p>
      </body></html>
    `;
    
    const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword'
    });
    
    const url = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(htmlContent);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_${record.classId}_${record.date}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="text-slate-500 text-sm mb-1">Total Laporan</div>
            <div className="text-3xl font-bold text-slate-800">{records.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="text-slate-500 text-sm mb-1">Kehadiran Rata-rata</div>
             <div className="text-3xl font-bold text-green-600">92%</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="text-slate-500 text-sm mb-1">Subjek Dominan</div>
             <div className="text-3xl font-bold text-indigo-600">Tilawati</div>
        </div>
      </div>

      {/* AI Summary Section */}
      <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-6 rounded-xl shadow-lg text-white">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="text-yellow-400"/> Ringkasan Evaluasi AI
        </h3>
        <p className="text-indigo-200 text-sm mb-6">
            Buat laporan eksekutif untuk sesi evaluasi (Konsultasi Sabtu) berdasarkan data yang terkumpul.
        </p>
        
        <div className="flex flex-wrap gap-3 mb-6">
            {['Harian', 'Mingguan', 'Bulanan'].map((type) => (
                <button
                    key={type}
                    onClick={() => handleGenerateSummary(type as any)}
                    disabled={isGeneratingSummary}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                        summaryType === type 
                        ? 'bg-white text-indigo-900 shadow-md transform scale-105' 
                        : 'bg-indigo-800/50 text-indigo-100 hover:bg-indigo-800'
                    }`}
                >
                   {type === 'Harian' ? <CheckCircle size={16}/> : type === 'Mingguan' ? <Calendar size={16}/> : <BookOpen size={16}/>}
                   Evaluasi {type}
                </button>
            ))}
        </div>

        {isGeneratingSummary && (
             <div className="animate-pulse space-y-3">
                <div className="h-4 bg-indigo-400/30 rounded w-3/4"></div>
                <div className="h-4 bg-indigo-400/30 rounded w-1/2"></div>
                <div className="h-4 bg-indigo-400/30 rounded w-5/6"></div>
             </div>
        )}

        {!isGeneratingSummary && summaryResult && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/10 text-indigo-50 text-sm leading-relaxed whitespace-pre-wrap">
                {summaryResult}
            </div>
        )}
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold mb-6">Tren Keaktifan/Nilai & Kehadiran</h3>
        <div className="h-64 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="kehadiran" fill="#4F46E5" name="Siswa Hadir" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="rataRata" fill="#10B981" name="Skor (Scaled 4.0)" radius={[4, 4, 0, 0]} />
                </BarChart>
             </ResponsiveContainer>
        </div>
      </div>

      {/* List & Export */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-lg">Riwayat Laporan</h3>
            <button 
                onClick={exportAllReportsToWord}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 hover:shadow-md transition-all flex items-center gap-2"
            >
                <Download size={16} /> Ekspor Semua (.doc)
            </button>
        </div>
        <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                    <th className="p-4">Tanggal</th>
                    <th className="p-4">Kelas</th>
                    <th className="p-4">Mapel</th>
                    <th className="p-4 text-right">Aksi</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {records.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400">Belum ada data laporan.</td></tr>
                ) : records.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                        <td className="p-4">{r.date}</td>
                        <td className="p-4 font-medium">{r.classId}</td>
                        <td className="p-4">
                            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">{r.subject}</span>
                        </td>
                        <td className="p-4 text-right">
                            <button 
                                onClick={() => copyReportToClipboard(r)}
                                className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
                            >
                                <FileText size={16} /> Word
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* Custom Chat Query */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
         <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><MessageSquare className="text-purple-500"/> Tanya Data Lanjutan</h3>
         <p className="text-sm text-slate-500 mb-4">Tanyakan hal spesifik yang tidak tercakup dalam ringkasan evaluasi di atas.</p>
         
         <div className="flex gap-2 mb-4">
            <input 
                type="text" 
                className="flex-1 p-3 border rounded-lg"
                placeholder="Contoh: Siapa saja siswa yang tidak pernah hadir minggu ini?"
                value={chatQuery}
                onChange={e => setChatQuery(e.target.value)}
            />
            <button 
                onClick={handleComprehensiveAsk}
                disabled={isThinking}
                className="bg-purple-600 text-white px-6 rounded-lg font-medium disabled:bg-purple-300"
            >
                {isThinking ? 'Thinking...' : 'Tanya AI'}
            </button>
         </div>
         
         {aiResponse && (
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-800 text-sm whitespace-pre-wrap">
                {aiResponse}
             </div>
         )}
      </div>
    </div>
  );
};
