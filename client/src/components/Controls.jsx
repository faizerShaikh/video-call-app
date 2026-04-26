import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LuShare2 } from 'react-icons/lu';

function ControlWithTooltip({ tooltip, children }) {
  return (
    <div className="relative group">
      {children}
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-md bg-black/85 px-2 py-1 text-xs text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 whitespace-nowrap z-20">
        {tooltip}
      </div>
    </div>
  );
}

export function Controls({
  isVideoEnabled,
  isAudioEnabled,
  isScreenSharing,
  canShareScreen,
  screenShareMessage,
  onToggleVideo,
  onToggleAudio,
  onToggleScreenShare,
  onShareRoom,
  onLeaveRoom,
  connectionState,
  isMobileView = false,
}) {
  return (
    <div className={cn(
      'flex items-center gap-3',
      isMobileView ? 'flex-wrap justify-start' : 'justify-end'
    )}>
      {/* Video Toggle */}
      <ControlWithTooltip tooltip={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}>
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
      </ControlWithTooltip>

      {/* Audio Toggle */}
      <ControlWithTooltip tooltip={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}>
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
      </ControlWithTooltip>

      {/* Screen Share Toggle */}
      <ControlWithTooltip tooltip={screenShareMessage || (isScreenSharing ? 'Stop screen share' : 'Share your screen')}>
        <Button
          variant={isScreenSharing ? 'destructive' : 'outline'}
          size="lg"
          onClick={onToggleScreenShare}
          disabled={!canShareScreen}
          className="rounded-full w-14 h-14"
          title={screenShareMessage || (isScreenSharing ? 'Stop screen share' : 'Share your screen')}
        >
          {isScreenSharing ? (
            // Stop/cancel screen sharing icon
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
                d="M4 4h16v10H4z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 20h8M12 14v6M6 6l12 6M18 6L6 12"
              />
            </svg>
          ) : (
            // Start screen sharing icon
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
                d="M9.75 17L8 21m8-4l1.75 4M4 3h16a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z"
              />
            </svg>
          )}
        </Button>
      </ControlWithTooltip>

      <ControlWithTooltip tooltip="Share room link">
        <Button
          variant="outline"
          size="lg"
          onClick={onShareRoom}
          className="rounded-full w-14 h-14"
          title="Share room link"
        >
          <LuShare2 className="h-5 w-5" />
        </Button>
      </ControlWithTooltip>

      <ControlWithTooltip tooltip="Leave room">
        <Button
          variant="outline"
          size="lg"
          onClick={onLeaveRoom}
          className="rounded-full w-14 h-14 border-red-200 text-red-600 hover:bg-red-50"
          title="Leave room"
        >
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
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </Button>
      </ControlWithTooltip>

      {/* Connection Status */}
      <div className={cn('flex items-center gap-2 px-2', !isMobileView && 'ml-1')}>
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

