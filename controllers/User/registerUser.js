import bcrypt from "bcrypt";
import { sendMail } from "../../utils/Email.js";
import { sanitizeUser } from "../../utils/SanitizeUser.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../utils/GenerateToken.js";
import RegisterSchema from "../../Validation/User/registerValidator.js";
import User from "../../models/User.model.js";
import mongoose from "mongoose";
import expressAsyncHandler from "express-async-handler";

export const registerUser = expressAsyncHandler(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await RegisterSchema.validateAsync(req.body);
    const { name, email, role, password, phoneNumber, address, ContactPerson } =
      user;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: `Email ${email} already exists,Kindly login.` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      role,
      password: hashedPassword,
      phoneNumber,
      address,
      ContactPerson,
      isVerified: false, // tracks email verification
    });

    const savedUser = await newUser.save();

    // Verification link
    await sendMail(
      savedUser.email,
      "Verify your email",
      `<p>Dear ${savedUser.name}, 
          Please click on the link to verify your email:</p>
          <p><a href=${process.env.ORIGIN}/verify-email/${savedUser._id} target='_blank'>Verify Email</a></p>`
    );

    const access_token = generateAccessToken(savedUser._id);
    const refresh_token = generateRefreshToken(savedUser._id);
    // const cookieExpirationDays = parseInt(process.env.COOKIE_EXPIRATION_DAYS);
    // if (isNaN(cookieExpirationDays)) {
    //   throw new Error("COOKIE_EXPIRATION_DAYS must be a valid number.");
    // }
    // // sends JWT token in the response cookies
    // res.cookie("token", token, {
    //   sameSite: process.env.PRODUCTION === "true" ? "None" : "Lax",
    //   maxAge: cookieExpirationDays * 24 * 60 * 60 * 1000,
    //   httpOnly: true,
    //   secure: process.env.PRODUCTION === "true",
    // });

    await session.commitTransaction();

    return res.status(201).json({
      message: "Registration successful. Please verify your email.",
      access_token,
      refresh_token,
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export const verifyEmail = expressAsyncHandler(async (req, res) => {
  const id = req.params.id;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.isVerified) {
      return res
        .status(400)
        .json({ message: "Email already verified, please login." });
    }

    await User.findByIdAndUpdate(user._id, { isVerified: true });

    return res.status(200).json({ message: "Email verified successfully." });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error occurred while verifying email." });
  }
});
