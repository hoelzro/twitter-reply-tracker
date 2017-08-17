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
    let sinceId : string = await loadLastSinceId(db, 'latest_max_id');
    let maxId : string = null;

    if(sinceId == null) {
        sinceId = conversationStart;
    }

    for await (let status of performSearch(conversationStart, maxId)) {
        if(status.in_reply_to_status_id_str == conversationStart) { // XXX here
        }
    }
}

export
function handler(event, context, callback) {
    main().then(
        (result) => callback(null, result),
        (err)    => callback(err));
}

main(); // XXX DEBUG
