const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { sendPushToUser } = require('../utils/pushNotification');
const { sendEmail } = require('../utils/email');
const { uploadSingle } = require('../utils/upload');
const { uploadToCloudinary } = require('../utils/cloudinaryUpload');

const router = express.Router();

// ── Doctor Auth Middleware (reused) ──────────────────────────────────
function authenticateDoctor(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Doctor authentication required.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.doctorId || decoded.type !== 'DOCTOR') {
      return res.status(401).json({ error: 'Invalid doctor token.' });
    }
    req.doctorId = decoded.doctorId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Helper: calculate estimated time for a token
function calcEstimatedTime(startTime, tokenNumber, avgMinutes) {
  if (!startTime || !tokenNumber) return null;
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + (m || 0) + (tokenNumber - 1) * avgMinutes;
  const hh = Math.floor(totalMin / 60) % 24;
  const mm = totalMin % 60;
  const period = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
}

// ============ USER ROUTES ============

/**
 * POST /api/appointments/book
 * User books an appointment
 */
router.post('/book', authenticate, async (req, res) => {
  try {
    const { doctorId, appointmentDate, notes } = req.body;
    if (!doctorId || !appointmentDate) {
      return res.status(400).json({ error: 'Doctor and appointment date are required.' });
    }

    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });
    if (!doctor.onlineBooking) {
      return res.status(400).json({ error: 'This doctor does not accept online bookings.' });
    }

    // Check for duplicate pending/confirmed appointment
    const existing = await prisma.appointment.findFirst({
      where: {
        doctorId,
        userId: req.user.id,
        status: { in: ['PENDING', 'APPROVED', 'PAYMENT_PENDING', 'CONFIRMED'] },
      },
    });
    if (existing) {
      return res.status(409).json({ error: 'You already have an active appointment with this doctor.' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        doctorId,
        userId: req.user.id,
        appointmentDate: new Date(appointmentDate),
        fee: doctor.fee,
        paymentMethod: doctor.paymentMethod,
        paymentAccount: doctor.paymentAccount,
        notes: notes || null,
      },
    });

    res.status(201).json({ message: 'Appointment request submitted.', appointment });
  } catch (error) {
    console.error('Book appointment error:', error);
    res.status(500).json({ error: 'Failed to book appointment.' });
  }
});

/**
 * GET /api/appointments/my
 * User gets their appointments
 */
router.get('/my', authenticate, async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        doctor: {
          select: {
            id: true, name: true, specialty: true, clinicName: true,
            address: true, phone: true, fee: true, currentToken: true,
            paymentMethod: true, paymentAccount: true, startTime: true,
            endTime: true, avgConsultTime: true,
          },
        },
      },
    });
    res.json({ appointments });
  } catch (error) {
    console.error('My appointments error:', error);
    res.status(500).json({ error: 'Failed to load appointments.' });
  }
});

/**
 * PUT /api/appointments/:id/payment-proof
 * User uploads payment screenshot
 */
router.put('/:id/payment-proof', authenticate, uploadSingle, async (req, res) => {
  try {
    const appt = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!appt) return res.status(404).json({ error: 'Appointment not found.' });
    if (appt.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not your appointment.' });
    }
    if (!['APPROVED', 'PAYMENT_PENDING'].includes(appt.status)) {
      return res.status(400).json({ error: 'Payment proof can only be uploaded for approved appointments.' });
    }

    if (!req.file) return res.status(400).json({ error: 'Image is required.' });

    const imageUrl = await uploadToCloudinary(req.file, 'shahkot/payments');

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { paymentProof: imageUrl, status: 'PAYMENT_PENDING' },
    });

    res.json({ message: 'Payment proof uploaded.', appointment: updated });
  } catch (error) {
    console.error('Payment proof error:', error);
    res.status(500).json({ error: 'Failed to upload payment proof.' });
  }
});

/**
 * PUT /api/appointments/:id/cancel
 * User or doctor cancels
 */
router.put('/:id/cancel', authenticate, async (req, res) => {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { doctor: { select: { name: true } } },
    });
    if (!appt) return res.status(404).json({ error: 'Appointment not found.' });
    if (appt.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not your appointment.' });
    }
    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appt.status)) {
      return res.status(400).json({ error: 'Cannot cancel this appointment.' });
    }

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', cancelReason: req.body.reason || 'Cancelled by user' },
    });

    res.json({ message: 'Appointment cancelled.', appointment: updated });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({ error: 'Failed to cancel.' });
  }
});

// ============ DOCTOR ROUTES ============

/**
 * GET /api/appointments/doctor
 * Doctor gets their appointments
 */
router.get('/doctor', authenticateDoctor, async (req, res) => {
  try {
    const { status, date } = req.query;
    const where = { doctorId: req.doctorId };
    if (status) where.status = status;
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.appointmentDate = { gte: d, lt: next };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, phone: true, photoUrl: true } },
      },
    });
    res.json({ appointments });
  } catch (error) {
    console.error('Doctor appointments error:', error);
    res.status(500).json({ error: 'Failed to load appointments.' });
  }
});

/**
 * PUT /api/appointments/:id/approve
 * Doctor approves an appointment
 */
router.put('/:id/approve', authenticateDoctor, async (req, res) => {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { doctor: true },
    });
    if (!appt) return res.status(404).json({ error: 'Appointment not found.' });
    if (appt.doctorId !== req.doctorId) {
      return res.status(403).json({ error: 'Not your appointment.' });
    }
    if (appt.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending appointments can be approved.' });
    }

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED' },
    });

    // Notify user
    const paymentInfo = appt.doctor.paymentMethod && appt.doctor.paymentAccount
      ? `\n\nPayment: Send Rs.${appt.fee || appt.doctor.fee || 0} via ${appt.doctor.paymentMethod} to ${appt.doctor.paymentAccount}`
      : '';
    await sendPushToUser(
      appt.userId,
      'Appointment Approved! ✅',
      `Dr. ${appt.doctor.name} approved your appointment.${paymentInfo}\n\nPlease upload payment proof to confirm.`,
      { type: 'APPOINTMENT_APPROVED', appointmentId: appt.id }
    );

    res.json({ message: 'Appointment approved.', appointment: updated });
  } catch (error) {
    console.error('Approve appointment error:', error);
    res.status(500).json({ error: 'Failed to approve.' });
  }
});

/**
 * PUT /api/appointments/:id/reject
 * Doctor rejects an appointment
 */
router.put('/:id/reject', authenticateDoctor, async (req, res) => {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { doctor: { select: { name: true } } },
    });
    if (!appt) return res.status(404).json({ error: 'Appointment not found.' });
    if (appt.doctorId !== req.doctorId) {
      return res.status(403).json({ error: 'Not your appointment.' });
    }

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', cancelReason: req.body.reason || 'Rejected by doctor' },
    });

    await sendPushToUser(
      appt.userId,
      'Appointment Update',
      `Dr. ${appt.doctor.name} could not accept your appointment.${req.body.reason ? ' Reason: ' + req.body.reason : ''}`,
      { type: 'APPOINTMENT_REJECTED', appointmentId: appt.id }
    );

    res.json({ message: 'Appointment rejected.', appointment: updated });
  } catch (error) {
    console.error('Reject appointment error:', error);
    res.status(500).json({ error: 'Failed to reject.' });
  }
});

/**
 * PUT /api/appointments/:id/verify-payment
 * Doctor verifies payment and assigns token
 */
router.put('/:id/verify-payment', authenticateDoctor, async (req, res) => {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { doctor: true },
    });
    if (!appt) return res.status(404).json({ error: 'Appointment not found.' });
    if (appt.doctorId !== req.doctorId) {
      return res.status(403).json({ error: 'Not your appointment.' });
    }
    if (!appt.paymentProof) {
      return res.status(400).json({ error: 'No payment proof uploaded yet.' });
    }

    // Assign next token for the appointment date
    const dayStart = new Date(appt.appointmentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    // Use MAX(tokenNumber) across ALL statuses so that completed/no-show
    // appointments don't cause token numbers to be re-assigned.
    const maxResult = await prisma.appointment.aggregate({
      where: {
        doctorId: req.doctorId,
        appointmentDate: { gte: dayStart, lt: dayEnd },
        tokenNumber: { not: null },
      },
      _max: { tokenNumber: true },
    });

    const tokenNumber = (maxResult._max.tokenNumber || 0) + 1;
    const estimatedTime = calcEstimatedTime(
      appt.doctor.startTime,
      tokenNumber,
      appt.doctor.avgConsultTime || 15
    );

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: {
        status: 'CONFIRMED',
        paymentVerified: true,
        tokenNumber,
        estimatedTime,
      },
    });

    // Update doctor's total tokens for today
    await prisma.doctor.update({
      where: { id: req.doctorId },
      data: { totalTokensToday: tokenNumber },
    });

    // Notify user with token details
    await sendPushToUser(
      appt.userId,
      'Payment Confirmed! 🎫',
      `Your token number is #${tokenNumber}.\nEstimated time: ${estimatedTime || 'TBD'}\nDoctor: Dr. ${appt.doctor.name}`,
      { type: 'PAYMENT_CONFIRMED', appointmentId: appt.id, tokenNumber: String(tokenNumber) }
    );

    // Send confirmation email with token details
    const user = await prisma.user.findUnique({ where: { id: appt.userId }, select: { email: true, name: true } });
    if (user?.email) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:linear-gradient(135deg,#10B981,#059669);padding:30px;border-radius:10px 10px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;">🎫 Token Confirmed!</h1>
          </div>
          <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px;">
            <h2 style="color:#333;">Hello ${user.name || 'Patient'},</h2>
            <p>Your appointment with <strong>Dr. ${appt.doctor.name}</strong> has been confirmed.</p>
            <div style="background:#fff;border:2px solid #10B981;border-radius:10px;padding:20px;text-align:center;margin:16px 0;">
              <p style="margin:0;font-size:14px;color:#666;">Your Token Number</p>
              <h1 style="margin:8px 0;font-size:48px;color:#10B981;">#${tokenNumber}</h1>
              <p style="margin:0;font-size:14px;color:#666;">Estimated Time: ${estimatedTime || 'TBD'}</p>
            </div>
            <p style="color:#666;">Fee: Rs. ${appt.fee || appt.doctor.fee || 'N/A'}</p>
            <p style="color:#888;font-size:12px;">Please arrive on time. You can track the live token in the app.</p>
          </div>
        </div>`;
      sendEmail(user.email, `Token #${tokenNumber} Confirmed - Dr. ${appt.doctor.name}`, html).catch(e => console.error('Token email error:', e));
    }

    res.json({ message: 'Payment verified, token assigned.', appointment: updated });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment.' });
  }
});

/**
 * PUT /api/appointments/:id/complete
 * Doctor marks appointment done → auto-advance currentToken
 */
router.put('/:id/complete', authenticateDoctor, async (req, res) => {
  try {
    const appt = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!appt) return res.status(404).json({ error: 'Appointment not found.' });
    if (appt.doctorId !== req.doctorId) {
      return res.status(403).json({ error: 'Not your appointment.' });
    }

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED' },
    });

    // Auto-advance doctor’s currentToken to the next confirmed token
    if (appt.tokenNumber) {
      await prisma.doctor.update({
        where: { id: req.doctorId },
        data: { currentToken: appt.tokenNumber + 1 },
      });
    }

    res.json({ message: 'Appointment completed.', appointment: updated });
  } catch (error) {
    console.error('Complete appointment error:', error);
    res.status(500).json({ error: 'Failed to update.' });
  }
});

/**
 * PUT /api/appointments/:id/no-show
 * Doctor marks no-show → auto-advance currentToken
 */
router.put('/:id/no-show', authenticateDoctor, async (req, res) => {
  try {
    const appt = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!appt) return res.status(404).json({ error: 'Appointment not found.' });
    if (appt.doctorId !== req.doctorId) {
      return res.status(403).json({ error: 'Not your appointment.' });
    }

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'NO_SHOW' },
    });

    // Auto-advance doctor’s currentToken on no-show too
    if (appt.tokenNumber) {
      await prisma.doctor.update({
        where: { id: req.doctorId },
        data: { currentToken: appt.tokenNumber + 1 },
      });
    }

    res.json({ message: 'Marked as no-show.', appointment: updated });
  } catch (error) {
    console.error('No-show error:', error);
    res.status(500).json({ error: 'Failed to update.' });
  }
});

/**
 * GET /api/appointments/live-token/:doctorId
 * PUBLIC — returns currentToken for a doctor (for user-side live polling)
 */
router.get('/live-token/:doctorId', async (req, res) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.doctorId },
      select: { id: true, name: true, currentToken: true, totalTokensToday: true },
    });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load token.' });
  }
});

/**
 * GET /api/appointments/:id
 * Get appointment detail
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: {
        doctor: {
          select: {
            id: true, name: true, specialty: true, clinicName: true,
            address: true, phone: true, fee: true, currentToken: true,
            paymentMethod: true, paymentAccount: true,
          },
        },
        user: { select: { id: true, name: true, phone: true, photoUrl: true } },
      },
    });
    if (!appt) return res.status(404).json({ error: 'Appointment not found.' });
    res.json(appt);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load appointment.' });
  }
});

module.exports = router;
