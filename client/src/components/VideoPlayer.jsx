import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export function VideoPlayer({ stream, isLocal = false, muted = false, className }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
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

