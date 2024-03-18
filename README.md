# L2 Liquidity Reward Program
## TVL by User - Adapters

### Background
Welcome to the L2-Liquidity-Reward Program! We've partnered with OpenBlock Labs to provide analysis and evaluation. Please follow the documentation below to satisfy your protocol’s data requirements. Failure to comply with these standards will result in disqualification from the incentive distribution.

### Onboarding Checklist
To finalize your enrollment and confirm eligibility, please complete the following:


1.  Set up a subquery indexer (e.g. Goldsky Subgraph)
    1.  Follow the docs here: https://docs.goldsky.com/guides/create-a-no-code-subgraph
2.  Prepare Subquery query code according to the data requirement section below.
3.  Submit your response as a Pull Request to: https://github.com/delta-hq/l2-lxp-liquidity-reward
    1.  With path being ‘/<your_protocol_handle>’ 
4.  Submit your contract addresses through this [Form](https://forms.gle/DJ2975hZwhz32t5r6)

### Data Requirement
Goal: **Hourly snapshot of TVL by User by Asset**

For each protocol, we are looking for the following: 
1.  Query that fetches all relevant events required to calculate User TVL in the Protocol at hourly level.
2.  Code that uses the above query, fetches all the data and converts it to csv file in below given format.

Teams can refer to the example we have in there to write the code required.

### Output Data Schema

| Data Field                | Notes                                                                                  |
|---------------------------|----------------------------------------------------------------------------------------|
| block_number              |                                                                                        |
| timestamp                 |                                                                                        |
| user_address              |                                                                                        |
| token_address             |                                                                                        |
| token_symbol (optional)   | Symbol of token                                                                        |
| token_balance             | Balance of token (If the token was borrowed, this balance should be negative)          |
| usd_price (from oracle)   | Price of token (optional)                                                              |


Sample output row will look like this:

| blocknumber | timestamp | user_address | token_address | token_symbol (optional) | token_balance |
|---|---|---|---|---|---|
| 2940306 | 2024-03-16 19:19:57 | 0x4874459FE…d689 | 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2 | WETH | 100 |

Note: **Expect multiple entries per user if the protocols has more than one token asset**

### Query Example (DEX - CL MM)

Below is the query being used in the example we have in the repo link. For querying like this, please create a subgraph that has this data for your respective protocol. This data should be further transformed to get the data as per required Output schema.

```
{
            positions(  block: {number: 4004302} orderBy: transaction__timestamp, first:1000,skip:0) {
            id


                liquidity
                owner
                pool {
                    sqrtPrice
                    tick
                    id
                }
                tickLower{
                    tickIdx
                }
                tickUpper{
                    tickIdx
                }
                token0 {
                    id
                    decimals
                    derivedUSD
                    name
                    symbol
                }
                token1 {
                    id
                    decimals
                    derivedUSD
                    name
                    symbol
                }
            },
            _meta{
                    block{
                    number
                }
            }
        }
```

### Response Example:
```
{
   "id": "3",
   "liquidity": "0",
   "owner": "0x8ad255ee352420d3e257aa87a5811bd09f72d251",
   "pool": {
     "sqrtPrice": "4158475459167119976298502",
     "tick": -197109,
     "id": "0xf2e9c024f1c0b7a2a4ea11243c2d86a7b38dd72f"
   },
   "tickLower": {
     "tickIdx": -198790
   },
   "tickUpper": {
     "tickIdx": -198770
   },
   "token0": {
     "id": "0x4200000000000000000000000000000000000006",
     "decimals": "18",
     "derivedUSD": "2754.920801587090063443331457265368",
     "name": "Wrapped Ether",
     "symbol": "WETH"
   },
   "token1": {
     "id": "0xd988097fb8612cc24eec14542bc03424c656005f",
     "decimals": "6",
     "derivedUSD": "1",
     "name": "USD Coin",
     "symbol": "USDC"
   }
 }
```

### Contract Security
Please submit your Contract Addresses and Pool Addresses through this [Form](https://forms.gle/DJ2975hZwhz32t5r6).

### Adapter Example
In this repo there is adapter example. This adapter is charged to get data positions from the subrgaph and calculate the TVL by users.
The main scripts is generating a output as CSV file.

[Adapter Example](adapters/example/dex/src/index.ts)

## How to execute this project?

```
npm install // install all packages
npm run watch //other terminal tab
npm run start // other terminal tab
```

By this, we'll be able to generate the output csv file.
