import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';

export function WaitingForApproval({
  roomId,
  userName,
  onCancel,
  message = 'Waiting for the host to let you in',
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
            <CardTitle className="text-2xl">Waiting for host approval</CardTitle>
            <CardDescription>
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
              <p className="text-muted-foreground">Meeting ID</p>
              <p className="font-semibold break-all">{roomId}</p>
            </div>
            {userName && (
              <p className="text-sm text-muted-foreground">
                Joining as <span className="font-medium text-foreground">{userName}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              You&apos;ll join automatically once the host allows your request.
            </p>
            <Button variant="outline" className="w-full" onClick={onCancel}>
              Cancel request
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
