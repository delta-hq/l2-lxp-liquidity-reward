import BigNumber from "bignumber.js";
import {
  getAllV3Positions,
  getAllV3Share,
  getPoolPosition,
  getToken0And1
} from "./v3query";
import { CAMELOT_START_TIMESTAMP, NURI_START_TIMESTAMP } from "./utils";
import { getArbBlock } from "./fetcher";

const CAMELOT_SUBGRAPH_BY_GATEWAY =
  "https://api.thegraph.com/subgraphs/id/QmUjsQpF3mewR2nNyWkpCeKqosaNbRefeqiJJtdEoHQpC7";
export const CAMELOT_AGETH_RSETH_POOL =
  "0x8039cd846fd1f1fe3f560bdbea5f799e499f7873";

export async function getCamelotAgEthHodlers(timestamp: number) {
  if (timestamp < CAMELOT_START_TIMESTAMP) {
    return [];
  }

  const arbBlockNumber = await getArbBlock(timestamp);
  const balances = await getAllV3Share(
    arbBlockNumber,
    CAMELOT_SUBGRAPH_BY_GATEWAY,
    CAMELOT_AGETH_RSETH_POOL
  );

  return balances;
}
