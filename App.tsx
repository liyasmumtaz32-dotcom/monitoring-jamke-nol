import React, { useState, useEffect } from 'react';
import { ClassData, DailyRecord, AttendanceStatus, SubjectType } from './types';
import { DailyEntryForm } from './components/DailyEntryForm';
import { Dashboard } from './components/Dashboard';
import { VoiceConsultant } from './components/VoiceConsultant';
import { Login } from './components/Login';
import { LayoutDashboard, PenTool, Menu, LogOut, Database, ShieldCheck, ArrowLeft, Zap, Calendar, CheckCircle, AlertTriangle, CheckSquare, Square, Filter, ListChecks, X, Download, Settings } from 'lucide-react';
import { saveRecordToDB, getRecordsFromDB } from './db';
import { MOCK_CLASSES, getSubjectForDay } from './constants';
import { generateReportHTML, downloadDoc } from './services/exportUtils';

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
      
      // Sort by Class Name
      const sorted = [...recordsToDownload].sort((a, b) => 
          a.classId.localeCompare(b.classId, undefined, {numeric: true})
      );
      
      const html = generateReportHTML(sorted, `Laporan Massal Tanggal ${bulkDate}`);
      downloadDoc(html, `Laporan_AutoFill_${bulkDate}_(${sorted.length}_Kelas).doc`);
  };

  const handleBulkGenerate = async () => {
      const classesToProcess = allAvailableClasses.filter(c => selectedBulkClassIds.has(c.id));

      if (classesToProcess.length === 0) {
          alert("Pilih setidaknya satu kelas untuk diproses.");
          return;
      }

      if (!confirm(`Apakah Anda yakin ingin membuat laporan otomatis untuk ${classesToProcess.length} kelas terpilih pada tanggal ${bulkDate}? \n\nMapel: ${bulkSubject}\n\nData akan diisi dengan nilai default (Hadir & Baik).`)) {
          return;
      }

      setIsBulkProcessing(true);
      setShowBulkResultModal(false);
      setBulkProgress({ current: 0, total: classesToProcess.length, currentClass: 'Memulai...' });
      
      const newRecords: DailyRecord[] = [];

      try {
          // Generate record for EACH selected class
          for (let i = 0; i < classesToProcess.length; i++) {
              const cls = classesToProcess[i];
              
              // Update Progress
              setBulkProgress({ 
                  current: i + 1, 
                  total: classesToProcess.length, 
                  currentClass: cls.name 
              });
              
              // Simulate delay to allow UI to update and show progress nicely
              await new Promise(resolve => setTimeout(resolve, 80));

              const studentsScores = cls.students.map(s => ({
                  studentId: s.id,
                  studentName: s.name,
                  attendance: AttendanceStatus.PRESENT,
                  activeInvolvement: 3, // Default Baik
                  fluency: 3,
                  tajwid: 3,
                  adab: 4, // Default Sangat Baik
                  jilid: 'Jilid 1',
                  page: '',
                  // Literasi Defaults
                  literacyTotalQuestions: 10,
                  literacyCorrect: 8,
                  literacyWrong: 2,
                  literacyScore: 80,
                  notes: ''
              }));

              const record: DailyRecord = {
                  id: `${Date.now()}-${cls.id}-${Math.random().toString(36).substr(2, 9)}`,
                  date: bulkDate,
                  classId: cls.name,
                  teacherName: cls.homeroomTeacher,
                  subject: bulkSubject,
                  studentScores: studentsScores,
                  teacherAnalysis: 'Kegiatan berjalan lancar dan kondusif secara umum (Auto-generated).',
                  recommendations: {
                      specialAttention: 'Nihil',
                      methodImprovement: 'Pertahankan suasana kelas',
                      nextWeekPlan: 'Lanjut materi berikutnya'
                  },
                  aiAnalysis: 'Laporan dibuat secara otomatis oleh Administrator.'
              };

              await saveRecordToDB(record);
              newRecords.push(record);
          }

          // Update State
          setRecords(prev => [...newRecords, ...prev]);
          setBulkGeneratedRecords(newRecords);
          
          // Finish Processing
          setTimeout(() => {
              setIsBulkProcessing(false);
              setActiveTab('dashboard');
              setShowBulkResultModal(true);

              // AUTO DOWNLOAD TRIGGER
              if (autoDownload) {
                  downloadBulkResults(newRecords);
              }
          }, 500);

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

  // If not logged in, show Login Screen
  if (!currentUserClass) {
    return <Login onLogin={setCurrentUserClass} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex relative">
      {/* Loading / Processing Overlay */}
      {isBulkProcessing && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex flex-col items-center justify-center text-white backdrop-blur-sm animate-fade-in">
            <div className="w-80 bg-white/10 rounded-full h-6 mb-6 border border-white/20 overflow-hidden relative">
                <div 
                    className="bg-gradient-to-r from-yellow-400 to-orange-500 h-full transition-all duration-200 ease-out relative z-10"
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/80 z-20">
                    {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
                </div>
            </div>
            <h3 className="text-3xl font-bold mb-2 animate-pulse">Memproses Data...</h3>
            <p className="text-indigo-200 font-mono text-lg mb-2">
                Kelas: <span className="text-yellow-300 font-bold">{bulkProgress.currentClass}</span>
            </p>
            <p className="text-sm text-white/50">
                {bulkProgress.current} dari {bulkProgress.total} laporan berhasil dibuat
            </p>
        </div>
      )}

      {/* Result Modal */}
      {showBulkResultModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                <div className="bg-green-600 p-6 text-white text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                        <CheckCircle size={32} className="text-white" />
                    </div>
                    <h3 className="text-2xl font-bold">Selesai!</h3>
                    <p className="text-green-100">{bulkGeneratedRecords.length} laporan telah dibuat.</p>
                </div>
                <div className="p-6 text-center">
                    <p className="text-slate-600 text-sm mb-6">
                        Data telah disimpan ke database. 
                        {autoDownload ? " File dokumen telah diunduh secara otomatis." : " Silakan unduh file dokumen di bawah ini."}
                    </p>
                    
                    <button 
                        onClick={() => downloadBulkResults(bulkGeneratedRecords)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 mb-3 transition-all shadow-lg shadow-indigo-200 hover:scale-[1.02]"
                    >
                        <Download size={20} /> Unduh Ulang (.doc)
                    </button>
                    
                    <button 
                        onClick={() => setShowBulkResultModal(false)}
                        className="w-full bg-white border border-slate-200 text-slate-600 font-medium py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors"
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
               {isAdmin ? 'Mode Administrator' : 'Login Sebagai'}
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
            {isAdmin ? 'Admin Dashboard' : 'Dashboard & Laporan'}
          </button>
          
          <button 
              onClick={() => { setActiveTab('input'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'input' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
              <PenTool size={20} /> Isi Monitoring {isAdmin && '(Semua Kelas)'}
          </button>
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100 space-y-2">
           <div className="flex items-center gap-2 px-4 py-2 text-xs text-green-600 bg-green-50 rounded-md">
               <Database size={14} />
               <span>Database Aktif</span>
           </div>
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
                        ? (isAdmin ? 'Dashboard Administrator - Rekap Sekolah' : `Dashboard - ${currentUserClass.name}`) 
                        : 'Formulir Monitoring Harian'}
                </h2>
             </div>
             <div className="flex items-center gap-4">
                <button 
                    onClick={() => setShowVoice(!showVoice)}
                    className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors shadow-md flex items-center gap-2"
                >
                    🎙️ Konsultasi AI
                </button>
             </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
            <div className="max-w-6xl mx-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64 text-slate-500">
                        Memuat Data...
                    </div>
                ) : activeTab === 'dashboard' ? (
                    <Dashboard 
                        // If Admin, 'records' prop receives ALL records to show aggregate data in charts
                        records={isAdmin ? records : records.filter(r => r.classId === currentUserClass.name)} 
                        allRecords={records}
                        isAdmin={isAdmin}
                    />
                ) : (
                    // LOGIC INPUT TAB
                    isAdmin ? (
                        !adminSelectedClassForInput ? (
                            <div className="space-y-8 animate-fade-in">
                                {/* ADMIN: BULK AUTO FILL SECTION */}
                                <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
                                    <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                                    
                                    <div className="relative z-10">
                                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                                            <div className="flex-1">
                                                <h3 className="text-2xl font-bold flex items-center gap-2 mb-2">
                                                    <Zap className="text-yellow-300" /> Auto-Fill Massal
                                                </h3>
                                                <p className="text-indigo-100 text-sm leading-relaxed mb-6 max-w-xl">
                                                    Buat laporan otomatis untuk kelas yang dipilih dengan satu klik.
                                                    Sistem akan mengisi nilai default (Hadir & Baik). 
                                                    Gunakan fitur ini untuk rekap cepat jika kegiatan berjalan normal.
                                                </p>

                                                {/* CLASS CHECKLIST */}
                                                <div className="bg-white/10 rounded-xl p-4 border border-white/20 backdrop-blur-md">
                                                    <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                                                        <h4 className="font-bold text-sm flex items-center gap-2 text-white">
                                                            <Filter size={16} /> Pilih Kelas ({selectedBulkClassIds.size} Terpilih)
                                                        </h4>
                                                        <button 
                                                            onClick={toggleAllBulk}
                                                            className="text-xs font-bold bg-white text-indigo-900 px-3 py-1.5 rounded hover:bg-indigo-50 transition-colors shadow-sm"
                                                        >
                                                            {selectedBulkClassIds.size === allAvailableClasses.length ? 'Batalkan Semua' : 'Pilih Semua'}
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                                        {allAvailableClasses.map(cls => (
                                                            <button
                                                                key={cls.id}
                                                                onClick={() => toggleBulkClass(cls.id)}
                                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border text-left ${
                                                                    selectedBulkClassIds.has(cls.id) 
                                                                    ? 'bg-green-400 text-indigo-900 border-green-300 shadow-sm' 
                                                                    : 'bg-indigo-900/40 text-indigo-200 border-transparent hover:bg-indigo-900/60'
                                                                }`}
                                                            >
                                                                {selectedBulkClassIds.has(cls.id) ? <CheckSquare size={14} className="shrink-0"/> : <Square size={14} className="shrink-0"/>}
                                                                <span className="truncate">{cls.name}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* CONTROLS SIDEBAR */}
                                            <div className="bg-white/10 p-5 rounded-xl border border-white/20 backdrop-blur-sm w-full lg:w-80 shrink-0 flex flex-col gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-indigo-200 uppercase mb-1 flex items-center gap-2">
                                                        <Calendar size={14}/> Tanggal Laporan
                                                    </label>
                                                    <input 
                                                        type="date" 
                                                        value={bulkDate}
                                                        onChange={(e) => setBulkDate(e.target.value)}
                                                        className="w-full p-2.5 rounded-lg bg-white text-slate-800 text-sm font-bold outline-none border-0 focus:ring-2 focus:ring-yellow-400"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-indigo-200 uppercase mb-1 flex items-center gap-2">
                                                        <ListChecks size={14}/> Jenis Kegiatan (Mapel)
                                                    </label>
                                                    <select
                                                        value={bulkSubject}
                                                        onChange={(e) => setBulkSubject(e.target.value as SubjectType)}
                                                        className="w-full p-2.5 rounded-lg bg-white text-slate-800 text-sm font-bold outline-none border-0 focus:ring-2 focus:ring-yellow-400 cursor-pointer"
                                                    >
                                                        {Object.values(SubjectType).map(type => (
                                                            <option key={type} value={type}>{type}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <label className="flex items-center gap-2 cursor-pointer bg-indigo-900/40 p-2 rounded-lg border border-white/10 hover:bg-indigo-900/60 transition-colors">
                                                    <input 
                                                        type="checkbox"
                                                        checked={autoDownload}
                                                        onChange={(e) => setAutoDownload(e.target.checked)}
                                                        className="w-4 h-4 text-yellow-400 rounded focus:ring-yellow-400"
                                                    />
                                                    <span className="text-xs font-medium text-indigo-100">Download Otomatis saat selesai</span>
                                                </label>

                                                <button 
                                                    onClick={handleBulkGenerate}
                                                    disabled={isBulkProcessing || selectedBulkClassIds.size === 0}
                                                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-indigo-900 font-black px-4 py-3 rounded-xl transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg mt-2 text-sm uppercase tracking-wide"
                                                >
                                                    {isBulkProcessing ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-indigo-900 border-t-transparent rounded-full animate-spin"></div>
                                                            Memproses...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Zap size={18} fill="currentColor" /> 
                                                            GENERATE ({selectedBulkClassIds.size})
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ADMIN: INDIVIDUAL CLASS GRID */}
                                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                                    <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        <PenTool size={20} className="text-slate-600"/> Input Manual Per Kelas
                                    </h3>
                                    <p className="text-slate-500 mb-6">Klik pada kartu kelas di bawah ini untuk mengisi formulir secara detail dan manual.</p>
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {allAvailableClasses.map(cls => (
                                            <button
                                                key={cls.id}
                                                onClick={() => setAdminSelectedClassForInput(cls)}
                                                className="p-4 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 hover:shadow-md transition-all text-left group bg-slate-50"
                                            >
                                                <div className="font-bold text-slate-800 text-lg group-hover:text-indigo-700 mb-1">{cls.name}</div>
                                                <div className="text-xs text-slate-500 truncate font-medium">{cls.homeroomTeacher}</div>
                                                <div className="text-[10px] text-slate-400 mt-2">{cls.students.length} Siswa</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // ADMIN: FORM WITH BACK BUTTON
                            <div className="animate-fade-in">
                                <div className="flex items-center justify-between mb-6 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded">MODE ADMIN</div>
                                        <span className="text-indigo-900 text-sm">Anda mengisi data untuk kelas <strong>{adminSelectedClassForInput.name}</strong></span>
                                    </div>
                                    <button 
                                        onClick={() => setAdminSelectedClassForInput(null)}
                                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-bold text-sm bg-white px-3 py-1.5 rounded shadow-sm border border-indigo-200 hover:shadow"
                                    >
                                        <ArrowLeft size={16} /> Ganti Kelas
                                    </button>
                                </div>
                                <DailyEntryForm selectedClass={adminSelectedClassForInput} onSave={handleSaveRecord} />
                            </div>
                        )
                    ) : (
                        // NORMAL TEACHER: DIRECT FORM
                        <DailyEntryForm selectedClass={currentUserClass} onSave={handleSaveRecord} />
                    )
                )}
            </div>
        </div>
      </main>

      {/* Voice Widget */}
      {showVoice && <VoiceConsultant onClose={() => setShowVoice(false)} />}
    </div>
  );
}