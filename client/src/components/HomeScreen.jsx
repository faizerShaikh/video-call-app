import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { calendarAPI, meetingAPI } from '@/services/api';

function makeCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const part = () =>
    Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part()}-${part()}-${part()}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`h-[22px] w-9 shrink-0 rounded-full p-[3px] transition-colors ${
        checked ? 'bg-[#1C6E6E]' : 'bg-[#D5DDE0]'
      }`}
    >
      <span
        className={`block h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[14px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function HomeScreen({
  isConnected,
  connectionError,
  joinError,
  onStartMeeting,
  onJoinRoom,
}) {
  const [view, setView] = useState('home');
  const [roomCode, setRoomCode] = useState(() => makeCode());
  const [joinValue, setJoinValue] = useState('');
  const [waitingRoom, setWaitingRoom] = useState(true);
  const [passcodeOn, setPasscodeOn] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [expires, setExpires] = useState('never');
  const [copied, setCopied] = useState(false);
  const [calendar, setCalendar] = useState('Outlook');
  const [hostApproval, setHostApproval] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [googleAccount, setGoogleAccount] = useState({ connected: false, email: null });
  const [outlookAccount, setOutlookAccount] = useState({ connected: false, email: null });
  const [upcoming, setUpcoming] = useState([]);
  const [connecting, setConnecting] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    date: '',
    start: '10:00',
    duration: '30 min',
    invites: '',
  });
  const [addLinkToEvents, setAddLinkToEvents] = useState(true);
  const googleConnected = Boolean(googleAccount?.connected);
  const outlookConnected = Boolean(outlookAccount?.connected);

  const hello = useMemo(() => greeting(), []);
  const displayLink = `synchro.ai21.ca/r/${roomCode}`;
  const shareUrl = `${window.location.origin}/call?roomid=${roomCode}`;

  useEffect(() => {
    const timer = setTimeout(() => {
      meetingAPI.save(roomCode, {
        waitingRoom,
        passcodeEnabled: passcodeOn,
        passcode: passcodeOn ? passcode : '',
        expires,
      }).catch(() => {
        toast.error('Could not save meeting settings');
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [roomCode, waitingRoom, passcodeOn, passcode, expires]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      toast.error('Could not copy the link');
      return;
    }
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 1600);
  };

  const openMail = () => {
    const pass = passcodeOn && passcode ? `\nPasscode: ${passcode}` : '';
    const body = encodeURIComponent(`Join my Synchro meeting: ${shareUrl}${pass}`);
    window.location.href = `mailto:?subject=${encodeURIComponent('Synchro meeting')}&body=${body}`;
  };

  const openOutlook = () => {
    const url = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent('Synchro meeting')}&body=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openGoogle = () => {
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Synchro meeting')}&details=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const applyCalendarStatus = (data) => {
    setGoogleAccount(data.google || { connected: false, email: null });
    setOutlookAccount(data.outlook || { connected: false, email: null });
    setUpcoming(data.upcoming || []);
  };

  useEffect(() => {
    let ignore = false;
    calendarAPI.status()
      .then(({ data }) => {
        if (!ignore) applyCalendarStatus(data);
      })
      .catch(() => {});

    const provider = searchParams.get('calendar');
    const connected = searchParams.get('connected');
    if (provider && connected != null) {
      const name = provider === 'google' ? 'Google Calendar' : 'Microsoft Outlook';
      if (connected === '1') toast.success(`${name} connected`);
      else toast.error(searchParams.get('reason') || `Could not connect ${name}`);
      const next = new URLSearchParams(searchParams);
      next.delete('calendar');
      next.delete('connected');
      next.delete('reason');
      setSearchParams(next, { replace: true });
    }

    return () => {
      ignore = true;
    };
    // Read the OAuth return once, when this screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectProvider = async (provider) => {
    setConnecting(provider);
    try {
      const { data } = await calendarAPI.start(provider);
      window.location.assign(data.url);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not start the calendar connection');
      setConnecting(null);
    }
  };

  const disconnectProvider = async (provider) => {
    setConnecting(provider);
    try {
      const { data } = await calendarAPI.disconnect(provider);
      applyCalendarStatus(data);
      toast.success(provider === 'google' ? 'Google Calendar disconnected' : 'Outlook disconnected');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not disconnect');
    } finally {
      setConnecting(null);
    }
  };

  const scheduleMeeting = async (event) => {
    event.preventDefault();
    const title = scheduleForm.title.trim();
    if (!title) {
      toast.error('Enter a meeting title');
      return;
    }
    if (!scheduleForm.date || !scheduleForm.start) {
      toast.error('Choose a date and start time');
      return;
    }
    const minutes = scheduleForm.duration === '1 hour' ? 60 : scheduleForm.duration === '45 min' ? 45 : 30;
    const startDate = new Date(`${scheduleForm.date}T${scheduleForm.start}`);
    if (Number.isNaN(startDate.getTime())) {
      toast.error('Enter a valid date and time');
      return;
    }
    if (startDate.getTime() < Date.now() - 60_000) {
      toast.error('Choose a start time in the future');
      return;
    }
    const endDate = new Date(startDate.getTime() + minutes * 60_000);
    const pad = (value) => String(value).padStart(2, '0');
    const stamp = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
    const providers = calendar === 'Both' ? ['outlook', 'google'] : calendar === 'Google' ? ['google'] : ['outlook'];

    setScheduling(true);
    try {
      const { data } = await calendarAPI.schedule({
        title,
        startLocal: stamp(startDate),
        endLocal: stamp(endDate),
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        invites: scheduleForm.invites,
        providers,
        roomId: roomCode,
        meetingUrl: shareUrl,
        addLink: addLinkToEvents,
      });
      setUpcoming(data.upcoming || []);
      toast.success(data.message || 'Meeting scheduled');
      setScheduleForm((form) => ({ ...form, title: '', invites: '' }));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not schedule the meeting');
    } finally {
      setScheduling(false);
    }
  };

  const startMeeting = () => {
    if (!isConnected) {
      toast.error('Still connecting to the server');
      return;
    }
    onStartMeeting(roomCode);
  };

  const joinMeeting = () => {
    const value = joinValue.trim();
    if (!value) {
      toast.error('Enter a room ID or link');
      return;
    }
    if (!isConnected) {
      toast.error('Still connecting to the server');
      return;
    }
    const fromLink = value.match(/roomid=([^&]+)/i);
    onJoinRoom(fromLink ? decodeURIComponent(fromLink[1]) : value);
  };

  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] flex-col bg-white text-[#0F2A44]">
      <div className="mx-auto w-full max-w-[1120px] flex-1 px-5 py-7 sm:px-10 sm:py-12">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-6 sm:mb-12">
          <div>
            <h1 className="m-0 text-[26px] font-semibold tracking-[-0.02em] sm:text-[34px]">{hello}</h1>
            <p className="mt-2 flex items-center gap-2 text-[15px] text-[#6B7A84]">
              <span className={`inline-block h-[7px] w-[7px] rounded-full ${isConnected ? 'bg-[#2E8B4F]' : 'bg-amber-500'}`} />
              {isConnected ? 'Secure network connected' : 'Connecting to secure network…'}
            </p>
          </div>
          <div className="hidden gap-2.5 sm:flex">
            <button type="button" onClick={() => document.getElementById('schedule')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex h-[46px] items-center rounded-[10px] border border-[#E6EBED] bg-white px-5 text-[15px] font-semibold hover:border-[#C9D3D6]">
              Schedule
            </button>
            <button type="button" onClick={startMeeting} className="inline-flex h-[46px] items-center rounded-[10px] bg-[#1C6E6E] px-5 text-[15px] font-semibold text-white hover:bg-[#155858]">
              Start meeting
            </button>
          </div>
          {view === 'home' && (
            <div className="grid w-full grid-cols-2 gap-2.5 sm:hidden">
              <button type="button" onClick={startMeeting} className="inline-flex h-[52px] items-center justify-center rounded-[10px] bg-[#1C6E6E] px-4 text-[15px] font-semibold text-white">
                Start meeting
              </button>
              <button type="button" onClick={() => setView('schedule')} className="inline-flex h-[52px] items-center justify-center rounded-[10px] border border-[#E6EBED] bg-white px-4 text-[15px] font-semibold">
                Schedule
              </button>
            </div>
          )}
        </div>

        {(connectionError || joinError) && view === 'home' && (
          <div className="mb-6 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {joinError || connectionError}
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-[72px]">
          <div>
            <div className={view === 'home' ? 'block' : 'hidden lg:block'}>
                <section className="mb-10 border-b border-[#E6EBED] pb-10">
                  <div className="mb-[18px] flex items-center justify-between">
                    <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6B7A84]">Quick link</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setWaitingRoom(true);
                        setPasscodeOn(false);
                        setPasscode('');
                        setExpires('never');
                        setRoomCode(makeCode());
                        toast.success('New link created');
                      }}
                      className="h-10 border-0 bg-transparent px-1 text-[15px] font-semibold text-[#1C6E6E]"
                    >
                      New link
                    </button>
                  </div>
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <div className="flex h-[54px] min-w-0 flex-1 items-center overflow-hidden rounded-[10px] border border-[#E6EBED] bg-[#F6F8F8] px-[18px] text-[15px] font-medium sm:text-[17px]">
                      <span className="truncate">{displayLink}</span>
                    </div>
                    <button type="button" onClick={copyLink} className="inline-flex h-[46px] items-center justify-center rounded-[10px] bg-[#1C6E6E] px-5 text-[15px] font-semibold text-white hover:bg-[#155858] sm:h-[54px]">
                      {copied ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3.5 text-sm text-[#2B3A45]">
                    <span className="flex items-center gap-2.5">
                      <Switch checked={waitingRoom} onChange={setWaitingRoom} label="Waiting room" />
                      Waiting room
                    </span>
                    <span className="flex items-center gap-2.5">
                      <Switch
                        checked={passcodeOn}
                        onChange={(enabled) => {
                          setPasscodeOn(enabled);
                          if (enabled && !passcode) {
                            setPasscode(String(Math.floor(100000 + Math.random() * 900000)));
                          }
                        }}
                        label="Passcode"
                      />
                      Passcode
                      {passcodeOn && passcode && <span className="font-semibold tracking-wide">{passcode}</span>}
                    </span>
                    <span className="flex items-center gap-2.5">
                      <label htmlFor="exp">Expires</label>
                      <select id="exp" value={expires} onChange={(e) => setExpires(e.target.value)} className="border-0 bg-transparent py-1 font-semibold">
                        <option>never</option>
                        <option>in 24 hours</option>
                        <option>in 7 days</option>
                      </select>
                    </span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1">
                    <button type="button" onClick={openMail} className="h-10 border-0 bg-transparent px-1 text-[15px] font-semibold text-[#1C6E6E]">Email invite</button>
                    <button type="button" onClick={openOutlook} className="h-10 border-0 bg-transparent px-1 text-[15px] font-semibold text-[#1C6E6E]">Add to Outlook</button>
                    <button type="button" onClick={openGoogle} className="h-10 border-0 bg-transparent px-1 text-[15px] font-semibold text-[#1C6E6E]">Add to Google Calendar</button>
                  </div>
                </section>

                <section>
                  <div className="mb-[18px]">
                    <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6B7A84]">Join with a room ID</h2>
                  </div>
                  <form
                    className="flex items-center gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      joinMeeting();
                    }}
                  >
                    <input
                      value={joinValue}
                      onChange={(e) => setJoinValue(e.target.value)}
                      placeholder="Room ID or link"
                      className="h-[46px] min-w-0 flex-1 rounded-[10px] border border-[#E6EBED] bg-white px-3.5 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-[#1C6E6E]"
                    />
                    <button type="submit" className="inline-flex h-[46px] shrink-0 items-center rounded-[10px] border border-[#E6EBED] bg-white px-5 text-[15px] font-semibold hover:border-[#C9D3D6]">
                      Join
                    </button>
                  </form>
                </section>
              </div>

            <section id="schedule" className={`scroll-mt-24 border-t border-[#E6EBED] pt-10 ${view === 'schedule' ? 'block' : 'hidden lg:block'}`}>
                <div className="mb-[18px] flex items-center justify-between">
                  <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6B7A84]">Schedule a meeting</h2>
                  <button type="button" onClick={() => setView('home')} className="text-sm font-semibold text-[#1C6E6E] lg:hidden">Back</button>
                </div>
                <form
                  className="grid grid-cols-2 gap-4 lg:grid-cols-4"
                  onSubmit={scheduleMeeting}
                >
                  <label className="col-span-2 flex flex-col gap-1.5 lg:col-span-4">
                    <span className="text-[13px] font-medium text-[#6B7A84]">Title</span>
                    <input value={scheduleForm.title} onChange={(e) => setScheduleForm((form) => ({ ...form, title: e.target.value }))} placeholder="Weekly project sync" className="h-[46px] rounded-[10px] border border-[#E6EBED] px-3.5 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-[#1C6E6E]" />
                  </label>
                  <label className="col-span-2 flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-[#6B7A84]">Date</span>
                    <input type="date" value={scheduleForm.date} onChange={(e) => setScheduleForm((form) => ({ ...form, date: e.target.value }))} className="h-[46px] rounded-[10px] border border-[#E6EBED] px-3.5 text-[15px]" />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-[#6B7A84]">Start</span>
                    <input type="time" value={scheduleForm.start} onChange={(e) => setScheduleForm((form) => ({ ...form, start: e.target.value }))} className="h-[46px] rounded-[10px] border border-[#E6EBED] px-3.5 text-[15px]" />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-[#6B7A84]">Duration</span>
                    <select value={scheduleForm.duration} onChange={(e) => setScheduleForm((form) => ({ ...form, duration: e.target.value }))} className="h-[46px] rounded-[10px] border border-[#E6EBED] bg-white px-3.5 text-[15px]">
                      <option>30 min</option>
                      <option>45 min</option>
                      <option>1 hour</option>
                    </select>
                  </label>
                  <label className="col-span-2 flex flex-col gap-1.5 lg:col-span-4">
                    <span className="text-[13px] font-medium text-[#6B7A84]">Invite</span>
                    <input value={scheduleForm.invites} onChange={(e) => setScheduleForm((form) => ({ ...form, invites: e.target.value }))} placeholder="Add emails, separated by commas" className="h-[46px] rounded-[10px] border border-[#E6EBED] px-3.5 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-[#1C6E6E]" />
                  </label>
                  <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-4">
                    <span className="text-[13px] font-medium text-[#6B7A84]">Add to calendar</span>
                    <div className="inline-flex w-full rounded-[10px] border border-[#E6EBED] p-[3px] sm:w-auto">
                      {['Outlook', 'Google', 'Both'].map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCalendar(item)}
                          className={`h-[38px] flex-1 rounded-[7px] px-4 text-sm font-medium sm:flex-none ${
                            calendar === item ? 'bg-[#0F2A44] text-white' : 'text-[#6B7A84]'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2 mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:col-span-4">
                    <label className="flex items-center gap-2.5 text-sm text-[#2B3A45]">
                      <input type="checkbox" checked={hostApproval} onChange={(e) => setHostApproval(e.target.checked)} className="h-[18px] w-[18px] accent-[#1C6E6E]" />
                      Host approves who joins
                    </label>
                    <button type="submit" disabled={scheduling} className="inline-flex h-[46px] items-center justify-center rounded-[10px] bg-[#1C6E6E] px-5 text-[15px] font-semibold text-white hover:bg-[#155858] disabled:opacity-60">
                      {scheduling ? 'Scheduling…' : 'Schedule & send invites'}
                    </button>
                  </div>
                </form>
              </section>

            {view === 'calendars' && (
              <section className="lg:hidden">
                <CalendarPanel
                  googleConnected={googleConnected}
                  googleEmail={googleAccount?.email}
                  outlookConnected={outlookConnected}
                  outlookEmail={outlookAccount?.email}
                  connecting={connecting}
                  onToggleGoogle={() => (googleConnected ? disconnectProvider('google') : connectProvider('google'))}
                  onToggleOutlook={() => (outlookConnected ? disconnectProvider('outlook') : connectProvider('outlook'))}
                  addLinkToEvents={addLinkToEvents}
                  onToggleAddLink={setAddLinkToEvents}
                />
              </section>
            )}
          </div>

          <aside className={view === 'home' ? 'block' : 'hidden lg:block'}>
            {view !== 'calendars' && (
              <section className="mb-10 border-b border-[#E6EBED] pb-10">
                <div className="mb-[18px] flex items-center justify-between">
                  <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6B7A84]">Up next</h2>
                </div>
                {upcoming.length === 0 ? (
                  <div className="rounded-xl bg-[#EAF3F2] p-5">
                    <p className="text-sm font-medium text-[#2B3A45]">No meetings scheduled yet.</p>
                    <p className="mt-1 text-sm text-[#6B7A84]">Schedule a meeting to send calendar invites.</p>
                    <button type="button" onClick={startMeeting} className="mt-4 inline-flex h-[46px] w-full items-center justify-center rounded-[10px] bg-[#1C6E6E] text-[15px] font-semibold text-white hover:bg-[#155858]">
                      Start meeting
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {upcoming.map((meeting) => (
                      <div key={meeting.id} className="rounded-xl border border-[#E6EBED] p-4">
                        <p className="font-semibold">{meeting.title}</p>
                        <p className="mt-1 text-sm text-[#6B7A84]">
                          {new Date(meeting.startsAt).toLocaleString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                        {meeting.providers?.length > 0 && (
                          <p className="mt-1 text-xs font-medium text-[#1C6E6E]">
                            {meeting.providers.map((provider) => (provider === 'google' ? 'Google' : 'Outlook')).join(' · ')}
                          </p>
                        )}
                        <button type="button" onClick={() => onStartMeeting(meeting.roomId)} className="mt-3 inline-flex h-[40px] items-center rounded-[10px] bg-[#1C6E6E] px-4 text-sm font-semibold text-white hover:bg-[#155858]">
                          Start
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="hidden lg:block">
              <CalendarPanel
                googleConnected={googleConnected}
                googleEmail={googleAccount?.email}
                outlookConnected={outlookConnected}
                outlookEmail={outlookAccount?.email}
                connecting={connecting}
                onToggleGoogle={() => (googleConnected ? disconnectProvider('google') : connectProvider('google'))}
                onToggleOutlook={() => (outlookConnected ? disconnectProvider('outlook') : connectProvider('outlook'))}
                addLinkToEvents={addLinkToEvents}
                onToggleAddLink={setAddLinkToEvents}
              />
            </section>
          </aside>
        </div>
      </div>

      <nav className="grid grid-cols-3 border-t border-[#E6EBED] bg-white px-0 pb-3 pt-1.5 lg:hidden">
        {[
          ['home', 'Home'],
          ['schedule', 'Schedule'],
          ['calendars', 'Calendars'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
              view === id ? 'text-[#0F2A44]' : 'text-[#6B7A84]'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function connectionLabel(connected, email) {
  if (!connected) return 'Not connected';
  return email ? `Connected as ${email}` : 'Connected';
}

function CalendarPanel({
  googleConnected,
  googleEmail,
  onToggleGoogle,
  outlookConnected,
  outlookEmail,
  onToggleOutlook,
  connecting,
  addLinkToEvents,
  onToggleAddLink,
}) {
  return (
    <>
      <div className="mb-[18px]">
        <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6B7A84]">Calendars</h2>
      </div>
      <div className="flex items-center gap-3 border-b border-[#E6EBED] py-3.5">
        <div className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold">Microsoft Outlook</b>
          <span className={`block truncate text-[13px] ${outlookConnected ? 'text-[#1E6B3A]' : 'text-[#6B7A84]'}`}>
            {connectionLabel(outlookConnected, outlookEmail)}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleOutlook}
          disabled={connecting === 'outlook'}
          className={outlookConnected ? 'text-[15px] font-semibold text-[#1C6E6E] disabled:opacity-60' : 'inline-flex h-[46px] items-center rounded-[10px] border border-[#E6EBED] px-4 text-[15px] font-semibold disabled:opacity-60'}
        >
          {connecting === 'outlook' ? 'Please wait…' : outlookConnected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
      <div className="flex items-center gap-3 border-b border-[#E6EBED] py-3.5">
        <div className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold">Google Calendar</b>
          <span className={`block truncate text-[13px] ${googleConnected ? 'text-[#1E6B3A]' : 'text-[#6B7A84]'}`}>
            {connectionLabel(googleConnected, googleEmail)}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleGoogle}
          disabled={connecting === 'google'}
          className={googleConnected ? 'text-[15px] font-semibold text-[#1C6E6E] disabled:opacity-60' : 'inline-flex h-[46px] items-center rounded-[10px] border border-[#E6EBED] px-4 text-[15px] font-semibold disabled:opacity-60'}
        >
          {connecting === 'google' ? 'Please wait…' : googleConnected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
      <label className="mt-3 flex items-center gap-2.5 text-sm text-[#2B3A45]">
        <input type="checkbox" checked={addLinkToEvents} onChange={(e) => onToggleAddLink(e.target.checked)} className="h-[18px] w-[18px] accent-[#1C6E6E]" />
        Add a Synchro link to new events
      </label>
    </>
  );
}
