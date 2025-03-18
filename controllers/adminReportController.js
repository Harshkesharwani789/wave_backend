const Booking = require("../models/booking");
const Partner = require("../models/Paartner");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

// Get revenue analytics
exports.getRevenueAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const transactions = await Transaction.find(query);

    const analytics = {
      totalRevenue: transactions.reduce(
        (sum, t) => sum + (t.type === "payment" ? t.amount : -t.amount),
        0
      ),
      transactionCount: transactions.length,
      successfulTransactions: transactions.filter((t) => t.status === "success")
        .length,
      failedTransactions: transactions.filter((t) => t.status === "failed")
        .length,
      averageTransactionValue:
        transactions.length > 0
          ? transactions.reduce((sum, t) => sum + t.amount, 0) /
            transactions.length
          : 0,
    };

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching revenue analytics",
    });
  }
};

// Get partner performance
exports.getPartnerPerformance = async (req, res) => {
  try {
    const partners = await Partner.find().select(
      "name rating completedBookings cancelledBookings totalEarnings"
    );

    const performance = partners.map((partner) => ({
      partnerId: partner._id,
      name: partner.name,
      rating: partner.rating,
      completionRate:
        (partner.completedBookings /
          (partner.completedBookings + partner.cancelledBookings)) *
          100 || 0,
      totalEarnings: partner.totalEarnings,
    }));

    res.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching partner performance",
    });
  }
};

// Get user analytics
exports.getUserAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: "active" });

    // Get users registered in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Get booking statistics
    const bookings = await Booking.find();
    const bookingsPerUser = bookings.length / totalUsers || 0;

    const analytics = {
      totalUsers,
      activeUsers,
      newUsers,
      bookingsPerUser,
      userRetentionRate: (activeUsers / totalUsers) * 100 || 0,
    };

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching user analytics",
    });
  }
};

// Get transaction report
exports.getTransactionReport = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const query = {};

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate("user", "name email phone")
      .populate("category", "name description")
      .populate("service", "name description basePrice duration")
      .sort({ createdAt: -1 });

    const formattedBookings = bookings.map((booking) => ({
      _id: booking._id,
      user: booking.user,
      category: booking.category,
      service: booking.service,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      location: booking.location,
      amount: booking.amount,
      status: booking.status,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      cancellationReason: booking.cancellationReason,
      cancelledAt: booking.cancelledAt,
    }));

    res.json({
      success: true,
      data: formattedBookings,
      total: formattedBookings.length,
      message: "Bookings fetched successfully",
    });
  } catch (error) {
    console.error("Error in getTransactionReport:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching bookings",
      error: error.message,
    });
  }
};
