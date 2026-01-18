import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { adminAPI } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LuArrowLeft, LuSearch, LuFilter, LuBan, LuTrash2 } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { UserDetailDialog } from '@/components/admin/UserDetailDialog';

export function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(new Set());
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspendModal, setShowSuspendModal] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [statusFilter, pagination.page, search]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (search) {
        params.search = search;
      }

      const response = await adminAPI.getUsers(params);
      setUsers(response.data.users);
      setPagination(response.data.pagination);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
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
    fetchUsers();
  };

  const handleSuspend = async (userId) => {
    if (!suspendReason.trim()) {
      toast.error('Please provide a reason for suspension');
      return;
    }

    setProcessing((prev) => new Set(prev).add(userId));
    try {
      await adminAPI.suspendUser(userId, { reason: suspendReason });
      toast.success('User suspended successfully');
      setShowSuspendModal(null);
      setSuspendReason('');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to suspend user');
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleUnsuspend = async (userId) => {
    setProcessing((prev) => new Set(prev).add(userId));
    try {
      await adminAPI.unsuspendUser(userId);
      toast.success('User unsuspended successfully');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to unsuspend user');
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleDelete = async (userId) => {
    setProcessing((prev) => new Set(prev).add(userId));
    try {
      await adminAPI.deleteUser(userId);
      toast.success('User deleted successfully');
      setDeleteConfirmModal(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete user');
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
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

  if (loading && users.length === 0) {
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
        <div className="container mx-auto max-w-7xl py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <LuArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">User Management</h1>
          <p className="text-muted-foreground">Manage all users in the system</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <LuSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <LuFilter className="w-4 h-4 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-4 font-medium">Name</th>
                    <th className="text-left p-4 font-medium">Email</th>
                    <th className="text-left p-4 font-medium">Phone</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Registered</th>
                    <th className="text-right p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user._id} className="border-b hover:bg-muted/50">
                        <td className="p-4">{user.name}</td>
                        <td className="p-4">{user.email}</td>
                        <td className="p-4">{user.phone}</td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(
                              user.status
                            )}`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            {user.status === 'approved' && !user.isAdmin && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setShowSuspendModal(user._id)}
                                disabled={processing.has(user._id) || showSuspendModal === user._id || deleteConfirmModal === user._id}
                              >
                                <LuBan className="w-4 h-4 mr-1" />
                                Suspend
                              </Button>
                            )}
                            {user.status === 'suspended' && !user.isAdmin && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUnsuspend(user._id)}
                                disabled={processing.has(user._id) || deleteConfirmModal === user._id}
                              >
                                Unsuspend
                              </Button>
                            )}
                            {!user.isAdmin && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteConfirmModal(user._id)}
                                disabled={processing.has(user._id) || showSuspendModal === user._id || deleteConfirmModal === user._id}
                              >
                                <LuTrash2 className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewUser(user._id)}
                              disabled={showSuspendModal === user._id || deleteConfirmModal === user._id}
                            >
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} users
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.pages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Detail Dialog */}
        <UserDetailDialog
          userId={selectedUserId}
          isOpen={isDialogOpen}
          onClose={handleDialogClose}
          onUserUpdated={handleUserUpdated}
        />

        {/* Suspend Modal */}
        {showSuspendModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Suspend User</CardTitle>
                <CardDescription>
                  Suspending: {users.find(u => u._id === showSuspendModal)?.name || 'User'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="suspendReason">Suspension Reason</Label>
                  <textarea
                    id="suspendReason"
                    className="w-full p-2 border rounded-md mt-2"
                    placeholder="Enter reason for suspension..."
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSuspend(showSuspendModal)}
                    disabled={processing.has(showSuspendModal) || !suspendReason.trim()}
                    variant="destructive"
                    className="flex-1"
                  >
                    Confirm Suspend
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSuspendModal(null);
                      setSuspendReason('');
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

        {/* Delete Confirmation Modal */}
        {deleteConfirmModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Delete User</CardTitle>
                <CardDescription>
                  Are you sure you want to delete: {users.find(u => u._id === deleteConfirmModal)?.name || 'User'}?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone. The user will be permanently removed from the system.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDelete(deleteConfirmModal)}
                    disabled={processing.has(deleteConfirmModal)}
                    variant="destructive"
                    className="flex-1"
                  >
                    <LuTrash2 className="w-4 h-4 mr-2" />
                    {processing.has(deleteConfirmModal) ? 'Deleting...' : 'Delete User'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirmModal(null)}
                    className="flex-1"
                    disabled={processing.has(deleteConfirmModal)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
