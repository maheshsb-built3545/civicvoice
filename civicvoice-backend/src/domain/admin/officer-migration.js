const Officer = require('../../models/Officer');
const logger = require('../../utils/logger');

async function migrateOfficerSchema() {
  try {
    const officers = await Officer.find({});
    let migratedCount = 0;
    
    for (const officer of officers) {
      let updated = false;

      // Handle legacy single ward field if it exists (e.g. string or ObjectId)
      const legacyWard = officer.get('ward');
      if (legacyWard && (!officer.wardIds || officer.wardIds.length === 0)) {
        officer.wardIds = [legacyWard];
        officer.set('ward', undefined);
        updated = true;
      }

      // Handle legacy single category field if it exists
      const legacyCategory = officer.get('category');
      if (legacyCategory && (!officer.categories || officer.categories.length === 0)) {
        officer.categories = [legacyCategory];
        officer.set('category', undefined);
        updated = true;
      }

      if (updated) {
        await officer.save();
        migratedCount++;
      }
    }
    
    if (migratedCount > 0) {
      logger.info(`Migrated ${migratedCount} legacy officer documents to arrays.`);
    }
  } catch (err) {
    logger.error('Failed to run officer schema migration', { error: err.message });
  }
}

module.exports = migrateOfficerSchema;
