const Booking = require("../models/booking");
// const Service = require("../models/Service");
// const ServiceCategory = require("../models/ServiceCategory");
const User = require("../models/User"); 
const Review = require("../models/Review"); 
const mongoose = require('mongoose');
const SubService = require("../models/SubService");

// Create a new booking
exports.createBooking = async (req, res) => {
  try {
    console.log("Create Booking - Request Body:", req.body);

    const { 
      subServiceId,
      userId,
      paymentMode,
      amount,
      location,
      scheduledTime,
      scheduledDate
    } = req.body;

    // Validate required fields
    if (!subServiceId) {
      return res.status(400).json({
        success: false,
        message: "subServiceId is required",
      });
    }

    // Check if subService exists and is active
    const subService = await SubService.findById(subServiceId);
    if (!subService) {
      return res.status(404).json({
        success: false,
        message: "SubService not found",
      });
    }

    if (!subService.isActive) {
      return res.status(400).json({
        success: false,
        message: "SubService is currently inactive",
      });
    }

    // Create the booking without referencing service
    const booking = new Booking({
      user: userId,
      subService: subServiceId,
      scheduledDate,
      scheduledTime,
      location: {
        address: location.address,
        landmark: location.landmark || "",
        pincode: location.pincode || ""
      },
      amount: amount || subService.price,
      status: 'pending',
      paymentMode
    });

    await booking.save();

    // Populate the booking with sub-service and user details
    const populatedBooking = await Booking.findById(booking._id)
      .populate('subService', 'name description price')
      .populate('user', 'name email phone');

    res.status(201).json({ message: "Booking created successfully", booking: populatedBooking });
  } catch (error) {
    console.error("Error in createBooking:", error);
    res.status(500).json({
      success: false,
      message: "Error creating booking",
      error: error.message,
    });
  }
};

// Get all bookings without pagination
exports.getAllBookings = async (req, res) => {
    try {
        // Get all bookings with populated service and category details
        const bookings = await Booking.find({ user: req.user._id })
            .populate('subService', 'name description basePrice duration')
            .populate('subService', 'name description price')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings
        });
    } catch (error) {
        console.error("Error in getAllBookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching bookings",
            error: error.message
        });
    }
};

// Get all bookings (with filters and pagination)
exports.getAllBookingsWithFilters = async (req, res) => {
    try {
        const { 
            status, 
            fromDate, 
            toDate, 
            page = 1, 
            limit = 10,
            sortBy = 'scheduledDate',
            sortOrder = 'desc'
        } = req.query;

        const skip = (page - 1) * limit;
        
        // Build query
        const query = {};
        
        // Add status filter
        if (status) {
            query.status = status;
        }

        // Add date range filter
        if (fromDate || toDate) {
            query.scheduledDate = {};
            if (fromDate) {
                query.scheduledDate.$gte = new Date(fromDate);
            }
            if (toDate) {
                query.scheduledDate.$lte = new Date(toDate);
            }
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Get bookings with pagination
        const bookings = await Booking.find(query)
            .populate({
                path: 'service',
                populate: {
                    path: 'category',
                    select: 'name'
                }
            })
            .populate('user', 'name email phone')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count
        const total = await Booking.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                bookings,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        console.error("Error in getAllBookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching all bookings",
            error: error.message,
        });
    }
};

// Get user's bookings
exports.getUserBookings = async (req, res) => { 
    try {
        const { status } = req.query;

        // Build query for user bookings
        const query = { user: req.user._id };
        if (status) {
            query.status = status;
        }

        // Fetch all bookings with full population
        const bookings = await Booking.find(query)
            .populate({
                path: 'subService',
                populate: {
                    path: 'service', // SubService -> Service
                    populate: {
                        path: 'subCategory', // Service -> SubCategory
                        populate: {
                            path: 'category', // SubCategory -> ServiceCategory
                            select: 'name'
                        }
                    }
                }
            })
            .populate({
                path: 'partner', // Populate partner details
            })
            .populate({
                path: 'cart.product', // Populate product details inside cart
            })
            .populate({
                path: 'cart.addedByPartner', // Populate partner who added the product
                select: 'profile.name profile.email' // Select specific fields
            })
            .sort({ createdAt: -1 })
            .lean(); // Convert to plain JS objects for better performance

        res.status(200).json({
            success: true,
            data: { bookings },
        });
    } catch (error) {
        console.error("Error in getUserBookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching user bookings",
            error: error.message,
        });
    }
};



// Get booking details
exports.getBookingDetails = async (req, res) => {
    try {
        const { bookingId } = req.params;

        const booking = await Booking.findOne({
            _id: bookingId,
            user: req.user._id,
        })
        .populate({
            path: 'subService',
            populate: {
                path: 'category',
                select: 'name'
            }
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        res.status(200).json({
            success: true,
            data: booking,
        });
    } catch (error) {
        console.error("Error in getBookingDetails:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching booking details",
            error: error.message,
        });
    }
};

// Update booking
exports.updateBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { scheduledDate, scheduledTime, location } = req.body;

        const booking = await Booking.findOne({
            _id: bookingId,
            // user: req.user._id,
        });
        console.log("Booking found in DB:", booking);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        if (!["pending", "accepted"].includes(booking.status)) {
            return res.status(400).json({
                success: false,
                message: "Cannot update booking that is in progress, completed, or cancelled",
            });
        }

        // Validate scheduled date is in the future
        if (scheduledDate) {
            const newBookingDate = new Date(scheduledDate);
            if (newBookingDate < new Date()) {
                return res.status(400).json({
                    success: false,
                    message: "Scheduled date must be in the future",
                });
            }
            booking.scheduledDate = newBookingDate;
        }

        // Update fields if provided
        if (scheduledTime) booking.scheduledTime = scheduledTime;
        if (location) {
            if (!location.address || !location.pincode) {
                return res.status(400).json({
                    success: false,
                    message: "Address and pincode are required in location",
                });
            }
            booking.location = location;
        }

        await booking.save();

        // Correct population according to the hierarchy
        await booking.populate({
            path: 'subService',
            populate: {
                path: 'service',
                populate: {
                    path: 'subCategory',
                    populate: {
                        path: 'category',
                        select: 'name',
                    },
                },
            },
        });

        res.status(200).json({
            success: true,
            message: "Booking updated successfully",
            data: booking,
        });
    } catch (error) {
        console.error("Error in updateBooking:", error);
        res.status(500).json({
            success: false,
            message: "Error updating booking",
            error: error.message,
        });
    }
};


// Cancel booking
// Cancel booking
exports.cancelBooking = async (req, res) => {
    try {
        console.log("Cancel Booking - Request Params:", req.params);
        console.log("Cancel Booking - Request Body:", req.body);

        const { bookingId } = req.params;
        const { cancellationReason, userId } = req.body;

        // Validate if userId and bookingId are provided
        if (!bookingId || !userId) {
            return res.status(400).json({
                success: false,
                message: "Booking ID and User ID are required",
            });
        }

        // Find the booking by ID and user
        const booking = await Booking.findOne({ _id: bookingId, user: userId });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found or does not belong to the user",
            });
        }

        if (booking.status === "cancelled") {
            return res.status(400).json({
                success: false,
                message: "Booking is already cancelled",
            });
        }

        if (["completed", "in_progress"].includes(booking.status)) {
            return res.status(400).json({
                success: false,
                message: "Cannot cancel a completed or in-progress booking",
            });
        }

        // Update booking status
        booking.status = "cancelled";
        booking.cancellationReason = cancellationReason || "No reason provided";
        booking.cancellationTime = new Date();

        await booking.save();

        // Populate the booking with sub-service and user details
        const populatedBooking = await Booking.findById(booking._id)
            .populate('subService', 'name description price')
            .populate('user', 'name email phone');

        res.status(200).json({
            success: true,
            message: "Booking cancelled successfully",
            booking: populatedBooking,
        });
    } catch (error) {
        console.error("Error in cancelBooking:", error);
        res.status(500).json({
            success: false,
            message: "Error cancelling booking",
            error: error.message,
        });
    }
};



// Add review
exports.addReview = async (req, res) => {
    try {
        const { rating, comment, type } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating is required and must be between 1 and 5",
            });
        }

        // Create a new review instance
        const review = new Review({
            user: req.user._id,
            booking: req.params.bookingId, // Include the booking ID from the URL
            rating,
            comment,
            type: type || 'booking'
        });

        await review.save();

        res.status(201).json({
            success: true,
            message: "Review added successfully",
            data: review,
        });
    } catch (error) {
        console.error("Error in addReview:", error);
        res.status(500).json({
            success: false,
            message: "Error adding review",
            error: error.message,
        });
    }
};

// Get all bookings for a user
exports.getAllUserBookings = async (req, res) => {
    try {
        console.log('Request Parameters:', req.params);
        console.log('User ID:', req.user._id);
        const bookings = await Booking.find({ user: req.user._id })
            .populate({
                path: 'subService',
                populate: {
                    path: 'category',
                    select: 'name'
                }
            })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: bookings,
        });
    } catch (error) {
        console.error('Error fetching all user bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching bookings',
            error: error.message,
        });
    }
};

// Get a specific booking by ID
exports.getBookingById = async (req, res) => {
    try {
        const booking = await Booking.findOne({
            _id: req.params.bookingId,
            user: req.user._id
        })
        .populate('service', 'name description basePrice duration')
        .populate('category', 'name description');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        res.status(200).json({
            success: true,
            data: booking
        });
    } catch (error) {
        console.error("Error in getBookingById:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching booking",
            error: error.message
        });
    }
};

// Get bookings by status
exports.getBookingsByStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Validate status
        const validStatuses = ["pending", "confirmed", "in_progress", "completed", "cancelled"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Must be one of: " + validStatuses.join(", ")
            });
        }

        const query = {
            user: req.user._id,
            status: status
        };

        // Get total count for pagination
        const total = await Booking.countDocuments(query);

        // Get bookings
        const bookings = await Booking.find(query)
            .populate('service', 'name description basePrice duration')
            .populate('category', 'name description')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            data: {
                bookings,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit
                }
            }
        });
    } catch (error) {
        console.error("Error in getBookingsByStatus:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching bookings",
            error: error.message
        });
    }
};

// Removed getCategories function as it has been moved to userServiceController.js

// Get all reviews
exports.getAllReviews = async (req, res) => {
    try {
        const reviews = await Review.find()
            .populate('user') // Fetch all user details
            .populate('subService'); // Fetch all subService details
        console.log(reviews);
        const ApprovedReviews = reviews.filter(review => review.status === 'approved');
        res.status(200).json(ApprovedReviews);

    } catch (error) {
        res.status(500).json({ message: 'Error fetching reviews', error });
    }
}; 
