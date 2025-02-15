const Admin = require("../models/admin");
const Partner = require("../models/Partner");
const User = require("../models/User");
const booking = require("../models/booking");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ServiceCategory = require("../models/ServiceCategory");
const Service = require("../models/Service");
const path = require('path');

// Admin login
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ adminId: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({
      token,
      admin: {
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
      },
    });
  } catch (error) {
    console.error("Admin Login Error:", error);
    res.status(500).json({ message: "Login failed" });
  }
};

// Create new admin (super_admin only)
exports.createAdmin = async (req, res) => {
  try {
    // Check if requester is super_admin
    if (req.admin.role !== "super_admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { email, password, name, permissions } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new admin
    const admin = new Admin({
      email,
      password: hashedPassword,
      name,
      permissions,
      role: "admin", // New admins are always regular admins
    });

    await admin.save();

    res.status(201).json({
      message: "Admin created successfully",
      admin: {
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
      },
    });
  } catch (error) {
    console.error("Create Admin Error:", error);
    res.status(500).json({ message: "Error creating admin" });
  }
};

// Get Dashboard Analytics
exports.getDashboardAnalytics = async (req, res) => {
  try {
    // Get partner counts by status
    const partnerStatusCounts = await Partner.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get KYC stats
    const kycStats = await Partner.aggregate([
      {
        $group: {
          _id: "$kycStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get recent registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRegistrations = await Partner.find({
      createdAt: { $gte: sevenDaysAgo },
    })
      .select("phone profile.name status createdAt")
      .sort({ createdAt: -1 })
      .limit(10);

    // Get daily registration counts for the last 7 days
    const dailyRegistrations = await Partner.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get KYC verification stats
    const kycVerificationStats = await Partner.aggregate([
      {
        $match: {
          kycDetails: { $exists: true },
        },
      },
      {
        $group: {
          _id: "$kycDetails.isVerified",
          count: { $sum: 1 },
          avgVerificationTime: {
            $avg: {
              $cond: [
                { $and: ["$kycDetails.verifiedAt", "$kycDetails.submittedAt"] },
                {
                  $subtract: [
                    "$kycDetails.verifiedAt",
                    "$kycDetails.submittedAt",
                  ],
                },
                null,
              ],
            },
          },
        },
      },
    ]);

    res.json({
      partnerStats: {
        total: partnerStatusCounts.reduce((acc, curr) => acc + curr.count, 0),
        byStatus: Object.fromEntries(
          partnerStatusCounts.map(({ _id, count }) => [_id, count])
        ),
      },
      kycStats: {
        total: kycStats.reduce((acc, curr) => acc + curr.count, 0),
        byStatus: Object.fromEntries(
          kycStats.map(({ _id, count }) => [_id, count])
        ),
        verificationStats: {
          verified:
            kycVerificationStats.find((stat) => stat._id === true)?.count || 0,
          pending:
            kycVerificationStats.find((stat) => stat._id === false)?.count || 0,
          avgVerificationTime:
            kycVerificationStats.find((stat) => stat._id === true)
              ?.avgVerificationTime || 0,
        },
      },
      registrationStats: {
        recentPartners: recentRegistrations,
        dailyTrend: dailyRegistrations,
      },
    });
  } catch (error) {
    console.error("Dashboard Analytics Error:", error);
    res.status(500).json({ message: "Error fetching dashboard analytics" });
  }
};

// Get pending KYC verifications
exports.getPendingKYC = async (req, res) => {
  try {
    const pendingPartners = await Partner.find({
      kycDetails: { $exists: true },
      "kycDetails.isVerified": false,
    }).select("phone profile kycDetails createdAt");

    res.json({
      count: pendingPartners.length,
      partners: pendingPartners,
    });
  } catch (error) {
    console.error("Pending KYC Error:", error);
    res.status(500).json({ message: "Error fetching pending KYC" });
  }
};

// Get partner KYC details
exports.getPartnerKYC = async (req, res) => {
  try {
    const { partnerId } = req.params;

    const partner = await Partner.findById(partnerId)
      .select('phone profile kycDetails createdAt')
      .populate('profile');

    if (!partner) {
      return res.status(404).json({ 
        success: false,
        message: "Partner not found" 
      });
    }

    res.json({
      success: true,
      data: {
        partnerId: partner._id,
        phone: partner.phone,
        profile: partner.profile,
        kycDetails: partner.kycDetails,
        createdAt: partner.createdAt
      }
    });
  } catch (error) {
    console.error("Get Partner KYC Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching partner KYC details" 
    });
  }
};

// Verify partner KYC
exports.verifyPartnerKYC = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { status, remarks } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be either 'approved' or 'rejected'"
      });
    }

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ 
        success: false,
        message: "Partner not found" 
      });
    }

    // Update only the verification status and remarks
    const updateData = {
      $set: {
        kycStatus: status === 'approved' ? 'verified' : 'rejected',
        'kycDetails.isVerified': status === 'approved',
        'kycDetails.verificationRemarks': remarks || '',
        'kycDetails.verifiedAt': new Date(),
        'kycDetails.verifiedBy': req.admin._id
      }
    };

    const updatedPartner = await Partner.findByIdAndUpdate(
      partnerId,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: `Partner KYC ${status} successfully`,
      data: {
        partnerId: updatedPartner._id,
        status: updatedPartner.kycStatus,
        isVerified: updatedPartner.kycDetails.isVerified,
        verifiedAt: updatedPartner.kycDetails.verifiedAt,
        remarks: updatedPartner.kycDetails.verificationRemarks
      }
    });
  } catch (error) {
    console.error("KYC Verification Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Error verifying KYC" 
    });
  }
};

// Get all partners
exports.getAllPartners = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status) {
      query["kycDetails.isVerified"] = status === "verified";
    }

    const partners = await Partner.find(query)
      .select("-tempOTP")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Partner.countDocuments(query);

    res.json({
      partners,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Get Partners Error:", error);
    res.status(500).json({ message: "Error fetching partners" });
  }
};

// Get partner details
exports.getPartnerDetails = async (req, res) => {
  try {
    const { partnerId } = req.params;

    const partner = await Partner.findById(partnerId).select("-tempOTP");

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    res.json({ partner });
  } catch (error) {
    console.error("Get Partner Details Error:", error);
    res.status(500).json({ message: "Error fetching partner details" });
  }
};

// Update Partner Status
exports.updatePartnerStatus = async (req, res) => {
  try {
    const { partnerId } = req.params;
    let { status, remarks } = req.body;

    // Convert status to lowercase and replace spaces with underscores
    status = status?.toLowerCase().trim().replace(/\s+/g, '_');

    // Validate status
    const validStatuses = ["pending", "under_review", "approved", "rejected", "blocked"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        note: "Status is case-sensitive and uses underscores. For example: 'under_review'"
      });
    }

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ 
        success: false,
        message: "Partner not found" 
      });
    }

    // Additional validations based on status
    if (status === "approved") {
      if (!partner.kycDetails?.isVerified) {
        return res.status(400).json({
          success: false,
          message: "Cannot approve partner without KYC verification"
        });
      }
      if (!partner.profileCompleted) {
        return res.status(400).json({
          success: false,
          message: "Cannot approve partner without completed profile",
          currentStatus: {
            profileCompleted: partner.profileCompleted,
            kycVerified: partner.kycDetails?.isVerified
          },
          note: "Please ensure the partner has completed their profile using the profile completion API"
        });
      }
    }

    // Update the partner status
    const updateData = {
      $set: {
        status: status,
        statusRemarks: remarks || '',
        statusUpdatedAt: new Date(),
        statusUpdatedBy: req.admin._id
      }
    };

    const updatedPartner = await Partner.findByIdAndUpdate(
      partnerId,
      updateData,
      { new: true, runValidators: true }
    ).select('status profile kycDetails statusRemarks statusUpdatedAt');

    res.json({
      success: true,
      message: `Partner status updated to ${status} successfully`,
      data: {
        partnerId: updatedPartner._id,
        name: updatedPartner.profile?.name,
        status: updatedPartner.status,
        kycVerified: updatedPartner.kycDetails?.isVerified,
        remarks: updatedPartner.statusRemarks,
        updatedAt: updatedPartner.statusUpdatedAt
      }
    });
  } catch (error) {
    console.error("Update Partner Status Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Error updating partner status",
      error: error.message 
    });
  }
};

// Create Service Category
exports.createServiceCategory = async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('File:', req.file);
    
    const { name, description } = req.body;
    
    // Validate required fields
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: "Name and description are required",
        receivedData: { name, description }
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Icon image is required"
      });
    }

    // Create icon path
    const iconPath = path.basename(req.file.path);

    const category = new ServiceCategory({
      name: name.trim(),
      description: description.trim(),
      icon: iconPath,
      status: true
    });

    console.log('Category to save:', category);

    const savedCategory = await category.save();
    console.log('Saved category:', savedCategory);
    
    res.status(201).json({
      success: true,
      message: "Service category created successfully",
      category: savedCategory
    });
  } catch (error) {
    console.error("Create Service Category Error Details:", {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Check for specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A category with this name already exists"
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating service category",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create Service
exports.createService = async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('File:', req.file);

    const { name, description, category, basePrice, duration } = req.body;

    // Validate required fields
    if (!name || !description || !category || !basePrice || !duration) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
        receivedData: { name, description, category, basePrice, duration }
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Icon image is required"
      });
    }

    // Validate category exists
    const serviceCategory = await ServiceCategory.findById(category);
    if (!serviceCategory) {
      return res.status(404).json({
        success: false,
        message: "Service category not found"
      });
    }

    // Create icon path
    const iconPath = path.basename(req.file.path);

    const service = new Service({
      category,
      name: name.trim(),
      description: description.trim(),
      icon: iconPath,
      basePrice: Number(basePrice),
      duration: Number(duration),
      status: 'active',
      tags: [],
      subServices: []
    });

    console.log('Service to save:', service);

    const savedService = await service.save();
    console.log('Saved service:', savedService);

    // Update category with the new service
    serviceCategory.services = serviceCategory.services || [];
    serviceCategory.services.push(savedService._id);
    await serviceCategory.save();

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      service: savedService
    });
  } catch (error) {
    console.error("Create Service Error Details:", {
      error: error.message,
      stack: error.stack,
      name: error.name
    });

    // Check for specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A service with this name already exists in this category"
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating service",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Add Sub-Service
exports.addSubService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { name, description, basePrice, duration } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: "Icon is required" });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    service.subServices.push({
      name,
      description,
      icon: path.basename(req.file.path),
      basePrice,
      duration
    });

    await service.save();
    res.status(201).json({ message: "Sub-service added successfully", service });
  } catch (error) {
    console.error("Add Sub-Service Error:", error);
    res.status(500).json({ message: "Failed to add sub-service" });
  }
};

// Get All Service Categories
exports.getAllServiceCategories = async (req, res) => {
  try {
    const categories = await ServiceCategory.find({ status: true });
    res.json(categories);
  } catch (error) {
    console.error("Get Service Categories Error:", error);
    res.status(500).json({ message: "Failed to fetch service categories" });
  }
};

// Get Services by Category
exports.getServicesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const services = await Service.find({ category: categoryId, status: true });
    res.json(services);
  } catch (error) {
    console.error("Get Services Error:", error);
    res.status(500).json({ message: "Failed to fetch services" });
  }
};

// Get all users with pagination and filters
exports.getAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Add status filter
    if (status) {
      query.status = status;
    }

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get users with pagination
    const users = await User.find(query)
      .select('name email phone address status createdAt')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await User.countDocuments(query);

    // Get booking counts for each user
    const userIds = users.map(user => user._id);
    const bookingCounts = await booking.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: '$user', count: { $sum: 1 } } }
    ]);

    // Create a map of user ID to booking count
    const bookingCountMap = {};
    bookingCounts.forEach(item => {
      bookingCountMap[item._id] = item.count;
    });

    // Format the response with all required fields
    const formattedUsers = users.map((user, index) => ({
      slNo: skip + index + 1,
      _id: user._id,
      customerName: user.name,
      phoneNo: user.phone,
      email: user.email,
      address: user.address || 'N/A',
      noOfBookings: bookingCountMap[user._id] || 0,
      accountStatus: user.status,
      createdAt: user.createdAt
    }));

    res.json({
      success: true,
      data: formattedUsers,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      },
      message: "Users fetched successfully"
    });

  } catch (error) {
    console.error("Get All Users Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message
    });
  }
};

// Get bookings for a specific user
exports.getUserBookings = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get all bookings for the user with populated service details
    const bookings = await booking.find({ user: userId })
      .populate('service', 'name description icon basePrice duration')
      .populate('subService', 'name description icon price duration')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "User bookings fetched successfully",
      data: bookings
    });

  } catch (error) {
    console.error("Get User Bookings Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user bookings",
      error: error.message
    });
  }
};

// Complete a booking
exports.completeBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Find the booking
    const bookingToComplete = await booking.findById(bookingId);
    if (!bookingToComplete) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Check if booking is already completed
    if (bookingToComplete.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: "Booking is already completed"
      });
    }

    // Check if booking is cancelled
    if (bookingToComplete.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: "Cannot complete a cancelled booking"
      });
    }

    // Update booking status to completed
    bookingToComplete.status = 'completed';
    bookingToComplete.completedAt = new Date();
    await bookingToComplete.save();

    res.status(200).json({
      success: true,
      message: "Booking marked as completed",
      data: bookingToComplete
    });

  } catch (error) {
    console.error("Complete Booking Error:", error);
    res.status(500).json({
      success: false,
      message: "Error completing booking",
      error: error.message
    });
  }
};
