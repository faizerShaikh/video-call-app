import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!videoRef.current) return;

    if (stream) {
      console.log('🎥 Setting video srcObject:', {
        streamId: stream.id,
        tracks: stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, id: t.id })),
      });
      
      // Set srcObject
      videoRef.current.srcObject = stream;
      
      // Play video after a small delay to avoid interruption errors
      const playPromise = videoRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('✅ Video playing successfully');
          })
          .catch(err => {
            // Ignore AbortError - it's usually harmless (video was interrupted by new load)
            if (err.name !== 'AbortError') {
              console.error('Error playing video:', err);
            }
          });
      }
    } else {
      // Clear video when stream is removed
      videoRef.current.srcObject = null;
    }
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
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center text-white">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm">Waiting for video...</p>
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

