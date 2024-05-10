## Title: 
<!--please follow this pattern for PR title "protocol_name : protocol_category : other comments". Example - "uniswap: dex : tvl by user"-->

## Please identify your 
<!--- Why is this change required? What problem does it solve? -->
<!--- If it fixes an open issue, please link to the issue here. -->

## How Has This Been Tested?
<!--- Please describe in detail how you tested your changes. -->
<!--- Include details of your testing environment, and the tests you ran to -->
<!--- see how your change affects other areas of the code, etc. -->


## Checklist before requesting a review
1. index.ts file contains
     - [ ]
     - [ ] function 
            ```
            export const getUserTVLByBlock = async (blocks: BlockData) => {
                const { blockNumber, blockTimestamp } = blocks
                    //    Retrieve data using block number and timestamp
                    // YOUR LOGIC HERE
                
                return csvRows

            };
            ``` 
    - [ ] getUserTVLByBlock function takes input with this schema
                ``` 
            interface BlockData {
                blockNumber: number;
                blockTimestamp: number;
            }
            ```
    - [ ] getUserTVLByBlock function returns output in this schema 
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