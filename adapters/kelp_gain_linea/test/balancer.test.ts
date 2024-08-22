import { fetchAllBalancerShare } from "../src/lib/balancer";

describe("balancer", () => {
	it("balancer subgraph pagination", async () => {
		const blockNumber = 20582417;
		const response = await fetchAllBalancerShare(blockNumber);
		expect(response.length).toEqual(20);
	})
})