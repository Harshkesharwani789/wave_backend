const express = require("express");
const router = express.Router();
const {
  auth,
  requireProfileCompletion,
  requireKYCVerification,
} = require("../middleware/auth");
const { sendLoginOTP, verifyOTP } = require("../controllers/partnerController.js");

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User and Partner authentication endpoints
 */

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     summary: Send OTP for login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Invalid phone number
 *       500:
 *         description: Server error
 */
router.post("/send-otp", sendLoginOTP);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *               otp:
 *                 type: string
 *                 description: OTP received on phone
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token
 *       400:
 *         description: Invalid OTP
 *       500:
 *         description: Server error
 */
router.post("/verify-otp", verifyOTP);

/**
 * @swagger
 * /api/auth/partner/send-otp:
 *   post:
 *     summary: Send OTP for partner login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Partner's phone number
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Invalid phone number
 *       500:
 *         description: Server error
 */
router.post("/partner/send-otp", sendLoginOTP);

/**
 * @swagger
 * /api/auth/partner/verify-otp:
 *   post:
 *     summary: Verify OTP and login for partner
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Partner's phone number
 *               otp:
 *                 type: string
 *                 description: OTP received on phone
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token
 *       400:
 *         description: Invalid OTP
 *       500:
 *         description: Server error
 */
router.post("/partner/verify-otp", verifyOTP);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get partner profile
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Partner profile retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/profile", auth, async (req, res) => {
  res.json(req.partner);
});

/**
 * @swagger
 * /api/auth/kyc-details:
 *   post:
 *     summary: Upload KYC details
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               kycDetails:
 *                 type: object
 *                 description: KYC information
 *     responses:
 *       200:
 *         description: KYC details uploaded successfully
 *       401:
 *         description: Unauthorized or Profile not completed
 *       500:
 *         description: Server error
 */
router.post(
  "/kyc-details",
  auth,
  requireProfileCompletion,
  async (req, res) => {
    // KYC upload logic here
  }
);

/**
 * @swagger
 * /api/auth/service-selection:
 *   post:
 *     summary: Select services
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of service IDs
 *     responses:
 *       200:
 *         description: Services selected successfully
 *       401:
 *         description: Unauthorized, Profile not completed, or KYC not verified
 *       500:
 *         description: Server error
 */
router.post(
  "/service-selection",
  auth,
  requireProfileCompletion,
  requireKYCVerification,
  async (req, res) => {
    // Service selection logic here
  }
);




module.exports = router;
