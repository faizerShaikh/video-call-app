import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { adminAPI } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LuCheck, LuX, LuArrowLeft } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { UserDetailDialog } from '@/components/admin/UserDetailDialog';

export function PendingApprovals() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(new Set());
  const [rejectReason, setRejectReason] = useState({});
  const [showRejectModal, setShowRejectModal] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const response = await adminAPI.getUsers({ status: 'pending' });
      setUsers(response.data.users);
    } catch (error) {
      toast.error('Failed to load pending users');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    setProcessing((prev) => new Set(prev).add(userId));
    try {
      await adminAPI.approveUser(userId, {});
      toast.success('User approved successfully');
      fetchPendingUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to approve user');
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleReject = async (userId) => {
    if (!rejectReason[userId]?.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setProcessing((prev) => new Set(prev).add(userId));
    try {
      await adminAPI.rejectUser(userId, { reason: rejectReason[userId] });
      toast.success('User rejected successfully');
      setRejectReason((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setShowRejectModal(null);
      fetchPendingUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reject user');
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleBulkApprove = async () => {
    const userIds = users.map((u) => u._id);
    setProcessing(new Set(userIds));
    try {
      await adminAPI.bulkApprove({ userIds });
      toast.success(`Approved ${userIds.length} user(s)`);
      fetchPendingUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to bulk approve');
    } finally {
      setProcessing(new Set());
    }
  };

  const handleViewUser = (userId) => {
    setSelectedUserId(userId);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedUserId(null);
  };

  const handleUserUpdated = () => {
    fetchPendingUsers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 p-4">
        <div className="container mx-auto max-w-6xl py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <LuArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Pending Approvals</h1>
            <p className="text-muted-foreground">
              {users.length} user{users.length !== 1 ? 's' : ''} awaiting approval
            </p>
          </div>
          {users.length > 0 && (
            <Button onClick={handleBulkApprove} disabled={processing.size > 0}>
              Approve All
            </Button>
          )}
        </div>

        {users.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No pending approvals</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-4 font-medium">Name</th>
                      <th className="text-left p-4 font-medium">Email</th>
                      <th className="text-left p-4 font-medium">Phone</th>
                      <th className="text-left p-4 font-medium">Registered</th>
                      <th className="text-right p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user._id} className="border-b hover:bg-muted/50">
                        <td className="p-4 font-medium">{user.name}</td>
                        <td className="p-4">{user.email}</td>
                        <td className="p-4">{user.phone}</td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(user._id)}
                              disabled={processing.has(user._id) || showRejectModal === user._id}
                            >
                              <LuCheck className="w-4 h-4 mr-2" />
                              {processing.has(user._id) ? 'Processing...' : 'Approve'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setShowRejectModal(user._id)}
                              disabled={processing.has(user._id) || showRejectModal === user._id}
                            >
                              <LuX className="w-4 h-4 mr-2" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewUser(user._id)}
                              disabled={showRejectModal === user._id}
                            >
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Reject User</CardTitle>
                <CardDescription>
                  Rejecting: {users.find(u => u._id === showRejectModal)?.name || 'User'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="rejectReason">Rejection Reason</Label>
                  <textarea
                    id="rejectReason"
                    className="w-full p-2 border rounded-md mt-2"
                    placeholder="Enter reason for rejection..."
                    value={rejectReason[showRejectModal] || ''}
                    onChange={(e) =>
                      setRejectReason((prev) => ({
                        ...prev,
                        [showRejectModal]: e.target.value,
                      }))
                    }
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleReject(showRejectModal)}
                    disabled={processing.has(showRejectModal) || !rejectReason[showRejectModal]?.trim()}
                    variant="destructive"
                    className="flex-1"
                  >
                    Confirm Reject
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRejectModal(null);
                      setRejectReason((prev) => {
                        const next = { ...prev };
                        delete next[showRejectModal];
                        return next;
                      });
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* User Detail Dialog */}
        <UserDetailDialog
          userId={selectedUserId}
          isOpen={isDialogOpen}
          onClose={handleDialogClose}
          onUserUpdated={handleUserUpdated}
        />
        </div>
      </div>
    </div>
  );
}
