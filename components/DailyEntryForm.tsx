
import React, { useState, useEffect, useCallback } from 'react';
import { ClassData, StudentScore, AttendanceStatus, DailyRecord, SubjectType } from '../types';
import { SCORING_RUBRIC, getSubjectForDay, TILAWATI_JILID_OPTIONS, TILAWATI_SCORE_OPTIONS, SMART_TEACHER_NOTES, CONSULTATION_OPTIONS } from '../constants';
import { Save, Calculator, Sparkles, BookOpen, Book, Pencil, HeartHandshake, Stethoscope, CheckSquare } from 'lucide-react';
import { generateDailyReportAnalysis } from '../services/geminiService';

interface Props {
  selectedClass: ClassData;
  onSave: (record: DailyRecord) => void;
}

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
    [AttendanceStatus.PRESENT]: 'H (Hadir)',
    [AttendanceStatus.LATE]: 'TL (Telat)',
    [AttendanceStatus.SICK]: 'S (Sakit)',
    [AttendanceStatus.PERMISSION]: 'I (Izin)',
    [AttendanceStatus.ABSENT]: 'A (Alpha)'
};

export const DailyEntryForm: React.FC<Props> = ({ selectedClass, onSave }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [scores, setScores] = useState<StudentScore[]>([]);
  const [teacherAnalysis, setTeacherAnalysis] = useState('');
  const [recSpecial, setRecSpecial] = useState('');
  const [recMethod, setRecMethod] = useState('');
  const [recPlan, setRecPlan] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Track which rows are in "manual edit" mode for notes
  const [manualEditModes, setManualEditModes] = useState<{[key: number]: boolean}>({});

  const subject = getSubjectForDay(new Date(date));
  const isTilawati = subject === SubjectType.TILAWATI;
  const isLiterasi = subject === SubjectType.LITERASI;
  const isKonsultasi = subject === SubjectType.KONSULTASI;

  useEffect(() => {
    // Initialize scores when class changes
    setScores(selectedClass.students.map(s => ({
      studentId: s.id,
      studentName: s.name,
      attendance: AttendanceStatus.PRESENT,
      activeInvolvement: 3,
      fluency: 3,
      tajwid: 3,
      adab: 4,
      jilid: 'Jilid 1',
      page: '',
      literacyTotalQuestions: 10, // Default 10 questions
      literacyCorrect: 0,
      literacyWrong: 10,
      literacyScore: 0,
      notes: ''
    })));
    
    // Set Default Standard Descriptions for All Classes
    setTeacherAnalysis('Jam ke-0 berjalan cukup efektif dengan tingkat kehadiran siswa > 90% pada mayoritas kelas. Setiap bulan untuk penyegaran makharijul huruf dan metode pembetulan bacaan.');
    setRecSpecial('Tidak Ada');
    setRecMethod('Kelas relatif tertib di awal pembelajaran.');
    setRecPlan(''); // Left empty for specific plans if needed
    
    setAiAnalysis('');
    setManualEditModes({});
  }, [selectedClass]);

  const updateScore = (index: number, field: keyof StudentScore, value: any) => {
    const newScores = [...scores];
    const currentScore = { ...newScores[index], [field]: value };

    // Logic khusus Literasi: Hitung otomatis Salah dan Nilai saat Soal/Benar berubah
    if (field === 'literacyTotalQuestions' || field === 'literacyCorrect') {
        const total = field === 'literacyTotalQuestions' ? value : (currentScore.literacyTotalQuestions || 0);
        const correct = field === 'literacyCorrect' ? value : (currentScore.literacyCorrect || 0);
        
        // Ensure correct doesn't exceed total
        const validCorrect = Math.min(correct, total);
        
        currentScore.literacyTotalQuestions = total;
        currentScore.literacyCorrect = validCorrect;
        currentScore.literacyWrong = total - validCorrect;
        currentScore.literacyScore = total > 0 ? Math.round((validCorrect / total) * 100) : 0;
    }

    newScores[index] = currentScore;
    setScores(newScores);
  };

  const markAllPresent = () => {
    if(confirm("Tandai semua siswa sebagai HADIR?")) {
        const newScores = scores.map(s => ({ ...s, attendance: AttendanceStatus.PRESENT }));
        setScores(newScores);
    }
  };

  const toggleManualEdit = (index: number) => {
    setManualEditModes(prev => ({...prev, [index]: !prev[index]}));
  };

  // Helper to determine performance level based on scores
  const getSmartNotesOptions = (s: StudentScore) => {
    let performance: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

    if (isTilawati) {
        const avg = (s.fluency + s.tajwid + s.adab) / 3;
        if (avg >= 3.5) performance = 'HIGH';
        else if (avg < 2.5) performance = 'LOW';
    } else if (isLiterasi) {
        const score = s.literacyScore || 0;
        if (score >= 85) performance = 'HIGH';
        else if (score < 60) performance = 'LOW';
    } else if (isKonsultasi) {
        // Logic khusus Konsultasi: Jika sakit/masalah (Nilai 1-2), masuk kategori LOW (Perlu Perhatian)
        if (s.tajwid <= 2 || s.adab <= 2 || (s.notes && s.notes.includes("Bullying")) || (s.notes && s.notes.includes("Keuangan"))) {
            performance = 'LOW';
        } else if (s.activeInvolvement === 4 && s.fluency === 4) {
            performance = 'HIGH';
        } else {
            performance = 'MEDIUM';
        }
    } else {
        // General / Other subjects
        const avg = (s.activeInvolvement + s.adab) / 2;
        if (avg >= 3.5) performance = 'HIGH';
        else if (avg < 2.5) performance = 'LOW';
    }

    const subjectKey = isTilawati ? SubjectType.TILAWATI : 
                       isLiterasi ? SubjectType.LITERASI : 
                       isKonsultasi ? SubjectType.KONSULTASI : 'GENERAL';
    
    // @ts-ignore - accessing dynamic key from constant
    return SMART_TEACHER_NOTES[subjectKey]?.[performance] || SMART_TEACHER_NOTES['GENERAL'][performance];
  };

  const calculateStats = useCallback(() => {
    const present = scores.filter(s => s.attendance === AttendanceStatus.PRESENT).length;
    const late = scores.filter(s => s.attendance === AttendanceStatus.LATE).length;
    const sick = scores.filter(s => s.attendance === AttendanceStatus.SICK).length;
    const permission = scores.filter(s => s.attendance === AttendanceStatus.PERMISSION).length;
    const absent = scores.filter(s => s.attendance === AttendanceStatus.ABSENT).length;

    const avg = (key: keyof StudentScore) => {
        const sum = scores.reduce((acc, curr) => acc + (typeof curr[key] === 'number' ? (curr[key] as number) : 0), 0);
        return (sum / scores.length).toFixed(1);
    }
    return { 
        present, late, sick, permission, absent, 
        avgInv: avg('activeInvolvement'), 
        avgFlu: avg('fluency'), 
        avgTaj: avg('tajwid'), 
        avgLitScore: avg('literacyScore') 
    };
  }, [scores]);

  const handleAnalyzeAI = async () => {
    setIsAnalyzing(true);
    const record: DailyRecord = {
        id: Date.now().toString(),
        date,
        classId: selectedClass.name,
        teacherName: selectedClass.homeroomTeacher,
        subject,
        studentScores: scores,
        teacherAnalysis,
        recommendations: {
            specialAttention: recSpecial,
            methodImprovement: recMethod,
            nextWeekPlan: recPlan
        }
    };
    const analysis = await generateDailyReportAnalysis(record);
    setAiAnalysis(analysis || "Tidak ada analisis.");
    setIsAnalyzing(false);
  };

  const handleSave = () => {
    const record: DailyRecord = {
      id: Date.now().toString(),
      date,
      classId: selectedClass.name,
      teacherName: selectedClass.homeroomTeacher,
      subject,
      studentScores: scores,
      teacherAnalysis,
      recommendations: {
        specialAttention: recSpecial,
        methodImprovement: recMethod,
        nextWeekPlan: recPlan
      },
      aiAnalysis
    };
    onSave(record);
  };

  const stats = calculateStats();

  // Helper to render dropdown for score
  const renderScoreDropdown = (
    studentIndex: number, 
    field: 'activeInvolvement' | 'fluency' | 'tajwid' | 'adab', 
    options: {value: number, label: string}[],
    colorClass: string
  ) => {
     const currentVal = scores[studentIndex][field] as number;
     return (
       <select 
          className={`w-full p-1.5 text-xs border rounded focus:ring-2 focus:ring-indigo-500 ${colorClass} font-medium`}
          value={currentVal}
          onChange={(e) => updateScore(studentIndex, field, parseInt(e.target.value))}
       >
          {options.map(opt => (
             <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
       </select>
     );
  };

  // Determine Header Icon and Title
  let HeaderIcon = BookOpen;
  let headerColor = "text-indigo-600";
  if (isLiterasi) { HeaderIcon = Book; headerColor = "text-green-600"; }
  else if (isKonsultasi) { HeaderIcon = HeartHandshake; headerColor = "text-pink-600"; }

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <HeaderIcon className={headerColor}/> 
            Instrumen Monitoring - <span className={headerColor}>{subject}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Tanggal</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
             <label className="block text-sm font-medium text-slate-500 mb-1">Kelas</label>
             <div className="w-full p-2 bg-slate-100 rounded-md font-medium text-slate-700">{selectedClass.name}</div>
          </div>
          <div>
             <label className="block text-sm font-medium text-slate-500 mb-1">Wali Kelas</label>
             <div className="w-full p-2 bg-slate-100 rounded-md font-medium text-slate-700">{selectedClass.homeroomTeacher}</div>
          </div>
        </div>
      </div>

      {/* Student Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-slate-50 text-slate-600 text-sm font-semibold">
              <tr>
                <th className="p-3 text-left w-10">No</th>
                <th className="p-3 text-left w-48">Nama Siswa</th>
                <th className="p-3 text-left w-36">
                    <div className="flex flex-col gap-1">
                        <span>Kehadiran</span>
                        <button 
                            onClick={markAllPresent} 
                            className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 w-fit transition-colors font-medium border border-green-200"
                            title="Tandai semua siswa sebagai Hadir"
                        >
                            <CheckSquare size={10} /> Set Semua Hadir
                        </button>
                    </div>
                </th>
                
                {/* Subject Specific Headers */}
                {isTilawati && (
                   <>
                     <th className="p-3 text-left w-32">Jilid</th>
                     <th className="p-3 text-left w-20">Hal</th>
                     <th className="p-3 text-center w-32">Fashohah</th>
                     <th className="p-3 text-center w-32">Tajwid</th>
                     <th className="p-3 text-center w-32">Adab</th>
                   </>
                )}

                {isLiterasi && (
                   <>
                     <th className="p-3 text-center w-24">Jml Soal</th>
                     <th className="p-3 text-center w-24">Benar</th>
                     <th className="p-3 text-center w-24">Salah</th>
                     <th className="p-3 text-center w-24 font-bold text-indigo-700">NILAI</th>
                   </>
                )}

                {isKonsultasi && (
                   <>
                     <th className="p-3 text-center w-40">Kerapian</th>
                     <th className="p-3 text-center w-40">Atribut</th>
                     <th className="p-3 text-center w-40">Kesehatan</th>
                     <th className="p-3 text-center w-40">Respon</th>
                     <th className="p-3 text-left w-48">Topik Masalah</th>
                   </>
                )}

                {!isTilawati && !isLiterasi && !isKonsultasi && (
                    <>
                        <th className="p-3 text-center w-32">Keaktifan</th>
                        <th className="p-3 text-center w-32">Kelancaran</th>
                        <th className="p-3 text-center w-32">Tajwid/Fokus</th>
                        <th className="p-3 text-center w-24">Adab</th>
                    </>
                )}

                <th className="p-3 text-left">
                    <span className="flex items-center gap-2">
                        {isKonsultasi ? "Detail Solusi/Tindakan" : "Catatan Guru"}
                        <span className="text-xs font-normal text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Smart AI</span>
                    </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scores.map((s, idx) => (
                <tr key={s.studentId} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 text-slate-500">{idx + 1}</td>
                  <td className="p-3 font-medium text-slate-800">{s.studentName}</td>
                  <td className="p-3">
                    <select 
                      value={s.attendance} 
                      onChange={(e) => updateScore(idx, 'attendance', e.target.value)}
                      className={`w-full p-1.5 rounded border text-xs font-medium cursor-pointer ${
                          s.attendance === AttendanceStatus.LATE ? 'text-orange-700 bg-orange-50 border-orange-200' :
                          s.attendance === AttendanceStatus.ABSENT ? 'text-red-700 bg-red-50 border-red-200' :
                          s.attendance === AttendanceStatus.SICK ? 'text-blue-700 bg-blue-50 border-blue-200' :
                          s.attendance === AttendanceStatus.PERMISSION ? 'text-purple-700 bg-purple-50 border-purple-200' :
                          'text-slate-700 border-slate-200'
                      }`}
                    >
                      {Object.values(AttendanceStatus).map(st => (
                          <option key={st} value={st}>
                            {ATTENDANCE_LABELS[st]}
                          </option>
                      ))}
                    </select>
                  </td>

                  {/* Tilawati Inputs */}
                  {isTilawati && (
                    <>
                        <td className="p-3">
                            <select 
                                value={s.jilid || 'Jilid 1'}
                                onChange={(e) => updateScore(idx, 'jilid', e.target.value)}
                                className="w-full p-1.5 text-xs border rounded bg-indigo-50 text-indigo-700 border-indigo-100"
                            >
                                {TILAWATI_JILID_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </td>
                        <td className="p-3">
                            <input 
                                type="text"
                                value={s.page || ''}
                                onChange={(e) => updateScore(idx, 'page', e.target.value)}
                                placeholder="Hal..."
                                className="w-full p-1.5 text-xs border rounded text-center"
                            />
                        </td>
                        <td className="p-3">
                             {renderScoreDropdown(idx, 'fluency', TILAWATI_SCORE_OPTIONS.fluency, 'text-green-700 bg-green-50')}
                        </td>
                        <td className="p-3">
                             {renderScoreDropdown(idx, 'tajwid', TILAWATI_SCORE_OPTIONS.tajwid, 'text-blue-700 bg-blue-50')}
                        </td>
                        <td className="p-3">
                             {renderScoreDropdown(idx, 'adab', TILAWATI_SCORE_OPTIONS.adab, 'text-amber-700 bg-amber-50')}
                        </td>
                    </>
                  )}

                  {/* Literasi Inputs */}
                  {isLiterasi && (
                    <>
                        <td className="p-3">
                            <input 
                                type="number" min="0"
                                value={s.literacyTotalQuestions || 0}
                                onChange={(e) => updateScore(idx, 'literacyTotalQuestions', parseInt(e.target.value))}
                                className="w-full p-1.5 text-center border rounded text-xs"
                            />
                        </td>
                        <td className="p-3">
                            <input 
                                type="number" min="0"
                                value={s.literacyCorrect || 0}
                                onChange={(e) => updateScore(idx, 'literacyCorrect', parseInt(e.target.value))}
                                className="w-full p-1.5 text-center border rounded text-xs text-green-700 font-bold bg-green-50"
                            />
                        </td>
                        <td className="p-3">
                            <input 
                                type="number"
                                value={s.literacyWrong || 0}
                                readOnly
                                className="w-full p-1.5 text-center border rounded text-xs bg-red-50 text-red-600"
                            />
                        </td>
                        <td className="p-3">
                            <div className="w-full p-1.5 text-center font-bold text-indigo-700 bg-indigo-50 rounded border border-indigo-100">
                                {s.literacyScore || 0}
                            </div>
                        </td>
                    </>
                  )}

                  {/* Konsultasi & Evaluasi Inputs */}
                  {isKonsultasi && (
                    <>
                       <td className="p-3">
                           {renderScoreDropdown(idx, 'activeInvolvement', CONSULTATION_OPTIONS.kerapian, 'text-slate-700')}
                       </td>
                       <td className="p-3">
                           {renderScoreDropdown(idx, 'fluency', CONSULTATION_OPTIONS.atribut, 'text-slate-700')}
                       </td>
                       <td className="p-3">
                           {renderScoreDropdown(idx, 'tajwid', CONSULTATION_OPTIONS.kesehatan, 'text-pink-700 bg-pink-50')}
                       </td>
                       <td className="p-3">
                           {renderScoreDropdown(idx, 'adab', CONSULTATION_OPTIONS.respon, 'text-purple-700 bg-purple-50')}
                       </td>
                       <td className="p-3">
                           <select 
                                className="w-full p-1.5 text-xs border rounded font-medium text-red-600 bg-red-50 border-red-100"
                                value={s.notes?.split(':')[0] || 'Aman/Nihil'} // Simple hack to store topic in notes temporarily if manual not used
                                onChange={(e) => {
                                    const topic = e.target.value;
                                    // Prepend topic to notes or replace it
                                    updateScore(idx, 'notes', topic);
                                }}
                           >
                                {CONSULTATION_OPTIONS.topics.map(t => <option key={t} value={t}>{t}</option>)}
                           </select>
                       </td>
                    </>
                  )}

                  {/* General Inputs */}
                  {!isTilawati && !isLiterasi && !isKonsultasi && (
                    <>
                        <td className="p-3 text-center">
                            <input 
                                type="number" min="1" max="4"
                                value={s.activeInvolvement}
                                onChange={(e) => updateScore(idx, 'activeInvolvement', parseInt(e.target.value))}
                                className="w-12 p-1 text-center border rounded"
                            />
                        </td>
                        <td className="p-3 text-center">
                             <input 
                                type="number" min="1" max="4"
                                value={s.fluency}
                                onChange={(e) => updateScore(idx, 'fluency', parseInt(e.target.value))}
                                className="w-12 p-1 text-center border rounded"
                            />
                        </td>
                        <td className="p-3 text-center">
                            <input 
                                type="number" min="1" max="4"
                                value={s.tajwid}
                                onChange={(e) => updateScore(idx, 'tajwid', parseInt(e.target.value))}
                                className="w-12 p-1 text-center border rounded"
                            />
                        </td>
                        <td className="p-3 text-center">
                            <input 
                                type="number" min="1" max="4"
                                value={s.adab}
                                onChange={(e) => updateScore(idx, 'adab', parseInt(e.target.value))}
                                className="w-12 p-1 text-center border rounded"
                            />
                        </td>
                    </>
                  )}

                  <td className="p-3 min-w-[250px]">
                    <div className="flex items-center gap-2">
                        {manualEditModes[idx] ? (
                             <input 
                                type="text" 
                                value={s.notes}
                                autoFocus
                                onChange={(e) => updateScore(idx, 'notes', e.target.value)}
                                placeholder={isKonsultasi ? "Detail tindakan/solusi..." : "Ketik manual..."}
                                className="w-full p-1.5 border rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                             />
                        ) : (
                            <select 
                                value={s.notes || ''}
                                onChange={(e) => {
                                    if (e.target.value === 'MANUAL') {
                                        toggleManualEdit(idx);
                                        updateScore(idx, 'notes', '');
                                    } else {
                                        updateScore(idx, 'notes', e.target.value);
                                    }
                                }}
                                className="w-full p-1.5 border rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                            >
                                <option value="">-- {isKonsultasi ? "Saran Tindakan" : "Pilih Catatan"} --</option>
                                <optgroup label="Saran AI (Berdasarkan Input)">
                                    {getSmartNotesOptions(s).map((note: string, i: number) => (
                                        <option key={i} value={note}>{note}</option>
                                    ))}
                                </optgroup>
                                <option value="MANUAL">✏️ Tulis Sendiri...</option>
                            </select>
                        )}
                        <button 
                            onClick={() => toggleManualEdit(idx)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            title="Switch to manual/dropdown"
                        >
                            <Pencil size={14} />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recap Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calculator size={20} /> Rekapitulasi Absensi & Nilai
            </h3>
            <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span>Hadir</span>
                        <span className="font-bold text-green-600">{stats.present}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span>Terlambat</span>
                        <span className="font-bold text-orange-600">{stats.late}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span>Sakit</span>
                        <span className="font-bold text-blue-600">{stats.sick}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span>Izin</span>
                        <span className="font-bold text-purple-600">{stats.permission}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Alpha</span>
                        <span className="font-bold text-red-600">{stats.absent}</span>
                    </div>
                </div>
                
                <h4 className="font-semibold text-slate-700 mt-2">Rata-rata Kelas</h4>
                {isLiterasi ? (
                   <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span>Nilai Literasi</span>
                      <span className="font-bold text-indigo-600">{stats.avgLitScore}</span>
                   </div>
                ) : isKonsultasi ? (
                   <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span>Kesehatan Fisik</span>
                      <span className="font-bold text-pink-600">{stats.avgTaj} (Skala 4)</span>
                   </div>
                ) : (
                   <>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span>{isTilawati ? 'Fashohah' : 'Keterlibatan'}</span>
                        <span className="font-bold">{isTilawati ? stats.avgFlu : stats.avgInv}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span>Tajwid</span>
                        <span className="font-bold">{stats.avgTaj}</span>
                    </div>
                   </>
                )}
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Analisis Guru & Tindak Lanjut</h3>
            <textarea 
                placeholder="Tulis analisis singkat kegiatan hari ini..."
                className="w-full h-24 p-3 border rounded-md text-sm mb-3"
                value={teacherAnalysis}
                onChange={(e) => setTeacherAnalysis(e.target.value)}
            ></textarea>
            <div className="grid grid-cols-1 gap-3">
                <input 
                    placeholder={isKonsultasi ? "Siswa dengan masalah berat..." : "Siswa perlu pendampingan khusus..."}
                    className="w-full p-2 border rounded text-sm"
                    value={recSpecial}
                    onChange={(e) => setRecSpecial(e.target.value)}
                />
                 <input 
                    placeholder={isKonsultasi ? "Evaluasi manajemen kelas..." : "Metode yang perlu diperbaiki..."}
                    className="w-full p-2 border rounded text-sm"
                    value={recMethod}
                    onChange={(e) => setRecMethod(e.target.value)}
                />
            </div>
        </div>
      </div>

      {/* AI Section */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                <Sparkles size={20} className="text-indigo-600" /> AI Education Analyst
            </h3>
            <button 
                onClick={handleAnalyzeAI}
                disabled={isAnalyzing}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
                {isAnalyzing ? 'Sedang Menganalisis...' : 'Analisis Data & Beri Saran'}
            </button>
        </div>
        {aiAnalysis && (
             <div className="bg-white p-4 rounded-lg border border-indigo-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed animate-fade-in">
                {aiAnalysis}
             </div>
        )}
      </div>

      <div className="flex justify-end">
        <button 
            onClick={handleSave}
            className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-green-700 hover:shadow-xl transition-all flex items-center gap-2"
        >
            <Save size={20} /> SIMPAN LAPORAN
        </button>
      </div>
    </div>
  );
};
