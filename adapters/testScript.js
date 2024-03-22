// runScript.js
const fs = require('fs');
const path = require('path');

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

// Call the getUserTVLByBlock function with desired arguments
getUserTVLByBlock({
    blockTimestamp: 1711023841,
    blockNumber: 3041467
}).then((result) => {
    if(!result || result.length){
      throw new Error('No data found');
    }
});




