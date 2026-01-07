import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export function VideoPlayer({ stream, isLocal = false, muted = false, className }) {
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
    </div>
  );
}

