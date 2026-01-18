import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';

export function Rejected() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
            <span className="text-3xl">❌</span>
          </div>
          <CardTitle className="text-2xl">Account Rejected</CardTitle>
          <CardDescription>
            Your registration has been rejected
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              We're sorry, but your account registration has been rejected.
            </p>
            {user?.rejectionReason && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm font-medium mb-1">Reason:</p>
                <p className="text-sm text-muted-foreground">{user.rejectionReason}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              If you believe this is an error, please contact support or try registering again.
            </p>
          </div>

          <div className="pt-4 space-y-2">
            <Link to="/register">
              <Button className="w-full">Register Again</Button>
            </Link>
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
