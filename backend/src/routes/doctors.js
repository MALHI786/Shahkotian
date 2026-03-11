const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ---------- Replication helpers (multi-DB) ----------
async function replicateDoctorToOtherDBs(doctor) {
  try {
    const manager = prisma.__dbManager;
    if (!manager || !manager.databases || manager.databases.length <= 1) return;
    for (const db of manager.databases) {
      try {
        if (db.index === manager.activeIndex) continue;
        // ensure client
        if (!db.client) {
          db.client = manager.createClient(db.url);
          await db.client.$connect();
        }
        // Upsert by id to replicate
        const client = db.client;
        const data = { ...doctor };
        // Remove nested relations to avoid nested create errors
        delete data.appointments;
        // Prisma client on other DBs may not accept undefined values for Date objects;
        // ensure createdAt/updatedAt are passed as ISO strings
        if (data.createdAt) data.createdAt = new Date(data.createdAt);
        if (data.updatedAt) data.updatedAt = new Date(data.updatedAt);
        await client.doctor.upsert({
          where: { id: doctor.id },
          create: data,
          update: data,
        });
      } catch (e) {
        // don't fail the whole operation; log and continue
        console.warn(`[DB REPL] replicateDoctor to DB#${db.index} failed: ${e.message}`);
      }
    }
  } catch (e) {
    console.warn('[DB REPL] replication error:', e.message);
  }
}

async function deleteDoctorFromAllDBsById(id) {
  try {
    const manager = prisma.__dbManager;
    if (!manager || !manager.databases || manager.databases.length === 0) return;
    for (const db of manager.databases) {
      try {
        if (!db.client) {
          db.client = manager.createClient(db.url);
          await db.client.$connect();
        }
        await db.client.doctor.delete({ where: { id } });
      } catch (e) {
        // ignore P2025 (not found) and continue
        if (e.code !== 'P2025') console.warn(`[DB REPL] delete doctor on DB#${db.index} failed: ${e.message}`);
      }
    }
  } catch (e) {
    console.warn('[DB REPL] delete replication error:', e.message);
  }
}
// ── Doctor Auth Middleware ────────────────────────────────────────────
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

// ============ PUBLIC ROUTES ============

/**
 * GET /api/doctors
 */
router.get('/', async (req, res) => {
  try {
    const { search, specialty, page = 1 } = req.query;
    const limit = 50;
    const where = {};
    if (specialty && specialty !== 'ALL') where.specialty = specialty;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { clinicName: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        skip: (parseInt(page) - 1) * limit,
        take: limit,
        orderBy: [{ isAvailableNow: 'desc' }, { isVerified: 'desc' }, { name: 'asc' }],
        select: {
          id: true, name: true, specialty: true, clinicName: true,
          address: true, phone: true, whatsapp: true, timings: true,
          fee: true, education: true, experience: true, isVerified: true,
          onlineBooking: true, paymentMethod: true, startTime: true,
          endTime: true, avgConsultTime: true, currentToken: true,
          weekdays: true, isAvailableNow: true, createdAt: true,
        },
      }),
      prisma.doctor.count({ where }),
    ]);

    res.json({
      doctors,
      pagination: { page: parseInt(page), limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({ error: 'Failed to load doctors.' });
  }
});

/**
 * GET /api/doctors/specialties
 */
router.get('/specialties', async (req, res) => {
  try {
    const specialties = [
      { key: 'GENERAL_PHYSICIAN', label: 'General Physician', icon: '👨‍⚕️' },
      { key: 'PEDIATRICIAN', label: 'Child Specialist', icon: '👶' },
      { key: 'GYNECOLOGIST', label: 'Gynecologist', icon: '🤰' },
      { key: 'CARDIOLOGIST', label: 'Heart Specialist', icon: '❤️' },
      { key: 'DERMATOLOGIST', label: 'Skin Specialist', icon: '🧴' },
      { key: 'ENT', label: 'ENT Specialist', icon: '👂' },
      { key: 'ORTHOPEDIC', label: 'Bone & Joint', icon: '🦴' },
      { key: 'DENTIST', label: 'Dentist', icon: '🦷' },
      { key: 'OPHTHALMOLOGIST', label: 'Eye Specialist', icon: '👁️' },
      { key: 'NEUROLOGIST', label: 'Neurologist', icon: '🧠' },
      { key: 'PSYCHIATRIST', label: 'Psychiatrist', icon: '🧘' },
      { key: 'UROLOGIST', label: 'Urologist', icon: '💧' },
      { key: 'HOMEOPATHIC', label: 'Homeopathic', icon: '🌿' },
      { key: 'HAKEEM', label: 'Hakeem', icon: '🍃' },
      { key: 'OTHER', label: 'Other', icon: '➕' },
    ];
    const counts = await prisma.doctor.groupBy({
      by: ['specialty'],
      _count: { specialty: true },
    });
    const countMap = {};
    counts.forEach((c) => { countMap[c.specialty] = c._count.specialty; });
    res.json({ specialties: specialties.map((s) => ({ ...s, count: countMap[s.key] || 0 })) });
  } catch (error) {
    console.error('Get specialties error:', error);
    res.status(500).json({ error: 'Failed to load specialties.' });
  }
});

// ── Doctor Auth ──────────────────────────────────────────────────────

/**
 * POST /api/doctors/auth/login
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const doctor = await prisma.doctor.findUnique({ where: { email } });
    if (!doctor || !doctor.password) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const valid = await bcrypt.compare(password, doctor.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = jwt.sign(
      { doctorId: doctor.id, type: 'DOCTOR' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, doctor: { id: doctor.id, name: doctor.name, specialty: doctor.specialty } });
  } catch (error) {
    console.error('Doctor login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

/**
 * GET /api/doctors/me/profile
 */
router.get('/me/profile', authenticateDoctor, async (req, res) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.doctorId },
      select: {
        id: true, name: true, specialty: true, clinicName: true,
        address: true, phone: true, whatsapp: true, timings: true,
        fee: true, education: true, experience: true, isVerified: true,
        email: true, onlineBooking: true, paymentMethod: true,
        paymentAccount: true, startTime: true, endTime: true,
        avgConsultTime: true, currentToken: true, totalTokensToday: true,
        weekdays: true, isAvailableNow: true,
      },
    });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

/**
 * PUT /api/doctors/me/profile
 */
router.put('/me/profile', authenticateDoctor, async (req, res) => {
  try {
    const allowed = [
      'clinicName', 'address', 'phone', 'whatsapp', 'timings', 'fee',
      'education', 'experience', 'onlineBooking', 'paymentMethod',
      'paymentAccount', 'startTime', 'endTime', 'avgConsultTime',
      'weekdays', 'isAvailableNow',
    ];
    const data = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) {
        if (k === 'fee' || k === 'avgConsultTime') data[k] = parseInt(req.body[k], 10) || 0;
        else if (k === 'onlineBooking' || k === 'isAvailableNow') data[k] = !!req.body[k];
        else data[k] = req.body[k];
      }
    });
    const doctor = await prisma.doctor.update({ where: { id: req.doctorId }, data });
    res.json({ message: 'Profile updated.', doctor });
  } catch (error) {
    console.error('Doctor update error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

/**
 * GET /api/doctors/me/dashboard
 */
router.get('/me/dashboard', authenticateDoctor, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [doctor, todayAppointments, allStats] = await Promise.all([
      prisma.doctor.findUnique({
        where: { id: req.doctorId },
        select: {
          id: true, name: true, currentToken: true, totalTokensToday: true,
          onlineBooking: true, paymentMethod: true, paymentAccount: true,
          startTime: true, endTime: true, avgConsultTime: true, fee: true,
          weekdays: true, isAvailableNow: true,
        },
      }),
      prisma.appointment.findMany({
        where: {
          doctorId: req.doctorId,
          appointmentDate: { gte: today, lt: tomorrow },
        },
        orderBy: { tokenNumber: 'asc' },
        include: {
          user: { select: { id: true, name: true, phone: true, photoUrl: true } },
        },
      }),
      prisma.appointment.groupBy({
        by: ['status'],
        where: { doctorId: req.doctorId },
        _count: { status: true },
      }),
    ]);

    const stats = {};
    allStats.forEach((s) => { stats[s.status] = s._count.status; });

    res.json({ doctor, todayAppointments, stats });
  } catch (error) {
    console.error('Doctor dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
});

/**
 * PUT /api/doctors/me/current-token
 */
router.put('/me/current-token', authenticateDoctor, async (req, res) => {
  try {
    const { currentToken } = req.body;
    const doctor = await prisma.doctor.update({
      where: { id: req.doctorId },
      data: { currentToken: parseInt(currentToken, 10) || 0 },
    });
    res.json({ message: 'Token updated.', currentToken: doctor.currentToken });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update token.' });
  }
});

/**
 * GET /api/doctors/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, specialty: true, clinicName: true,
        address: true, phone: true, whatsapp: true, timings: true,
        fee: true, education: true, experience: true, isVerified: true,
        onlineBooking: true, paymentMethod: true, startTime: true,
        endTime: true, avgConsultTime: true, currentToken: true,
        createdAt: true,
      },
    });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });
    res.json(doctor);
  } catch (error) {
    console.error('Get doctor error:', error);
    res.status(500).json({ error: 'Failed to load doctor.' });
  }
});

// ============ ADMIN ROUTES ============

/**
 * POST /api/doctors  (admin — with optional email/password for doctor login)
 */
router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const {
      name, specialty, clinicName, address, phone, whatsapp,
      timings, fee, education, experience, isVerified,
      latitude, longitude, email, password, onlineBooking,
      paymentMethod, paymentAccount, startTime, endTime, avgConsultTime, weekdays,
    } = req.body;

    if (!name || !specialty || !address || !phone) {
      return res.status(400).json({ error: 'Name, specialty, address, and phone are required.' });
    }

    let hashedPassword = null;
    if (email && password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }
      const existing = await prisma.doctor.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: 'A doctor with this email already exists.' });
      }
      hashedPassword = await bcrypt.hash(password, 12);
    }

    const doctor = await prisma.doctor.create({
      data: {
        name,
        specialty,
        clinicName: clinicName || null,
        address,
        phone,
        whatsapp: whatsapp || phone,
        timings: timings || null,
        fee: fee ? parseInt(fee, 10) : null,
        education: education || null,
        experience: experience || null,
        isVerified: isVerified || false,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        email: email || null,
        password: hashedPassword,
        onlineBooking: onlineBooking || false,
        paymentMethod: paymentMethod || null,
        paymentAccount: paymentAccount || null,
        startTime: startTime || null,
        endTime: endTime || null,
        avgConsultTime: avgConsultTime ? parseInt(avgConsultTime, 10) : 15,
        weekdays: weekdays || null,
      },
    });
    // Replicate to other DBs in background (best-effort)
    replicateDoctorToOtherDBs(doctor).catch(() => {});

    res.status(201).json({ message: 'Doctor added successfully.', doctor });
  } catch (error) {
    console.error('Add doctor error:', error);
    res.status(500).json({ error: 'Failed to add doctor.' });
  }
});

/**
 * PUT /api/doctors/:id  (admin)
 */
router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const existing = await prisma.doctor.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Doctor not found.' });

    const {
      name, specialty, clinicName, address, phone, whatsapp,
      timings, fee, education, experience, isVerified,
      latitude, longitude, email, password, onlineBooking,
      paymentMethod, paymentAccount, startTime, endTime, avgConsultTime,
      weekdays, isAvailableNow,
    } = req.body;

    const data = {};
    if (name) data.name = name;
    if (specialty) data.specialty = specialty;
    if (clinicName !== undefined) data.clinicName = clinicName;
    if (address) data.address = address;
    if (phone) data.phone = phone;
    if (whatsapp !== undefined) data.whatsapp = whatsapp;
    if (timings !== undefined) data.timings = timings;
    if (fee !== undefined) data.fee = fee ? parseInt(fee, 10) : null;
    if (education !== undefined) data.education = education;
    if (experience !== undefined) data.experience = experience;
    if (isVerified !== undefined) data.isVerified = isVerified;
    if (latitude !== undefined) data.latitude = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined) data.longitude = longitude ? parseFloat(longitude) : null;
    if (email !== undefined) data.email = email || null;
    if (onlineBooking !== undefined) data.onlineBooking = onlineBooking;
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod;
    if (paymentAccount !== undefined) data.paymentAccount = paymentAccount;
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime !== undefined) data.endTime = endTime;
    if (avgConsultTime !== undefined) data.avgConsultTime = parseInt(avgConsultTime, 10) || 15;
    if (weekdays !== undefined) data.weekdays = weekdays;
    if (isAvailableNow !== undefined) data.isAvailableNow = !!isAvailableNow;

    if (password) {
      data.password = await bcrypt.hash(password, 12);
    }

    const doctor = await prisma.doctor.update({ where: { id: req.params.id }, data });
    // Replicate update across other DBs
    replicateDoctorToOtherDBs(doctor).catch(() => {});
    res.json({ message: 'Doctor updated.', doctor });
  } catch (error) {
    console.error('Update doctor error:', error);
    res.status(500).json({ error: 'Failed to update doctor.' });
  }
});

/**
 * DELETE /api/doctors/:id  (admin)
 */
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const existing = await prisma.doctor.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Doctor not found.' });
    await prisma.appointment.deleteMany({ where: { doctorId: req.params.id } });
    await prisma.doctor.delete({ where: { id: req.params.id } });
    // Also delete from other DBs (best-effort)
    deleteDoctorFromAllDBsById(req.params.id).catch(() => {});
    res.json({ message: 'Doctor deleted.' });
  } catch (error) {
    console.error('Delete doctor error:', error);
    res.status(500).json({ error: 'Failed to delete doctor.' });
  }
});

module.exports = router;
