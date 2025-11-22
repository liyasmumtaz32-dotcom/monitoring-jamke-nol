
import React, { useState, useEffect } from 'react';
import { MOCK_CLASSES } from '../constants';
import { ClassData } from '../types';
import { LogIn, School, UserPlus, ArrowLeft, Save, ShieldCheck, Lock } from 'lucide-react';

interface Props {
  onLogin: (classData: ClassData) => void;
}

export const Login: React.FC<Props> = ({ onLogin }) => {
  const [selectedClassId, setSelectedClassId] = useState('');
  const [customClasses, setCustomClasses] = useState<ClassData[]>([]);
  const [viewMode, setViewMode] = useState<'LOGIN' | 'MANUAL' | 'ADMIN'>('LOGIN');
  
  // Admin State
  const [adminPassword, setAdminPassword] = useState('');

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

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin123') {
        // Create a special "Admin" class object
        const adminUser: ClassData = {
            id: 'ADMIN',
            name: 'SEMUA KELAS',
            homeroomTeacher: 'Administrator',
            students: []
        };
        onLogin(adminUser);
    } else {
        alert("Password Admin Salah!");
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
          {viewMode === 'LOGIN' && (
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

                <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-center">
                    <button 
                        type="button"
                        onClick={() => setViewMode('MANUAL')}
                        className="text-slate-500 hover:text-indigo-600 font-medium text-xs flex flex-col items-center gap-1 transition-colors"
                    >
                        <UserPlus size={18} /> 
                        <span>Input Baru</span>
                    </button>
                    <button 
                        type="button"
                        onClick={() => setViewMode('ADMIN')}
                        className="text-slate-500 hover:text-indigo-600 font-medium text-xs flex flex-col items-center gap-1 transition-colors"
                    >
                        <ShieldCheck size={18} /> 
                        <span>Login Admin</span>
                    </button>
                </div>
            </form>
          )}

          {viewMode === 'MANUAL' && (
            // MODE INPUT MANUAL
            <form onSubmit={handleManualSubmit} className="space-y-4">
                 <div className="flex items-center gap-2 text-indigo-800 font-bold border-b pb-2 mb-4">
                    <button type="button" onClick={() => setViewMode('LOGIN')} className="hover:bg-indigo-50 p-1 rounded">
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
                 </div>

                 <button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4"
                >
                    <Save size={20} /> Simpan & Masuk
                </button>
            </form>
          )}

          {viewMode === 'ADMIN' && (
            // MODE ADMIN LOGIN
            <form onSubmit={handleAdminLogin} className="space-y-6">
                 <div className="flex items-center gap-2 text-red-800 font-bold border-b border-red-100 pb-2 mb-4">
                    <button type="button" onClick={() => setViewMode('LOGIN')} className="hover:bg-red-50 p-1 rounded text-red-600">
                        <ArrowLeft size={20} />
                    </button>
                    <h3>Akses Administrator</h3>
                 </div>

                 <div className="bg-red-50 p-3 rounded-lg text-xs text-red-700 mb-4">
                    Halaman ini khusus untuk Kepala Sekolah / Kurikulum untuk melakukan ekspor data massal.
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Password Admin</label>
                    <div className="relative">
                        <input 
                            type="password"
                            value={adminPassword}
                            onChange={e => setAdminPassword(e.target.value)}
                            className="w-full p-3 pl-10 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm outline-none"
                            placeholder="Masukkan Password..."
                            autoFocus
                        />
                        <Lock className="absolute left-3 top-3 text-slate-400" size={18}/>
                    </div>
                 </div>

                 <button
                    type="submit"
                    className="w-full bg-slate-800 hover:bg-black text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4 shadow-lg"
                >
                    <ShieldCheck size={20} /> Masuk Dashboard Admin
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
