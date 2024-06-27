import * as fs from "fs";
import { write } from "fast-csv";
import csv from "csv-parser";
/**
 * The objective is to quantify:
 *     - TVL on Linea (size of collateral minting GRAI on Linea)
 *     - GRAI stability pool deposits on Linea
 *
 * For that, we'll be querying an existing Gravita Subgraph deployed on TheGraph.
 */

type OutputDataSchemaRow = {
	block_number: number;
	timestamp: number;
	user_address: string;
	token_address: string;
	token_balance: bigint;
	token_symbol: string;
	usd_price: number;
};

const LINEA_RPC = "https://rpc.linea.build";


const DYSON_SUBGRAPH_QUERY_URL =
	"https://api.goldsky.com/api/public/project_clus3ghosysc701v046du9c18/subgraphs/linea-dyson/1.0.0/gn";

const DYSON_POOLS_QUERY = `
    query allPairs($blockNumber: Int!) {
        pairEntities(first: 100, block: {number: $blockNumber}) {
            id
            quoteToken
            token0Address
            token0Decimals
            token0Name
            token1Address
            token1Decimals
            token1Name
        }
    }
`;

const DYSON_POSITIONS_QUERY = `
    query DysonPositionsQuery($blockNumber: Int!, $interval: Int!, $offset: Int!) {
        noteEntities(first: $interval, skip: $offset, where: {isWithdrawed: false}, block: {number: $blockNumber}, orderBy: timestamp, orderDirection: desc) {
            timestamp
            user
            pair
            depositType
            depositAmt
            token0Amt
            token1Amt
            isWithdrawed
          }
    }
`;



const post = async (url: string, data: any): Promise<any> => {
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify(data),
	});
	return await response.json();
};

const getLatestBlockNumberAndTimestamp = async () => {
	const data = await post(LINEA_RPC, {
		jsonrpc: "2.0",
		method: "eth_getBlockByNumber",
		params: ["latest", false],
		id: 1,
	});
	const blockNumber = parseInt(data.result.number);
	const blockTimestamp = parseInt(data.result.timestamp);
	return { blockNumber, blockTimestamp };
};

const getBlockTimestamp = async (number: number): Promise<number> => {
	const hexBlockNumber = "0x" + number.toString(16); // Convert decimal block number to hexadecimal
	const data = await post(LINEA_RPC, {
		jsonrpc: "2.0",
		method: "eth_getBlockByNumber",
		params: [hexBlockNumber, false],
		id: 1,
	});
	const blockTimestampInt = parseInt(data.result.timestamp);
	return blockTimestampInt;
};

const getPoolsData = async (
	blockNumber: number,
	blockTimestamp: number,
): Promise<Map<string, any>> => {
	const queryBlock = blockNumber > 675342 ? blockNumber : 675342;
	const responseJson = await post(DYSON_SUBGRAPH_QUERY_URL, {
		query: DYSON_POOLS_QUERY,
		variables: { blockNumber: queryBlock },
	});
	const poolMap = new Map<string, any>();

	const poolArray = responseJson?.data?.pairEntities || [];

	for (let index = 0; index < poolArray.length; index++) {
		const element = poolArray[index];
		poolMap.set(element?.id, element);
	}
	return poolMap;
};

function formatUnits(value: bigint, decimals: number) {
    let display = value.toString()

    const negative = display.startsWith('-')
    if (negative) display = display.slice(1)

    display = display.padStart(decimals, '0')

    let [integer, fraction] = [
      display.slice(0, display.length - decimals),
      display.slice(display.length - decimals),
    ]
    fraction = fraction.replace(/(0+)$/, '')
    return `${negative ? '-' : ''}${integer || '0'}${
      fraction ? `.${fraction}` : ''
    }`
  }

interface SumPosition {
	user: string;
	tokenAddress: string;
	tokenBalance: bigint;
	tokenSymbol: string;
}

const fetchingAllPositionData = async (queryBlock: number, interval = 1000) => {
	let hasMore = true;
	let offset = 0;
	let positionsArray: any[] = [];
	while (hasMore) {
		const responseJson = await post(DYSON_SUBGRAPH_QUERY_URL, {
			query: DYSON_POSITIONS_QUERY,
			variables: { blockNumber: queryBlock, interval, offset },
		});
		const partPositionsArray = responseJson?.data?.noteEntities as any[] || [];
		hasMore = partPositionsArray.length === interval;
		offset += interval;
		positionsArray = positionsArray.concat(partPositionsArray);
	}
	return positionsArray;
};

const getPositionData = async (
	blockNumber: number,
	blockTimestamp: number,
): Promise<OutputDataSchemaRow[]> => {
	const queryBlock = blockNumber > 675341 ? blockNumber : 675341;
	const poolMap = await getPoolsData(blockNumber, blockTimestamp);
	const userPositionMap = new Map<string, SumPosition>();
	const positionsArray = await fetchingAllPositionData(queryBlock)

	for (let index = 0; index < positionsArray.length; index++) {
		const element = positionsArray[index];
		const pairData = poolMap.get(element.pair.toLowerCase());
		const depositToken =
			element.depositType === 0
				? {
						tokenAddress: pairData.token0Address,
						tokenSymbol: pairData.token0Name,
                        decimals: parseFloat(pairData.token0Decimals)
				  }
				: {
						tokenAddress: pairData.token1Address,
						tokenSymbol: pairData.token1Name,
                        decimals: parseFloat(pairData.token1Decimals)
				  };
		const id = `${element.user}-${depositToken.tokenAddress}`
        let position: SumPosition | undefined = userPositionMap.get(id)
        const depositAmt = BigInt(element.depositAmt)
        if(position){
            position.tokenBalance += depositAmt
        } else {
            position = {user: element.user,
            tokenAddress: depositToken.tokenAddress,
            tokenBalance: depositAmt,
            tokenSymbol: depositToken.tokenSymbol}
        }
        userPositionMap.set(
			id,
			position,
		);
	}

    const keyIterator = userPositionMap.keys()
	const csvRows: OutputDataSchemaRow[] = [];
	for (const key of keyIterator) {
        const userPosition = userPositionMap.get(key)
        if(userPosition){
            csvRows.push({
                block_number: blockNumber,
                timestamp: blockTimestamp,
                user_address: userPosition.user,
                token_address: userPosition.tokenAddress,
                token_balance: userPosition.tokenBalance,
                token_symbol: userPosition.tokenSymbol,
                usd_price: 0,
            });
        }

	}
	return csvRows;
};

interface BlockData {
	blockNumber: number;
	blockTimestamp: number;
}

export const main = async (blocks: BlockData[]) => {
	const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
	const batchSize = 10; // Size of batch to trigger writing to the file
	let i = 0;

	for (const { blockNumber, blockTimestamp } of blocks) {
		try {
			// Retrieve data using block number and timestamp
			const csvRows = await getPositionData(blockNumber, blockTimestamp);

			// Accumulate CSV rows for all blocks
			allCsvRows.push(...csvRows);

			i++;
			console.log(`Processed block ${i}`);

			// Write to file when batch size is reached or at the end of loop
			if (i % batchSize === 0 || i === blocks.length) {
				const ws = fs.createWriteStream(`outputData.csv`, {
					flags: i === batchSize ? "w" : "a",
				});
				write(allCsvRows, { headers: i === batchSize ? true : false })
					.pipe(ws)
					.on("finish", () => {
						console.log(`CSV file has been written.`);
					});

				// Clear the accumulated CSV rows
				allCsvRows.length = 0;
			}
		} catch (error) {
			console.error(`An error occurred for block ${blockNumber}:`, error);
		}
	}
};

export const getUserTVLByBlock = async (blocks: BlockData) => {
	const { blockNumber, blockTimestamp } = blocks;
	//    Retrieve data using block number and timestamp
	const csvRows = await getPositionData(blockNumber, blockTimestamp);
	return csvRows;
};

//  main([{blockNumber: 799999,
// 	blockTimestamp: 1201203123123}]).then(() => {
//      console.log("Done");
//  });

const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
  const blocks: BlockData[] = [];

  await new Promise<void>((resolve, reject) => {
	const readable = fs.createReadStream(filePath);

    fs.createReadStream(filePath)
	  .pipe(csv()) // Specify the separator as '\t' for TSV files
      .on("data", (row) => {
		console.log(row, 'row')
        const blockNumber = parseInt(row.number, 10);
        const blockTimestamp = parseInt(row.timestamp, 10);
        if (!isNaN(blockNumber) && blockTimestamp) {
          blocks.push({ blockNumber: blockNumber, blockTimestamp });
        }
      })
      .on("end", () => {
        resolve();
      })
      .on("error", (err) => {
        reject(err);
      });
  });

  return blocks;
};

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
