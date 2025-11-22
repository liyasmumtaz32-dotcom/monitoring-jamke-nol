
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
  const [docsPerClass, setDocsPerClass] = useState<number>(4); // Default 4 dokumen (1 bulan)
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
            const sorted = storedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setRecords(sorted);

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

  // Initialize bulk selection
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
        await saveRecordToDB(record);
        const updatedRecords = [record, ...records];
        setRecords(updatedRecords);
        setActiveTab('dashboard');
        alert("Laporan berhasil disimpan!");
    } catch (error) {
        console.error("Error saving record:", error);
        alert("Gagal menyimpan laporan.");
    }
  };

  const downloadBulkResults = (recordsToDownload: DailyRecord[]) => {
      if (!recordsToDownload || recordsToDownload.length === 0) return;
      
      const sorted = [...recordsToDownload].sort((a, b) => {
          const classCompare = a.classId.localeCompare(b.classId, undefined, {numeric: true});
          if (classCompare !== 0) return classCompare;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      const title = `Laporan_Massal_${bulkDate}_Total_${recordsToDownload.length}_Dokumen`;
      const html = generateReportHTML(sorted, `Laporan Massal (4 Minggu Terakhir)`);
      downloadDoc(html, `${title}.doc`);
  };

  const handleBulkGenerate = async () => {
      const classesToProcess = allAvailableClasses.filter(c => selectedBulkClassIds.has(c.id));

      if (classesToProcess.length === 0) {
          alert("Pilih setidaknya satu kelas.");
          return;
      }

      const totalDocsToGenerate = classesToProcess.length * docsPerClass;

      if (!confirm(`YAKIN GENERATE?\n\nTarget: ${classesToProcess.length} Kelas\nMode: ${docsPerClass} Minggu Mundur\nTotal: ${totalDocsToGenerate} Laporan Baru\n\nProses ini akan memakan waktu beberapa detik.`)) {
          return;
      }

      setIsBulkProcessing(true);
      setShowBulkResultModal(false);
      setBulkGeneratedRecords([]); 
      setBulkProgress({ current: 0, total: totalDocsToGenerate, currentClass: 'Persiapan...' });
      
      const newRecordsBatch: DailyRecord[] = [];
      let processedCount = 0;

      try {
          // LOOP KELAS
          for (let i = 0; i < classesToProcess.length; i++) {
              const cls = classesToProcess[i];
              
              // LOOP MINGGUAN (Mundur Tanggal)
              for (let j = 0; j < docsPerClass; j++) {
                  processedCount++;

                  // HITUNG TANGGAL MUNDUR
                  // j=0 (Hari ini), j=1 (7 hari lalu), j=2 (14 hari lalu)
                  const d = new Date(bulkDate);
                  d.setDate(d.getDate() - (j * 7));
                  const specificDate = d.toISOString().split('T')[0];
                  
                  // Tentukan Mapel berdasarkan Hari pada tanggal tersebut
                  const currentSubject = getSubjectForDay(d);

                  // Visual Progress Update
                  setBulkProgress({ 
                      current: processedCount, 
                      total: totalDocsToGenerate,
                      currentClass: `${cls.name} (Minggu ke-${j+1})` 
                  });
                  
                  // CRITICAL: Jeda agar UI sempat render progress bar
                  await new Promise(resolve => setTimeout(resolve, 10));

                  // 1. Generate Nilai Acak (Tanpa AI, Murni Algoritma Cepat)
                  const studentsScores = generateRandomStudentScores(cls.students, currentSubject);

                  // 2. Generate Catatan Guru (Template Random)
                  const templateData = generateClassReportTemplate(cls.name, cls.homeroomTeacher, currentSubject, studentsScores);

                  const record: DailyRecord = {
                      id: `${Date.now()}-${cls.id}-${j}-${Math.random().toString(36).substr(2, 5)}`,
                      date: specificDate,
                      classId: cls.name,
                      teacherName: cls.homeroomTeacher,
                      subject: currentSubject,
                      studentScores: studentsScores,
                      teacherAnalysis: templateData.teacherAnalysis,
                      recommendations: templateData.recommendations,
                      aiAnalysis: 'Generated by Auto-System'
                  };

                  await saveRecordToDB(record);
                  newRecordsBatch.push(record);
              }
          }

          // Update State
          setRecords(prev => {
              const updated = [...newRecordsBatch, ...prev];
              return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          });
          
          setBulkGeneratedRecords(newRecordsBatch);
          
          // Finish
          await new Promise(resolve => setTimeout(resolve, 500));
          setIsBulkProcessing(false);
          setShowBulkResultModal(true);

          if (autoDownload) {
             setTimeout(() => downloadBulkResults(newRecordsBatch), 500);
          }

      } catch (error) {
          console.error("Bulk Error", error);
          alert("Terjadi kesalahan. Coba refresh halaman.");
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
      {/* LOADING OVERLAY */}
      {isBulkProcessing && (
        <div className="fixed inset-0 bg-slate-900 z-[100] flex flex-col items-center justify-center text-white">
            <div className="w-full max-w-md px-6 text-center">
                <div className="mb-8">
                    <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center mx-auto animate-spin border-4 border-white border-t-transparent">
                        <Database size={32} />
                    </div>
                </div>
                
                <h2 className="text-2xl font-bold mb-2">Memproses Data Massal...</h2>
                <p className="text-indigo-300 mb-6 text-sm">Membuat 4 Dokumen Mundur per Kelas</p>

                {/* PROGRESS BAR */}
                <div className="w-full bg-slate-800 rounded-full h-4 mb-4 overflow-hidden">
                    <div 
                        className="bg-green-500 h-full transition-all duration-100"
                        style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                    ></div>
                </div>

                <div className="flex justify-between text-sm font-mono">
                    <span className="text-yellow-400">{bulkProgress.currentClass}</span>
                    <span>{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</span>
                </div>
            </div>
        </div>
      )}

      {/* RESULT MODAL */}
      {showBulkResultModal && (
        <div className="fixed inset-0 bg-black/80 z-[90] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Selesai!</h3>
                <p className="text-slate-500 mb-6">
                    Berhasil membuat <b>{bulkGeneratedRecords.length}</b> laporan baru.
                </p>
                
                <button 
                    onClick={() => downloadBulkResults(bulkGeneratedRecords)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl mb-3 flex items-center justify-center gap-2"
                >
                    <Download size={20} /> Download File (.doc)
                </button>
                <button 
                    onClick={() => setShowBulkResultModal(false)}
                    className="w-full bg-slate-100 text-slate-600 font-bold py-3 px-4 rounded-xl"
                >
                    Tutup
                </button>
            </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 transform transition-transform lg:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-bold text-indigo-600">Monit0r</h1>
          <p className="text-xs text-slate-500">Jam Ke-0 System</p>
        </div>

        <div className="p-4">
           <div className={`p-3 rounded-lg ${isAdmin ? 'bg-red-50 text-red-800' : 'bg-indigo-50 text-indigo-800'}`}>
               <p className="text-xs font-bold uppercase mb-1">{isAdmin ? 'Administrator' : 'Guru'}</p>
               <p className="font-bold text-sm truncate">{currentUserClass.homeroomTeacher}</p>
           </div>
        </div>

        <nav className="p-4 space-y-2">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          
          <button 
              onClick={() => { setActiveTab('input'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${activeTab === 'input' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
              <PenTool size={20} /> {isAdmin ? 'Generator Massal' : 'Input Laporan'}
          </button>
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100">
           <button onClick={handleLogout} className="w-full flex items-center gap-2 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 rounded-lg">
             <LogOut size={18} /> Keluar
           </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0">
             <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden"><Menu /></button>
                <h2 className="font-bold text-slate-800">
                    {activeTab === 'dashboard' ? 'Dashboard & Rekap' : (isAdmin ? 'Generator Laporan Massal' : 'Formulir Input')}
                </h2>
             </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            <div className="max-w-6xl mx-auto">
                {activeTab === 'dashboard' ? (
                    <Dashboard 
                        records={isAdmin ? records : records.filter(r => r.classId === currentUserClass.name)} 
                        allRecords={records}
                        isAdmin={isAdmin}
                    />
                ) : (
                    isAdmin ? (
                        !adminSelectedClassForInput ? (
                            // TAMPILAN GENERATOR MASSAL
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-fade-in">
                                <div className="border-b border-slate-100 pb-4 mb-6">
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <Zap className="text-yellow-500" /> Generator Laporan Otomatis
                                    </h3>
                                    <p className="text-slate-500 text-sm mt-1">
                                        Pilih kelas, dan sistem akan membuat laporan mundur untuk 1 bulan (4 Minggu) secara instan.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* KOLOM KIRI: KONTROL */}
                                    <div className="space-y-6">
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tanggal Akhir (Hari Ini)</label>
                                            <input 
                                                type="date" 
                                                value={bulkDate}
                                                onChange={(e) => setBulkDate(e.target.value)}
                                                className="w-full p-2 border rounded font-medium"
                                            />
                                            <p className="text-xs text-slate-400 mt-1 italic">
                                                Sistem akan membuat tanggal mundur per 7 hari dari tanggal ini.
                                            </p>
                                        </div>

                                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                            <label className="block text-xs font-bold text-yellow-700 uppercase mb-2">Jumlah Dokumen / Kelas</label>
                                            <select
                                                value={docsPerClass}
                                                onChange={(e) => setDocsPerClass(parseInt(e.target.value))}
                                                className="w-full p-2 border border-yellow-300 rounded font-bold text-slate-700"
                                            >
                                                <option value={4}>4 Dokumen (1 Bulan Full)</option>
                                                <option value={3}>3 Dokumen (3 Minggu)</option>
                                                <option value={2}>2 Dokumen (2 Minggu)</option>
                                                <option value={1}>1 Dokumen (Hanya Hari Ini)</option>
                                            </select>
                                        </div>

                                        <div className="pt-4">
                                            <button 
                                                onClick={handleBulkGenerate}
                                                disabled={selectedBulkClassIds.size === 0}
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold py-4 px-6 rounded-xl shadow-lg transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <span className="flex items-center gap-2"><Play fill="currentColor" size={18} /> PROSES SEKARANG</span>
                                                <span className="text-xs font-normal text-indigo-200">
                                                    Total: {selectedBulkClassIds.size * docsPerClass} Dokumen
                                                </span>
                                            </button>
                                            
                                            <div className="mt-4 flex items-center justify-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    checked={autoDownload}
                                                    onChange={e => setAutoDownload(e.target.checked)}
                                                    className="w-4 h-4 text-indigo-600"
                                                />
                                                <span className="text-sm text-slate-600">Otomatis Download Hasil (.doc)</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* KOLOM KANAN: PILIH KELAS */}
                                    <div className="lg:col-span-2 bg-slate-50 rounded-xl border border-slate-200 flex flex-col h-[500px]">
                                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white rounded-t-xl">
                                            <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                                <ListChecks size={18}/> Daftar Kelas ({selectedBulkClassIds.size} Dipilih)
                                            </h4>
                                            <button 
                                                onClick={toggleAllBulk}
                                                className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded transition-colors"
                                            >
                                                {selectedBulkClassIds.size === allAvailableClasses.length ? 'Hapus Semua' : 'Pilih Semua'}
                                            </button>
                                        </div>
                                        
                                        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
                                            {allAvailableClasses.map(cls => (
                                                <label 
                                                    key={cls.id}
                                                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                                                        selectedBulkClassIds.has(cls.id) 
                                                        ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500' 
                                                        : 'bg-white border-slate-200 hover:border-indigo-300'
                                                    }`}
                                                >
                                                    <input 
                                                        type="checkbox"
                                                        checked={selectedBulkClassIds.has(cls.id)}
                                                        onChange={() => toggleBulkClass(cls.id)}
                                                        className="mt-1 w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-slate-800">{cls.name}</div>
                                                        <div className="text-xs text-slate-500 truncate">{cls.homeroomTeacher}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Opsi Manual */}
                                <div className="mt-12 pt-8 border-t border-slate-100 text-center">
                                    <p className="text-slate-400 text-sm mb-4">Ingin input manual satu per satu?</p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {allAvailableClasses.slice(0, 5).map(cls => (
                                            <button
                                                key={cls.id}
                                                onClick={() => setAdminSelectedClassForInput(cls)}
                                                className="px-3 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600 hover:border-indigo-500 hover:text-indigo-600"
                                            >
                                                {cls.name}
                                            </button>
                                        ))}
                                        <span className="text-xs text-slate-400 self-center">...</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // MODE INPUT MANUAL ADMIN
                            <div className="animate-fade-in">
                                <div className="bg-indigo-50 p-4 rounded-lg mb-6 flex justify-between items-center border border-indigo-100">
                                    <div>
                                        <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded mr-2">ADMIN MODE</span>
                                        <span className="font-bold text-indigo-900">Input Manual: {adminSelectedClassForInput.name}</span>
                                    </div>
                                    <button 
                                        onClick={() => setAdminSelectedClassForInput(null)}
                                        className="bg-white text-indigo-600 px-3 py-1 rounded text-sm font-medium border border-indigo-200 hover:bg-indigo-50"
                                    >
                                        Kembali
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
