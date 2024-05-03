export const readBlocksFromApi = async (startTime: number, endTime: number): Promise<any[]> => {
    const results = []
    for (let i = startTime; i <= endTime; i += 3600) {
        let response = await fetch(`https://api.lineascan.build/api?module=block&action=getblocknobytime&timestamp=${i}&closest=after&apikey=ADD_API_KEY`, {
            headers: { "Content-Type": "application/json" },
        });

        const json = await response.json()
        // sleep
        await new Promise(r => setTimeout(r, 1000));
        results.push(Number(json.result))
    }
    console.log(results);

    return results

    // daily blocks
    return [
        1459540, 1473940, 1488339, 1502715, 1517109, 1531509,
        1545909, 1560309, 1574707, 1589104, 1603499, 1617898,
        1632296, 1646696, 1661096, 1675487, 1689885, 1704285,
        1718685, 1733085, 1747485, 1761885, 1779844, 1800972,
        1822511, 1844067, 1865652, 1887247, 1908844, 1930429,
        1951984, 1973539, 1994976, 2016544, 2038130, 2059720,
        2081313, 2102851, 2124303, 2145723, 2166829, 2188347,
        2209908, 2231357, 2252825, 2274361, 2295942, 2317539,
        2339139, 2360738, 2382328, 2403928, 2425521, 2447121,
        2468721, 2490321, 2511921, 2533521, 2555120, 2576720,
        2598320, 2619920, 2641520, 2663120, 2684720, 2706320,
        2727920, 2749520, 2771120, 2792720, 2814320, 2835920,
        2857520, 2879120, 2900720, 2922320, 2943907, 2965507,
        2987107, 3008707, 3030307, 3051907, 3073507, 3095107, 
        3116707
    ]
}