const User  = require("../models/user.model");
const Argon  = require("argon2");
const jwt    = require("jsonwebtoken");
const argonLimiter = require("../../utils/argonLimiter");

// ─── activateUser ─────────────────────────────────────────────────────────────
// POST /api/v1/users/activate
const activateUser = async (req, res) => {
    try {
        const {
            registrationNumber,
            hostel,
            roomNumber,
            newPassword,
            confirmPassword
        } = req.body;

        // Only match by registrationNumber + hostel — roomNumber is not always set in DB
        const user = await User.findOne({ registrationNumber, hostel });

        if (user == null) {
            return res.status(404).json({
                success: false,
                message: "user not found"
            });
        }

        if (user.isActivated === true) {
            return res.status(400).json({
                success: false,
                message: "user already activated"
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "passwords do not match"
            });
        }

        const hashPass = await Argon.hash(newPassword);
        user.password = hashPass;
        user.isActivated = true;

        // Save roomNumber if provided and not the literal string "null"
        if (roomNumber && roomNumber !== "null") {
            user.roomNumber = roomNumber;
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: "user activated successfully"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "failed to activate user",
            error: error.message
        });
    }
};

// ─── loggedInUser ─────────────────────────────────────────────────────────────
// POST /api/v1/users/login
const loggedInUser = async (req, res) => {
    try {
        const { registrationNumber, password } = req.body;

        if (!registrationNumber || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        const user = await User.findOne({ registrationNumber });

        if (user == null) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        if (user.isActivated === false) {
            return res.status(403).json({
                success: false,
                message: "Please activate your account first"
            });
        }

        // argonLimiter caps concurrent Argon2 calls to 10 — prevents CPU saturation
        const isPasswordCorrect = await argonLimiter.schedule(() =>
            Argon.verify(user.password, password)
        );

        if (isPasswordCorrect === false) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const token = jwt.sign(
            {
                id:                 user._id,
                name:               user.name,
                registrationNumber: user.registrationNumber,
                role:               user.role,
                hostel:             user.hostel,
                roomNumber:         user.roomNumber,
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(200).json({
            success: true,
            message: "user logged in successfully",
            token
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "due to system failure failed to login user",
            error: error.message
        });
    }
};

module.exports = { activateUser, loggedInUser };