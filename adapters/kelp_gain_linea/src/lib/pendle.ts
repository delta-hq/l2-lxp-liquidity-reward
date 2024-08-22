const PendleURL =
  "https://app.sentio.xyz/api/v1/analytics/kelp_analytics/pendle_mainnet_ageth/sql/execute";

const API_KEY = process.env.SENTIO_API_KEY || "";

type Result = {
  rows: Row[];
};

type Row = {
  user: string;
  share: string;
  block_number: string;
  day: string;
};

export async function fetchAllPendleShare(blockNumber: number) {
  const dataSize = 20000;
  let page = 0;

  const totalShares = [];
  while (true) {
    const postData = apiPostData(blockNumber, page, dataSize);

    const responseRaw = await post(PendleURL, postData);
    console.log(`${JSON.stringify(responseRaw)}`);
    const result: Result = responseRaw.result;

    page = page + 1;

    console.log(result.rows.length);

    if (result.rows.length == 0) {
      break;
    }
    totalShares.push(...result.rows);
  }

  totalShares.map((e) => {});

  return totalShares;
}

function apiPostData(blockNumber: number, page: number, dataSize: number) {
  const queryStr = `SELECT DISTINCT user, share, recordedAtBlock as block_number, ROUND((recordedAtTimestamp - 1702280195) / 86400) as day FROM UserDailyShare WHERE recordedAtBlock = ${blockNumber} LIMIT ${dataSize} OFFSET ${
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
