import {client} from "./utils/client";
import {searchStartBlock, stablecoinFarmAddress, vaultsAddresses, zeroAddress} from "./utils/constants";
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

const collectTransferEvents = async (events: any[], token_symbol: string) => {
    const csvRows: OutputDataSchemaRow[] = [];
    for (let i = 0; i < events.length; i++) {
        const {
            args: {from: senderAddress_address, to: receiver_address, amount: token_balance},
            blockNumber,
            address: token_address
        } = events[i]
        const timestamp = await getBlockTimestamp(blockNumber)
        if(senderAddress_address !== stablecoinFarmAddress && senderAddress_address !== zeroAddress) {
            csvRows.push({
                block_number: Number(blockNumber),
                timestamp,
                user_address: senderAddress_address,
                token_address,
                token_balance: -BigInt(token_balance),
                token_symbol,
                usd_price: 0
            })
        }
        if (receiver_address !== stablecoinFarmAddress && receiver_address !== zeroAddress) {
            csvRows.push({
                block_number: Number(blockNumber),
                timestamp,
                user_address: receiver_address,
                token_address,
                token_balance: BigInt(token_balance),
                token_symbol,
                usd_price: 0
            })
        }
    }
    return csvRows;
}

export const getUserTVLByBlock = async (
    blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
    const {blockNumber} = blocks
    const allCsvRows: OutputDataSchemaRow[] = [];
    for (let i = 0; i < vaultsAddresses.length; i++) {
        const {address, token_symbol} = vaultsAddresses[i];
        let currentStartingBlock = searchStartBlock;
        while (currentStartingBlock < blockNumber) {
            const endBlock = currentStartingBlock + 799 > blockNumber ? blockNumber : currentStartingBlock + 799
            const transferEvents = await client.getContractEvents({
                address,
                abi: vaultAbi,
                eventName: "Transfer",
                fromBlock: BigInt(currentStartingBlock),
                toBlock: BigInt(endBlock),
            });
            const transferCsvRows = await collectTransferEvents(transferEvents, token_symbol);
            allCsvRows.push(...transferCsvRows)
            currentStartingBlock = endBlock
        }
    }
    return allCsvRows
}
