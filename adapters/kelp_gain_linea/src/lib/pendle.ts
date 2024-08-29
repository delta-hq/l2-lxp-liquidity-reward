import { Result, Row } from "./models";
import { agETHBalancerOf } from "./fetcher";
import { pendleSYAgETH } from "./utils";

const PendleURL =
  "https://app.sentio.xyz/api/v1/analytics/kelp_analytics/pendle_mainnet_ageth/sql/execute";

const API_KEY = process.env.KELPDAO_SENTIO_API_KEY || "";

export async function fetchAllPendleShare(
  blockNumber: number,
  timeStamp: number
) {
  const cur = new Date();
  if (cur.getTime() / 1000 - timeStamp < 3600) {
    timeStamp = cur.getTime() / 1000 - 3600;
  }

  const dataSize = 20000;
  let page = 0;

  let day = Math.round((timeStamp - 1724122487) / 86400);
  const totalShares = [];
  while (true) {
    const postData = apiPostData(day, page, dataSize);

    const responseRaw = await post(PendleURL, postData);
    const result: Result = responseRaw.result;

    page = page + 1;

    console.log(result.rows.length);

    if (result.rows.length == 0) {
      break;
    }
    totalShares.push(...result.rows);
  }

  return await convertLpToAgETH(blockNumber, totalShares);
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

function apiPostData(day: number, page: number, dataSize: number) {
  const queryStr = `SELECT DISTINCT user, share, recordedAtBlock as block_number, ROUND((recordedAtTimestamp - 1724122487) / 86400) as day FROM UserDailyShare WHERE day = ${day} LIMIT ${dataSize} OFFSET ${
    page * dataSize
  }`;
  return {
    sqlQuery: {
      sql: queryStr,
      size: dataSize
    }
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
