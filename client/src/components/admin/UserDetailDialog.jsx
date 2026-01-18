import { useState, useEffect } from 'react';
import { adminAPI } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LuX, LuCheck, LuBan } from 'react-icons/lu';

export function UserDetailDialog({ userId, isOpen, onClose, onUserUpdated }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    if (isOpen && userId) {
      fetchUser();
    }
  }, [isOpen, userId]);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getUserById(userId);
      setUser(response.data.user);
    } catch (error) {
      toast.error('Failed to load user details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setProcessing(true);
    try {
      await adminAPI.approveUser(userId, {});
      toast.success('User approved successfully');
      if (onUserUpdated) onUserUpdated();
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
      await adminAPI.rejectUser(userId, { reason: rejectReason });
      toast.success('User rejected successfully');
      setShowRejectModal(false);
      setRejectReason('');
      if (onUserUpdated) onUserUpdated();
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
      await adminAPI.suspendUser(userId, { reason: suspendReason });
      toast.success('User suspended successfully');
      setShowSuspendModal(false);
      setSuspendReason('');
      if (onUserUpdated) onUserUpdated();
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
      await adminAPI.unsuspendUser(userId);
      toast.success('User unsuspended successfully');
      if (onUserUpdated) onUserUpdated();
      fetchUser();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to unsuspend user');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      suspended: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    };
    return badges[status] || '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background z-10">
          <div>
            <h2 className="text-2xl font-bold">User Details</h2>
            <p className="text-sm text-muted-foreground">View and manage user account</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <LuX className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : user ? (
            <>
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
              {!showRejectModal && !showSuspendModal && (
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
                        className="w-full"
                      >
                        <LuBan className="w-4 h-4 mr-2" />
                        Suspend User
                      </Button>
                    )}

                    {user.status === 'suspended' && (
                      <Button onClick={handleUnsuspend} disabled={processing} className="w-full">
                        <LuCheck className="w-4 h-4 mr-2" />
                        Unsuspend User
                      </Button>
                    )}

                    {user.status === 'rejected' && (
                      <Button onClick={handleApprove} disabled={processing} className="w-full">
                        <LuCheck className="w-4 h-4 mr-2" />
                        Approve User
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

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
                      <Button
                        onClick={handleReject}
                        disabled={processing || !rejectReason.trim()}
                        variant="destructive"
                        className="flex-1"
                      >
                        Confirm Reject
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowRejectModal(false);
                          setRejectReason('');
                        }}
                        className="flex-1"
                      >
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
                      <Button
                        onClick={handleSuspend}
                        disabled={processing || !suspendReason.trim()}
                        variant="destructive"
                        className="flex-1"
                      >
                        Confirm Suspend
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowSuspendModal(false);
                          setSuspendReason('');
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
