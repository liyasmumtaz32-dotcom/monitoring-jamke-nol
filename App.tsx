
import React, { useState, useEffect } from 'react';
import { ClassData, DailyRecord, AttendanceStatus, SubjectType } from './types';
import { DailyEntryForm } from './components/DailyEntryForm';
import { Dashboard } from './components/Dashboard';
import { VoiceConsultant } from './components/VoiceConsultant';
import { Login } from './components/Login';
import { LayoutDashboard, PenTool, Menu, LogOut, Database, ShieldCheck, ArrowLeft, Zap, Calendar, CheckCircle, AlertTriangle, CheckSquare, Square, Filter, ListChecks, X, Download, Settings, Sparkles, FileText, Play, Layers } from 'lucide-react';
import { saveRecordToDB, getRecordsFromDB } from './db';
import { MOCK_CLASSES, getSubjectForDay } from './constants';
import { generateReportHTML, downloadDoc } from './services/exportUtils';
import { generateRandomStudentScores, generateClassReportTemplate } from './services/autoFillService';

export default function App() {
  // Auth State
  const [currentUserClass, setCurrentUserClass] = useState<ClassData | null>(null);

  // App State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'input'>('dashboard');
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [showVoice, setShowVoice] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Admin Input State
  const [adminSelectedClassForInput, setAdminSelectedClassForInput] = useState<ClassData | null>(null);
  const [allAvailableClasses, setAllAvailableClasses] = useState<ClassData[]>(MOCK_CLASSES);
  
  // Bulk Generate State
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkSubject, setBulkSubject] = useState<SubjectType>(SubjectType.TILAWATI);
  const [docsPerClass, setDocsPerClass] = useState<number>(4); // New: Default 4 docs per class
  const [selectedBulkClassIds, setSelectedBulkClassIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentClass: '' });
  const [showBulkResultModal, setShowBulkResultModal] = useState(false);
  const [bulkGeneratedRecords, setBulkGeneratedRecords] = useState<DailyRecord[]>([]);
  const [autoDownload, setAutoDownload] = useState(true);

  // Determine if user is ADMIN
  const isAdmin = currentUserClass?.id === 'ADMIN';

  // Load data from DB on mount
  useEffect(() => {
    const fetchData = async () => {
        try {
            const storedRecords = await getRecordsFromDB();
            // Sort by date descending (newest first)
            const sorted = storedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setRecords(sorted);

            // Load custom classes for Admin selector
            const storedClasses = localStorage.getItem('monit0r_custom_classes');
            if (storedClasses) {
                try {
                    const custom = JSON.parse(storedClasses);
                    setAllAvailableClasses([...MOCK_CLASSES, ...custom]);
                } catch (e) {
                    console.error("Failed to parse custom classes", e);
                }
            }
        } catch (error) {
            console.error("Failed to load data from DB", error);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, []);

  // Initialize bulk selection and subject
  useEffect(() => {
      if (allAvailableClasses.length > 0) {
          setSelectedBulkClassIds(new Set(allAvailableClasses.map(c => c.id)));
      }
  }, [allAvailableClasses]);

  useEffect(() => {
      setBulkSubject(getSubjectForDay(new Date(bulkDate)));
  }, [bulkDate]);

  const toggleBulkClass = (id: string) => {
      const newSet = new Set(selectedBulkClassIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedBulkClassIds(newSet);
  };

  const toggleAllBulk = () => {
      if (selectedBulkClassIds.size === allAvailableClasses.length) {
          setSelectedBulkClassIds(new Set());
      } else {
          setSelectedBulkClassIds(new Set(allAvailableClasses.map(c => c.id)));
      }
  };

  const handleSaveRecord = async (record: DailyRecord) => {
    try {
        // Save to IndexedDB
        await saveRecordToDB(record);
        
        // Update local state
        const updatedRecords = [record, ...records];
        setRecords(updatedRecords);
        
        setActiveTab('dashboard');
        alert("Laporan berhasil disimpan ke Database!");
    } catch (error) {
        console.error("Error saving record:", error);
        alert("Gagal menyimpan laporan. Silakan coba lagi.");
    }
  };

  const downloadBulkResults = (recordsToDownload: DailyRecord[]) => {
      if (!recordsToDownload || recordsToDownload.length === 0) return;
      
      // Sort by Class Name then Date
      const sorted = [...recordsToDownload].sort((a, b) => {
          const classCompare = a.classId.localeCompare(b.classId, undefined, {numeric: true});
          if (classCompare !== 0) return classCompare;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      const title = `Laporan_Massal_${bulkDate}_(${recordsToDownload.length}_Dokumen)`;
      const html = generateReportHTML(sorted, `Laporan Massal (${docsPerClass} Dokumen per Kelas)`);
      downloadDoc(html, `${title}.doc`);
  };

  const handleBulkGenerate = async () => {
      const classesToProcess = allAvailableClasses.filter(c => selectedBulkClassIds.has(c.id));

      if (classesToProcess.length === 0) {
          alert("Pilih setidaknya satu kelas untuk diproses.");
          return;
      }

      const totalDocsToGenerate = classesToProcess.length * docsPerClass;

      // Konfirmasi
      if (!confirm(`SIAP GENERATE?\n\nTarget: ${classesToProcess.length} Kelas\nJumlah: ${docsPerClass} Dokumen/Kelas\nTotal: ${totalDocsToGenerate} Dokumen\n\nSistem akan membuat laporan mundur per minggu dari tanggal yang dipilih.`)) {
          return;
      }

      setIsBulkProcessing(true);
      setShowBulkResultModal(false);
      setBulkGeneratedRecords([]); 
      setBulkProgress({ current: 0, total: totalDocsToGenerate, currentClass: 'Memulai...' });
      
      const newRecordsBatch: DailyRecord[] = [];
      let processedCount = 0;

      try {
          // Loop Kelas
          for (let i = 0; i < classesToProcess.length; i++) {
              const cls = classesToProcess[i];
              
              // Loop Jumlah Dokumen per Kelas (Mundur per minggu)
              for (let j = 0; j < docsPerClass; j++) {
                  processedCount++;
                  
                  // Hitung Tanggal Mundur (Week 1, Week 2, dst)
                  const d = new Date(bulkDate);
                  d.setDate(d.getDate() - (j * 7));
                  const specificDate = d.toISOString().split('T')[0];
                  
                  // Update visual progress state
                  setBulkProgress({ 
                      current: processedCount, 
                      total: totalDocsToGenerate,
                      currentClass: `${cls.name} (Dok ke-${j+1})` 
                  });
                  
                  // Delay sedikit agar UI sempat render ulang
                  await new Promise(resolve => setTimeout(resolve, 20));

                  // 1. Generate Nilai Siswa (Random Realistis berbeda tiap loop)
                  const studentsScores = generateRandomStudentScores(cls.students, bulkSubject);

                  // 2. Generate Analisis Guru
                  const templateData = generateClassReportTemplate(cls.name, cls.homeroomTeacher, bulkSubject, studentsScores);

                  const record: DailyRecord = {
                      id: `${Date.now()}-${cls.id}-${j}-${Math.random().toString(36).substr(2, 5)}`,
                      date: specificDate,
                      classId: cls.name,
                      teacherName: cls.homeroomTeacher,
                      subject: bulkSubject,
                      studentScores: studentsScores,
                      teacherAnalysis: templateData.teacherAnalysis,
                      recommendations: templateData.recommendations,
                      aiAnalysis: 'Auto-Generated (Standard Model)'
                  };

                  await saveRecordToDB(record);
                  newRecordsBatch.push(record);
              }
          }

          // Update state utama
          setRecords(prev => {
              const updated = [...newRecordsBatch, ...prev];
              return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          });
          
          setBulkGeneratedRecords(newRecordsBatch);
          
          // Tunggu sebentar di 100%
          await new Promise(resolve => setTimeout(resolve, 500));
          setIsBulkProcessing(false);
          setShowBulkResultModal(true);

          // Trigger Auto Download jika aktif
          if (autoDownload) {
             setTimeout(() => downloadBulkResults(newRecordsBatch), 500);
          }

      } catch (error) {
          console.error("Bulk generation error", error);
          alert("Terjadi kesalahan saat pembuatan massal.");
          setIsBulkProcessing(false);
      }
  };

  const handleLogout = () => {
    setCurrentUserClass(null);
    setActiveTab('dashboard');
    setAdminSelectedClassForInput(null);
  };

  if (!currentUserClass) {
    return <Login onLogin={setCurrentUserClass} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex relative font-sans">
      {/* LAYAR PROGRESS (FULL SCREEN OVERLAY) */}
      {isBulkProcessing && (
        <div className="fixed inset-0 bg-slate-900 z-[100] flex flex-col items-center justify-center text-white">
            <div className="w-full max-w-md px-6 text-center">
                <div className="mb-6 relative">
                    <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center mx-auto animate-pulse shadow-[0_0_30px_rgba(79,70,229,0.6)]">
                        <Database size={40} className="text-white" />
                    </div>
                </div>
                
                <h2 className="text-3xl font-bold mb-2">Sedang Membuat Laporan...</h2>
                <p className="text-indigo-300 mb-8 text-lg">Mohon tunggu, jangan tutup halaman ini.</p>

                {/* PROGRESS BAR BESAR */}
                <div className="w-full bg-slate-700 rounded-full h-6 mb-4 overflow-hidden border border-slate-600">
                    <div 
                        className="bg-gradient-to-r from-green-400 to-emerald-500 h-full transition-all duration-200 ease-out"
                        style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                    ></div>
                </div>

                {/* INDIKATOR ANGKA JELAS */}
                <div className="flex justify-between items-end border-b border-slate-700 pb-4 mb-4">
                    <div className="text-left">
                        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Proses Saat Ini</p>
                        <p className="text-xl font-bold text-yellow-400">{bulkProgress.currentClass}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Dokumen</p>
                        <p className="text-4xl font-black text-white">
                            {bulkProgress.current}<span className="text-slate-500 text-2xl">/{bulkProgress.total}</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* HASIL MODAL */}
      {showBulkResultModal && (
        <div className="fixed inset-0 bg-black/80 z-[90] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
                <div className="bg-emerald-600 p-8 text-white text-center shrink-0">
                    <div className="w-20 h-20 bg-white text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <CheckCircle size={48} />
                    </div>
                    <h3 className="text-3xl font-bold mb-1">SELESAI!</h3>
                    <p className="text-emerald-100 text-lg">
                        <span className="font-bold">{bulkGeneratedRecords.length}</span> Laporan Berhasil Dibuat
                    </p>
                </div>
                
                <div className="p-6 flex flex-col gap-4 bg-slate-50">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                         <p className="text-slate-500 text-sm mb-1">File Laporan (Word)</p>
                         {autoDownload ? (
                             <div className="text-green-600 font-bold flex items-center justify-center gap-2">
                                 <CheckCircle size={18} /> Terunduh Otomatis
                             </div>
                         ) : (
                             <p className="text-slate-800 font-medium">Siap diunduh</p>
                         )}
                    </div>

                    <button 
                        onClick={() => downloadBulkResults(bulkGeneratedRecords)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-indigo-200 hover:-translate-y-1"
                    >
                        <Download size={24} /> 
                        {autoDownload ? 'Unduh Ulang File (.doc)' : 'DOWNLOAD SEKARANG (.doc)'}
                    </button>
                    
                    <button 
                        onClick={() => setShowBulkResultModal(false)}
                        className="w-full bg-white border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 transform transition-transform lg:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Monit0r
          </h1>
          <p className="text-xs text-slate-500 mt-1">Jam Ke-0 System</p>
        </div>

        <div className={`p-4 mx-4 mt-4 rounded-lg border ${isAdmin ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'}`}>
           <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isAdmin ? 'text-red-600' : 'text-indigo-600'}`}>
               {isAdmin ? 'Administrator' : 'Login Sebagai'}
           </p>
           <p className="font-bold text-slate-800 text-sm">{currentUserClass.homeroomTeacher}</p>
           {!isAdmin && <p className="text-xs text-slate-600 mt-1">Kelas: {currentUserClass.name}</p>}
        </div>

        <nav className="p-4 space-y-2 mt-2">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {isAdmin ? <ShieldCheck size={20} /> : <LayoutDashboard size={20} />}
            {isAdmin ? 'Dashboard' : 'Dashboard Saya'}
          </button>
          
          <button 
              onClick={() => { setActiveTab('input'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'input' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
              <PenTool size={20} /> {isAdmin ? 'Generator Massal' : 'Isi Monitoring'}
          </button>
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100 space-y-2">
           <button 
             onClick={handleLogout}
             className="w-full flex items-center gap-2 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
           >
             <LogOut size={18} /> Keluar
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0">
             <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600">
                    <Menu />
                </button>
                <h2 className="text-lg font-semibold text-slate-800">
                    {activeTab === 'dashboard' 
                        ? (isAdmin ? 'Dashboard Admin' : `Dashboard Kelas ${currentUserClass.name}`) 
                        : (isAdmin ? 'Generator Laporan Otomatis' : 'Formulir Harian')}
                </h2>
             </div>
             {/* COUNTER DOKUMEN REAL */}
             {isAdmin && records.length > 0 && (
                <div className="hidden md:flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                    <FileText size={14} className="text-slate-500"/>
                    <span className="text-xs font-bold text-slate-700">Total Database: {records.length} Data</span>
                </div>
             )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10 bg-slate-50/50">
            <div className="max-w-6xl mx-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64 text-slate-500">
                        Memuat Data...
                    </div>
                ) : activeTab === 'dashboard' ? (
                    <Dashboard 
                        records={isAdmin ? records : records.filter(r => r.classId === currentUserClass.name)} 
                        allRecords={records}
                        isAdmin={isAdmin}
                    />
                ) : (
                    isAdmin ? (
                        !adminSelectedClassForInput ? (
                            <div className="space-y-8 animate-fade-in">
                                {/* ADMIN: GENERATOR MASSAL SEDERHANA & JELAS */}
                                <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-indigo-100 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                                    
                                    <div className="flex flex-col md:flex-row gap-8">
                                        <div className="flex-1">
                                            <h3 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                                                <Zap className="text-indigo-600" fill="currentColor" /> Generator Laporan Massal
                                            </h3>
                                            <p className="text-slate-500 mb-6 leading-relaxed text-sm">
                                                Fitur ini membuat laporan otomatis untuk kelas yang diceklis.
                                                Sistem akan membuat nilai bervariasi (tidak flat) dan analisis guru otomatis.
                                            </p>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tanggal Awal (Tgl Terakhir)</label>
                                                    <input 
                                                        type="date" 
                                                        value={bulkDate}
                                                        onChange={(e) => setBulkDate(e.target.value)}
                                                        className="w-full p-2 bg-white border border-slate-300 rounded font-semibold text-slate-800 text-sm"
                                                    />
                                                </div>
                                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mapel</label>
                                                    <select
                                                        value={bulkSubject}
                                                        onChange={(e) => setBulkSubject(e.target.value as SubjectType)}
                                                        className="w-full p-2 bg-white border border-slate-300 rounded font-semibold text-slate-800 text-sm"
                                                    >
                                                        {Object.values(SubjectType).map(type => (
                                                            <option key={type} value={type}>{type}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                                    <label className="block text-[10px] font-bold text-yellow-700 uppercase mb-1">Jumlah Dokumen / Kelas</label>
                                                    <select
                                                        value={docsPerClass}
                                                        onChange={(e) => setDocsPerClass(parseInt(e.target.value))}
                                                        className="w-full p-2 bg-white border border-yellow-300 rounded font-bold text-indigo-800 text-sm"
                                                    >
                                                        <option value={1}>1 Dokumen (Tanggal Ini)</option>
                                                        <option value={2}>2 Dokumen (2 Minggu)</option>
                                                        <option value={3}>3 Dokumen (3 Minggu)</option>
                                                        <option value={4}>4 Dokumen (1 Bulan Full)</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-3 items-center border-t border-slate-100 pt-4">
                                                <button 
                                                    onClick={handleBulkGenerate}
                                                    disabled={selectedBulkClassIds.size === 0}
                                                    className="w-full sm:w-auto flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-indigo-200 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
                                                >
                                                    <Play fill="currentColor" /> 
                                                    BUAT {selectedBulkClassIds.size * docsPerClass} DOKUMEN
                                                </button>
                                                <label className="flex items-center gap-2 text-sm text-slate-600 px-4 cursor-pointer select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={autoDownload}
                                                        onChange={e => setAutoDownload(e.target.checked)}
                                                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                                    />
                                                    <span>Auto Download</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* PILIH KELAS */}
                                        <div className="w-full md:w-80 bg-slate-50 rounded-xl p-4 border border-slate-200 h-[400px] flex flex-col shadow-inner">
                                            <div className="flex justify-between items-center mb-3 border-b border-slate-200 pb-2">
                                                <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                                                    <ListChecks size={16}/> Pilih Kelas
                                                </h4>
                                                <button 
                                                    onClick={toggleAllBulk}
                                                    className="text-xs font-bold text-indigo-600 hover:underline"
                                                >
                                                    {selectedBulkClassIds.size === allAvailableClasses.length ? 'Uncheck All' : 'Check All'}
                                                </button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                                {allAvailableClasses.map(cls => (
                                                    <label 
                                                        key={cls.id}
                                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                                            selectedBulkClassIds.has(cls.id) 
                                                            ? 'bg-white border border-indigo-200 shadow-sm' 
                                                            : 'hover:bg-slate-100 border border-transparent'
                                                        }`}
                                                    >
                                                        <input 
                                                            type="checkbox"
                                                            checked={selectedBulkClassIds.has(cls.id)}
                                                            onChange={() => toggleBulkClass(cls.id)}
                                                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-center">
                                                                <div className="font-bold text-sm text-slate-800">{cls.name}</div>
                                                                {selectedBulkClassIds.has(cls.id) && docsPerClass > 1 && (
                                                                    <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1 rounded font-bold">x{docsPerClass}</span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 truncate">{cls.homeroomTeacher}</div>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-slate-200 text-center text-[10px] text-slate-500">
                                                Terpilih: {selectedBulkClassIds.size} Kelas
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* MANUAL CARD */}
                                <div className="text-center pt-8">
                                    <p className="text-slate-400 text-sm mb-4">Atau ingin input manual satu per satu?</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 opacity-75 hover:opacity-100 transition-opacity">
                                        {allAvailableClasses.slice(0, 6).map(cls => (
                                            <button
                                                key={cls.id}
                                                onClick={() => setAdminSelectedClassForInput(cls)}
                                                className="p-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
                                            >
                                                {cls.name}
                                            </button>
                                        ))}
                                        <div className="flex items-center justify-center text-xs text-slate-400">
                                            ...dan lainnya
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="animate-fade-in">
                                <div className="flex items-center justify-between mb-6 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded">ADMIN MODE</div>
                                        <span className="text-indigo-900 text-sm">Input Manual: <strong>{adminSelectedClassForInput.name}</strong></span>
                                    </div>
                                    <button 
                                        onClick={() => setAdminSelectedClassForInput(null)}
                                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-bold text-sm bg-white px-3 py-1.5 rounded shadow-sm border border-indigo-200"
                                    >
                                        <ArrowLeft size={16} /> Kembali
                                    </button>
                                </div>
                                <DailyEntryForm selectedClass={adminSelectedClassForInput} onSave={handleSaveRecord} />
                            </div>
                        )
                    ) : (
                        <DailyEntryForm selectedClass={currentUserClass} onSave={handleSaveRecord} />
                    )
                )}
            </div>
        </div>
      </main>

      {showVoice && <VoiceConsultant onClose={() => setShowVoice(false)} />}
    </div>
  );
}
