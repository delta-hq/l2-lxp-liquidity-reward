import { request } from "graphql-request";

export const MULTICALL_BATCH_SIZE = 10;

export interface IDwise {
	id: string;
}

export async function subgraphFetchAllById<T extends IDwise>(
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
			first: MULTICALL_BATCH_SIZE,
			lastId: lastId,
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

export async function subgraphFetchOne<T>(
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