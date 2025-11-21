
import React, { useState, useEffect } from 'react';
import { MOCK_CLASSES } from '../constants';
import { ClassData } from '../types';
import { LogIn, School, UserPlus, ArrowLeft, Save } from 'lucide-react';

interface Props {
  onLogin: (classData: ClassData) => void;
}

export const Login: React.FC<Props> = ({ onLogin }) => {
  const [selectedClassId, setSelectedClassId] = useState('');
  const [customClasses, setCustomClasses] = useState<ClassData[]>([]);
  const [isManualMode, setIsManualMode] = useState(false);

  // Form State for Manual Mode
  const [manualTeacher, setManualTeacher] = useState('');
  const [manualClassName, setManualClassName] = useState('');
  const [manualStudents, setManualStudents] = useState('');

  // Load custom classes from LocalStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('monit0r_custom_classes');
    if (stored) {
      try {
        setCustomClasses(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse custom classes", e);
      }
    }
  }, []);

  const allClasses = [...MOCK_CLASSES, ...customClasses];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedClass = allClasses.find(c => c.id === selectedClassId);
    if (selectedClass) {
      onLogin(selectedClass);
    } else {
      alert("Silakan pilih nama wali kelas terlebih dahulu.");
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualTeacher || !manualClassName || !manualStudents.trim()) {
        alert("Mohon lengkapi Nama Guru, Nama Kelas, dan Daftar Siswa.");
        return;
    }

    // Parse students (split by newline)
    const studentsList = manualStudents
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map((name, idx) => ({
            id: `custom-${Date.now()}-${idx}`,
            name: name
        }));

    if (studentsList.length === 0) {
        alert("Daftar siswa tidak boleh kosong.");
        return;
    }

    const newClassData: ClassData = {
        id: `custom-class-${Date.now()}`,
        name: manualClassName,
        homeroomTeacher: manualTeacher,
        students: studentsList
    };

    // Save to Local Storage
    const updatedCustomClasses = [...customClasses, newClassData];
    setCustomClasses(updatedCustomClasses);
    localStorage.setItem('monit0r_custom_classes', JSON.stringify(updatedCustomClasses));

    // Automatically Log In
    onLogin(newClassData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-center text-white">
          <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
            <School size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Monit0r</h1>
          <p className="text-indigo-100 text-sm">Sistem Monitoring Jam Ke-0</p>
        </div>
        
        <div className="p-8">
          {!isManualMode ? (
            // MODE LOGIN BIASA
            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Pilih Identitas Wali Kelas
                </label>
                <div className="relative">
                    <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none bg-white"
                    >
                    <option value="" disabled>-- Cari Nama Anda --</option>
                    {allClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                        {c.homeroomTeacher} ({c.name})
                        </option>
                    ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                    </div>
                </div>
                </div>

                <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                >
                <LogIn size={20} /> Masuk Aplikasi
                </button>

                <div className="pt-4 border-t border-slate-100 text-center">
                    <p className="text-sm text-slate-500 mb-2">Nama tidak ada di daftar?</p>
                    <button 
                        type="button"
                        onClick={() => setIsManualMode(true)}
                        className="text-indigo-600 font-medium text-sm hover:underline flex items-center justify-center gap-1 w-full"
                    >
                        <UserPlus size={16} /> Input Data Baru (Manual)
                    </button>
                </div>
            </form>
          ) : (
            // MODE INPUT MANUAL
            <form onSubmit={handleManualSubmit} className="space-y-4">
                 <div className="flex items-center gap-2 text-indigo-800 font-bold border-b pb-2 mb-4">
                    <button type="button" onClick={() => setIsManualMode(false)} className="hover:bg-indigo-50 p-1 rounded">
                        <ArrowLeft size={20} />
                    </button>
                    <h3>Input Data Guru Baru</h3>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nama Wali Kelas</label>
                    <input 
                        type="text"
                        value={manualTeacher}
                        onChange={e => setManualTeacher(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="Contoh: Budi Santoso, S.Pd"
                        required
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nama Kelas</label>
                    <input 
                        type="text"
                        value={manualClassName}
                        onChange={e => setManualClassName(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="Contoh: 10 - A"
                        required
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                        Daftar Siswa (Satu nama per baris)
                    </label>
                    <textarea 
                        value={manualStudents}
                        onChange={e => setManualStudents(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm h-32"
                        placeholder="Ahmad Dhani&#10;Budi Doremi&#10;Citra Kirana"
                        required
                    ></textarea>
                    <p className="text-[10px] text-slate-500 mt-1">*Data akan tersimpan otomatis di browser ini.</p>
                 </div>

                 <button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4"
                >
                    <Save size={20} /> Simpan & Masuk
                </button>
            </form>
          )}
        </div>
        
        <div className="bg-slate-50 p-4 text-center text-xs text-slate-400 border-t border-slate-100">
          &copy; 2025 SMA Islam Al-Ghozali
        </div>
      </div>
    </div>
  );
};
