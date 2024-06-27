const SUBGRAPH_ENDPOINT = "https://graph.zklink.io/subgraphs/name/wagmi-points"
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchGraphQLData = async <T>(query: string): Promise<T> => {
  let response;
  let data;
  let retry = true;

  while (retry) {
    try {
      response = await fetch(SUBGRAPH_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      data = await response.json();
      if (data.errors) {
        throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
      }

      retry = false;
    } catch (error) {
      console.error("Fetch error:", error);
      console.log("Retrying in 5 seconds...");
      await delay(5000);
    }
  }

  return data.data;
};
