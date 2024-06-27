import { Response } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchGraphQLData = async (query: string): Promise<Response> => {
  let data;
  let errors;
  let retry = true;
  let retryCount = 0;
  const maxRetries = 10;

  while (retry && retryCount < maxRetries) {
    try {
      const response = await fetch("https://graph.zklink.io/subgraphs/name/aqua-points-v2", {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
      });
      ({ data, errors } = await response.json());

      if (!errors) {
        retry = false;
      }
    } catch (error) {
      retryCount++;
      console.error("Fetch error:", error);
    }

    if (errors) {
      console.error("Errors detected, retrying in 5 seconds...", errors);
      await delay(5000);
      retryCount++;
    }
  }

  if (retryCount >= maxRetries) {
    console.error("Maximum retry limit reached");
  }

  return data;
};

export type QueryFunction<T> = (skip: number, pageSize: number) => Promise<T[]>;

export const fetchInParallel = async <T>(
  queryFunction: QueryFunction<T>,
  pageSize: number,
  maxConcurrency: number
): Promise<T[]> => {
  let result: T[] = [];
  const promises: Array<Promise<void>> = [];
  let processedRecords = 0;

  const fetchPage = async (startSkip: number) => {
    let localSkip = startSkip;
    let fetchNext = true;

    while (fetchNext) {
      const data = await queryFunction(localSkip, pageSize);
      result = result.concat(data);
      processedRecords += data.length;
      console.log(`Processed native ${processedRecords} records so far`);

      if (data.length < pageSize) {
        console.log(`The last native data from ${localSkip} to ${localSkip + pageSize}`);
        fetchNext = false;
      } else {
        console.log(`The native data from ${localSkip} to ${localSkip + pageSize}`);
        localSkip += pageSize * maxConcurrency;
      }
    }
  };

  for (let i = 0; i < maxConcurrency; i++) {
    promises.push(fetchPage(i * pageSize));
  }

  await Promise.all(promises);

  console.log(`Total processed native records: ${processedRecords}`);
  return result;
};

