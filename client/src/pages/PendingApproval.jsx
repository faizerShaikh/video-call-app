import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function PendingApproval() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
            <span className="text-3xl">⏳</span>
          </div>
          <CardTitle className="text-2xl">Awaiting Approval</CardTitle>
          <CardDescription>
            Your registration is pending admin approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Hello {user?.name || 'User'}, your account has been created successfully.
            </p>
            <p className="text-sm text-muted-foreground">
              An administrator will review your registration and approve your account.
              You will be notified once your account is approved.
            </p>
            <p className="text-sm font-medium text-muted-foreground mt-4">
              Expected approval time: 24-48 hours
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
