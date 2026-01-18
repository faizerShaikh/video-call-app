import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LuArrowLeft, LuCheck, LuX, LuBan } from 'react-icons/lu';
import { Link } from 'react-router-dom';

export function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    fetchUser();
  }, [id]);

  const fetchUser = async () => {
    try {
      const response = await adminAPI.getUserById(id);
      setUser(response.data.user);
    } catch (error) {
      toast.error('Failed to load user details');
      navigate('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setProcessing(true);
    try {
      await adminAPI.approveUser(id, {});
      toast.success('User approved successfully');
      fetchUser();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to approve user');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setProcessing(true);
    try {
      await adminAPI.rejectUser(id, { reason: rejectReason });
      toast.success('User rejected successfully');
      setShowRejectModal(false);
      setRejectReason('');
      fetchUser();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reject user');
    } finally {
      setProcessing(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim()) {
      toast.error('Please provide a reason for suspension');
      return;
    }

    setProcessing(true);
    try {
      await adminAPI.suspendUser(id, { reason: suspendReason });
      toast.success('User suspended successfully');
      setShowSuspendModal(false);
      setSuspendReason('');
      fetchUser();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to suspend user');
    } finally {
      setProcessing(false);
    }
  };

  const handleUnsuspend = async () => {
    setProcessing(true);
    try {
      await adminAPI.unsuspendUser(id);
      toast.success('User unsuspended successfully');
      fetchUser();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to unsuspend user');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      suspended: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    };
    return badges[status] || '';
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-4xl py-8">
        <Link to="/admin/users" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <LuArrowLeft className="w-4 h-4" />
          Back to User Management
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">User Details</h1>
          <p className="text-muted-foreground">View and manage user account</p>
        </div>

        <div className="space-y-6">
          {/* User Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{user.name}</CardTitle>
                  <CardDescription>{user.email}</CardDescription>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusBadge(
                    user.status
                  )}`}
                >
                  {user.status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{user.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{user.phone}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Registered</Label>
                  <p className="font-medium">
                    {new Date(user.createdAt).toLocaleString()}
                  </p>
                </div>
                {user.lastLoginAt && (
                  <div>
                    <Label className="text-muted-foreground">Last Login</Label>
                    <p className="font-medium">
                      {new Date(user.lastLoginAt).toLocaleString()}
                    </p>
                  </div>
                )}
                {user.approvedAt && (
                  <div>
                    <Label className="text-muted-foreground">Approved</Label>
                    <p className="font-medium">
                      {new Date(user.approvedAt).toLocaleString()}
                    </p>
                  </div>
                )}
                {user.rejectedAt && (
                  <div>
                    <Label className="text-muted-foreground">Rejected</Label>
                    <p className="font-medium">
                      {new Date(user.rejectedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {user.rejectionReason && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <Label className="text-muted-foreground">Rejection Reason</Label>
                  <p className="mt-1">{user.rejectionReason}</p>
                </div>
              )}

              {user.suspensionReason && (
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <Label className="text-muted-foreground">Suspension Reason</Label>
                  <p className="mt-1">{user.suspensionReason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Manage user account status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user.status === 'pending' && (
                <div className="flex gap-2">
                  <Button onClick={handleApprove} disabled={processing} className="flex-1">
                    <LuCheck className="w-4 h-4 mr-2" />
                    Approve User
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowRejectModal(true)}
                    disabled={processing}
                    className="flex-1"
                  >
                    <LuX className="w-4 h-4 mr-2" />
                    Reject User
                  </Button>
                </div>
              )}

              {user.status === 'approved' && !user.isAdmin && (
                <Button
                  variant="destructive"
                  onClick={() => setShowSuspendModal(true)}
                  disabled={processing}
                >
                  <LuBan className="w-4 h-4 mr-2" />
                  Suspend User
                </Button>
              )}

              {user.status === 'suspended' && (
                <Button onClick={handleUnsuspend} disabled={processing}>
                  <LuCheck className="w-4 h-4 mr-2" />
                  Unsuspend User
                </Button>
              )}

              {user.status === 'rejected' && (
                <Button onClick={handleApprove} disabled={processing}>
                  <LuCheck className="w-4 h-4 mr-2" />
                  Approve User
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Reject Modal */}
          {showRejectModal && (
            <Card>
              <CardHeader>
                <CardTitle>Reject User</CardTitle>
                <CardDescription>Provide a reason for rejection</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="rejectReason">Reason</Label>
                  <textarea
                    id="rejectReason"
                    className="w-full p-2 border rounded-md mt-2"
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleReject} disabled={processing || !rejectReason.trim()}>
                    Confirm Reject
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                  }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Suspend Modal */}
          {showSuspendModal && (
            <Card>
              <CardHeader>
                <CardTitle>Suspend User</CardTitle>
                <CardDescription>Provide a reason for suspension</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="suspendReason">Reason</Label>
                  <textarea
                    id="suspendReason"
                    className="w-full p-2 border rounded-md mt-2"
                    rows={4}
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Enter reason for suspension..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSuspend} disabled={processing || !suspendReason.trim()}>
                    Confirm Suspend
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setShowSuspendModal(false);
                    setSuspendReason('');
                  }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
