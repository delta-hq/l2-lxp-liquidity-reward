import { createPublicClient, formatUnits, http, parseAbi, parseUnits } from "viem";
import { getUserTVLByBlock } from "./utils";
import { linea } from "viem/chains";
import { getLpAccountBalanceAtBlock } from "./utils/subgraph";
import { getCompositeBalances } from "./utils/assets";

const users = ['0xc82c7d826b1ed0b2a4e9a2be72b445416f901fd1', '0xdd507fecd5de6f5398060cc0404cb133f9048c3a'];

const blocks = [5081800, 5082887, 5084087, 6055026];

const logUserEntry = async (user: string) => {
    const ret: Record<number, any> = {}
    const composite: Record<number, any> = {}
    for (const block of blocks) {
        const results = await getLpAccountBalanceAtBlock(block, undefined, user);
        composite[block] = (await getCompositeBalances(results)).map(r => {
            return {
                latestTransferBlock: r.block,
                account: r.account.id,
                tokens: r.underlyingTokens.join(', '),
                amount: r.underlyingBalances.join(', '),
            }
        })

        ret[block] = results.map(r => {
            return {
                latestTransferBlock: r.block,
                account: r.account.id,
                tokens: r.token.id,
                amount: r.amount
            }
        })
    }
    console.log('tvl for', user, ':')
    console.log(ret)
    console.log('\ncomposite for', user, ':')
    console.log(composite)
}

const dev = async () => {
    for (const user of users) {
        await logUserEntry(user)
    }
}
dev();

// 5081800,  1717289323
// 5082887,  1717297198
// 5084087,  1717300798
// 5085287,  1717304398