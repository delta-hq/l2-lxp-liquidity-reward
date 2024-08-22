import { gql } from "graphql-request";
import { request } from "graphql-request";

const BALANCER_V2 = "https://thegraph.com/explorer/subgraphs/C4ayEZP2yTXRAB8vSaTrgN4m9anTe9Mdm2ViyiAuV9TV?view=Query&chain=arbitrum-one";
const AGETH_POOL_ID = "0xf1bbc5d95cd5ae25af9916b8a193748572050eb00000000000000000000006bc";

// balancer pre-mints all the token, so when you join there is no mint/burn (which is expensive), this is gas effective approach
// all the pre-minted tokens are present in the balancer vault, so we need to exclude it
const BALANCER_VAULT_ADDRESS = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";

interface GraphQLQuery {
	query: string;
	collection: string;
}

interface UserAddress {
	id: string;
}

interface Share {
	userAddress: UserAddress;
	balance: string;
}

interface BalancerPoolSharesResult {
	shares: Share[];
}

const BALANCER_POOL_SHARES_QUERY: GraphQLQuery = {
    query: gql`
        query GetUserPoolBalances($poolId: ID!, $block: Int) {
            pool(id: $poolId, block: { number: $block }) {
                shares(
                    first: 10000,
                    where: { balance_gt: "0" }
                    orderBy: balance
                    orderDirection: desc
                ) {
                    userAddress {
                        id
                    }
                    balance
                }
            }
        }
		`,
	collection: "pool",
};

export async function subgraphFetch<T>(
	endpoint: string,
	query: string,
	collection: string,
	variables: Record<string, unknown>
): Promise<T> {
	const resp: { [collection: string]: T } = await request(
		endpoint,
		query,
		variables
	);
	return resp[collection];
}

export async function fetchBalancerAgEthPoolShares(
	block: number,
): Promise<Share[]> {
	try {
		const results = await subgraphFetch<BalancerPoolSharesResult>(
			BALANCER_V2,
			BALANCER_POOL_SHARES_QUERY.query,
			BALANCER_POOL_SHARES_QUERY.collection,
			{ poolId: AGETH_POOL_ID, block: block }
		);

		if (results && results.shares) {
			return results.shares;
		} else {
			console.warn(
				`Error: Shares not found in the results for block ${block}.`
			);
			return [];
		}
	} catch (error) {
		console.error(
			`Error fetching Balancer pool shares for block ${block}:`,
			error
		);
		throw error;
	}
}




export async function fetchAllBalancerShare(blockNumber: number) {
	let balances = await fetchBalancerAgEthPoolShares(blockNumber);
	balances = balances.filter( (balance) => balance.userAddress.id.toLowerCase() != BALANCER_VAULT_ADDRESS.toLowerCase());
	return balances;
}