import fs from "fs";
import path from "path";

import { LINEA_RPC } from "./config";

const LAST_BLOCK_FILE = path.join(__dirname, "lastBlock.txt");

export const post = async (url: string, data: any): Promise<any> => {
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

export const getLatestBlockNumberAndTimestamp = async () => {
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

export const getTimestampAtBlock = async (blockNumber: number) => {
  const data = await post(LINEA_RPC, {
    jsonrpc: "2.0",
    method: "eth_getBlockByNumber",
    params: ["0x" + blockNumber.toString(16), true],
    id: 1,
  });
  return parseInt(data.result.timestamp);
};

export function readLastProcessedBlock(): number | null {
  try {
    if (fs.existsSync(LAST_BLOCK_FILE)) {
      const content = fs.readFileSync(LAST_BLOCK_FILE, "utf8");
      return parseInt(content, 10);
    }
  } catch (error) {
    console.error("Failed to read last processed block:", error);
  }
  return null;
}

export function saveLastProcessedBlock(blockNumber: number) {
  console.log("Saving last processed block:", blockNumber);
  fs.writeFileSync(LAST_BLOCK_FILE, blockNumber.toString(), "utf8");
}
