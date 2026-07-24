const fs = require('node:fs');
const path = require('node:path');

const MEDIA_FIELDS = {
  id: 'number',
  type: 'string',
  title: 'string',
  description: 'string',
  rating: 'number',
  voteCount: 'number',
  popularity: 'number',
  releaseDate: 'string',
  posterPath: 'string',
  backdropPath: 'string',
  mediaType: 'string',
  genreTitle: 'string'
};

function getPath(value, pathParts) {
  return pathParts.reduce((current, part) => current?.[part], value);
}

function collectMediaRecords(value, records = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === 'object' && !Array.isArray(item) && 'id' in item) {
        records.push(item);
      } else {
        collectMediaRecords(item, records);
      }
    }
  } else if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      collectMediaRecords(nested, records);
    }
  }
  return records;
}

function validateMediaRecord(record, label) {
  for (const [field, expectedType] of Object.entries(MEDIA_FIELDS)) {
    if (typeof record[field] !== expectedType || (expectedType === 'number' && !Number.isFinite(record[field]))) {
      throw new Error(`${label}: field "${field}" must be a ${expectedType}.`);
    }
  }

  if (record.type !== 'tmdb') {
    throw new Error(`${label}: field "type" must be "tmdb".`);
  }
  if (!['movie', 'tv'].includes(record.mediaType)) {
    throw new Error(`${label}: field "mediaType" must be "movie" or "tv".`);
  }
}

function validateData(data, { requiredCollections = [], requiredCollectionGroups = [] } = {}) {
  const records = collectMediaRecords(data);
  if (records.length === 0) {
    throw new Error('No media records were generated; the existing data file was preserved.');
  }

  records.forEach((record, index) => validateMediaRecord(record, `Record ${index + 1}`));

  for (const collectionPath of requiredCollections) {
    const collection = getPath(data, collectionPath);
    if (!Array.isArray(collection) || collection.length === 0) {
      throw new Error(`Required collection "${collectionPath.join('.')}" is empty; the existing data file was preserved.`);
    }
  }

  for (const collectionGroup of requiredCollectionGroups) {
    const count = collectionGroup.paths.reduce((total, collectionPath) => {
      const collection = getPath(data, collectionPath);
      return total + (Array.isArray(collection) ? collection.length : 0);
    }, 0);
    if (count === 0) {
      throw new Error(`Required collection group "${collectionGroup.label}" is empty; the existing data file was preserved.`);
    }
  }

  return records.length;
}

function writeValidatedJson(filePath, data, options = {}) {
  const recordCount = validateData(data, options);
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });

  const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);

  console.log(`[data] ${options.label || path.basename(filePath)}: validated ${recordCount} media records and wrote ${filePath}.`);
  return recordCount;
}

module.exports = { validateData, writeValidatedJson };
