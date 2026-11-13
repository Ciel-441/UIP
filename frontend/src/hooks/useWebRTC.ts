import { useState, useEffect, useRef, useCallback } from 'react';
import { useDialog } from '@/context/DialogContext';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function useWebRTC(ws: WebSocket | null, currentUserId: number | undefined) {
  const { showToast } = useDialog();
  const [activeCallConvId, setActiveCallConvId] = useState<number | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<number, { stream: MediaStream | null, volume: number }>>({});
  const [incomingCall, setIncomingCall] = useState<{ conversationId: number, senderId: number } | null>(null);
  
  // Track connections and pending ICE candidates
  const peersRef = useRef<Record<number, RTCPeerConnection>>({});
  const pendingCandidatesRef = useRef<Record<number, RTCIceCandidateInit[]>>({});

  const activeCallConvIdRef = useRef<number | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const updateActiveCallConvId = (id: number | null) => {
    setActiveCallConvId(id);
    activeCallConvIdRef.current = id;
  };

  const updateLocalStream = (stream: MediaStream | null) => {
    setLocalStream(stream);
    localStreamRef.current = stream;
  };

  const cleanupCall = useCallback(() => {
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    updateLocalStream(null);
    setRemoteStreams({});
    updateActiveCallConvId(null);
  }, []);

  const renegotiate = async (peerId: number) => {
    const pc = peersRef.current[peerId];
    if (pc && ws && ws.readyState === WebSocket.OPEN) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({
          type: 'webrtc_offer',
          target_user_id: peerId,
          offer: offer
        }));
      } catch (err) {
        console.error("Renegotiation failed:", err);
      }
    }
  };

  const createPeerConnection = (peerId: number) => {
    if (peersRef.current[peerId]) return peersRef.current[peerId];
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[peerId] = pc;
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
    }
    
    pc.onicecandidate = (event) => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'webrtc_ice_candidate',
          target_user_id: peerId,
          candidate: event.candidate
        }));
      }
    };
    
    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [peerId]: { ...prev[peerId], stream: event.streams[0] }
      }));
    };
    
    return pc;
  };

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!ws) return;
    
    const handleMessage = async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log("DEBUG: useWebRTC WS RECEIVED MESSAGE", data);
        
        if (data.type === 'call_status') {
          if (data.status === 'joined' && data.sender_id !== currentUserId) {
            if (activeCallConvIdRef.current === data.conversation_id) {
              // Add to remote streams immediately
              setRemoteStreams(prev => ({
                ...prev,
                [data.sender_id]: { stream: prev[data.sender_id]?.stream || null, volume: prev[data.sender_id]?.volume || 1.0 }
              }));

              // Someone joined our active call. We should initiate a connection to them!
              createPeerConnection(data.sender_id);
              await renegotiate(data.sender_id);
            } else if (activeCallConvIdRef.current === null) {
              // We are not in a call, notify about incoming call
              setIncomingCall({
                conversationId: data.conversation_id,
                senderId: data.sender_id
              });
            }
          } else if (data.status === 'left') {
            // Remove their stream and connection
            if (peersRef.current[data.sender_id]) {
              peersRef.current[data.sender_id].close();
              delete peersRef.current[data.sender_id];
            }
            setRemoteStreams(prev => {
              const next = { ...prev };
              delete next[data.sender_id];
              return next;
            });
            // Clear incoming call if caller left
            setIncomingCall(prev => {
              if (prev && prev.conversationId === data.conversation_id && prev.senderId === data.sender_id) {
                return null;
              }
              return prev;
            });
          }
        }
        
        else if (data.type === 'webrtc_offer') {
          const senderId = data.sender_id;
          
          // Add offering participant immediately
          setRemoteStreams(prev => ({
            ...prev,
            [senderId]: { stream: prev[senderId]?.stream || null, volume: prev[senderId]?.volume || 1.0 }
          }));

          const pc = createPeerConnection(senderId);
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          ws.send(JSON.stringify({
            type: 'webrtc_answer',
            target_user_id: senderId,
            answer: answer
          }));
          
          // Add any pending candidates
          const pending = pendingCandidatesRef.current[senderId] || [];
          for (const candidate of pending) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          delete pendingCandidatesRef.current[senderId];
        }
        
        else if (data.type === 'webrtc_answer') {
          const senderId = data.sender_id;
          const pc = peersRef.current[senderId];
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          }
        }
        
        else if (data.type === 'webrtc_ice_candidate') {
          const senderId = data.sender_id;
          const pc = peersRef.current[senderId];
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } else {
            // Queue it up if remote description isn't set yet
            if (!pendingCandidatesRef.current[senderId]) {
              pendingCandidatesRef.current[senderId] = [];
            }
            pendingCandidatesRef.current[senderId].push(data.candidate);
          }
        }
      } catch (e) {
        console.error("Error processing WebRTC message", e);
      }
    };
    
    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, currentUserId]);

  const startCall = async (conversationId: number, withVideo: boolean = false) => {
    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: withVideo
        });
        updateLocalStream(stream);
      } catch (mediaError) {
        console.warn("Could not get media stream, continuing in signaling-only mode:", mediaError);
        showToast("Call started in signaling-only mode (camera/microphone not detected or blocked).", "info");
      }
      
      updateActiveCallConvId(conversationId);
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'call_status',
          conversation_id: conversationId,
          status: 'joined'
        }));
      }
    } catch (e) {
      console.error("Failed to start call", e);
    }
  };

  const acceptCall = () => {
    if (incomingCall) {
      startCall(incomingCall.conversationId);
      setIncomingCall(null);
    }
  };

  const endCall = () => {
    if (ws && ws.readyState === WebSocket.OPEN && activeCallConvIdRef.current) {
      ws.send(JSON.stringify({
        type: 'call_status',
        conversation_id: activeCallConvIdRef.current,
        status: 'left'
      }));
    }
    cleanupCall();
  };

  const setRemoteVolume = (peerId: number, volume: number) => {
    setRemoteStreams(prev => {
      if (!prev[peerId]) return prev;
      return { ...prev, [peerId]: { ...prev[peerId], volume } };
    });
  };

  const toggleLocalAudio = async () => {
    if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => { track.enabled = !track.enabled; });
      updateLocalStream(new MediaStream(localStreamRef.current.getTracks())); // trigger re-render
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          const newStream = localStreamRef.current 
            ? new MediaStream([...localStreamRef.current.getTracks(), audioTrack])
            : stream;
          updateLocalStream(newStream);
          
          for (const [peerIdStr, pc] of Object.entries(peersRef.current)) {
            const peerId = parseInt(peerIdStr);
            pc.addTrack(audioTrack, newStream);
            await renegotiate(peerId);
          }
        }
      } catch (err) {
        console.error("Failed to acquire microphone on toggle:", err);
        showToast("Microphone access denied or blocked.", "error");
      }
    }
  };

  const toggleLocalVideo = async () => {
    if (localStreamRef.current && localStreamRef.current.getVideoTracks().length > 0) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => { track.enabled = !track.enabled; });
      updateLocalStream(new MediaStream(localStreamRef.current.getTracks())); // trigger re-render
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const newStream = localStreamRef.current 
            ? new MediaStream([...localStreamRef.current.getTracks(), videoTrack])
            : stream;
          updateLocalStream(newStream);
          
          for (const [peerIdStr, pc] of Object.entries(peersRef.current)) {
            const peerId = parseInt(peerIdStr);
            pc.addTrack(videoTrack, newStream);
            await renegotiate(peerId);
          }
        }
      } catch (err) {
        console.error("Failed to acquire camera on toggle:", err);
        showToast("Camera access denied or blocked.", "error");
      }
    }
  };

  return {
    activeCallConvId,
    localStream,
    remoteStreams,
    startCall,
    endCall,
    setRemoteVolume,
    toggleLocalAudio,
    toggleLocalVideo,
    incomingCall,
    setIncomingCall,
    acceptCall
  };
}
