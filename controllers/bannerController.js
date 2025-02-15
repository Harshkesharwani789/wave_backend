const Banner = require("../models/Banner");
const fs = require("fs").promises;
const path = require("path");

// Helper function to get filename from path
const getFilename = (filepath) => {
  if (!filepath) return null;
  // If it's a full URL or path, extract just the filename
  if (filepath.includes('/')) {
    return filepath.split('/').pop();
  }
  return filepath;
};

const bannerController = {
  // Upload a new banner
  uploadBanner: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No banner image file provided",
        });
      }

      // Get just the filename without any path
      const filename = getFilename(req.file.path);

      const banner = new Banner({
        image: filename,
        title: req.body.title,
        description: req.body.description,
        order: req.body.order || 0,
        isActive: true
      });

      await banner.save();

      const bannerResponse = banner.toObject();
      bannerResponse.image = getFilename(bannerResponse.image);

      res.status(201).json({
        success: true,
        message: "Banner uploaded successfully",
        banner: bannerResponse,
      });
    } catch (error) {
      console.error("Error in uploadBanner:", error);
      res.status(500).json({
        success: false,
        message: "Error uploading banner",
        error: error.message,
      });
    }
  },

  // Get all banners
  getAllBanners: async (req, res) => {
    try {
      const banners = await Banner.find().sort({ order: 1 }).lean();
      
      // Clean image paths
      const bannersWithCleanImages = banners.map(banner => ({
        ...banner,
        image: getFilename(banner.image)
      }));

      res.status(200).json({
        success: true,
        banners: bannersWithCleanImages,
      });
    } catch (error) {
      console.error("Error in getAllBanners:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching banners",
        error: error.message,
      });
    }
  },

  // Get active banners for users
  getActiveBanners: async (req, res) => {
    try {
      const banners = await Banner.find({ isActive: true })
        .sort({ order: 1 })
        .lean();

      // Clean image paths
      const bannersWithCleanImages = banners.map(banner => ({
        ...banner,
        image: getFilename(banner.image)
      }));

      res.status(200).json({
        success: true,
        banners: bannersWithCleanImages,
      });
    } catch (error) {
      console.error("Error in getActiveBanners:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching active banners",
        error: error.message,
      });
    }
  },

  // Update banner
  updateBanner: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      if (req.file) {
        // Get just the filename without any path
        updateData.image = getFilename(req.file.path);
      }

      const banner = await Banner.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      ).lean();

      if (!banner) {
        return res.status(404).json({
          success: false,
          message: "Banner not found",
        });
      }

      // Clean image path in response
      banner.image = getFilename(banner.image);

      res.status(200).json({
        success: true,
        message: "Banner updated successfully",
        banner,
      });
    } catch (error) {
      console.error("Error in updateBanner:", error);
      res.status(500).json({
        success: false,
        message: "Error updating banner",
        error: error.message,
      });
    }
  },

  // Delete banner
  deleteBanner: async (req, res) => {
    try {
      const { id } = req.params;
      const banner = await Banner.findById(id);

      if (!banner) {
        return res.status(404).json({
          success: false,
          message: "Banner not found",
        });
      }

      // Delete the image file if it exists
      if (banner.image) {
        try {
          const imagePath = path.join(__dirname, '..', 'uploads', 'banners', banner.image);
          await fs.unlink(imagePath);
        } catch (err) {
          console.error("Error deleting banner image file:", err);
        }
      }

      await Banner.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: "Banner deleted successfully",
      });
    } catch (error) {
      console.error("Error in deleteBanner:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting banner",
        error: error.message,
      });
    }
  },
};

module.exports = bannerController;
