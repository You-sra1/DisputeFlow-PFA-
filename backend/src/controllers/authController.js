const userModel = require('../models/usermodel');
const { generateToken } = require('../utils/jwt');
const { hashPassword, comparePassword } = require('../utils/bcryptHelper');
const { successResponse, errorResponse } = require('../utils/responseBuilder');
const AppError = require('../utils/AppError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function login(req, res) {
  try {
    const { requestInfo, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(
        errorResponse('Email and password are required', { errorCode: '40070' })
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json(
        errorResponse('Invalid email format', { errorCode: '40071' })
      );
    }

    const user = await userModel.findByEmail(email);

    if (!user) {
      return res.status(401).json(
        errorResponse('Invalid email or password', { errorCode: '40101' })
      );
    }

    const passwordValide = await comparePassword(password, user.password);
    if (!passwordValide) {
      return res.status(401).json(
        errorResponse('Invalid email or password', { errorCode: '40101' })
      );
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    return res.status(200).json(
      successResponse({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      })
    );
  } catch (err) {
    console.error('Erreur login :', err.message);
    return res.status(500).json(
      errorResponse('Internal server error', { errorCode: '50000' })
    );
  }
}

async function me(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json(
        errorResponse('Unauthorized', { errorCode: '40100' })
      );
    }

    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json(
        errorResponse('User not found', { errorCode: '40401' })
      );
    }

    return res.status(200).json(successResponse(user));
  } catch (err) {
    console.error('Erreur /me :', err.message);
    return res.status(500).json(
      errorResponse('Internal server error', { errorCode: '50000' })
    );
  }
}

async function updateMe(req, res) {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AppError('Name is required', 400, '40072');
    }
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      throw new AppError('Valid email is required', 400, '40073');
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    const existing = await userModel.findByEmail(trimmedEmail);
    if (existing && existing.id !== userId) {
      throw new AppError('Email already in use by another account', 409, '40920');
    }

    await userModel.updateProfile(userId, { name: trimmedName, email: trimmedEmail });

    const updatedUser = await userModel.findById(userId);

    return res.status(200).json(successResponse(updatedUser));
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json(
        errorResponse(err.message, { errorCode: err.errorCode })
      );
    }
    console.error('Erreur updateMe :', err.message);
    return res.status(500).json(
      errorResponse('Internal server error', { errorCode: '50000' })
    );
  }
}

async function changePassword(req, res) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || typeof currentPassword !== 'string') {
      throw new AppError('Current password is required', 400, '40074');
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new AppError('New password must be at least 6 characters', 400, '40075');
    }

    const user = await userModel.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, '40401');
    }

    const fullUser = await userModel.findByEmail(user.email);
    if (!fullUser) {
      throw new AppError('User not found', 404, '40401');
    }

    const valid = await comparePassword(currentPassword, fullUser.password);
    if (!valid) {
      throw new AppError('Current password is incorrect', 401, '40102');
    }

    const hash = await hashPassword(newPassword);
    await userModel.updatePassword(userId, hash);

    return res.status(200).json(successResponse({ message: 'Password updated successfully' }));
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json(
        errorResponse(err.message, { errorCode: err.errorCode })
      );
    }
    console.error('Erreur changePassword :', err.message);
    return res.status(500).json(
      errorResponse('Internal server error', { errorCode: '50000' })
    );
  }
}

module.exports = { login, me, updateMe, changePassword };
