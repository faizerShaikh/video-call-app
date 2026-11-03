import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SynchroLogo } from '@/components/SynchroLogo';

export function GuestJoin({
  roomId,
  initialName = '',
  error,
  joining = false,
  passcodeRequired = false,
  waitingRoom = true,
  expired = false,
  onSubmit,
  onBack,
}) {
  const [name, setName] = useState(initialName);
  const [passcode, setPasscode] = useState('');
  const trimmed = name.trim();
  const trimmedPasscode = passcode.trim();
  const showJoining = joining && !error;
  const canSubmit = trimmed && (!passcodeRequired || trimmedPasscode);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit || showJoining || expired) return;
    onSubmit(trimmed.slice(0, 80), trimmedPasscode);
  };

  return (
    <div className="min-h-screen bg-[#F6F8F8] flex flex-col">
      <Header guest />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4 pb-4 border-b">
              <SynchroLogo className="text-[30px]" />
            </div>
            <CardTitle className="text-3xl text-[#0F2A44]">Join meeting</CardTitle>
            <CardDescription>
              {expired
                ? 'This meeting link has expired.'
                : waitingRoom
                  ? 'Enter your name to join. The host will let you in.'
                  : 'Enter your name to join the meeting.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expired ? (
              <p className="py-4 text-center text-sm text-[#6B7A84]">Ask the host for a new meeting link.</p>
            ) : showJoining ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="h-10 w-10 rounded-full border-4 border-[#1C6E6E] border-t-transparent animate-spin" />
                <p className="text-sm text-[#6B7A84]">Joining the meeting…</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-[10px] border border-[#E6EBED] bg-[#F6F8F8] px-4 py-3 text-sm">
                  <p className="text-[#6B7A84]">Meeting ID</p>
                  <p className="font-semibold break-all text-[#0F2A44]">{roomId}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-name">Your name</Label>
                  <Input
                    id="guest-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter your name"
                    maxLength={80}
                    autoFocus
                    autoComplete="name"
                  />
                </div>
                {passcodeRequired && (
                  <div className="space-y-2">
                    <Label htmlFor="guest-passcode">Passcode</Label>
                    <Input
                      id="guest-passcode"
                      value={passcode}
                      onChange={(event) => setPasscode(event.target.value)}
                      placeholder="Enter the meeting passcode"
                      maxLength={10}
                      autoComplete="off"
                    />
                  </div>
                )}
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={!canSubmit}>
                  Join meeting
                </Button>
                {joining && onBack && (
                  <Button type="button" variant="outline" className="w-full" onClick={onBack}>
                    Back
                  </Button>
                )}
              </form>
            )}
            {!showJoining && (
              <p className="mt-6 text-center text-sm text-[#6B7A84]">
                Have an account?{' '}
                <Link
                  to="/"
                  state={{ from: { pathname: '/call', search: `?roomid=${encodeURIComponent(roomId)}` } }}
                  className="font-medium text-[#1C6E6E] hover:underline"
                >
                  Sign in
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
