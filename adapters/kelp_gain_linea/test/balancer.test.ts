import { fetchAllBalancerShare } from "../src/lib/balancer";

describe("balancer", () => {
	it("balancer subgraph pagination", async () => {
		const blockNumber = 20583274;
		const response = await fetchAllBalancerShare(blockNumber);
		expect(response.length).toEqual(17);
	})
})