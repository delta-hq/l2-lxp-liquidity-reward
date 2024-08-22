import { gql } from "graphql-request";
import { subgraphFetchAllById } from "./subgraph";

const BALANCER_V2_ENDPOINT = "https://api.thegraph.com/subgraphs/id/QmQ5TT2yYBZgoUxsat3bKmNe5Fr9LW9YAtDs8aeuc1BRhj";
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
	id: string;
	userAddress: UserAddress;
	balance: string;
}


const BALANCER_POOL_SHARES_QUERY: GraphQLQuery = {
    query: gql`
        query GetPoolShares($poolId: ID!, $block: Int, $first: Int, $lastId: ID!) {
            poolShares(
                where: { poolId: $poolId, id_gt: $lastId }
                block: { number: $block }
                first: $first
                orderBy: id
                orderDirection: asc
            ) {
                id
                balance
                userAddress {
                    id
                }
            }
        }
		`,
	collection: "poolShares",
};

export async function fetchBalancerAgEthPoolShares(
	block: number,
): Promise<Share[]> {
	return await subgraphFetchAllById<Share>(
		BALANCER_V2_ENDPOINT,
		BALANCER_POOL_SHARES_QUERY.query,
		BALANCER_POOL_SHARES_QUERY.collection,
		{ poolId: AGETH_POOL_ID, block: block}
	);
}

export async function fetchAllBalancerShare(blockNumber: number) {
	let balances = await fetchBalancerAgEthPoolShares(blockNumber);
	balances = balances.filter((balance) => balance.userAddress.id.toLowerCase() != BALANCER_VAULT_ADDRESS.toLowerCase());
	return balances;
}

