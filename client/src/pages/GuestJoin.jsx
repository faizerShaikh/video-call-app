import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { meetingAPI } from '@/services/api';
import { toast } from 'sonner';
import { LuClock, LuInfo, LuX } from 'react-icons/lu';
import logo from '/logo.png';

const guestJoinSchema = z.object({
  guestName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9\s\-_.,!?]+$/, 'Name contains invalid characters'),
});

export function GuestJoin() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [meeting, setMeeting] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(guestJoinSchema),
  });

  // Fetch meeting details
  useEffect(() => {
    if (meetingId) {
      fetchMeeting();
    }
  }, [meetingId]);

  // Countdown timer
  useEffect(() => {
    if (!meeting || !meeting.expiresAt) return;

    const interval = setInterval(() => {
      const now = new Date();
      const expiresAt = new Date(meeting.expiresAt);
      const diff = expiresAt - now;

      if (diff <= 0) {
        setTimeRemaining(null);
        setMeeting((prev) => (prev ? { ...prev, isExpired: true } : null));
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining({
        hours,
        minutes,
        seconds,
        total: diff,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [meeting]);

  const fetchMeeting = async () => {
    setFetching(true);
    try {
      const response = await meetingAPI.getMeeting(meetingId);
      if (response.data.success) {
        setMeeting(response.data.data);
        if (response.data.data.isExpired || !response.data.data.canJoin) {
          toast.error('This meeting has expired or is no longer available');
        }
      } else {
        toast.error(response.data.error || 'Meeting not found');
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('Error fetching meeting:', error);
      const errorMessage =
        error.response?.data?.error ||
        (error.response?.status === 404
          ? 'Meeting not found'
          : error.response?.status === 410
          ? 'This meeting has expired'
          : 'Failed to load meeting');
      toast.error(errorMessage);
      if (error.response?.status === 404 || error.response?.status === 410) {
        setTimeout(() => navigate('/', { replace: true }), 2000);
      }
    } finally {
      setFetching(false);
    }
  };

  const onSubmit = async (data) => {
    if (!meeting || !meeting.canJoin) {
      toast.error('This meeting is no longer available');
      return;
    }

    setLoading(true);
    try {
      const response = await meetingAPI.joinAsGuest(meetingId, data.guestName);
      if (response.data.success) {
        const { token, roomId } = response.data.data;
        // Store guest token and info
        localStorage.setItem('guestToken', token);
        localStorage.setItem('guestName', data.guestName);
        localStorage.setItem('guestMeetingId', meetingId);
        
        // Navigate to call with meeting info
        navigate(`/call?roomid=${roomId}&meetingId=${meetingId}&guest=true`, {
          replace: true,
        });
      } else {
        toast.error(response.data.error || 'Failed to join meeting');
      }
    } catch (error) {
      console.error('Error joining as guest:', error);
      const errorMessage =
        error.response?.data?.error ||
        (error.response?.status === 410
          ? 'This meeting has expired'
          : 'Failed to join meeting');
      toast.error(errorMessage);
      
      if (error.response?.status === 410) {
        setTimeout(() => {
          setMeeting((prev) => (prev ? { ...prev, isExpired: true } : null));
        }, 1000);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = () => {
    if (!timeRemaining) return 'Expired';
    const { hours, minutes, seconds } = timeRemaining;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading meeting...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <LuX className="w-5 h-5" />
              Meeting Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              The meeting you're looking for doesn't exist or has expired.
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = meeting.isExpired || !meeting.canJoin;
  const isExpiringSoon = timeRemaining && timeRemaining.total < 15 * 60 * 1000; // Less than 15 minutes

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Synchr" className="h-12 w-auto" />
          </div>
          <CardTitle>Join Meeting</CardTitle>
          <CardDescription>
            {meeting.title || 'Video Call Meeting'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Meeting Info */}
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Host:</span>
              <span className="text-sm">{meeting.createdBy?.name || 'Unknown'}</span>
            </div>
            {timeRemaining && !isExpired && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1">
                  <LuClock className="w-4 h-4" />
                  Time Remaining:
                </span>
                <span
                  className={`text-sm font-semibold ${
                    isExpiringSoon ? 'text-destructive' : ''
                  }`}
                >
                  {formatTimeRemaining()}
                </span>
              </div>
            )}
            {meeting.participantCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Participants:</span>
                <span className="text-sm">{meeting.participantCount}</span>
              </div>
            )}
          </div>

          {/* Expired Warning */}
          {isExpired && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
              <div className="flex items-center gap-2">
                <LuInfo className="w-5 h-5" />
                <div>
                  <p className="font-semibold">Meeting Expired</p>
                  <p className="text-sm mt-1">
                    This meeting is no longer available for joining.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Expiring Soon Warning */}
          {isExpiringSoon && !isExpired && (
            <div className="p-4 bg-yellow-500/10 text-yellow-600 rounded-lg border border-yellow-500/20">
              <div className="flex items-center gap-2">
                <LuClock className="w-5 h-5" />
                <p className="text-sm">
                  This meeting will expire soon. Join quickly!
                </p>
              </div>
            </div>
          )}

          {/* Guest Name Form */}
          {!isExpired && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guestName">Your Name</Label>
                <Input
                  id="guestName"
                  placeholder="Enter your name"
                  {...register('guestName')}
                  disabled={loading}
                  autoFocus
                />
                {errors.guestName && (
                  <p className="text-sm text-destructive">
                    {errors.guestName.message}
                  </p>
                )}
              </div>

              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? 'Joining...' : 'Join as Guest'}
              </Button>
            </form>
          )}

          {isExpired && (
            <Button onClick={() => navigate('/')} className="w-full" variant="outline">
              Go Home
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
