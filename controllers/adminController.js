const Admin = require("../models/admin");
const Partner = require("../models/Paartner");
const User = require("../models/User");
const booking = require("../models/booking");
const Review = require("../models/Review"); // Assuming Review model is defined in a separate file
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ServiceCategory = require("../models/ServiceCategory");
const Service = require("../models/Service");
const path = require('path');
const SubCategory = require("../models/SubCategory"); // Assuming SubCategory model is defined in a separate file
const PartnerProfile = require("../models/PartnerProfile");
const mongoose = require("mongoose");

// Admin login
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ adminId: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
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
// Get pending KYC verifications
exports.getPendingKYC = async (req, res) => {
  try {
    const pendingPartners = await Partner.find({
      kyc: { $exists: true },
      "kyc.status": "Pending", // Ensuring we fetch only pending verifications
    }).select("phone profile kyc createdAt");

    const formattedPartners = pendingPartners.map((partner) => ({
      id: partner._id,
      phone: partner.phone,
      name: partner.profile?.name || "N/A",
      email: partner.profile?.email || "N/A",
      createdAt: partner.createdAt,
      KYC: {
        status: partner.kyc?.status || "Pending",
        panCard: partner.kyc?.panCard || "Not Uploaded",
        aadhaar: partner.kyc?.aadhaar || "Not Uploaded",
      },
    }));

    res.json({
      count: pendingPartners.length,
      partners: formattedPartners,
    });
  } catch (error) {
    console.error("Pending KYC Error:", error);
    res.status(500).json({ message: "Error fetching pending KYC verifications" });
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
    console.log("Received Partner ID:", partnerId);

    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).json({ success: false, message: "Invalid Partner ID format" });
    }

    const partner = await Partner.findById(partnerId);
    console.log("Fetched Partner:", partner);

    if (!partner) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    res.json({ success: true, message: "Partner found", partner });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


// Get all partners
// Get all partners
// Get all partners
// Get all partners
exports.getAllPartners = async (req, res) => {
  try {
    const partners = await Partner.find()
      .populate("bookings")
      .populate("category")
      .populate("subcategory")
      .populate("service")
      .populate("kyc")
      .populate("reviews.user", "name email") // Fetch user name & email in reviews
      .populate("reviews.booking") // Fetch booking details in reviews
      .select("-tempOTP") // Exclude tempOTP from the response
      .sort({ createdAt: -1 });


      // Generate month-wise booking count
    const formattedPartners = await Promise.all(partners.map(async (partner) => {
      const bookingCounts = await booking.aggregate([
        {
          $match: { partner: partner._id } // Filter bookings for the current partner
        },
        {
          $group: {
            _id: { 
              year: { $year: "$createdAt" }, 
              month: { $month: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { 
          $sort: { "_id.year": 1, "_id.month": 1 } 
        }
      ]);

      // Convert bookingCounts into a structured object
      const monthWiseBookings = {};
      bookingCounts.forEach(entry => {
        const monthName = new Date(entry._id.year, entry._id.month - 1).toLocaleString('default', { month: 'long' });
        monthWiseBookings[monthName] = entry.count;
      });

      return {
        Profile: {
          id: partner._id,
          name: partner.profile?.name || "N/A",
        email: partner.profile?.email || "N/A",
        phone: partner.phone,
        address: partner.profile?.address || "N/A",
        landmark: partner.profile?.landmark || "N/A",
        pincode: partner.profile?.pincode || "N/A",
        experience: partner.experience || "N/A",
        qualification: partner.qualification || "N/A",
        modeOfService: partner.modeOfService || "N/A",
        profileCompleted: partner.profileCompleted,
        profilePicture: partner.profilePicture || "N/A",
        createdAt: partner.createdAt,
        updatedAt: partner.updatedAt,
        KYC: {
          status: partner.kyc?.status || "Pending",
          panCard: partner.kyc?.panCard ? `/uploads/kyc/${partner.kyc.panCard}` : "Not Uploaded",
          aadhaar: partner.kyc?.aadhaar ? `/uploads/kyc/${partner.kyc.aadhaar}` : "Not Uploaded",
        },
      },
      Bookings: partner.bookings.length > 0 ? partner.bookings : "No bookings",
      Reviews: partner.reviews.length > 0 ? partner.reviews : "No reviews",
      Services: partner.service.length > 0 ? partner.service : "No services",
      MonthWiseBookingCount: monthWiseBookings
    };
        }));

    res.json({
      partners: formattedPartners,
      total: partners.length,
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

    const partner = await Partner.findById(partnerId)
      .select("-tempOTP")
      .populate({
        path: "bookings", // Populate bookings
        populate: [
          {
            path: "subService", // Populate subService inside bookings
            model: "SubService",
            select: "name price duration description", // Select relevant fields
          },
          {
            path: "user", // Populate user inside bookings
            model: "User",
            select: "name phone email", // Select relevant fields
          },
        ],
      })
      .populate({
        path: "user", // Populate partner's associated user
        select: "name phone email",
      })
      .populate({
        path: "subService", // Populate partner's subService directly
        select: "name price duration description",
      })
      .select("-__v")
      .sort({ scheduledDate: 1, scheduledTime: 1 });

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
    console.log(req.body , "req body")
    // Convert status to lowercase and replace spaces with underscores
    status = status?.trim().replace(/\s+/g, '_');

    // Validate status
    const validStatuses = ["pending", "under_review", "Approved", "Rejected", "blocked"];
    if (!status || !validStatuses.includes(status)) {
      console.log(status , validStatuses.includes(status))
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        note: "Status is case-sensitive and uses underscores. For example: 'under_review'"
      });
    }

    const partner = await PartnerProfile.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ 
        success: false,
        message: "Partner not found" 
      });
    }

    // Additional validations based on status
    // if (status === "Approved") {
    //   // if (!partner.isVerified === "") {
    //   //   return res.status(400).json({
    //   //     success: false,
    //   //     message: "Cannot approve partner without KYC verification"
    //   //   });
    //   // }
    //   if (!partner.profileCompleted) {
    //     return res.status(400).json({
    //       success: false,
    //       message: "Cannot approve partner without completed profile",
    //       currentStatus: {
    //         profileCompleted: partner.profileCompleted,
    //         kycVerified: partner.kycDetails?.isVerified
    //       },
    //       note: "Please ensure the partner has completed their profile using the profile completion API"
    //     });
    //   }
    // }

    // Update the partner status
    const updateData = {
      $set: {
        status: status,
        statusRemarks: remarks || ''
      }
    };

    const updatedPartner = await PartnerProfile.findByIdAndUpdate(
      partnerId,
      updateData,
      { new: true, runValidators: true }
    ) 

    res.json({
      success: true,
      message: `Partner status updated to ${status} successfully`,
      data: {
        partnerId: updatedPartner._id,
        name: updatedPartner.name,
        status: updatedPartner.status
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
    // console.log('Request body:', req.body);
    // console.log('File:', req.file);

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

// Get all users without pagination limit
exports.getAllUsers = async (req, res) => {
  try {
    const { search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

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

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get all users without pagination
    const users = await User.find(query)
      .select('name email phone address status createdAt')
      .sort(sort);

    // Get total count
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

    // Format the response
    const formattedUsers = users.map((user, index) => ({
      slNo: index + 1,
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
      total,
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

// Get all reviews
// Get all reviews
exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('user') // Populate customer details
      .populate('subService') // Populate subService details
      .populate({
        path: 'booking', // Populate booking
        populate: {
          path: 'partner', // Populate partner from the booking
           // Select fields from partner
        }
      });

    // Format the response to include desired fields
    const formattedReviews = reviews.map(review => ({
      _id : review._id,
      customer: {
        name: review.user?.name || 'Unknown',
        email: review.user?.email || 'Unknown'
      },
      subService: review.subService
        ? {
            name: review.subService.name,
            description: review.subService.description
          }
        : null,
      date: review.createdAt,
      partner: review.booking?.partner
        ? {
            name: review.booking.partner.name,
            email: review.booking.partner.email
          }
        : null,
      rating: review.rating,
      comment: review.comment,
      status: review.status // ✅ Make sure the status is included
    }));

    res.status(200).json({
      success: true,
      message: 'Fetched all reviews successfully',
      data: reviews
      // data: formattedReviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching reviews'
    });
  }
};

// Update review status
exports.updateReviewStatus = async (req, res) => {
  const { reviewId } = req.params;
  const { status } = req.body;
  console.log("Incoming Data :", req.params , req.body)

  if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Choose 'approved' or 'rejected'." });
  }

  try {
      const review = await Review.findByIdAndUpdate(
          reviewId,
          { status },
          { new: true }
      ).populate('partner', 'name').populate('booking', 'price date services');

      if (!review) {
          return res.status(404).json({ message: "Review not found." });
      }

      res.status(200).json({ message: `Review ${status} successfully`, review });
  } catch (error) {
    console.log(error)
      res.status(500).json({ message: "Error updating review status", error: error.message });
  }
};


// Add Sub Category
exports.addSubCategory = async (req, res) => {
  // console.log("testing" , req.body , req.file)
  // console.log("Request Body:", req.body); // Log the request body
  // console.log("Uploaded File:", req.file); // Log the uploaded file

  const { name, category } = req.body; // Extracting name and category from the form data

  // Check if name and category are provided
  if (!name || !category) {
    console.log(name , category , "test")
      return res.status(400).json({ message: "Name and category are required." });
  }

  const subCategory = new SubCategory({
      name,
      category,
      image: req.file?.filename // Assuming the image is uploaded similarly
  });

  await subCategory.save();
  return res.status(201).json({ message: "Subcategory created successfully", subCategory });
};

// Update service category
exports.updateSubCategory = async (req, res) => {
  try {
    const { name } = req.body;
    let image = req.file ? req.file.filename : undefined; // Handle uploaded file
    console.log(name, image);

    // Find the existing category
    const existingSubCategory = await SubCategory.findById(req.params.subcategoryId);
    if (!existingSubCategory) {
      return res.status(404).json({
        success: false,
        message: "Service category not found",
      });
    }

    // Prepare update object (only update fields that are provided)
    const updateData = {};
    if (name) updateData.name = name; // Update only if name is provided
    if (image) updateData.image = path.basename(image); // Update only if icon is uploaded

    // Perform the update
    const subCategory = await SubCategory.findByIdAndUpdate(
      req.params.subcategoryId,
      { $set: updateData },
      { new: true }
    );

    // console.log(category, "category");

    res.json({
      success: true,
      data: subCategory
    });
  } catch (error) {
    console.log(error, "error");
    res.status(500).json({
      success: false,
      message: "Error updating service category"
    });
  }
};

// Delete service category
exports.deleteSubCategory = async (req, res) => {
  try {
    const category = await SubCategory.findById(req.params.subcategoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Service category not found"
      });
    }

    // Check if category has any active services
    // const activeServices = await Service.find({ category: req.params.categoryId, status: 'active' });
    // if (activeServices.length > 0) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Cannot delete category with active services"
    //   });
    // }

    // Use findByIdAndDelete instead of remove()
    await SubCategory.findByIdAndDelete(req.params.subcategoryId);
    
    res.json({
      success: true,
      message: "Sub Category deleted successfully"
    });
  } catch (error) {
    console.error("Delete SubCategory Error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting SubCategory",
      error: error.message
    });
  }
};

// Update User Status
exports.updateUserStatus = async (req, res) => {
  const { userId, status } = req.body;
  if (!userId || (status !== 'active' && status !== 'inactive')) {
    console.log(userId , status)
      return res.status(400).json({ message: 'Invalid user ID or status' });
  }
  try {
      const user = await User.findByIdAndUpdate(userId, { status }, { new: true });
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }
      return res.status(200).json({ message: 'User status updated', user });
  } catch (error) {
      return res.status(500).json({ message: 'Server error', error });
  }
};

