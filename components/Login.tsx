
import React, { useState } from 'react';
import { MOCK_CLASSES } from '../constants';
import { ClassData } from '../types';
import { LogIn, School } from 'lucide-react';

interface Props {
  onLogin: (classData: ClassData) => void;
}

export const Login: React.FC<Props> = ({ onLogin }) => {
  const [selectedClassId, setSelectedClassId] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedClass = MOCK_CLASSES.find(c => c.id === selectedClassId);
    if (selectedClass) {
      onLogin(selectedClass);
    } else {
      alert("Silakan pilih nama wali kelas terlebih dahulu.");
    }
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
                  required
                >
                  <option value="" disabled>-- Pilih Nama Anda --</option>
                  {MOCK_CLASSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.homeroomTeacher} ({c.name})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                *Pastikan Anda memilih nama yang sesuai dengan SK Wali Kelas.
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
            >
              <LogIn size={20} /> Masuk Aplikasi
            </button>
          </form>
        </div>
        
        <div className="bg-slate-50 p-4 text-center text-xs text-slate-400 border-t border-slate-100">
          &copy; 2025 SMA Islam Al-Ghozali
        </div>
      </div>
    </div>
  );
};
