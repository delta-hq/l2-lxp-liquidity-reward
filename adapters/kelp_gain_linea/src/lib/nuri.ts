import BigNumber from "bignumber.js";
import {
  getAllV3Positions,
  getAllV3Share,
  getPoolPosition,
  getToken0And1
} from "./v3query";
import { NURI_START_TIMESTAMP } from "./utils";
import { getScrollBlock } from "./fetcher";

const NURI_AGETH_RSETH_POOL = "0x107d317617e82f1871906cf6fee702a5daa4d135";
const API_KEY = process.env.KELPGAIN_SUBGRAPH_API_KEY || "";
const NURI_SUBGRAPH_BY_GATEWAY = `https://gateway.thegraph.com/api/${API_KEY}/subgraphs/id/Eqr2CueSusTohoTsXCiQgQbaApjuK2ikFvpqkVTPo1y5`;

export async function getNuriAgEthHodlers(timestamp: number) {
  if (timestamp < NURI_START_TIMESTAMP) {
    return [];
  }

  const scrollBlockNumber = await getScrollBlock(timestamp);
  const balances = await getAllV3Share(
    scrollBlockNumber,
    NURI_SUBGRAPH_BY_GATEWAY,
    NURI_AGETH_RSETH_POOL
  );

  return balances;
}
