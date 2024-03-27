import { createWriteStream } from 'fs';
import { format } from '@fast-csv/format';

// writes csv from object array with keys as headers
export const writeCsv = async <T = object>(data: T[], filename: string): Promise<void> => {
    const stream = format({ headers: true });
    const output = createWriteStream(filename);

    const completed = new Promise((resolve, reject) => {
        stream.pipe(output).on('end', resolve).on('error', reject);
    });
    // console.log("writing csv to file:", filename);
    data.map((row) => stream.write(row));
    await completed;
    stream.end();
    // console.log("csv written to file:", filename);
    return;
}