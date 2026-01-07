import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export function VideoPlayer({ 
  stream, 
  isLocal = false, 
  muted = false, 
  className,
  isVideoEnabled = true,
  isAudioEnabled = true,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [hasVideoTracks, setHasVideoTracks] = useState(false);

  // Monitor stream for video tracks
  useEffect(() => {
    if (!stream) {
      setHasVideoTracks(false);
      return;
    }

    const checkTracks = () => {
      const tracks = stream.getTracks();
      const videoTracks = tracks.filter(t => t.kind === 'video' && t.readyState === 'live');
      const hasTracks = videoTracks.length > 0;
      
      if (hasTracks !== hasVideoTracks) {
        console.log('🎥 Video tracks changed:', {
          streamId: stream.id,
          hasTracks,
          videoTracks: videoTracks.length,
          totalTracks: tracks.length,
          trackIds: videoTracks.map(t => t.id.substring(0, 8)),
        });
        setHasVideoTracks(hasTracks);
      }
    };

    // Check immediately
    checkTracks();

    // Listen for track additions/removals
    const handleTrackAdded = (event) => {
      console.log('➕ Track added to stream:', event.track.kind, event.track.id.substring(0, 8));
      if (event.track.kind === 'video') {
        checkTracks();
      }
    };

    const handleTrackRemoved = (event) => {
      console.log('➖ Track removed from stream:', event.track.kind, event.track.id.substring(0, 8));
      if (event.track.kind === 'video') {
        checkTracks();
      }
    };

    stream.addEventListener('addtrack', handleTrackAdded);
    stream.addEventListener('removetrack', handleTrackRemoved);

    return () => {
      stream.removeEventListener('addtrack', handleTrackAdded);
      stream.removeEventListener('removetrack', handleTrackRemoved);
    };
  }, [stream, hasVideoTracks]);

  // Update video element when stream or tracks change
  useEffect(() => {
    if (!videoRef.current) return;

    if (stream && hasVideoTracks) {
      const currentSrcObject = videoRef.current.srcObject;
      
      // Only update if the stream reference has changed
      if (currentSrcObject !== stream) {
        console.log('🎥 Updating video srcObject:', {
          streamId: stream.id,
          previousStreamId: currentSrcObject?.id || 'none',
          tracks: stream.getTracks().map(t => `${t.kind}(${t.id.substring(0, 8)})`).join(', '),
        });
        
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Play video
        const playPromise = videoRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('✅ Video playing successfully');
            })
            .catch(err => {
              // Ignore AbortError - it's usually harmless (video was interrupted by new load)
              if (err.name !== 'AbortError') {
                console.error('❌ Error playing video:', err);
              }
            });
        }
      } else {
        // Same stream, but check if tracks are still there
        const tracks = stream.getTracks();
        const videoTracks = tracks.filter(t => t.kind === 'video' && t.readyState === 'live');
        if (videoTracks.length === 0 && currentSrcObject) {
          console.warn('⚠️ Stream lost video tracks, clearing srcObject');
          videoRef.current.srcObject = null;
          streamRef.current = null;
        }
      }
    } else {
      // Clear video when stream is removed or has no video tracks
      if (videoRef.current.srcObject) {
        console.log('🧹 Clearing video srcObject');
        videoRef.current.srcObject = null;
        streamRef.current = null;
      }
    }
  }, [stream, hasVideoTracks]);
  
  // Also listen for track state changes on the video element's stream
  useEffect(() => {
    if (!videoRef.current || !stream) return;
    
    const videoElement = videoRef.current;
    
    const handleLoadedMetadata = () => {
      console.log('📹 Video metadata loaded');
    };
    
    const handleLoadedData = () => {
      console.log('📹 Video data loaded');
    };
    
    const handleCanPlay = () => {
      console.log('📹 Video can play');
      // Ensure video is playing
      if (videoElement.paused) {
        videoElement.play().catch(err => {
          if (err.name !== 'AbortError') {
            console.error('Error playing video on canplay:', err);
          }
        });
      }
    };
    
    const handlePlay = () => {
      console.log('▶️ Video started playing');
    };
    
    const handlePause = () => {
      console.log('⏸️ Video paused');
    };
    
    const handleError = (e) => {
      console.error('❌ Video error:', e);
    };
    
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('loadeddata', handleLoadedData);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('error', handleError);
    
    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('error', handleError);
    };
  }, [stream]);

  return (
    <div className={cn('relative w-full h-full bg-black rounded-lg overflow-hidden', className)}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted || isLocal}
        className="w-full h-full object-cover"
      />
      {(!stream || !hasVideoTracks) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
          <div className="text-center text-white">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm">
              {!stream ? 'Waiting for video...' : 'Waiting for video tracks...'}
            </p>
            {stream && !hasVideoTracks && (
              <p className="text-xs text-gray-400 mt-2">
                Stream connected, waiting for video track
              </p>
            )}
          </div>
        </div>
      )}
      {isLocal && (
        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          You
        </div>
      )}
      
      {/* Video/Audio Status Indicators */}
      {(!isVideoEnabled || !isAudioEnabled) && (
        <div className="absolute top-2 right-2 flex gap-2 z-10">
          {!isVideoEnabled && (
            <div className="bg-red-500/90 text-white px-2 py-1 rounded flex items-center gap-1 text-xs font-semibold shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l22 22" />
              </svg>
              Video Off
            </div>
          )}
          {!isAudioEnabled && (
            <div className="bg-red-500/90 text-white px-2 py-1 rounded flex items-center gap-1 text-xs font-semibold shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l22 22" />
              </svg>
              Mic Off
            </div>
          )}
        </div>
      )}
    </div>
  );
}

