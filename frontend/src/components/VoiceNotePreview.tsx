import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Trash2, Send, Loader2 } from 'lucide-react';

interface VoiceNotePreviewProps {
  file: File;
  onDiscard: () => void;
  onSend: () => void;
  isUploading: boolean;
}

export function VoiceNotePreview({ file, onDiscard, onSend, isUploading }: VoiceNotePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      // Sometimes Infinity is returned for webm files initially
      if (audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (duration === 0 && audio.currentTime > 0) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [duration]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === Infinity) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex-1 bg-[#1e1e2d] border border-[#2a2a3e] rounded-xl flex items-center gap-3 px-3 py-2 min-h-[44px]">
      <audio ref={audioRef} src={audioUrl} className="hidden" />
      
      <button 
        type="button" 
        onClick={onDiscard}
        className="p-2 text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-colors shrink-0"
      >
        <Trash2 className="w-5 h-5" />
      </button>

      <div className="flex-1 flex items-center gap-3 bg-[#12121a] rounded-lg px-3 py-1.5 border border-[#2a2a3e]/50">
        <button 
          type="button"
          onClick={togglePlayPause}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-[#ff79c6] text-white hover:bg-[#ff92df] transition-colors shrink-0"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div className="flex-1 flex flex-col justify-center">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-[#ff79c6] font-medium tracking-wide uppercase">Voice Preview</span>
            <span className="text-xs text-[#a0a0b0] font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          
          <div className="w-full h-1.5 bg-[#2a2a3e] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#ff79c6] rounded-full transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={isUploading}
        onClick={onSend}
        className="p-2 bg-[#ff79c6] text-white rounded-lg hover:bg-[#ff92df] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
      </button>
    </div>
  );
}
