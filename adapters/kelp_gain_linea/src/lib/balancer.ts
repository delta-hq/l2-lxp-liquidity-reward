import { gql } from "graphql-request";
import { subgraphFetchAllById, subgraphFetchOne } from "./subgraph";
import BigNumber from "bignumber.js";

const BALANCER_V2_ENDPOINT = "https://api.thegraph.com/subgraphs/id/QmQ5TT2yYBZgoUxsat3bKmNe5Fr9LW9YAtDs8aeuc1BRhj";
const AGETH_POOL_ID = "0xf1bbc5d95cd5ae25af9916b8a193748572050eb00000000000000000000006bc";

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

interface Token {
	priceRate: string; // or number, depending on the actual data type
	weight: string; // or number
	balance: string; // or number
	symbol: string;
}

interface Pool {
	tokens: Token[];
	totalShares: string;
}

interface GetPoolDetailsResponse {
	pool: Pool;
}

const ONE_E_18 = BigInt(10**18);

const BALANCER_POOL_SHARES_QUERY: GraphQLQuery = {
    query: gql`
        query GetPoolShares($poolId: ID!, $block: Int, $first: Int, $lastId: ID!) {
            poolShares(
                where: { poolId: $poolId, id_gt: $lastId, balance_gt: "0",  userAddress_not: "0x0000000000000000000000000000000000000000" }
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

const POOL_DETAILS_QUERY: GraphQLQuery = {
    query: gql`
        query GetPoolDetails($poolId: ID!, $block: Int) {
            pool(id: $poolId, block: { number: $block }) {
                tokens {
                    priceRate
                    weight
                    balance
                    symbol
                }
                totalShares
            }
        }
		`,
	collection: "pool",
};

export async function getPoolDetails(block: number): Promise<Pool>  {
	return await subgraphFetchOne<Pool>(
		BALANCER_V2_ENDPOINT,
		POOL_DETAILS_QUERY.query,
		POOL_DETAILS_QUERY.collection,
		{ poolId: AGETH_POOL_ID, block: block}
	)
}

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

function convertLpToAgETH(balances: Share[], poolDetails: Pool) {
	const agETH = poolDetails.tokens.filter( (token) => token.symbol == 'agETH')[0];
	const totalPoolAgETH = BigNumber(agETH.balance).multipliedBy(BigNumber(ONE_E_18.toString()));
	const totalLiquidity = BigNumber(poolDetails.totalShares).multipliedBy(ONE_E_18.toString());

	for(let i=0; i<balances.length; i++) {
		const userLpBalance = BigNumber(balances[i].balance).multipliedBy(BigNumber(ONE_E_18.toString()));
		const userShare = userLpBalance.div(totalLiquidity);
		const userAgETH = userShare.multipliedBy(totalPoolAgETH);
		balances[i].balance = userAgETH.toString();
	}
	return balances;
}

export async function fetchAllBalancerShare(blockNumber: number) {
	let balances = await fetchBalancerAgEthPoolShares(blockNumber);
	const poolDetails = await getPoolDetails(blockNumber);
	return convertLpToAgETH(balances, poolDetails);
}

