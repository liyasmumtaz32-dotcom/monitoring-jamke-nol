
import React, { useState, useEffect } from 'react';
import { ClassData, DailyRecord } from './types';
import { DailyEntryForm } from './components/DailyEntryForm';
import { Dashboard } from './components/Dashboard';
import { VoiceConsultant } from './components/VoiceConsultant';
import { Login } from './components/Login';
import { LayoutDashboard, PenTool, Menu, LogOut, Database } from 'lucide-react';
import { saveRecordToDB, getRecordsFromDB } from './db';

export default function App() {
  // Auth State
  const [currentUserClass, setCurrentUserClass] = useState<ClassData | null>(null);

  // App State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'input'>('dashboard');
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [showVoice, setShowVoice] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from DB on mount
  useEffect(() => {
    const fetchData = async () => {
        try {
            const storedRecords = await getRecordsFromDB();
            // Sort by date descending (newest first)
            const sorted = storedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setRecords(sorted);
        } catch (error) {
            console.error("Failed to load data from DB", error);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, []);

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

  const handleLogout = () => {
    setCurrentUserClass(null);
    // We do NOT clear records here, because we want them to persist in the DB for the next login
    // If you want to clear session only, this is fine.
    setActiveTab('dashboard');
  };

  // If not logged in, show Login Screen
  if (!currentUserClass) {
    return <Login onLogin={setCurrentUserClass} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
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

        <div className="p-4 bg-indigo-50 mx-4 mt-4 rounded-lg border border-indigo-100">
           <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">Login Sebagai</p>
           <p className="font-bold text-slate-800 text-sm">{currentUserClass.homeroomTeacher}</p>
           <p className="text-xs text-slate-600 mt-1">Kelas: {currentUserClass.name}</p>
        </div>

        <nav className="p-4 space-y-2 mt-2">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={20} /> Dashboard & Laporan
          </button>
          
          <button 
            onClick={() => { setActiveTab('input'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'input' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <PenTool size={20} /> Isi Monitoring
          </button>
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100 space-y-2">
           <div className="flex items-center gap-2 px-4 py-2 text-xs text-green-600 bg-green-50 rounded-md">
               <Database size={14} />
               <span>Database Aktif (IndexedDB)</span>
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
                    {activeTab === 'dashboard' ? `Dashboard - ${currentUserClass.name}` : 'Formulir Monitoring Harian'}
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
                    <Dashboard records={records.filter(r => r.classId === currentUserClass.name)} />
                ) : (
                    <DailyEntryForm selectedClass={currentUserClass} onSave={handleSaveRecord} />
                )}
            </div>
        </div>
      </main>

      {/* Voice Widget */}
      {showVoice && <VoiceConsultant onClose={() => setShowVoice(false)} />}
    </div>
  );
}
