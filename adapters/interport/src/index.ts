import {client} from "./utils/client";
import {searchStartBlock, vaultsAddresses} from "./utils/constants";
import {vaultAbi} from "./utils/vault-abi"

interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

type OutputDataSchemaRow = {
    block_number: number;
    timestamp: number;
    user_address: string;
    token_address: string;
    token_balance: bigint;
    token_symbol: string; //token symbol should be empty string if it is not available
    usd_price: number; //assign 0 if not available
};

const getBlockTimestamp = async (blockNumber: bigint) => {
    const data = await client.getBlock({
        blockNumber: blockNumber
    })
    return Number(data.timestamp);
}

const collectEvents = async (events: any[], token_symbol: string, isDeposit: boolean) => {
    const csvRows: OutputDataSchemaRow[] = [];
    for (let i = 0; i < events.length; i++) {
        const {
            args: {caller: user_address, assetAmount: token_balance},
            blockNumber,
            address: token_address
        } = events[i]
        const timestamp = await getBlockTimestamp(blockNumber)
        csvRows.push({
            block_number: Number(blockNumber),
            timestamp,
            user_address,
            token_address,
            token_balance: isDeposit ? token_balance : -token_balance,
            token_symbol,
            usd_price: 0
        })
    }
    return csvRows;
}

export const getUserTVLByBlock = async (
    blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
    const {blockNumber, blockTimestamp} = blocks
    const allCsvRows: OutputDataSchemaRow[] = [];
    for (let i = 0; i < vaultsAddresses.length; i++) {
        const {address, token_symbol} = vaultsAddresses[i];
        let currentStartingBlock = searchStartBlock;
        while (currentStartingBlock < blockNumber) {
            const endBlock = currentStartingBlock + 799 > blockNumber ? blockNumber : currentStartingBlock + 799
            const depositEvents = await client.getContractEvents({
                address,
                abi: vaultAbi,
                eventName: "Deposit",
                fromBlock: BigInt(currentStartingBlock),
                toBlock: BigInt(endBlock),
            });
            const depositCsvRows = await collectEvents(depositEvents, token_symbol, true);

            const withdrawEvents = await client.getContractEvents({
                address,
                abi: vaultAbi,
                eventName: "Withdraw",
                fromBlock: BigInt(currentStartingBlock),
                toBlock: BigInt(endBlock),
            });
            const withdrawCsvRows = await collectEvents(withdrawEvents, token_symbol, false);
            allCsvRows.push(...depositCsvRows, ...withdrawCsvRows)
            currentStartingBlock = endBlock
        }
    }
    return allCsvRows
}
