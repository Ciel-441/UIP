import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, UserCircle, Minimize2, Maximize2 } from 'lucide-react';

interface CallOverlayProps {
  activeConvId: number;
  conversations: any[];
  localStream: MediaStream | null;
  remoteStreams: Record<number, { stream: MediaStream | null, volume: number }>;
  onEndCall: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onSetVolume: (peerId: number, volume: number) => void;
  currentUserId: number | undefined;
}

const VideoPlayer = ({ 
  stream, 
  muted = false, 
  volume = 1,
  pfpUrl,
  name
}: { 
  stream: MediaStream | null, 
  muted?: boolean, 
  volume?: number,
  pfpUrl?: string,
  name?: string
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);
  
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);
  
  // Check if there is an active video track
  const hasVideo = stream ? stream.getVideoTracks().some(track => track.enabled && track.readyState === 'live') : false;

  return (
    <div className="relative w-full h-full bg-[#0e0e15] flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted={muted} 
        className={`w-full h-full object-cover transition-opacity duration-300 ${hasVideo ? 'opacity-100 block' : 'opacity-0 absolute pointer-events-none w-1 h-1'}`}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#151522] w-full h-full">
          {/* Blurred Background */}
          {pfpUrl ? (
            <img 
              src={pfpUrl} 
              alt="bg" 
              className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-20 scale-110 pointer-events-none" 
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-tr from-[#ff79c6]/5 to-[#d68eff]/5 blur-3xl" />
          )}
          
          {/* Centered Profile Avatar */}
          <div className="relative flex flex-col items-center gap-3 z-10">
            <div className="w-24 h-24 rounded-full border border-white/20 overflow-hidden shadow-2xl bg-[#2a2a3e] flex items-center justify-center">
              {pfpUrl ? (
                <img src={pfpUrl} alt={name || "user"} className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="w-16 h-16 text-[#6b6b7b]" />
              )}
            </div>
            {name && (
              <span className="text-sm font-semibold text-white tracking-wide drop-shadow-md">
                {name}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function CallOverlay({ 
  activeConvId, 
  conversations, 
  localStream, 
  remoteStreams, 
  onEndCall, 
  onToggleAudio, 
  onToggleVideo,
  onSetVolume,
  currentUserId
}: CallOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasAnyoneJoined, setHasAnyoneJoined] = useState(false);
  
  useEffect(() => {
    const peersCount = Object.keys(remoteStreams).length;
    if (peersCount > 0 && !hasAnyoneJoined) {
      setHasAnyoneJoined(true);
    } else if (peersCount === 0 && hasAnyoneJoined) {
      onEndCall();
    }
  }, [remoteStreams, hasAnyoneJoined, onEndCall]);
  
  const conv = conversations.find(c => c.id === activeConvId);
  if (!conv) return null;

  const isAudioEnabled = localStream?.getAudioTracks().some(t => t.enabled);
  const isVideoEnabled = localStream?.getVideoTracks().some(t => t.enabled);
  
  const remotePeers = Object.entries(remoteStreams);

  // Look up my profile details
  const myMember = conv.members?.find((m: any) => m.id === currentUserId);
  const myPfp = myMember?.pfp_url;
  const myName = myMember?.name || 'You';

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[200] bg-[#12121a]/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-3 flex items-center gap-4 animate-fade-in max-w-sm">
        <div className="relative flex items-center gap-2.5">
          {/* Avatar / Icon */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff79c6] to-[#d68eff] flex items-center justify-center overflow-hidden shrink-0">
            {conv.pfp_url ? (
              <img src={conv.pfp_url} alt="pfp" className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="w-6 h-6 text-white" />
            )}
          </div>
          {/* Pulsing indicator */}
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#10b981] border-2 border-[#12121a] flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0 pr-2">
          <h4 className="text-xs font-semibold text-white truncate">{conv.name || 'Group Call'}</h4>
          <p className="text-[10px] text-[#6b6b7b] truncate font-medium">Call ongoing</p>
        </div>

        {/* Small Control Actions */}
        <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
          <button 
            onClick={onToggleAudio}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isAudioEnabled ? 'hover:bg-white/5 text-[#a0a0b0]' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
          >
            {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
          
          <button 
            onClick={onToggleVideo}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isVideoEnabled ? 'hover:bg-white/5 text-[#a0a0b0]' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
          >
            {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>

          <button 
            onClick={onEndCall}
            className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-500 transition-colors cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" />
          </button>

          <button 
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-[#a0a0b0] hover:text-white transition-colors cursor-pointer"
            title="Maximize Call"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col p-4 md:p-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">{conv.name || 'Group Call'}</h2>
          <p className="text-[#6b6b7b] text-sm">
            {remotePeers.length === 0 ? 'Waiting for others to join...' : `${remotePeers.length + 1} participants`}
          </p>
        </div>
        
        <button 
          onClick={() => setIsMinimized(true)}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#a0a0b0] hover:text-white transition-colors cursor-pointer flex items-center justify-center shrink-0"
          title="Minimize Call"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
      </div>

      {/* Grid */}
      <div className={`flex-1 grid gap-4 ${remotePeers.length === 0 ? 'grid-cols-1 max-w-2xl mx-auto w-full' : remotePeers.length === 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-3'} min-h-0`}>
        
        {/* Local Stream */}
        <div className="relative w-full h-full min-h-[200px]">
          <VideoPlayer 
            stream={localStream} 
            muted={true} 
            pfpUrl={myPfp}
            name={myName}
          />
          <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded-md text-xs text-white font-medium flex items-center gap-2 z-20">
            You {isAudioEnabled ? '' : '(Muted)'}
          </div>
        </div>
        
        {/* Remote Streams */}
        {remotePeers.map(([peerIdStr, { stream, volume }]) => {
          const peerId = parseInt(peerIdStr);
          const member = conv.members?.find((m: any) => m.id === peerId);
          const name = member?.name || `User ${peerId}`;
          const pfpUrl = member?.pfp_url;
          
          return (
            <div key={peerId} className="relative w-full h-full min-h-[200px] group">
              <VideoPlayer 
                stream={stream} 
                volume={volume} 
                pfpUrl={pfpUrl}
                name={name}
              />
              <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded-md text-xs text-white font-medium z-20">
                {name}
              </div>
              
              {/* Volume Control Overlay */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 p-2 rounded-lg flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-white" />
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={volume}
                  onChange={(e) => {
                    const newVol = parseFloat(e.target.value);
                    onSetVolume(peerId, newVol);
                    // Find actual audio element inside VideoPlayer?
                    // Because VideoPlayer abstracts it, we should pass volume to VideoPlayer
                  }}
                  className="w-20"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="mt-8 flex items-center justify-center gap-4">
        <button 
          onClick={onToggleAudio}
          className={`p-4 rounded-full transition-colors ${isAudioEnabled ? 'bg-[#2a2a3e] hover:bg-[#3a3a4e] text-white' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'}`}
        >
          {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </button>
        
        <button 
          onClick={onToggleVideo}
          className={`p-4 rounded-full transition-colors ${isVideoEnabled ? 'bg-[#2a2a3e] hover:bg-[#3a3a4e] text-white' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'}`}
        >
          {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </button>
        
        <button 
          onClick={onEndCall}
          className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
      
    </div>
  );
}
