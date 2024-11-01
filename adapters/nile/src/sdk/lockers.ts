import { SUBGRAPH_URL } from "./config";

export const getUserLockers = async (
  blockNumber: number,
): Promise<string[]> => {
  const query = `query {
            userLocker(
                id: "lockers"
                block: { number: ${blockNumber} }
            ) {
              users
            }
        }`;

  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    body: JSON.stringify({ query }),
    headers: { "Content-Type": "application/json" },
  });

  const {
    data: { userLocker },
  } = await response.json();

  return userLocker.users;
};
