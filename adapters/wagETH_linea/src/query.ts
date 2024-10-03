import { request } from "graphql-request";
import { gql } from "graphql-request";

const MULTICALL_BATCH_SIZE = 1000;

const LINEA_WAGETH_SUBGRAPH =
	"https://api.studio.thegraph.com/query/70817/linea-wageth/version/latest";
export const LINEA_WAGETH_ADDR = "0x2a4f1dcc79b83608f9e3BC1F3F55fBEfCBFaE885";
export const LINEA_WAGETH_SYMBOL = "wagETH";
interface IDwise {
	id: string;
}

async function subgraphFetchAllById<T extends IDwise>(
	endpoint: string,
	query: string,
	collection: string,
	variables: Record<string, unknown>
): Promise<T[]> {
	const data: T[] = [];
	let lastId = "0x0000000000000000000000000000000000000000";
	while (true) {
		const resp: { [collection: string]: T[] } = await request(endpoint, query, {
			...variables,
			lastId
		});

		const batch: T[] = resp[collection];
		if (batch.length == 0) {
			break;
		}

		const last = batch[batch.length - 1];
		lastId = last.id;

		data.push(...batch);

		if (batch.length < MULTICALL_BATCH_SIZE) {
			break;
		}
	}
	return data;
}

interface GraphQLQuery {
	query: string;
	collection: string;
}

export type UserBalanceSubgraphEntry = {
	id: string;
	balance: string;
};

export const USER_BALANCES_QUERY: GraphQLQuery = {
    query: gql`
        query PositionsQuery($block: Int, $lastId: ID!) {
            userBalances(
                where: { balance_gt: "0", id_gt: $lastId }
                block: { number: $block }
                orderBy: id
                orderDirection: asc
                first: 1000
            ) {
                id
                balance
            }
        }
		`,
	collection: "userBalances"
};

export async function getAllWagEthHodlers(blockNumber: number) {
	const positions = await subgraphFetchAllById<UserBalanceSubgraphEntry>(
		LINEA_WAGETH_SUBGRAPH,
		USER_BALANCES_QUERY.query,
		USER_BALANCES_QUERY.collection,
		{ block: blockNumber, lastId: "0x0000000000000000000000000000000000000000" }
	);
	return positions;
}