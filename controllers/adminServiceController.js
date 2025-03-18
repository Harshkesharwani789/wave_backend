const mongoose = require("mongoose");
const ServiceCategory = require("../models/ServiceCategory");
const Service = require("../models/Service");
const Booking = require("../models/booking");
const SubService = require("../models/SubService");
const path = require("path");
const { stripUrl } = require("../middleware/upload");
const SubCategory = require("../models/SubCategory");
const Product = require("../models/product");
const Partner = require("../models/Paartner");
// Get all services
exports.getAllServices = async (req, res) => {
  try {
    const services = await Service.find()
      .populate({
        path: "category",
        select:
          "name description icon status subCategoryTitle createdAt updatedAt",
      })
      .lean();

    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error("Get All Services Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create service
exports.createService = async (req, res) => {
  try {
    console.log("Create Service Request:", {
      body: req.body,
      file: req.file,
      headers: req.headers["content-type"],
    });

    // Validate required fields
    if (!req.body.name || !req.body.description || !req.body.subCategory) {
      return res.status(400).json({
        success: false,
        message:
          "Name, description, subCategory, basePrice, and duration are required",
      });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required",
      });
    }

    // Validate category exists
    const subCategory = await SubCategory.findById(req.body.subCategory);
    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const service = new Service({
      subCategory: req.body.subCategory,
      name: req.body.name,
      description: req.body.description,
      icon: path.basename(req.file.path),
    });

    await service.save();
    subCategory.services.push(service._id);
    await subCategory.save();

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      data: service,
    });
  } catch (error) {
    console.error("Create Service Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all service categories
exports.getAllServiceCategories = async (req, res) => {
  try {
    const categories = await ServiceCategory.find();
    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get Categories Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get services by category
exports.getServicesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Validate category exists
    const category = await ServiceCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Get services
    const services = await Service.find({ category: categoryId });

    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error("Get Services by Category Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Add sub-service
exports.addSubService = async (req, res) => {
  try {
    console.log("\n=== Add Sub-Service Request ===");
    console.log("Body:", req.body);
    console.log("File:", req.file);
    console.log("Params:", req.params);

    const { serviceId } = req.params;
    const { name, description, basePrice, duration } = req.body;

    // Basic validation
    if (!name || !description || !basePrice || !duration) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
        required: ["name", "description", "basePrice", "duration"],
        received: req.body,
      });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Icon file is required",
      });
    }

    // Find parent service
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Parent service not found",
      });
    }

    // Create sub-service
    const subService = new SubService({
      service: serviceId,
      name: name.trim(),
      description: description.trim(),
      basePrice: Number(basePrice),
      duration: Number(duration),
      icon: path.basename(req.file.path),
      status: "active",
    });

    try {
      await subService.save(); // Save the new subservice
      service.subServices.push(subService._id); // Add the subservice ID to the service
      await service.save(); // Save the updated service
    } catch (error) {
      console.error("Error adding subservice:", error);
      // Handle the error (e.g., send a response or throw an error)
    }
    //  Populate service details in response
    //   const populatedSubService = await SubService.findById(subService._id).populate('service');

    // const subCategory = await SubCategory.findById(service.subCategory);
    // if (subCategory) {
    //     subCategory.subservices.push(subService._id);
    //     await subCategory.save();
    // }

    res.status(201).json({
      success: true,
      message: "Sub-service added successfully",
      data: populatedSubService,
    });
  } catch (error) {
    console.error("Add Sub-Service Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error adding sub-service",
    });
  }
};

// Update service category
exports.updateServiceCategory = async (req, res) => {
  try {
    const { name } = req.body;
    let icon = req.file ? req.file.filename : undefined; // Handle uploaded file
    // console.log(name, icon);

    // Find the existing category
    const existingCategory = await ServiceCategory.findById(
      req.params.categoryId
    );
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Service category not found",
      });
    }

    // Prepare update object (only update fields that are provided)
    const updateData = {};
    if (name) updateData.name = name; // Update only if name is provided
    if (icon) updateData.icon = path.basename(icon); // Update only if icon is uploaded

    // Perform the update
    const category = await ServiceCategory.findByIdAndUpdate(
      req.params.categoryId,
      { $set: updateData },
      { new: true }
    );

    // console.log(category, "category");

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.log(error, "error");
    res.status(500).json({
      success: false,
      message: "Error updating service category",
    });
  }
};

// Delete service category
exports.deleteServiceCategory = async (req, res) => {
  try {
    const category = await ServiceCategory.findById(req.params.categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Service category not found",
      });
    }

    // Check if category has any active services
    const activeServices = await Service.find({
      category: req.params.categoryId,
      status: "active",
    });
    if (activeServices.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category with active services",
      });
    }

    // Use findByIdAndDelete instead of remove()
    await ServiceCategory.findByIdAndDelete(req.params.categoryId);

    res.json({
      success: true,
      message: "Service category deleted successfully",
    });
  } catch (error) {
    console.error("Delete Category Error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting service category",
      error: error.message,
    });
  }
};

// Get service analytics
exports.getServiceAnalytics = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;

    // Get bookings for this category in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const bookings = await Booking.find({
      "service.category": categoryId,
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Calculate analytics
    const analytics = {
      totalBookings: bookings.length,
      totalRevenue: bookings.reduce((sum, booking) => sum + booking.amount, 0),
      averageRating:
        bookings.filter((b) => b.rating).reduce((sum, b) => sum + b.rating, 0) /
          bookings.filter((b) => b.rating).length || 0,
      statusBreakdown: {
        completed: bookings.filter((b) => b.status === "completed").length,
        cancelled: bookings.filter((b) => b.status === "cancelled").length,
        pending: bookings.filter((b) => b.status === "pending").length,
      },
    };

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching service analytics",
    });
  }
};

// Create category
exports.createCategory = async (req, res) => {
  try {
    // Validate required fields
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Icon file is required",
      });
    }

    if (!req.body.name || !req.body.description) {
      return res.status(400).json({
        success: false,
        message: "Name and description are required",
      });
    }

    // Create new category with just the filename
    const category = new ServiceCategory({
      name: req.body.name.trim(),
      description: req.body.description.trim(),
      icon: req.file.filename, // Store only the filename
      status: "active",
      subtitle: req.body.subtitle.trim(),
    });

    const savedCategory = await category.save();

    // Transform the response
    const response = {
      _id: savedCategory._id,
      name: savedCategory.name,
      description: savedCategory.description,
      icon: savedCategory.icon, // This will be just the filename
      status: savedCategory.status,
      createdAt: savedCategory.createdAt,
      updatedAt: savedCategory.updatedAt,
      subtitle: savedCategory.subtitle,
    };

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: response,
    });
  } catch (error) {
    console.error("Create Category Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    // Use lean() for better performance and to get plain objects
    const categories = await ServiceCategory.find().lean();

    // Transform to ensure clean data
    const transformedCategories = categories.map((category) => {
      let icon = category.icon;

      // Handle all possible URL formats
      if (icon.includes("http://localhost:9000/uploads/")) {
        icon = icon.split("/uploads/")[1];
      } else if (icon.includes("http://localhost:9000/")) {
        icon = icon.split("http://localhost:9000/")[1];
      } else if (icon.includes("/")) {
        icon = icon.split("/").pop();
      }

      return {
        _id: category._id,
        name: category.name,
        description: category.description,
        icon: icon,
      };
    });

    res.status(200).json({
      success: true,
      data: transformedCategories,
      message: "Categories fetched successfully",
    });
  } catch (error) {
    console.error("Get Categories Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all sub-services
exports.getAllSubServices = async (req, res) => {
  try {
    // Debug: Check if SubService model exists
    // console.log('SubService Model:', !!SubService);

    // First get all sub-services without population to check raw data
    const rawSubServices = await SubService.find().populate();
    // console.log('Raw data count:', rawSubServices.length);
    // console.log('First raw item:', rawSubServices[0]);

    // Now try to populate
    const subServices = await SubService.find().populate("service");

    // console.log('After populate count:', subServices.length);
    // console.log('First populated item:', JSON.stringify(subServices[0], null, 2));

    // Safe mapping with extensive null checking
    const formattedSubServices = subServices
      .filter((item) => item !== null && item !== undefined)
      .map((subService) => {
        // Debug log for each item
        // console.log('Processing subService:', subService?._id);

        return {
          _id: subService?._id?.toString() || "No ID",
          name: subService?.name || "Unnamed Service",
          description: subService?.description || "No description",
          price: subService?.price || 0,
          duration: subService?.duration || 0,
          isActive: Boolean(subService?.isActive),
          serviceName: subService?.service?.name || "No Service Name",
          createdAt: subService?.createdAt || new Date(),
          updatedAt: subService?.updatedAt || new Date(),
        };
      });

    // Return the results
    return res.status(200).json({
      success: true,
      count: formattedSubServices.length,
      data: formattedSubServices,
    });
  } catch (error) {
    console.error("Detailed error:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    return res.status(500).json({
      success: false,
      message: "Error fetching sub-services",
      error: error.message,
    });
  }
};
// Create sub-service
// exports.createSubService = async (req, res) => {
//   try {
//       console.log('Received Data:', req.body);
//       console.log('Uploaded File:', req.file || 'No file uploaded');

//       if (!req.file) {
//           return res.status(400).json({ success: false, message: 'Icon image is required' });
//       }

//       const iconPath = req.file.filename; // Store uploaded filename

//       const subService = new SubService({
//           name: req.body.name,
//           description: req.body.description,
//           service: req.body.service,
//           mrp: req.body.mrp,
//           discount: req.body.discount,
//           gst: req.body.gst,
//           icon: iconPath, // Save file path
//           includes: req.body.includes.split(','),
//           excludes: req.body.excludes.split(',')
//       });

//       const savedSubService = await subService.save();

//       res.status(201).json({
//           success: true,
//           message: 'Sub-Service created successfully',
//           subService: savedSubService
//       });

//   } catch (error) {
//       console.error('Error:', error);
//       res.status(500).json({ success: false, message: 'Error creating sub-service', error: error.message });
//   }
// };

// Create sub-service
exports.createSubService = async (req, res) => {
  try {
    console.log("Received Data:", req.body);
    console.log("Uploaded Files:", req.files || "No files uploaded");

    // Ensure at least 4 images are uploaded
    if (!req.files || req.files.length < 4) {
      return res.status(400).json({
        success: false,
        message: "At least 4 images are required",
      });
    }

    // Extract file paths
    const imagePaths = req.files.map((file) => file.filename);

    const subService = new SubService({
      name: req.body.name,
      description: req.body.description,
      service: req.body.service,
      price: req.body.price,
      discount: req.body.discount,
      gst: req.body.gst,
      commission: req.body.commission,
      icon: imagePaths, // Store array of image filenames
      includes: req.body.includes ? req.body.includes.split(",") : [],
      excludes: req.body.excludes ? req.body.excludes.split(",") : [],
    });

    const savedSubService = await subService.save();

    res.status(201).json({
      success: true,
      message: "Sub-Service created successfully",
      subService: savedSubService,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating sub-service",
      error: error.message,
    });
  }
};

// Update service
exports.updateService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { name, description } = req.body;

    // Find service
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Update fields
    service.name = name || service.name;
    service.description = description || service.description;

    // Update icon if provided
    if (req.file) {
      service.icon = path.basename(req.file.path);
    }

    await service.save();

    res.json({
      success: true,
      message: "Service updated successfully",
      data: service,
    });
  } catch (error) {
    console.error("Update Service Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete service
exports.deleteService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    // Find and delete service
    const service = await Service.findByIdAndDelete(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Remove service reference from category
    await ServiceCategory.updateMany(
      { services: serviceId },
      { $pull: { services: serviceId } }
    );

    res.json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error("Delete Service Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update sub-service
exports.updateSubService = async (req, res) => {
  console.log("Req BOdy : ", req.body);
  console.log("Req Files : ", req.files);
  try {
    const { serviceId, subServiceId } = req.params;
    const { name, description, price, includes, excludes } = req.body;

    // Find service and sub-service
    // if (!req.files || req.files.length < 4) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "At least 4 images are required"
    //   });
    // }

    if (req.files.length < 4 && req.files.length >= 1) {
      console.log("Only 1 image is there");
      return res.status(400).json({
        success: false,
        message: "At least 4 images are required",
      });
    }
    // Extract file paths
    const imagePaths = req.files.map((file) => file.filename);

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const subService = await SubService.findById(subServiceId);
    if (!subService) {
      return res.status(404).json({
        success: false,
        message: "Sub-service not found",
      });
    }

    // Update fields
    subService.name = name || subService.name;
    subService.description = description || subService.description;
    subService.price = price || subService.price;
    subService.includes = includes || subService.includes;
    subService.excludes = excludes || subService.excludes;
    subService.discount = req.body.discount || subService.discount;
    subService.gst = req.body.gst || subService.gst;
    subService.commission = req.body.commission || subService.commission;
    subService.icon = imagePaths || subService.icon;

    // subService.icon: imagePaths, // Store array of image filenames
    // subService.duration = duration || subService.duration;

    // Update icon if provided
    // if (req.file) {
    //   subService.icon = path.basename(req.file.path);
    // }

    await subService.save();

    res.json({
      success: true,
      message: "Sub-service updated successfully",
      data: subService,
    });
  } catch (error) {
    console.error("Update Sub-service Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update sub-service
// exports.updateSubService = async (req, res) => {
//   try {
//     console.log("Received Update Data:", req.body , req.params);
//     console.log("Uploaded Files:", req.files || "No files uploaded");

//     const { subServiceId } = req.params; // Get sub-service ID from URL
//     const updateData = { ...req.body };

//     // Check if the sub-service exists
//     const existingSubService = await SubService.findById(subServiceId);
//     if (!existingSubService) {
//       return res.status(404).json({
//         success: false,
//         message: "Sub-service not found"
//       });
//     }

//     // Handle image update
//     if (req.files && req.files.length > 0) {
//       if (req.files.length !== 4) {
//         return res.status(400).json({
//           success: false,
//           message: "If updating images, exactly 4 images must be provided"
//         });
//       }
//       updateData.icon = req.files.map(file => file.filename); // Store new images
//       console.log("updateData" , updateData)
//     }

//     // Update only provided fields (partial update allowed)
//     const updatedSubService = await SubService.findByIdAndUpdate(
//       subServiceId,
//       { $set: updateData },
//       { new: true, runValidators: true }
//     );

//     res.status(200).json({
//       success: true,
//       message: "Sub-Service updated successfully",
//       subService: updatedSubService
//     });

//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error updating sub-service",
//       error: error.message
//     });
//   }
// };

// exports.updateSubService = async (req, res) => {
//   try {
//     console.log("Received Update Data:", req.body);
//     console.log("Uploaded Files:", req.files || "No files uploaded");

//     const { subServiceId } = req.params;
//     const updateData = { ...req.body };

//     // Find the existing sub-service
//     const existingSubService = await SubService.findById(subServiceId);
//     if (!existingSubService) {
//       return res.status(404).json({ success: false, message: "Sub-service not found" });
//     }

//     // Check if images need to be updated
//     if (req.files && req.files.length > 0) {
//       if (req.files.length !== 4) {
//         return res.status(400).json({ success: false, message: "If updating images, exactly 4 images must be provided" });
//       }
//       updateData.icon = req.files.map(file => file.filename); // Store new images
//     } else {
//       delete updateData.icon; // Do not update images if no new ones are provided
//     }

//     // Update only provided fields
//     const updatedSubService = await SubService.findByIdAndUpdate(subServiceId, { $set: updateData }, { new: true, runValidators: true });

//     res.status(200).json({
//       success: true,
//       message: "Sub-Service updated successfully",
//       subService: updatedSubService
//     });

//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error updating sub-service",
//       error: error.message
//     });
//   }
// };

// Delete sub-service

exports.deleteSubService = async (req, res) => {
  try {
    const { serviceId, subServiceId } = req.params;

    // Find service
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Find and delete sub-service
    const subService = await SubService.findByIdAndDelete(subServiceId);
    if (!subService) {
      return res.status(404).json({
        success: false,
        message: "Sub-service not found",
      });
    }

    // Remove sub-service reference from service
    service.subServices = service.subServices.filter(
      (id) => id.toString() !== subServiceId
    );
    await service.save();

    res.json({
      success: true,
      message: "Sub-service deleted successfully",
    });
  } catch (error) {
    console.error("Delete Sub-service Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update service recommendation status
exports.updateServiceRecommendation = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { isRecommended } = req.body;

    if (typeof isRecommended !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isRecommended must be a boolean value",
      });
    }

    const service = await Service.findByIdAndUpdate(
      serviceId,
      { isRecommended },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Service ${
        isRecommended ? "marked as" : "removed from"
      } recommended`,
      data: service,
    });
  } catch (error) {
    console.error("Update Service Recommendation Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update service most booked status
exports.updateServiceMostBooked = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { isMostBooked } = req.body;

    if (typeof isMostBooked !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isMostBooked must be a boolean value",
      });
    }

    const service = await Service.findByIdAndUpdate(
      serviceId,
      { isMostBooked },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Service ${
        isMostBooked ? "marked as" : "removed from"
      } most booked`,
      data: service,
    });
  } catch (error) {
    console.error("Update Service Most Booked Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get recommended services
exports.getRecommendedServices = async (req, res) => {
  try {
    const services = await Service.find({ isRecommended: true, isActive: true })
      .populate("category")
      .lean();

    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error("Get Recommended Services Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get most booked services
exports.getMostBookedServices = async (req, res) => {
  try {
    const services = await Service.find({ isMostBooked: true, isActive: true })
      .populate("category")
      .lean();

    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error("Get Most Booked Services Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all categories with sub-categories, services, and sub-services
exports.getAllCategoriesWithDetails = async (req, res) => {
  try {
    const categories = await ServiceCategory.find().populate({
      path: "subCategories", // Assuming the ServiceCategory model has a field 'subCategories'
      populate: {
        path: "services", // Assuming the SubCategory model has a field 'services'
        populate: {
          path: "subServices", // Assuming the Service model has a field 'subServices'
        },
      },
    });

    // Format the response to include sub-categories nested within categories
    const formattedCategories = categories.map((category) => ({
      _id: category._id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      subCategories: category.subCategories, // This will include services and sub-services
    }));

    res.status(200).json({
      success: true,
      data: formattedCategories,
    });
  } catch (error) {
    console.error("Get All Categories Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// add product for partner
exports.addProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      brand,
      description,
      price,
      stock,
      specifications,
      howToUse,
      hsnCode,
      gstPercentage,
      discountPercentage,
      model,
    } = req.body;

    let imagePath = req.file ? req.file.path : ""; // Get uploaded image path

    // Extract only the filename from the image path
    if (imagePath) {
      imagePath = imagePath.split("/").pop(); // Extracts '1741171846734-220232475.png'
    }

    const newProduct = new Product({
      name,
      category,
      brand,
      description,
      price,
      stock,
      specifications,
      howToUse,
      hsnCode,
      gstPercentage,
      discountPercentage,
      model,
      image: imagePath, // Save only filename
    });

    await newProduct.save();

    res
      .status(201)
      .json({ message: "Product added successfully", product: newProduct });
  } catch (error) {
    console.error("Error adding product:", error);
    res
      .status(500)
      .json({ message: "Error adding product", error: error.message });
  }
};

// ✅ Get all products (Admin)
// exports.getAllProducts = async (req, res) => {
//   try {
//       const products = await Product.find();
//       res.status(200).json(products);
//   } catch (error) {
//       res.status(500).json({ message: "Error fetching products", error });
//   }
// };

// ✅ Get all products (Admin) with populated category
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("category"); // Populating the category field
    res.status(200).json(products);
  } catch (error) {
    console.log("error : ", error);
    res.status(500).json({ message: "Error fetching products", error });
  }
};

// ✅ Update product (Admin)
exports.updateProduct = async (req, res) => {
  try {
    console.log("Received params:", req.params); // Debugging

    const { id: productId } = req.params; // Extract correct param

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID format" });
    }

    // Find the existing product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Prepare update fields
    const updateFields = { ...req.body };

    // Handle image update
    if (req.file) {
      updateFields.image = path.basename(req.file.path);
    }

    // Remove empty values to ensure partial update
    Object.keys(updateFields).forEach((key) => {
      if (
        updateFields[key] === undefined ||
        updateFields[key] === null ||
        updateFields[key] === ""
      ) {
        delete updateFields[key];
      }
    });

    // Update only the provided fields
    Object.assign(product, updateFields);

    // Save updated product
    await product.save();

    res.status(200).json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.log("error : ", error);
    res.status(500).json({ message: "Error updating product", error });
  }
};

// ✅ Delete product (Admin)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct)
      return res.status(404).json({ message: "Product not found" });

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting product", error });
  }
};

// ✅ Reduce inventory when a partner selects a product
exports.useProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product || product.stock <= 0)
      return res.status(400).json({ message: "Product out of stock" });

    product.stock -= 1;
    await product.save();

    res.status(200).json({ message: "Product used successfully", product });
  } catch (error) {
    res.status(500).json({ message: "Error using product", error });
  }
};

// ✅ Replenish inventory when a partner removes a product
exports.returnProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.stock += 1;
    await product.save();

    res.status(200).json({ message: "Product returned successfully", product });
  } catch (error) {
    res.status(500).json({ message: "Error returning product", error });
  }
};

//change the partner profile status
// Admin API to update partner's profile status
exports.updatePartnerStatus = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { status } = req.body;

    // Validate status value
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value. Must be 'active' or 'inactive'.",
      });
    }

    // Find and update partner's status
    const updatedPartner = await Partner.findByIdAndUpdate(
      partnerId,
      { profileStatus: status },
      { new: true } // Return updated document
    );

    if (!updatedPartner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: `Partner's status updated to '${status}'.`,
      data: updatedPartner,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

//get partner earnings
// Fetch partner's transactions and earnings
exports.getPartnerEarnings = async (req, res) => {
  try {
    const { partnerId } = req.params;

    // Fetch all completed bookings for the partner
    const bookings = await Booking.find({
      partner: partnerId,
      status: "completed",
    })
      .populate("user", "name email")
      .populate("subService", "name price commission")
      .populate("service", "name")
      .populate("subCategory", "name")
      .populate("category", "name")
      .populate("partner", "profile.name profile.email");

    if (!bookings.length) {
      return res
        .status(404)
        .json({ message: "No completed bookings found for this partner." });
    }

    let totalEarnings = 0;
    let transactions = bookings.map((booking) => {
      const subService = booking.subService;
      const totalAmount = booking.amount;
      const commissionAmount = (subService.commission / 100) * totalAmount;
      const partnerEarnings = totalAmount - commissionAmount;
      totalEarnings += partnerEarnings;

      return {
        bookingId: booking._id,
        user: booking.user,
        subService: subService.name,
        service: booking.service?.name,
        subCategory: booking.subCategory?.name,
        category: booking.category?.name,
        totalAmount,
        commissionPercentage: subService.commission,
        commissionAmount,
        partnerEarnings,
        paymentMode: booking.paymentMode,
        status: booking.status,
        completedAt: booking.completedAt,
      };
    });

    res.json({ partnerId, totalEarnings, transactions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
