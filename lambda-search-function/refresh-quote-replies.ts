// vim:sts=4 sw=4

import { conversationStart, loadLastSinceId, insertIntoRepliesTable, updateLatestMaxId, performSearch } from './common';
import * as AWS from 'aws-sdk';
import * as process from 'process';

async function main() {
    (Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol.for("Symbol.asyncIterator");

    if('AWS_REGION' in process.env) {
        AWS.config.update({
            region: process.env.AWS_REGION
        });
    }

    let db = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    let sinceId : string = await loadLastSinceId(db, 'quote_latest_max_id');
    let outMaxId = { maxId : null};

    if(sinceId == null) {
        sinceId = conversationStart;
    }

    for await (let status of performSearch('https://twitter.com/sehurlburt/status/889004724669661184', conversationStart, outMaxId)) {
        if(status.quoted_status && status.quoted_status.id_str == conversationStart) {
            insertIntoRepliesTable(db, status);
        }
    }
    updateLatestMaxId(db, outMaxId.maxId, 'quote_latest_max_id');
}

export
function handler(event, context, callback) {
    main().then(
        (result) => callback(null, result),
        (err)    => callback(err));
}
