import React, { useState, useMemo } from 'react';
import { DailyRecord, SubjectType, StudentScore } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FileText, MessageSquare, Calendar, TrendingUp, BookOpen, CheckCircle, Download, Users, ShieldCheck, ListFilter, ArrowLeft, Eye } from 'lucide-react';
import { generateComprehensiveReport, generateEvaluationSummary } from '../services/geminiService';
import { CONSULTATION_OPTIONS, MOCK_CLASSES } from '../constants';
import { generateReportHTML, downloadDoc } from '../services/exportUtils';

interface Props {
  records: DailyRecord[];
  allRecords: DailyRecord[];
  isAdmin?: boolean;
}

export const Dashboard: React.FC<Props> = ({ records, allRecords, isAdmin = false }) => {
  const [chatQuery, setChatQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  
  // Admin Specific State
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  // Summary State
  const [summaryType, setSummaryType] = useState<'Harian' | 'Triwulan' | 'Bulanan'>('Harian');
  const [summaryResult, setSummaryResult] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Export Loading State
  const [isExporting, setIsExporting] = useState(false);

  // --- ADMIN SPECIFIC: Class Summary Calculation ---
  const classSummary = useMemo(() => {
    if (!isAdmin) return [];
    
    const todayStr = new Date().toISOString().split('T')[0];
    const summaryMap = new Map<string, {count: number, lastDate: string, teacher: string, submittedToday: boolean}>();

    // 1. Initialize with MOCK_CLASSES to show ALL classes (even empty ones)
    MOCK_CLASSES.forEach(c => {
        summaryMap.set(c.name, {
            count: 0, 
            lastDate: '-', 
            teacher: c.homeroomTeacher,
            submittedToday: false
        });
    });

    // 2. Process All Records to fill/overwrite data
    allRecords.forEach(r => {
        const current = summaryMap.get(r.classId) || { 
            count: 0, 
            lastDate: '-', 
            teacher: r.teacherName,
            submittedToday: false
        };

        current.count += 1;
        if (current.lastDate === '-' || new Date(r.date) > new Date(current.lastDate)) {
             current.lastDate = r.date;
        }
        if (r.date === todayStr) {
            current.submittedToday = true;
        }
        // Update teacher name just in case
        current.teacher = r.teacherName;

        summaryMap.set(r.classId, current);
    });

    return Array.from(summaryMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
  }, [allRecords, isAdmin]);

  // --- Determine Displayed Records (Global vs Detail) ---
  const displayedRecords = useMemo(() => {
      if (isAdmin && selectedClass) {
          return allRecords.filter(r => r.classId === selectedClass);
      }
      return records; // For normal user or Admin Global View
  }, [isAdmin, selectedClass, allRecords, records]);

  // Prepare Chart Data
  const chartData = displayedRecords.map(r => {
    let scoreVal = 0;
    if (r.subject === SubjectType.LITERASI) {
        const avgLit = r.studentScores.reduce((acc, curr) => acc + (curr.literacyScore || 0), 0) / r.studentScores.length;
        scoreVal = avgLit / 25; 
    } else {
        scoreVal = r.studentScores.reduce((acc, curr) => acc + curr.activeInvolvement, 0) / r.studentScores.length;
    }

    return {
        date: r.date,
        label: (isAdmin && !selectedClass) ? `${r.date} (${r.classId})` : r.date,
        kehadiran: r.studentScores.filter(s => s.attendance === 'H').length,
        rataRata: scoreVal.toFixed(2)
    };
  });
  
  const displayChartData = (isAdmin && !selectedClass) ? chartData.slice(0, 50) : chartData;

  const handleComprehensiveAsk = async () => {
    setIsThinking(true);
    const res = await generateComprehensiveReport(displayedRecords, chatQuery);
    setAiResponse(res || "");
    setIsThinking(false);
  };

  const handleGenerateSummary = async (type: 'Harian' | 'Triwulan' | 'Bulanan') => {
      setSummaryType(type);
      setIsGeneratingSummary(true);
      setSummaryResult('');

      const today = new Date();
      let filteredRecords: DailyRecord[] = [];

      if (type === 'Harian') {
          const todayStr = today.toISOString().split('T')[0];
          filteredRecords = displayedRecords.filter(r => r.date === todayStr);
          if (filteredRecords.length === 0 && displayedRecords.length > 0) {
              filteredRecords = [displayedRecords[0]]; 
          }
      } else if (type === 'Triwulan') {
          const last90Days = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
          filteredRecords = displayedRecords.filter(r => new Date(r.date) >= last90Days);
      } else if (type === 'Bulanan') {
          filteredRecords = displayedRecords.filter(r => {
              const d = new Date(r.date);
              return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
          });
      }

      const res = await generateEvaluationSummary(filteredRecords, type);
      setSummaryResult(res || "Gagal membuat ringkasan.");
      setIsGeneratingSummary(false);
  };

  const exportCurrentClassReports = () => {
    if (displayedRecords.length === 0) {
        alert("Tidak ada data laporan untuk diekspor.");
        return;
    }
    const title = selectedClass ? `Laporan Kelas ${selectedClass}` : `Laporan Kelas`;
    const html = generateReportHTML(displayedRecords, title);
    downloadDoc(html, `Rekap_${selectedClass || 'Kelas'}_${new Date().toISOString().split('T')[0]}.doc`);
  };

  const exportMassReports = async () => {
    if (allRecords.length === 0) {
        alert("Database kosong, belum ada laporan dari kelas manapun.");
        return;
    }
    
    setIsExporting(true);

    // Add small delay to allow UI to show loading state before heavy processing
    setTimeout(() => {
        try {
            const sortedRecords = [...allRecords].sort((a, b) => {
                const classComparison = a.classId.localeCompare(b.classId, undefined, {numeric: true});
                if (classComparison !== 0) return classComparison;
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });

            const html = generateReportHTML(sortedRecords, "Laporan Monitoring Massal (Semua Kelas)");
            downloadDoc(html, `Laporan_Massal_Semua_Kelas_${new Date().toISOString().split('T')[0]}.doc`);
        } catch (e) {
            console.error(e);
            alert("Gagal melakukan ekspor massal.");
        } finally {
            setIsExporting(false);
        }
    }, 100);
  };

  const copyReportToClipboard = (record: DailyRecord) => {
    const html = generateReportHTML([record], `Laporan ${record.classId}`);
    downloadDoc(html, `Laporan_${record.classId}_${record.date}.doc`);
  };

  return (
    <div className="space-y-8">
      {/* ADMIN: Navigation Header */}
      {isAdmin && selectedClass && (
          <div className="flex items-center justify-between mb-2 animate-fade-in">
              <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedClass(null)}
                    className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium transition-colors bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 hover:shadow-md"
                  >
                      <ArrowLeft size={20} /> Kembali
                  </button>
                  <div className="flex flex-col">
                      <h2 className="text-2xl font-bold text-slate-800">Detail Monitoring</h2>
                      <span className="text-indigo-600 font-semibold text-lg">{selectedClass}</span>
                  </div>
              </div>
              <button 
                  onClick={exportCurrentClassReports}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 hover:shadow-md transition-all flex items-center gap-2"
              >
                  <Download size={16} /> Ekspor Kelas Ini
              </button>
          </div>
      )}

      {/* ADMIN VIEW: Class Summary Grid (Show if no specific class selected) */}
      {isAdmin && !selectedClass && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <ListFilter className="text-indigo-600" /> Monitoring Seluruh Kelas
                </h3>
                <div className="flex gap-2">
                    <div className="text-xs text-green-700 bg-green-100 px-3 py-1 rounded-full flex items-center gap-1">
                         <CheckCircle size={12} /> Sudah Lapor Hari Ini
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {classSummary.map(cls => (
                    <div 
                        key={cls.name} 
                        onClick={() => setSelectedClass(cls.name)}
                        className={`p-4 rounded-lg border transition-all shadow-sm hover:shadow-md cursor-pointer relative group
                            ${cls.submittedToday 
                                ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                                : 'bg-slate-50 border-slate-200 hover:border-indigo-300 hover:bg-white'}`}
                    >
                        {/* Status Badge */}
                        {cls.submittedToday && (
                            <div className="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                <CheckCircle size={10} /> SELESAI
                            </div>
                        )}

                        <div className="flex justify-between items-start mb-2">
                            <div className="font-bold text-lg text-slate-800 group-hover:text-indigo-600">{cls.name}</div>
                        </div>
                        <div className="text-xs text-slate-500 mb-2 truncate" title={cls.teacher}>
                            {cls.teacher}
                        </div>
                        <div className="flex justify-between items-center mt-2">
                             <div className="bg-white/50 px-2 py-1 rounded text-[10px] font-medium text-slate-600 border border-slate-100">
                                {cls.count} Laporan
                             </div>
                             <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                {cls.lastDate === '-' ? 'Belum ada data' : cls.lastDate}
                             </div>
                        </div>
                    </div>
                ))}
            </div>
          </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="text-slate-500 text-sm mb-1">
                {isAdmin && !selectedClass ? 'Total Seluruh Laporan' : `Total Laporan (${selectedClass || 'Kelas Ini'})`}
            </div>
            <div className="text-3xl font-bold text-slate-800">{displayedRecords.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="text-slate-500 text-sm mb-1">Kehadiran Rata-rata</div>
             <div className="text-3xl font-bold text-green-600">92%</div>
        </div>
        <div className={`p-6 rounded-xl shadow-sm border ${isAdmin ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200'}`}>
             <div className="text-slate-500 text-sm mb-1">
                {isAdmin && !selectedClass ? 'Total Data (Semua Kelas)' : 'Status Sistem'}
             </div>
             <div className="text-3xl font-bold text-indigo-600">
                {isAdmin && !selectedClass ? allRecords.length : 'Aktif'}
             </div>
             {isAdmin && <div className="text-xs text-red-600 font-medium mt-1">Mode Administrator</div>}
        </div>
      </div>

      {/* AI Summary Section */}
      <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-6 rounded-xl shadow-lg text-white">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="text-yellow-400"/> Ringkasan Evaluasi AI {isAdmin && !selectedClass ? '(Global)' : selectedClass ? `(${selectedClass})` : ''}
        </h3>
        <p className="text-indigo-200 text-sm mb-6">
            Buat laporan eksekutif untuk sesi evaluasi berdasarkan data yang terkumpul.
        </p>
        
        <div className="flex flex-wrap gap-3 mb-6">
            {['Harian', 'Triwulan', 'Bulanan'].map((type) => (
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
                   {type === 'Harian' ? <CheckCircle size={16}/> : type === 'Triwulan' ? <Calendar size={16}/> : <BookOpen size={16}/>}
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
        <h3 className="text-lg font-bold mb-6">
            Tren Keaktifan/Nilai & Kehadiran {isAdmin && !selectedClass ? '(50 Data Terakhir)' : `(${selectedClass || 'Kelas Ini'})`}
        </h3>
        <div className="h-64 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey={isAdmin && !selectedClass ? "label" : "date"} hide={isAdmin && !selectedClass} />
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
      <div className={`bg-white rounded-xl shadow-sm border overflow-hidden ${isAdmin ? 'border-red-200 ring-2 ring-red-50' : 'border-slate-200'}`}>
        <div className="p-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-2">
                {isAdmin ? <ShieldCheck className="text-red-600" /> : <FileText className="text-indigo-600" />}
                <h3 className="font-bold text-lg">
                    {isAdmin && !selectedClass ? 'Database Seluruh Kelas' : `Riwayat Laporan ${selectedClass || ''}`}
                </h3>
            </div>
            
            <div className="flex gap-2">
                {/* Mass Export Button - Only visible in Admin Global View */}
                {isAdmin && !selectedClass && (
                    <button 
                        onClick={exportMassReports}
                        disabled={isExporting}
                        className={`${isExporting ? 'bg-slate-400' : 'bg-red-700 hover:bg-red-800'} text-white px-4 py-2 rounded-lg text-sm font-medium hover:shadow-md transition-all flex items-center gap-2`}
                        title="Unduh semua laporan dari seluruh kelas dalam satu file"
                    >
                        {isExporting ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <Users size={16} /> 
                        )}
                        {isExporting ? 'MEMPROSES...' : 'EKSPOR MASSAL (SEMUA KELAS)'}
                    </button>
                )}

                {/* Single Class Export - Visible for Teacher OR Admin Detail View */}
                {(!isAdmin || selectedClass) && (
                    <button 
                        onClick={exportCurrentClassReports}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 hover:shadow-md transition-all flex items-center gap-2"
                    >
                        <Download size={16} /> Ekspor Kelas Ini
                    </button>
                )}
            </div>
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
                {displayedRecords.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400">Belum ada data laporan.</td></tr>
                ) : displayedRecords.map(r => (
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