const fs = require('fs');
const path = require('path');

const csv = require('csv-parser');
const { write } =require('fast-csv');

// Get the folder name from command line arguments
const folderName = process.argv[2];

if (!folderName) {
  console.error('Folder name not provided. Please provide the folder name as an argument.');
  process.exit(1);
}

// Get the absolute path of the provided folder
const folderPath = path.resolve(folderName);

// Check if the provided folder exists
if (!fs.existsSync(folderPath)) {
  console.error(`Folder '${folderName}' does not exist.`);
  process.exit(1);
}

// Check if the provided folder contains index.ts file
const indexPath = path.join(folderPath, 'dist/index.js');
if (!fs.existsSync(indexPath)) {
  console.error(`Folder '${folderName}' does not contain index.ts file.`);
  process.exit(1);
}

// Import the funct function from the provided folder
const { getUserTVLByBlock } = require(indexPath);

const readBlocksFromCSV = async (filePath) => {
  const blocks = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ separator: '\t' })) // Specify the separator as '\t' for TSV files
      .on('data', (row) => {
        const blockNumber = parseInt(row.number, 10);
        const blockTimestamp = parseInt(row.block_timestamp, 10);
        if (!isNaN(blockNumber) && blockTimestamp) {
          blocks.push({ blockNumber: blockNumber, blockTimestamp });
        }
      })
      .on('end', () => {
        resolve();
      })
      .on('error', (err) => {
        reject(err);
      });
  });

  return blocks;
};

readBlocksFromCSV('block_numbers.tsv')
.then(async (blocks) => {
  const allCsvRows = []; // Array to accumulate CSV rows for all blocks
  const batchSize = 10; // Size of batch to trigger writing to the file
  let i = 0;

  for (const block of blocks) {
    try {
      const result = await getUserTVLByBlock(block);

      // Accumulate CSV rows for all blocks
      allCsvRows.push(...result);

      i++;
      console.log(`Processed block ${i}`);

      // Write to file when batch size is reached or at the end of loop
      if (i % batchSize === 0 || i === blocks.length) {
        const ws = fs.createWriteStream(`${folderName}/outputData.csv`, { flags: i === batchSize ? 'w' : 'a' });
        write(allCsvRows, { headers: i === batchSize ? true : false })
          .pipe(ws)
          .on("finish", () => {
            console.log(`CSV file has been written.`);
          });

        // Clear the accumulated CSV rows
        allCsvRows.length = 0;
      }
    } catch (error) {
      console.error(`An error occurred for block ${block}:`, error);
    }

  }
})
.catch((err) => {
  console.error('Error reading CSV file:', err);
});
