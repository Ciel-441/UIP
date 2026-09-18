import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw } from 'lucide-react';

export default function CameraCaptureModal({ onClose, onCapture }: { onClose: () => void, onCapture: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(s => {
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch(console.error);
      
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#12121a] rounded-2xl w-full max-w-lg border border-[#2a2a3e] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[#2a2a3e] flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2"><Camera className="w-5 h-5" /> Take a Photo</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="relative bg-black flex items-center justify-center min-h-[300px]">
          {!stream && <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full max-h-[60vh] object-contain"
          />
        </div>

        <div className="p-4 border-t border-[#2a2a3e] flex justify-center">
          <button 
            onClick={handleCapture}
            className="w-16 h-16 rounded-full border-4 border-white bg-[#ff79c6] hover:bg-[#ff92df] flex items-center justify-center transition-transform active:scale-95"
          >
            <Camera className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
