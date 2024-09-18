import { Result, Row } from "./models";
import { agETHBalancerOf } from "./fetcher";
import { PENDLE_START_BLOCK, pendleSYAgETH } from "./utils";

const PendleURL =
  "https://app.sentio.xyz/api/v1/analytics/kelpdao/pendle_mainnet_ageth_v2/sql/execute";

const API_KEY = process.env.KELPDAO_SENTIO_API_KEY || "";

const EARLIEST_TIME = 1724122800;
export async function fetchAllPendleShare(
  blockNumber: number,
  timeStamp: number
) {
  if (blockNumber <= PENDLE_START_BLOCK || timeStamp < EARLIEST_TIME) {
    return [];
  }
  const dataSize = 20000;
  let page = 0;

  let hoursPassed = Math.round((timeStamp - EARLIEST_TIME) / 3600);

  const totalShares = [];
  while (true) {
    const postData = apiPostData(hoursPassed, page, dataSize);

    const responseRaw = await post(PendleURL, postData);
    const result: Result = responseRaw.result;

    page = page + 1;

    console.log(result.rows.length);

    if (result.rows.length == 0) {
      break;
    }
    totalShares.push(...result.rows);
  }

  const shares = await convertLpToAgETH(blockNumber, totalShares);

  if (shares.length == 0) {
    throw new Error(`Empty share pendle BLOCK: ${blockNumber}`);
  }
  return shares;
}

async function convertLpToAgETH(
  blockNumber: number,
  pendleShares: Row[]
): Promise<Row[]> {
  const totalAgEth = await agETHBalancerOf(blockNumber, pendleSYAgETH);

  let pendeShares = pendleShares.reduce((acc, s) => acc + BigInt(s.share), 0n);

  return pendleShares.map((e) => {
    let share = (BigInt(e.share) * BigInt(totalAgEth)) / pendeShares;
    return {
      user: e.user,
      share: share.toString(),
      block_number: e.block_number,
      day: e.day
    };
  });
}

function apiPostData(hour: number, page: number, dataSize: number) {
  const queryStr = `SELECT DISTINCT user, share, recordedAtBlock as block_number, ROUND((recordedAtTimestamp - ${EARLIEST_TIME}) / 3600) as hour FROM UserHourlyShare WHERE hour = ${hour} LIMIT ${dataSize} OFFSET ${
    page * dataSize
  }`;

  console.log(queryStr);

  return {
    sqlQuery: {
      sql: queryStr,
      size: dataSize
    },
    version: 3
  };
}

const post = async (url: string, data: any) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "api-key": API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(data)
  });
  return await response.json();
};
