const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const rating = require("./rating.model");
const dokter = require("../dokter/dokter.model");
const verifyToken = require("../middleware/verifyToken");

router.post('/create', masyarakatAuthorization, async (req, res) => {
   try {
     const {
       jadwal,
       dokter_id,
       rating: ratingValue
     } = req.body;
      if (!jadwal || !dokter_id || ratingValue === undefined) {
       return res.status(400).json({
         success: false,
         message: 'Semua field harus diisi (jadwal, dokter_id, rating)'
       });
     }
      if (ratingValue < 0 || ratingValue > 5) {
       return res.status(400).json({
         success: false,
         message: 'Rating harus antara 0-5'
       });
     }
      const existingRating = await rating.findOne({
       jadwal: jadwal,
       masyarakat_id: req.user.id
     });
      if (existingRating) {
       return res.status(400).json({
         success: false,
         message: 'Anda sudah memberikan rating untuk konsultasi ini'
       });
     }
      const newRating = await rating.create({
       jadwal: jadwal,
       masyarakat_id: req.user.id,
       dokter_id: dokter_id,
       rating: ratingValue
     });
      await updateDoctorAverageRating(dokter_id);
      res.status(201).json({
       success: true,
       message: 'Rating berhasil disimpan',
       data: newRating
     });
    } catch (error) {
     console.error('Error creating rating:', error);
    
     if (error.code === 11000) {
       return res.status(400).json({
         success: false,
         message: 'Anda sudah memberikan rating untuk konsultasi ini'
       });
     }
    
     res.status(500).json({
       success: false,
       message: 'Terjadi kesalahan server',
       error: error.message
     });
   }
});
 async function updateDoctorAverageRating(dokterId) {
 try {
   const result = await rating.aggregate([
     { $match: { dokter_id: dokterId } },
     {
       $group: {
         _id: "$dokter_id",
         averageRating: { $avg: "$rating" },
         totalRatings: { $sum: 1 }
       }
     }
   ]);


   if (result.length > 0) {
     const updatedDokter = await dokter.findByIdAndUpdate(
       dokterId,
       {
         rating_dokter: parseFloat(result[0].averageRating.toFixed(2)),
         total_ratings: result[0].totalRatings
       },
       { new: true }
     );
     console.log('Doctor rating updated:', updatedDokter);
   }
 } catch (err) {
   console.error('Error updating doctor rating:', err);
 }
}

// cek apakah user yg login sudah memberikan rating untuk jadwal yang dipilih
router.get('/getbyid/:jadwal', verifyToken, async (req, res) => {
 try {
   const { jadwal } = req.params;


   if (!jadwal) {
     return res.status(400).json({
       success: false,
       message: 'jadwal harus disediakan'
     });
   }


   if (!mongoose.Types.ObjectId.isValid(jadwal)) {
     return res.status(400).json({
       success: false,
       message: 'Format jadwal tidak valid'
     });
   }


   const existingRating = await rating.findOne({
     jadwal: jadwal,
     masyarakat_id: req.user.id
   });


   if (existingRating) {
     return res.status(200).json({
       success: true,
       message: 'Rating sudah ada',
       data: {
         hasRating: true,
         rating: existingRating
       }
     });
   } else {
     return res.status(200).json({
       success: true,
       message: 'Belum ada rating',
       data: {
         hasRating: false,
         rating: null
       }
     });
   }


 } catch (error) {
   console.error('Error checking rating:', error);
   res.status(500).json({
     success: false,
     message: 'Terjadi kesalahan server',
     error: error.message
   });
 }
});

// untuk melihat semua rating yang user login berikan kepada dokter
router.get('/masyarakat/getall', verifyToken, async (req, res) => {
 try {
   const ratings = await rating.find({
     masyarakat_id: req.user.id
   })
   .populate('dokter_id', 'nama_dokter spesialis_dokter')
   .populate('jadwal', 'tanggal jam')
   .sort({ createdAt: -1 });


   res.status(200).json({
     success: true,
     message: 'Data rating berhasil diambil',
     data: ratings
   });

 } catch (error) {
   console.error('Error getting user ratings:', error);
   res.status(500).json({
     success: false,
     message: 'Terjadi kesalahan server',
     error: error.message
   });
 }
});

// GET endpoint untuk mendapatkan semua rating untuk dokter tertentu (untuk dokter melihat rating mereka)
router.get('/dokter/:dokter_id', verifyToken, async (req, res) => {
 try {
   const { dokter_id } = req.params;

   // Validasi ObjectId format
   if (!mongoose.Types.ObjectId.isValid(dokter_id)) {
     return res.status(400).json({
       success: false,
       message: 'Format dokter_id tidak valid'
     });
   }
   const ratings = await rating.find({
     dokter_id: dokter_id
   })
   .populate('masyarakat_id', 'nama')
   .populate('jadwal', 'tanggal jam')
   .sort({ createdAt: -1 });

   res.status(200).json({
     success: true,
     message: 'Data rating dokter berhasil diambil',
     data: ratings
   });
 } catch (error) {
   console.error('Error getting doctor ratings:', error);
   res.status(500).json({
     success: false,
     message: 'Terjadi kesalahan server',
     error: error.message
   });
 }
});

module.exports = router;