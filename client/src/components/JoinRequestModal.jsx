import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function JoinRequestModal({
  requests = [],
  onApprove,
  onReject,
  busyRequesterId = null,
}) {
  if (!requests.length) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle>Join requests</CardTitle>
          <CardDescription>
            People are waiting to join your meeting. Approve or deny each request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[60vh] overflow-y-auto">
          {requests.map((request) => {
            const isBusy = busyRequesterId === request.requesterSocketId;
            return (
              <div
                key={request.requesterSocketId}
                className="rounded-lg border bg-muted/30 p-3 space-y-3"
              >
                <div>
                  <p className="font-semibold text-base">
                    {request.userName || 'Unknown user'}
                  </p>
                  {request.userEmail ? (
                    <p className="text-sm text-muted-foreground break-all">
                      {request.userEmail}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Email not available</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={isBusy}
                    onClick={() => onApprove(request.requesterSocketId)}
                  >
                    {isBusy ? 'Working...' : 'Allow'}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={isBusy}
                    onClick={() => onReject(request.requesterSocketId)}
                  >
                    Deny
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
