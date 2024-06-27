import axios from "axios";
import { client, okuAccountApiUrl } from "./config";
import { UserTvl } from "./types";

export const getV3UserPositionsAtTimestamp = async (
    timeStamp: number,
): Promise<UserTvl[]> => {
    const result: UserTvl[] = [];
    try {
        const userTvls = await axios.get(`${okuAccountApiUrl}/rewards/linea/${timeStamp}`);
        result.push(...userTvls.data);
    } catch (e) {
        console.error("failed to query userTvl values:", e);
        return [];
    }
    return result;
};

export const getTimestampAtBlock = async (blockNumber: number) => {
    const block = await client.getBlock({
        blockNumber: BigInt(blockNumber),
    });
    return Number(block.timestamp * 1000n);
};
