import { SUBGRAPH_URL } from "./config";

export const getEvents = async (
    blockNumberLTE: number,
    offset: number,
    limit: number,
): Promise<any> => {
    const block_range = `(
        block: {
            number: ${blockNumberLTE}
        },
        skip: ${offset},
        first: ${limit},
        orderBy: block_number
    )`
    const query = `{
        depositRequesteds ${block_range} {
          contractId_
          depositId
          sender
          amountDepositToken
        }
        depositFulfilleds ${block_range} {
          contractId_
          depositId
        }
        withdrawalFulfilleds ${block_range} {
          contractId_
          recipient
          amountDepositToken
        }
      }`;

    const response = await fetch(SUBGRAPH_URL, {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    return data.data;
}