import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function Suspended() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <CardTitle className="text-2xl">Account Suspended</CardTitle>
          <CardDescription>
            Your account has been suspended
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Your account has been temporarily suspended.
            </p>
            {user?.suspensionReason && (
              <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <p className="text-sm font-medium mb-1">Reason:</p>
                <p className="text-sm text-muted-foreground">{user.suspensionReason}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              Please contact support if you have any questions.
            </p>
          </div>

          <div className="pt-4 space-y-2">
            <Button onClick={handleLogout} variant="outline" className="w-full">
              Logout
            </Button>
            <Button onClick={() => navigate('/')} variant="ghost" className="w-full">
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
