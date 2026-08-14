const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { resolveWard } = require('../src/geo/wardResolver');
const Complaint = require('../src/models/Complaint');
const Officer = require('../src/models/Officer');
const Ward = require('../src/models/Ward');

async function run() {
  await connectDB();

  try {
    // 1. Test the keyword hack ward resolution
    console.log('--- Testing resolveWard keyword hack ---');
    const res1 = await resolveWard({ locationText: 'Broken road near Sanjivani College' });
    console.log('Result for "Sanjivani College" text:', res1);

    const res2 = await resolveWard({ locationText: 'Pothole on Saidham Road' }); // normal Pune/Kopargaon text
    console.log('Result for "Saidham Road" text:', res2);

    // 2. Fix database data relationships for existing complaints
    console.log('\n--- Repairing database demo data ---');
    const sanjivaniWard = await Ward.findOne({ name: 'Sanjivani Campus Ward' });
    const kojagiriWard = await Ward.findOne({ name: 'Kojagiri' });
    const anitaOfficer = await Officer.findOne({ name: 'Anita Deshmukh' });
    const kavitaOfficer = await Officer.findOne({ name: 'Kavita More' });

    if (sanjivaniWard && anitaOfficer) {
      // Find complaints containing 'sanjivani' or 'college' and correct them to Sanjivani Campus Ward and Anita
      const correctedCount = await Complaint.updateMany(
        { 
          $or: [
            { rawText: /sanjivani|college/i },
            { 'structured.description': /sanjivani|college/i }
          ]
        },
        {
          wardId: sanjivaniWard._id,
          assignedOfficerId: anitaOfficer._id,
          status: 'assigned'
        }
      );
      console.log(`Updated ${correctedCount.modifiedCount} complaints to Sanjivani Campus Ward and Anita Deshmukh`);
    }

    if (kojagiriWard && kavitaOfficer) {
      // Find remaining Kojagiri complaints and assign them to Kavita More
      const correctedKojagiri = await Complaint.updateMany(
        { wardId: kojagiriWard._id },
        { 
          assignedOfficerId: kavitaOfficer._id,
          status: 'assigned'
        }
      );
      console.log(`Updated ${correctedKojagiri.modifiedCount} Kojagiri complaints to Kavita More`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
