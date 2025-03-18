const Booking = require("../models/booking");
const Partner = require("../models/Paartner");
const User = require("../models/User");
const Support = require("../models/Support");
const Token = require("../models/Token");
const Quotation = require("../models/Quotation");
const Transaction = require("../models/Transaction");

// Enhanced partner performance metrics
exports.getDetailedPartnerMetrics = async (req, res) => {
  try {
    const { partnerId, startDate, endDate } = req.query;
    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }

    const metrics = await Booking.aggregate([
      {
        $match: {
          partner: mongoose.Types.ObjectId(partnerId),
          ...dateQuery,
        },
      },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          cancelledBookings: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
          totalEarnings: { $sum: "$partnerEarnings" },
          averageRating: { $avg: "$rating" },
          responseTime: { $avg: "$partnerResponseTime" },
          serviceTime: { $avg: "$serviceCompletionTime" },
        },
      },
    ]);

    // Get support metrics
    const supportMetrics = await Support.aggregate([
      {
        $match: {
          requestedBy: mongoose.Types.ObjectId(partnerId),
          requestorType: "Partner",
          ...dateQuery,
        },
      },
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          resolvedTickets: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
          },
          averageResolutionTime: {
            $avg: {
              $cond: [
                { $eq: ["$status", "resolved"] },
                { $subtract: ["$resolvedAt", "$createdAt"] },
                0,
              ],
            },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        bookingMetrics: metrics[0] || {},
        supportMetrics: supportMetrics[0] || {},
      },
    });
  } catch (error) {
    console.error("Partner Metrics Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching partner metrics",
    });
  }
};

// Enhanced quotation analytics
exports.getQuotationAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, partnerId } = req.query;
    const query = {};

    if (partnerId) query.partner = partnerId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const analytics = await Quotation.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalQuotations: { $sum: 1 },
          acceptedQuotations: {
            $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] },
          },
          rejectedQuotations: {
            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
          },
          averageAmount: { $avg: "$amount" },
          totalAmount: { $sum: "$amount" },
          byService: {
            $push: {
              service: "$service",
              amount: "$amount",
              status: "$status",
            },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: analytics[0] || {},
    });
  } catch (error) {
    console.error("Quotation Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching quotation analytics",
    });
  }
};

// Enhanced token system analytics
exports.getTokenAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    const query = {};

    if (type) query.type = type;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const analytics = await Token.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: 1 },
          resolvedTokens: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
          },
          pendingTokens: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          averageResolutionTime: {
            $avg: {
              $cond: [
                { $eq: ["$status", "resolved"] },
                { $subtract: ["$resolvedAt", "$createdAt"] },
                0,
              ],
            },
          },
          byType: {
            $push: {
              type: "$type",
              status: "$status",
              priority: "$priority",
            },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: analytics[0] || {},
    });
  } catch (error) {
    console.error("Token Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching token analytics",
    });
  }
};

// Enhanced dashboard analytics
exports.getDashboardAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }

    // Get booking analytics
    const bookingAnalytics = await Booking.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          averageBookingValue: { $avg: "$totalAmount" },
          completionRate: {
            $avg: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
        },
      },
    ]);

    // Get user analytics
    const userAnalytics = await User.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
        },
      },
    ]);

    // Get partner analytics
    const partnerAnalytics = await Partner.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: null,
          totalPartners: { $sum: 1 },
          activePartners: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          averageRating: { $avg: "$rating" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        bookings: bookingAnalytics[0] || {},
        users: userAnalytics[0] || {},
        partners: partnerAnalytics[0] || {},
      },
    });
  } catch (error) {
    console.error("Dashboard Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard analytics",
    });
  }
};
