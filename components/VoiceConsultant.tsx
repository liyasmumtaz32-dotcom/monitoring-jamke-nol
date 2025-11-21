import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Volume2, X } from 'lucide-react';

export const VoiceConsultant: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcription, setTranscription] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null); // For future video extension
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  
  useEffect(() => {
    // Cleanup on unmount
    return () => {
        // Close session logic would go here if exposed by API easily
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
    };
  }, []);

  const connectToGemini = async () => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = outputAudioContext;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                },
                systemInstruction: "Anda adalah Kepala Sekolah AI yang bijaksana. Bantu guru mendiskusikan masalah siswa dan metode Tilawati secara lisan. Jadilah suportif dan ringkas.",
            },
            callbacks: {
                onopen: () => {
                    setIsConnected(true);
                    const source = inputAudioContext.createMediaStreamSource(stream);
                    const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.onaudioprocess = (e) => {
                        if (isMuted) return;
                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    // Handle Audio Output
                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio) {
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                        const source = outputAudioContext.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContext.destination);
                        source.start();
                    }
                    // Handle Transcription if available (simplified for demo)
                    if(message.serverContent?.modelTurn?.parts[0]?.text) {
                         setTranscription(message.serverContent.modelTurn.parts[0].text);
                    }
                },
                onclose: () => setIsConnected(false),
                onerror: (err) => console.error(err)
            }
        });
        sessionPromiseRef.current = sessionPromise;

    } catch (error) {
        console.error("Failed to connect:", error);
        alert("Gagal koneksi ke Live API. Pastikan API Key valid dan mic diizinkan.");
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white rounded-xl shadow-2xl border border-indigo-100 w-80 overflow-hidden font-sans">
      <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            <h3 className="font-semibold">Konsultasi Live</h3>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
      </div>
      
      <div className="p-6 flex flex-col items-center justify-center gap-6 bg-slate-50 h-64">
        {!isConnected ? (
             <button 
             onClick={connectToGemini}
             className="flex flex-col items-center gap-3 text-indigo-600 hover:scale-105 transition-transform">
                <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-indigo-200">
                    <Mic size={32} />
                </div>
                <span className="font-medium">Mulai Diskusi Suara</span>
             </button>
        ) : (
            <>
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg relative">
                    <div className="absolute w-full h-full rounded-full border-4 border-white/20 animate-ping"></div>
                    <Volume2 className="text-white" size={40} />
                </div>
                <div className="flex gap-4">
                    <button onClick={toggleMute} className={`p-3 rounded-full ${isMuted ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-700'}`}>
                        {isMuted ? <MicOff /> : <Mic />}
                    </button>
                </div>
                <p className="text-xs text-slate-500 text-center px-4">
                    Berbicaralah dengan AI Kepala Sekolah untuk evaluasi metode.
                </p>
            </>
        )}
      </div>
    </div>
  );
};

// Helpers for Audio
function createBlob(data: Float32Array): any {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  }
  
  function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  
  async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }