import User from '../models/User.js';

// Get all users with pagination and filters
export const getUsers = async (req, res) => {
  try {
    const {
      status,
      search,
      page = 1,
      limit = 20,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Filter by status
    if (status && ['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      query.status = status;
    }

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort order
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortObj = { [sort]: sortOrder };

    // Get users
    const users = await User.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .select('-password');

    // Get total count
    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get users'
    });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user'
    });
  }
};

// Approve user
export const approveUser = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'User is already approved'
      });
    }

    user.status = 'approved';
    user.approvedBy = adminId;
    user.approvedAt = new Date();
    user.rejectedAt = null;
    user.rejectionReason = null;

    await user.save();

    res.json({
      success: true,
      message: 'User approved successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve user'
    });
  }
};

// Reject user
export const rejectUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.status === 'rejected') {
      return res.status(400).json({
        success: false,
        error: 'User is already rejected'
      });
    }

    user.status = 'rejected';
    user.rejectedAt = new Date();
    user.rejectionReason = reason || null;
    user.approvedAt = null;
    user.approvedBy = null;

    await user.save();

    res.json({
      success: true,
      message: 'User rejected successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reject user'
    });
  }
};

// Suspend user
export const suspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.isAdmin) {
      return res.status(400).json({
        success: false,
        error: 'Cannot suspend admin users'
      });
    }

    if (user.status === 'suspended') {
      return res.status(400).json({
        success: false,
        error: 'User is already suspended'
      });
    }

    user.status = 'suspended';
    user.suspendedAt = new Date();
    user.suspensionReason = reason || null;

    await user.save();

    res.json({
      success: true,
      message: 'User suspended successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to suspend user'
    });
  }
};

// Unsuspend user (approve suspended user)
export const unsuspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.status !== 'suspended') {
      return res.status(400).json({
        success: false,
        error: 'User is not suspended'
      });
    }

    user.status = 'approved';
    user.approvedBy = adminId;
    user.approvedAt = new Date();
    user.suspendedAt = null;
    user.suspensionReason = null;

    await user.save();

    res.json({
      success: true,
      message: 'User unsuspended successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Unsuspend user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to unsuspend user'
    });
  }
};

// Bulk approve users
export const bulkApprove = async (req, res) => {
  try {
    const { userIds } = req.body;
    const adminId = req.user._id;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'User IDs array is required'
      });
    }

    const result = await User.updateMany(
      { _id: { $in: userIds }, status: { $ne: 'approved' } },
      {
        $set: {
          status: 'approved',
          approvedBy: adminId,
          approvedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null
        }
      }
    );

    res.json({
      success: true,
      message: `Approved ${result.modifiedCount} user(s)`,
      approved: result.modifiedCount
    });
  } catch (error) {
    console.error('Bulk approve error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to bulk approve users'
    });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent deleting admin users
    if (user.isAdmin) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete admin user'
      });
    }

    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user'
    });
  }
};

// Get dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      pendingUsers,
      approvedUsers,
      rejectedUsers,
      suspendedUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'pending' }),
      User.countDocuments({ status: 'approved' }),
      User.countDocuments({ status: 'rejected' }),
      User.countDocuments({ status: 'suspended' })
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        pendingUsers,
        approvedUsers,
        rejectedUsers,
        suspendedUsers
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get dashboard statistics'
    });
  }
};
