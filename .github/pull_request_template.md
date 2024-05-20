## Title: 
<!--please follow this pattern for PR title "protocol_name : protocol_category : other comments". Example - "uniswap: dex : tvl by user"-->
- [ ] Pattern for PR title "protocol_name : protocol_category : other comments". Example - "uniswap: dex : tvl by user"

## Checklist before requesting a review
1. **index.ts file**

     - [ ] **Contains function**

            ```export const getUserTVLByBlock = async (blocks: BlockData) => {
                const { blockNumber, blockTimestamp } = blocks
                    //    Retrieve data using block number and timestamp
                    // YOUR LOGIC HERE
                
                return csvRows

            };
            ``` 
    - [ ] **getUserTVLByBlock function takes input with this schema**
        
            ``` 
                interface BlockData {
                    blockNumber: number;
                    blockTimestamp: number;
                }
            ```
    - [ ] **getUserTVLByBlock function returns output in this schema**

                ```
                const csvRows: OutputDataSchemaRow[] = [];

                type OutputDataSchemaRow = {
                    block_number: number;  //block_number which was given as input
                    timestamp: number;     // block timestamp which was given an input, epoch format
                    user_address: string;   // wallet address, all lowercase
                    token_address: string;  // token address all lowercase
                    token_balance: bigint;  // token balance, raw amount. Please dont divide by decimals
                    token_symbol: string; //token symbol should be empty string if it is not available
                    usd_price: number; //assign 0 if not available
                };
                ```
    - [ ] **contains function**

            ```
                const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
                const blocks: BlockData[] = [];

                await new Promise<void>((resolve, reject) => {
                    fs.createReadStream(filePath)
                    .pipe(csv()) // Specify the separator as '\t' for TSV files
                    .on('data', (row) => {
                        const blockNumber = parseInt(row.number, 10);
                        const blockTimestamp = parseInt(row.timestamp, 10);
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

            ```
    - [ ] **has this code**
           
            ```
            readBlocksFromCSV('hourly_blocks.csv').then(async (blocks: any[]) => {
            console.log(blocks);
            const allCsvRows: any[] = []; 

            for (const block of blocks) {
                try {
                    const result = await getUserTVLByBlock(block);
                    allCsvRows.push(...result);
                } catch (error) {
                    console.error(`An error occurred for block ${block}:`, error);
                }
            }
            await new Promise((resolve, reject) => {
                const ws = fs.createWriteStream(`outputData.csv`, { flags: 'w' });
                write(allCsvRows, { headers: true })
                    .pipe(ws)
                    .on("finish", () => {
                    console.log(`CSV file has been written.`);
                    resolve;
                    });
            });

            }).catch((err) => {
            console.error('Error reading CSV file:', err);
            });
        ```
2. **Output data**
    - [ ] Data is returned for underlying tokens only. Not for special tokens (lp/veTokens etc)
    - [ ] Follows the exact sequence mentioned in OutputDataSchemaRow . This is needed as we want same column ordering in output csv
    - Value of each field is :
        - [ ] block_number *is same as input block number. This signifies TVL is as of this block_number.*
        - [ ] timestamp is same as input timestamp. This signifies TVL is as of this timestamp. It is in epoch format.
        - [ ] user_address is in lowercase
        - [ ] token_address is in lowercase
        - [ ] token_balance is in raw amount. Please dont divide by decimals.
        - [ ] token_symbol value if present, empty string if value is not available.
        - [ ] usd_price if value is available, 0 if value is not available.
