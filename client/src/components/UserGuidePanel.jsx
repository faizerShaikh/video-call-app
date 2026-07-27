import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  LuBadgeCheck,
  LuChevronDown,
  LuChevronUp,
  LuLightbulb,
  LuLink,
  LuMonitorUp,
  LuSearch,
  LuShield,
  LuUser,
  LuUsers,
  LuVideo,
  LuVolume2,
  LuX,
} from 'react-icons/lu';

const GUIDE_STORAGE_KEY = 'synchro-user-guide-hidden';

const GUIDE_SECTIONS = [
  {
    id: 'welcome',
    title: 'Welcome to Synchro',
    icon: LuBadgeCheck,
    summary: 'A quick overview of how meetings work in Synchro.',
    points: [
      'Use this page to create or join a meeting with a room ID.',
      'The first person to join becomes the meeting host.',
      'Hosts approve new participants before they enter the room.',
    ],
  },
  {
    id: 'create',
    title: 'Create a Meeting',
    icon: LuVideo,
    summary: 'Start a new room and become the host.',
    points: [
      'Enter or generate a room ID, then join the room.',
      'As the host, you will receive live join requests from other participants.',
    ],
  },
  {
    id: 'join',
    title: 'Join a Meeting',
    icon: LuUsers,
    summary: 'Join with a room ID or a shared meeting link.',
    points: [
      'Paste a shared link or type the room ID manually.',
      'If a host is already inside, you will wait for approval before entering.',
    ],
  },
  {
    id: 'invite',
    title: 'Invite Participants',
    icon: LuLink,
    summary: 'Share the room so others can join quickly.',
    points: [
      'Use the share button inside the meeting to copy or share the room link.',
      'Non-Pro hosted meetings allow up to 3 total participants.',
    ],
  },
  {
    id: 'controls',
    title: 'Audio & Video Controls',
    icon: LuVolume2,
    summary: 'Manage your camera and microphone during the call.',
    points: [
      'Use the bottom controls to mute/unmute your microphone.',
      'Turn your camera on or off at any time during the meeting.',
    ],
  },
  {
    id: 'screen-share',
    title: 'Screen Sharing',
    icon: LuMonitorUp,
    summary: 'Share your screen with other participants.',
    pro: true,
    points: [
      'Screen sharing is available for Pro users only.',
      'If someone else is already sharing, you must wait until they stop.',
    ],
  },
  {
    id: 'profile',
    title: 'Profile & Account',
    icon: LuUser,
    summary: 'Manage your profile details and password.',
    points: [
      'Open your profile to update your name and phone number.',
      'You can change your password from the profile page whenever needed.',
    ],
  },
  {
    id: 'security',
    title: 'Security & Access',
    icon: LuShield,
    summary: 'Keep your account and meetings secure.',
    points: [
      'Use Forgot Password on the login page if you cannot access your account.',
      'Only the current host can approve or reject meeting join requests.',
    ],
  },
];

const QUICK_TIPS = [
  'Use the dice button to generate a unique meeting ID quickly.',
  'Keep the room ID short and easy to share with participants.',
  'If media permissions are blocked, allow camera and microphone access in your browser.',
];

function ProBadge() {
  return (
    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
      Pro
    </span>
  );
}

export function UserGuidePanel() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isHidden, setIsHidden] = useState(false);
  const [expandedSections, setExpandedSections] = useState(() =>
    GUIDE_SECTIONS.reduce((acc, section, index) => {
      acc[section.id] = index < 2;
      return acc;
    }, {})
  );

  useEffect(() => {
    const hiddenPreference = window.localStorage.getItem(GUIDE_STORAGE_KEY);
    setIsHidden(hiddenPreference === 'true');
  }, []);

  const filteredSections = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return GUIDE_SECTIONS;

    return GUIDE_SECTIONS.filter((section) => {
      const haystack = [
        section.title,
        section.summary,
        ...section.points,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [searchTerm]);

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const hideGuide = () => {
    setIsHidden(true);
    window.localStorage.setItem(GUIDE_STORAGE_KEY, 'true');
  };

  const showGuide = () => {
    setIsHidden(false);
    window.localStorage.setItem(GUIDE_STORAGE_KEY, 'false');
  };

  if (isHidden) {
    return (
      <div className="w-full h-full">
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">Guide hidden</p>
              <p className="text-sm text-muted-foreground">Show it again whenever you need help.</p>
            </div>
            <Button variant="outline" onClick={showGuide}>
              Show Guide
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <aside className="flex h-full w-full min-h-0 flex-col">
      <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">How to Use Synchro</CardTitle>
              <CardDescription className="mt-1">
                A quick, always-available guide while you work from the meeting page.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={hideGuide}
              aria-label="Hide guide"
              className="shrink-0"
            >
              <LuX className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative mt-4">
            <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search the guide..."
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          <div className="space-y-3">
            {filteredSections.map((section, index) => {
              const Icon = section.icon;
              const isExpanded = !!expandedSections[section.id];

              return (
                <div
                  key={section.id}
                  className="rounded-xl border bg-background/80 transition-colors hover:bg-muted/20"
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-start gap-3 p-4 text-left"
                  >
                    <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {index + 1}.
                        </span>
                        <span className="font-medium">{section.title}</span>
                        {section.pro && <ProBadge />}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{section.summary}</p>
                    </div>
                    <div className="pt-1 text-muted-foreground">
                      {isExpanded ? <LuChevronUp className="h-4 w-4" /> : <LuChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  <div
                    className={`grid overflow-hidden transition-all duration-200 ease-out ${
                      isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="min-h-0">
                      <div className="border-t px-4 pb-4 pt-3">
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          {section.points.map((point) => (
                            <li key={point} className="flex gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredSections.length === 0 && (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No guide sections matched your search.
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <LuLightbulb className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Quick Tips</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {QUICK_TIPS.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
