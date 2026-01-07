import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HiOutlinePhoneMissedCall } from 'react-icons/hi';

export function Controls({
  isVideoEnabled,
  isAudioEnabled,
  onToggleVideo,
  onToggleAudio,
  onEndCall,
  connectionState,
}) {
  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-card rounded-lg border">
      {/* Video Toggle */}
      <Button
        variant={isVideoEnabled ? 'default' : 'destructive'}
        size="lg"
        onClick={onToggleVideo}
        className="rounded-full w-14 h-14"
        title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
      >
        {isVideoEnabled ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        )}
      </Button>

      {/* Audio Toggle */}
      <Button
        variant={isAudioEnabled ? 'default' : 'destructive'}
        size="lg"
        onClick={onToggleAudio}
        className="rounded-full w-14 h-14"
        title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
      >
        {isAudioEnabled ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
            />
          </svg>
        )}
      </Button>

      {/* End Call */}
      <Button
        variant="destructive"
        size="lg"
        onClick={onEndCall}
        className="rounded-full w-14 h-14"
        title="End call"
      >
        <HiOutlinePhoneMissedCall className="h-6 w-6 text-white" />
      </Button>

      {/* Connection Status */}
      <div className="ml-4 flex items-center gap-2">
        <div
          className={cn(
            'w-3 h-3 rounded-full',
            connectionState === 'connected' && 'bg-green-500',
            connectionState === 'connecting' && 'bg-yellow-500 animate-pulse',
            connectionState === 'disconnected' && 'bg-gray-500',
            connectionState === 'failed' && 'bg-red-500'
          )}
        />
        <span className="text-sm text-muted-foreground capitalize">
          {connectionState}
        </span>
      </div>
    </div>
  );
}

