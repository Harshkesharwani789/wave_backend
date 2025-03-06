const PartnerService = require("../models/PartnerService");
const ServiceCategory = require("../models/ServiceCategory");
const Partner = require("../models/Partner");
const Booking = require("../models/booking");
const PartnerProfile = require("../models/PartnerProfile");
const jwt = require("jsonwebtoken");
const SubService = require("../models/SubService");
const mongoose = require("mongoose");
const Product = require("../models/product");

// Get all available services for partners
exports.getAvailableServices = async (req, res) => {
  try {
    const categories = await ServiceCategory.find({ status: "active" })
      .select("name description icon services")
      .where("services.status")
      .equals("active");

    res.json(categories);
  } catch (error) {
    console.error("Get Available Services Error:", error);
    res.status(500).json({ message: "Error fetching available services" });
  }
};

// Select services by partner
exports.selectService = async (req, res) => {
  try {
    const { categoryId, serviceId } = req.params;
    const { price, experience, certificates, availability } = req.body;

    // 1. Validate partner status
    if (
      req.partner.status !== "approved" ||
      req.partner.kycStatus !== "verified"
    ) {
      return res.status(403).json({
        success: false,
        message: "Complete profile approval and KYC verification first",
      });
    }

    // 2. Check for ongoing services
    const ongoingService = await PartnerService.findOne({
      partner: req.partner._id,
      status: {
        $in: ["active", "in_progress"],
      },
    });

    if (ongoingService) {
      return res.status(400).json({
        success: false,
        message:
          "Please complete your ongoing service before selecting a new one",
        currentService: {
          category: ongoingService.category,
          service: ongoingService.service,
          status: ongoingService.status,
        },
      });
    }

    // 3. Validate required fields
    if (!price || !experience) {
      return res.status(400).json({
        success: false,
        message: "Price and experience are required",
      });
    }

    // 4. Check if service exists
    const category = await ServiceCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const service = category.services.id(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // 5. Validate price against base price
    if (price < service.basePrice) {
      return res.status(400).json({
        success: false,
        message: `Price must be at least ${service.basePrice}`,
      });
    }

    // 6. Create new partner service
    const partnerService = new PartnerService({
      partner: req.partner._id,
      category: categoryId,
      service: serviceId,
      price,
      experience,
      certificates: certificates || [],
      status: "active", // Initial status
      availability: availability || {
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        timeSlots: [{ start: "09:00", end: "18:00" }],
      },
    });

    await partnerService.save();

    res.json({
      success: true,
      message: "Service selected successfully",
      service: partnerService,
    });
  } catch (error) {
    console.error("Select Service Error:", error);
    res.status(500).json({
      success: false,
      message: "Error selecting service",
    });
  }
};

// Get partner's selected services
exports.getMyServices = async (req, res) => {
  try {
    const services = await PartnerService.find({ partner: req.partner._id })
      .populate("category", "name description")
      .sort({ createdAt: -1 });

    res.json(services);
  } catch (error) {
    console.error("Get My Services Error:", error);
    res.status(500).json({ message: "Error fetching your services" });
  }
};

// Update partner service
exports.updateMyService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const updates = req.body;

    const service = await PartnerService.findOne({
      _id: serviceId,
      partner: req.partner._id,
    });

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    // If price is being updated, validate against base price
    if (updates.price) {
      const category = await ServiceCategory.findById(service.category);
      const baseService = category.services.id(service.service);

      if (updates.price < baseService.basePrice) {
        return res.status(400).json({
          message: `Price cannot be less than base price of ${baseService.basePrice}`,
        });
      }
    }

    Object.assign(service, updates);
    await service.save();

    res.json({
      message: "Service updated successfully",
      service,
    });
  } catch (error) {
    console.error("Update Service Error:", error);
    res.status(500).json({ message: "Error updating service" });
  }
};

// Toggle service status (active/inactive)
exports.toggleServiceStatus = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const service = await PartnerService.findOne({
      _id: serviceId,
      partner: req.partner._id,
    });

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    service.status = status;
    await service.save();

    res.json({
      message: `Service ${
        status === "active" ? "activated" : "deactivated"
      } successfully`,
      service,
    });
  } catch (error) {
    console.error("Toggle Service Status Error:", error);
    res.status(500).json({ message: "Error updating service status" });
  }
};

// Add a helper function to get partner's current service status
exports.getCurrentService = async (req, res) => {
  try {
    const currentService = await PartnerService.findOne({
      partner: req.partner._id,
      status: {
        $in: ["active", "in_progress"],
      },
    }).populate("category service");

    if (!currentService) {
      return res.json({
        success: true,
        message: "No active services found",
        canSelectNew: true,
      });
    }

    res.json({
      success: true,
      currentService,
      canSelectNew: false,
    });
  } catch (error) {
    console.error("Get Current Service Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching current service",
    });
  }
};

// Get service history
exports.getServiceHistory = async (req, res) => {
  try {
    const services = await PartnerService.find({
      partner: req.partner._id,
      status: { $in: ["completed", "cancelled"] },
    })
      .populate("category service")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      services,
    });
  } catch (error) {
    console.error("Service History Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching service history",
    });
  }
};

// Update service status
exports.updateServiceStatus = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { status } = req.body;

    const service = await PartnerService.findOne({
      _id: serviceId,
      partner: req.partner._id,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    service.status = status;
    await service.save();

    res.json({
      success: true,
      message: "Service status updated",
      service,
    });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating service status",
    });
  }
};

// Get matching bookings for partner
exports.getMatchingBookings = async (req, res) => {
  try {
    // Get partner's profile
    const profile = await Partner.findOne({ _id: req.partner._id });
    console.log("Profile:", profile);

    if (!profile) {
      return res.status(400).json({
        success: false,
        message: "Partner profile not found",
      });
    }

    // Get partner's selected category, sub-category, and services
    const { category, subcategory, service } = profile;

    if (!category || !subcategory || !service || service.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Partner category, sub-category, or services not set",
      });
    }

    console.log("Partner Category:", category);
    console.log("Partner Sub-Category:", subcategory);
    console.log("Partner Services:", service);

    // Find sub-services that belong to the partner's selected services
    const subServices = await SubService.find({
      service: { $in: service },
    }).select("_id");

    if (!subServices || subServices.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No sub-services found for the selected services",
      });
    }

    const subServiceIds = subServices.map((subService) => subService._id);
    console.log("Eligible Sub-Services:", subServiceIds);

    // Find bookings where sub-service matches the partner's selected service
    const bookings = await Booking.find({
      subService: { $in: subServiceIds }, // Only fetch relevant sub-services
      status: { $in: ["pending"] },
    })
      .populate({
        path: "service",
        populate: {
          path: "subCategory",
          model: "SubCategory",
          populate: {
            path: "category",
            model: "ServiceCategory",
            select: "name", // Ensure the category name is fetched
          },
        },
      })
      .populate({
        path: "user",
        select: "name phone email", // Ensure user details are fetched
      })
      .populate({
        path: "subService",
        select: "name price duration description", // Ensure sub-service details are fetched
      })
      .populate({
        path: "service",
        select: "name", // Ensure service name is fetched
      })
      .populate({
        path: "subCategory",
        model: "SubCategory",
        select: "name", // Ensure subcategory name is fetched
      })
      .select("-__v")
      .sort({ scheduledDate: 1, scheduledTime: 1 });

    console.log("Found Bookings Count:", bookings.length);

    // Format the response
    const formattedBookings = bookings.map((booking) => ({
      bookingId: booking._id,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      amount: booking.amount,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      location: booking.location,
      user: {
        name: booking.user?.name || "N/A",
        phone: booking.user?.phone || "N/A",
        email: booking.user?.email || "N/A",
      },
      subService: {
        name: booking.subService?.name || "N/A",
        price: booking.subService?.price || 0,
        duration: booking.subService?.duration || "N/A",
        description: booking.subService?.description || "N/A",
      },
      service: {
        name: booking.service?.name || "N/A",
      },
      category: {
        name: booking.category?.name || "N/A",
      },
      subCategory: {
        name: booking.subCategory?.name || "N/A",
      },
    }));

    res.json({
      success: true,
      count: formattedBookings.length,
      partnerDetails: {
        category,
        subcategory,
        service,
      },
      bookings: formattedBookings,
    });
  } catch (error) {
    console.error("Get Matching Bookings Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching matching bookings",
      error: error.message,
    });
  }
};

//accept booking
exports.acceptBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { partnerId } = req.body;

    if (!bookingId || !partnerId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and Partner ID are required",
      });
    }

    console.log("Partner ID:", partnerId);
    console.log("Booking ID:", bookingId);

    // Validate partner existence
    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res
        .status(404)
        .json({ success: false, message: "Partner not found" });
    }

    // Validate booking existence
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    console.log("Current Booking Status:", booking.status);

    // Check if booking is already accepted or canceled
    if (["accepted", "cancelled"].includes(booking.status)) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot accept this booking" });
    }

    // Update Booking: Assign partner and change status to 'accepted'
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        partner: partnerId,
        status: "accepted",
        acceptedAt: new Date(),
      },
      { new: true }
    )
      .populate({
        path: "partner",
        select:
          "name email phone profilePicture address experience qualification profile",
      })
      .populate({
        path: "user",
        select: "name email phone profilePhoto address",
      })
      .populate({
        path: "subService",
        select: "name price photo description duration",
      })
      .populate({
        path: "service",
        select: "name description",
      });

    // Update Partner: Add booking to bookings array
    await Partner.findByIdAndUpdate(
      partnerId,
      { $addToSet: { bookings: bookingId } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Booking accepted successfully",
      data: updatedBooking,
    });
  } catch (error) {
    console.error("Error accepting booking:", error);
    res.status(500).json({
      success: false,
      message: "Error accepting booking",
      error: error.message,
    });
  }
};

// Get completed bookings
exports.getCompletedBookings = async (req, res) => {
  try {
    const completedBookings = await Booking.find({
      partner: req.partner._id,
      status: "completed",
    })
      .populate({
        path: "user",
        select: "name email phone profilePhoto address",
      })
      .populate({
        path: "subService",
        select: "name price photo description duration",
      })
      .populate({
        path: "service",
        select: "name description",
      })
      .populate({
        path: "partner",
        select:
          "name email phone profilePicture address experience qualification profile",
      })
      .sort({ completedAt: -1 });

    if (!completedBookings.length) {
      return res.status(200).json({
        success: true,
        message: "No completed bookings found",
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Completed bookings fetched successfully",
      data: completedBookings,
    });
  } catch (error) {
    console.error("Error fetching completed bookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching completed bookings",
      error: error.message,
    });
  }
};

// Get rejected bookings
exports.getRejectedBookings = async (req, res) => {
  try {
    const rejectedBookings = await Booking.find({
      partner: req.partner._id,
      status: "rejected",
    })
      .populate({
        path: "user",
        select: "name email phone profilePhoto address",
      })
      .populate({
        path: "subService",
        select: "name price photo description duration",
      })
      .populate({
        path: "service",
        select: "name description",
      })
      .populate({
        path: "partner",
        select:
          "name email phone profilePicture address experience qualification profile",
      })
      .sort({ updatedAt: -1 });

    if (!rejectedBookings.length) {
      return res.status(200).json({
        success: true,
        message: "No rejected bookings found",
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Rejected bookings fetched successfully",
      data: rejectedBookings,
    });
  } catch (error) {
    console.error("Error fetching rejected bookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching rejected bookings",
      error: error.message,
    });
  }
};

// Reject booking
exports.rejectBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { partnerId } = req.body;

    if (!bookingId || !partnerId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and Partner ID are required",
      });
    }

    console.log("Partner ID:", partnerId);
    console.log("Booking ID:", bookingId);

    // Validate partner existence
    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res
        .status(404)
        .json({ success: false, message: "Partner not found" });
    }

    // Validate booking existence
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    console.log("Current Booking Status:", booking.status);

    // Check if booking is already accepted, rejected, or canceled
    if (["accepted", "cancelled", "rejected"].includes(booking.status)) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot reject this booking" });
    }

    // Update Booking: Change status to 'rejected'
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      { status: "rejected" },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Booking rejected successfully",
      data: updatedBooking,
    });
  } catch (error) {
    console.error("Error rejecting booking:", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting booking",
      error: error.message,
    });
  }
};

// Complete booking - Partner uploads photos and videos before marking the job as completed
exports.completeBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;

    // Extract only the filename from the path without using path module
    const photos = files.photos
      ? files.photos.map((file) => file.path.split("/").pop())
      : [];
    const videos = files.videos
      ? files.videos.map((file) => file.path.split("/").pop())
      : [];

    // Find and update the booking
    const booking = await Booking.findByIdAndUpdate(
      id,
      {
        status: "completed",
        photos,
        videos,
        completedAt: new Date(),
      },
      { new: true }
    )
      .populate({
        path: "user",
        select: "name email phone profilePhoto address",
      })
      .populate({
        path: "subService",
        select: "name price photo description duration",
      })
      .populate({
        path: "service",
        select: "name description",
      })
      .populate({
        path: "partner",
        select:
          "name email phone profilePicture address experience qualification profile",
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking completed successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error completing booking:", error);
    res.status(500).json({
      success: false,
      message: "Error completing booking",
      error: error.message,
    });
  }
};

// Get completed bookings
exports.getCompletedBookings = async (req, res) => {
  try {
    // Find completed bookings for the partner
    const completedBookings = await Booking.find({
      partner: req.partner._id, // Using req.partner._id instead of decoded token
      status: "completed",
    })
      .populate("user", "name email phone") // Populate user details
      .populate("service", "name") // Populate service details
      .populate("subService", "name") // Populate subService details
      .select("-__v") // Exclude version key
      .sort({ completedAt: -1 }); // Sort by completion date, newest first

    if (!completedBookings.length) {
      return res.status(200).json({
        success: true,
        message: "No completed bookings found",
        bookings: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Completed bookings fetched successfully",
      bookings: completedBookings,
    });
  } catch (error) {
    console.error("Error fetching completed bookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching completed bookings",
      error: error.message || "Unknown error",
    });
  }
};

exports.getPendingBookings = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1]; // Get the token from the header
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Decode the token
    const partnerId = decoded._id; // Extract partner ID from the decoded token

    const pendingBookings = await Booking.find({
      partnerId: partnerId,
      status: "pending",
    });

    if (!pendingBookings.length) {
      return res.status(404).json({ message: "No pending bookings found" });
    }

    res.status(200).json({
      message: "Pending bookings fetched successfully",
      bookings: pendingBookings,
    });
  } catch (error) {
    console.error("Error fetching pending bookings:", error);
    res.status(500).json({
      message: "Error fetching pending bookings",
      error: error.message || "Unknown error",
    });
  }
};

// Get completed bookings
exports.getRejectedBookings = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1]; // Get the token from the header
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Decode the token
    const partnerId = decoded._id; // Extract partner ID from the decoded token

    const rejectedBookings = await Booking.find({
      partnerId: partnerId,
      status: "rejected",
    });

    if (!rejectedBookings.length) {
      return res.status(404).json({ message: "No rejected bookings found" });
    }

    res.status(200).json({
      message: "Rejected bookings fetched successfully",
      bookings: rejectedBookings,
    });
  } catch (error) {
    console.error("Error fetching rejected bookings:", error);
    res.status(500).json({
      message: "Error fetching rejected bookings",
      error: error.message || "Unknown error",
    });
  }
};

// Pause a booking
// exports.pauseBooking = async (req, res) => {
//   console.log(
//     "now i am going to pause the booking ................................................"
//   );

//   try {
//     const { bookingId } = req.params;
//     const { nextScheduledDate, nextScheduledTime, pauseReason } = req.body;
//     console.log(
//       " nextScheduledDate, nextScheduledTime, pauseReason",
//       nextScheduledDate,
//       nextScheduledTime,
//       pauseReason
//     );
//     // Find the booking and verify it belongs to this partner
//     const booking = await Booking.findOne({
//       _id: bookingId,
//       partner: req.partner._id,
//       status: { $in: ["accepted", "in_progress"] },
//     });

//     if (!booking) {
//       return res.status(404).json({
//         success: false,
//         message: "Booking not found or cannot be paused",
//       });
//     }

//     // Update the booking status and pause details
//     booking.status = "paused";
//     booking.pauseDetails = {
//       nextScheduledDate: new Date(nextScheduledDate),
//       nextScheduledTime,
//       pauseReason,
//       pausedAt: new Date(),
//     };
//     console.log("booking", booking);
//     await booking.save();

//     res.status(200).json({
//       success: true,
//       message: "Booking paused successfully",
//       data: booking,
//     });
//   } catch (error) {
//     console.error("Error pausing booking:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error pausing booking",
//       error: error.message,
//     });
//   }
// };

exports.pauseBooking = async (req, res) => {
  console.log("Pausing the booking...");

  try {
    const { bookingId } = req.params;
    let { nextScheduledDate, nextScheduledTime, pauseReason } = req.body;

    console.log("Received:", {
      nextScheduledDate,
      nextScheduledTime,
      pauseReason,
    });

    if (!nextScheduledDate || isNaN(new Date(nextScheduledDate).getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid nextScheduledDate provided.",
      });
    }

    if (!nextScheduledTime) {
      return res.status(400).json({
        success: false,
        message: "Invalid nextScheduledTime provided.",
      });
    }

    // Find booking
    const booking = await Booking.findOne({
      _id: bookingId,
      partner: req.partner._id,
      status: { $in: ["accepted", "in_progress"] },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or cannot be paused",
      });
    }

    // Update booking
    booking.status = "paused";
    booking.pauseDetails = {
      nextScheduledDate: new Date(nextScheduledDate),
      nextScheduledTime,
      pauseReason,
      pausedAt: new Date(),
    };

    console.log("booking", booking);
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Booking paused successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error pausing booking:", error);
    res.status(500).json({
      success: false,
      message: "Error pausing booking",
      error: error.message,
    });
  }
};

// Get all paused bookings for a partner
exports.getPausedBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      partner: req.partner._id,
      status: "paused",
    })
      .populate("user", "name email phone")
      .populate("service", "name")
      .populate("subService", "name")
      .sort({
        "pauseDetails.nextScheduledDate": 1,
        "pauseDetails.nextScheduledTime": 1,
      });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error("Error fetching paused bookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching paused bookings",
      error: error.message,
    });
  }
};

// Resume a paused booking
exports.resumeBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Find the booking and verify it belongs to this partner and is paused
    const booking = await Booking.findOne({
      _id: bookingId,
      partner: req.partner._id,
      status: "paused",
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Paused booking not found",
      });
    }

    // Get the scheduled date and time from pauseDetails
    const { nextScheduledDate, nextScheduledTime } = booking.pauseDetails;

    // Update the booking
    booking.status = "in_progress";
    booking.scheduledDate = nextScheduledDate;
    booking.scheduledTime = nextScheduledTime;
    booking.pauseDetails = undefined; // Clear pause details

    await booking.save();

    res.status(200).json({
      success: true,
      message: "Booking resumed successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error resuming booking:", error);
    res.status(500).json({
      success: false,
      message: "Error resuming booking",
      error: error.message,
    });
  }
};

// Get accepted bookings for a specific partner
exports.getPartnerBookings = async (req, res) => {
  try {
    const { partnerId } = req.params;

    const bookings = await Booking.find({
      partner: partnerId,
      status: "accepted",
    })
      .populate({
        path: "user",
        select: "name email phone profilePhoto address",
      })
      .populate({
        path: "subService",
        select: "name price photo description duration",
      })
      .populate({
        path: "service",
        select: "name description",
      })
      .populate({
        path: "partner",
        select:
          "name email phone profilePicture address experience qualification profile",
      })
      .sort({ scheduledDate: -1 });

    res.status(200).json({
      success: true,
      message: "Partner bookings retrieved successfully",
      data: bookings,
    });
  } catch (error) {
    console.error("Error getting partner bookings:", error);
    res.status(500).json({
      success: false,
      message: "Error getting partner bookings",
      error: error.message,
    });
  }
};

// ✅ Get all products by category (For partners)
exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params; // Extract category ID from URL

    console.log("Received categoryId:", category);

    // Validate category ID format
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    // Convert category to ObjectId
    const categoryId = new mongoose.Types.ObjectId(category);

    // Fetch products that match category ID & have stock available
    const products = await Product.find({
      category: categoryId,
      stock: { $gt: 0 },
    });

    if (products.length === 0) {
      return res
        .status(404)
        .json({ message: "No products found for this category" });
    }

    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products by category:", error);
    res
      .status(500)
      .json({ message: "Error fetching products", error: error.message });
  }
};

// add to cart (Products)
exports.addToCart = async (req, res) => {
  try {
    const { bookingId, productId, change } = req.body; // 'change' is either +1 or -1
    const partnerId = req.partner.id; // Assuming partner token is decoded & stored in req.partner

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Validate product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if the given bookingId exists and is accepted for this partner
    const activeBooking = await Booking.findOne({
      _id: bookingId,
      partner: partnerId, // Ensure the booking belongs to this partner
      status: "accepted",
    });

    if (!activeBooking) {
      return res.status(400).json({ message: "Invalid or unaccepted booking" });
    }

    // Check if the product is already in the cart
    const existingItemIndex = partner.cart.findIndex(
      (item) => item.product.toString() === productId
    );

    if (existingItemIndex !== -1) {
      // Update quantity based on change (+1 or -1)
      partner.cart[existingItemIndex].quantity += change;

      // Remove item if quantity is 0 or negative
      if (partner.cart[existingItemIndex].quantity <= 0) {
        partner.cart.splice(existingItemIndex, 1);
      }
    } else if (change > 0) {
      // If product is not in the cart and change is positive, add it
      partner.cart.push({ product: productId, quantity: 1, approved: false });
    }

    await partner.save();
    return res.status(200).json({ message: "Cart updated successfully", cart: partner.cart });
  } catch (error) {
    return res.status(500).json({ message: "Error updating cart", error: error.message });
  }
};



// Use Approved Cart Products for a Booking
exports.useApprovedCartProductsForBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const partnerId = req.partner.id;

    console.log("Booking ID:", bookingId);
    console.log("Partner ID:", partnerId);

    // Fetch Booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Ensure the Partner is Assigned
    if (!booking.partner || booking.partner.toString() !== partnerId.toString()) {
      return res.status(403).json({ message: "Unauthorized: You are not assigned to this booking" });
    }

    // Fetch Partner Cart
    const partner = await Partner.findById(partnerId).populate("cart.product");
    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    console.log("Partner Cart:", partner.cart);

    // Filter Approved and Valid Products
    const approvedCartItems = partner.cart.filter(
      item => item.approved === true && item.product !== null
    );

    if (approvedCartItems.length === 0) {
      return res.status(400).json({ message: "No valid approved products in cart for this booking" });
    }

    let updatedInventory = [];
    let usedProducts = [];

    // Deduct Stock from Inventory
    for (const item of approvedCartItems) {
      const product = await Product.findById(item.product._id);
      if (!product) {
        console.error("Product not found:", item.product._id);
        continue;
      }

      // Check stock availability
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for product: ${product.name}` });
      }

      // Deduct stock
      product.stock -= item.quantity;
      await product.save();

      // Collect product details for response
      usedProducts.push({
        productId: product._id,
        name: product.name,
        usedQuantity: item.quantity,
        usedAt: new Date(),
      });

      updatedInventory.push({
        productId: product._id,
        name: product.name,
        remainingStock: product.stock,
      });
    }

    // Store Used Products in Booking History
    booking.usedProducts = usedProducts;
    await booking.save();

    // Save Used Products in Partner's Cart History
    partner.cartHistory = partner.cartHistory || [];
    partner.cartHistory.push({
      bookingId: bookingId,
      usedProducts: usedProducts,
      timestamp: new Date(),
    });

    // Clear Partner's Cart After Usage
    partner.cart = [];
    await partner.save();

    return res.status(200).json({
      success: true,
      message: "Products used successfully, inventory updated for booking",
      usedProducts: usedProducts,
      updatedInventory: updatedInventory,
      partnerCartHistory: partner.cartHistory,
    });

  } catch (error) {
    console.error("Error using products for booking:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};



