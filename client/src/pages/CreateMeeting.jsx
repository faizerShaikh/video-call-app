import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { meetingAPI } from '@/services/api';
import { toast } from 'sonner';
import { LuCopy, LuShare2, LuTrash2, LuClock } from 'react-icons/lu';

const meetingSchema = z.object({
  title: z.string().max(100, 'Title must be less than 100 characters').optional(),
});

export function CreateMeeting() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(meetingSchema),
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Fetch user's meetings
  useEffect(() => {
    if (isAuthenticated) {
      fetchMeetings();
    }
  }, [isAuthenticated]);

  // Countdown timer for created meeting
  useEffect(() => {
    if (!createdMeeting) return;

    const interval = setInterval(() => {
      const now = new Date();
      const expiresAt = new Date(createdMeeting.expiresAt);
      const diff = expiresAt - now;

      if (diff <= 0) {
        setTimeRemaining(null);
        setCreatedMeeting(null);
        fetchMeetings();
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
  }, [createdMeeting]);

  const fetchMeetings = async () => {
    try {
      const response = await meetingAPI.getUserMeetings({ status: 'active' });
      if (response.data.success) {
        setMeetings(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const response = await meetingAPI.createMeeting(data);
      if (response.data.success) {
        const meeting = response.data.data;
        setCreatedMeeting(meeting);
        toast.success('Meeting created successfully!');
        reset();
        fetchMeetings();
      } else {
        toast.error(response.data.error || 'Failed to create meeting');
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast.error(error.response?.data?.error || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const shareLink = async (link) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join my meeting',
          text: `Join my meeting: ${createdMeeting?.title || 'Video Call'}`,
          url: link,
        });
      } else {
        copyToClipboard(link);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        copyToClipboard(link);
      }
    }
  };

  const handleEndMeeting = async (meetingId) => {
    if (!confirm('Are you sure you want to end this meeting?')) return;

    try {
      const response = await meetingAPI.endMeeting(meetingId);
      if (response.data.success) {
        toast.success('Meeting ended successfully');
        if (createdMeeting?.meetingId === meetingId) {
          setCreatedMeeting(null);
          setTimeRemaining(null);
        }
        fetchMeetings();
      } else {
        toast.error(response.data.error || 'Failed to end meeting');
      }
    } catch (error) {
      console.error('Error ending meeting:', error);
      toast.error(error.response?.data?.error || 'Failed to end meeting');
    }
  };

  const formatTimeRemaining = () => {
    if (!timeRemaining) return 'Expired';
    const { hours, minutes, seconds } = timeRemaining;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Create Meeting</h1>

        {/* Create Meeting Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>New Meeting</CardTitle>
            <CardDescription>
              Create a shareable meeting link that expires in 1 hour
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Meeting Title (Optional)</Label>
                <Input
                  id="title"
                  placeholder="e.g., Team Standup, Client Call"
                  {...register('title')}
                />
                {errors.title && (
                  <p className="text-sm text-destructive">{errors.title.message}</p>
                )}
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Creating...' : 'Create Meeting'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Created Meeting Display */}
        {createdMeeting && (
          <Card className="mb-8 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LuClock className="w-5 h-5" />
                Meeting Created
              </CardTitle>
              <CardDescription>
                Share this link with participants. Expires in {formatTimeRemaining()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {createdMeeting.title && (
                <div>
                  <Label className="text-sm font-semibold">Title</Label>
                  <p className="text-sm text-muted-foreground">{createdMeeting.title}</p>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold">Meeting Link</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={createdMeeting.shareableLink}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(createdMeeting.shareableLink)}
                    title="Copy link"
                  >
                    <LuCopy className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => shareLink(createdMeeting.shareableLink)}
                    title="Share link"
                  >
                    <LuShare2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={() => navigate(`/call?roomid=${createdMeeting.roomId}&meetingId=${createdMeeting.meetingId}`)}
                >
                  Join Meeting
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleEndMeeting(createdMeeting.meetingId)}
                >
                  <LuTrash2 className="w-4 h-4 mr-2" />
                  End Meeting
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Meetings List */}
        {meetings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Active Meetings</CardTitle>
              <CardDescription>
                Your currently active meetings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {meetings.map((meeting) => (
                  <div
                    key={meeting._id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {meeting.title || 'Untitled Meeting'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Meeting ID: {meeting.meetingId}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Participants: {meeting.participantCount || 0}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate(`/call?roomid=${meeting.roomId}&meetingId=${meeting.meetingId}`)
                        }
                      >
                        Join
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleEndMeeting(meeting.meetingId)}
                      >
                        <LuTrash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
