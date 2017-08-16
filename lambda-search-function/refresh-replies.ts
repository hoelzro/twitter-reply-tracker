// vim:sts=4 sw=4

import { conversationStart, loadLastSinceId, insertIntoRepliesTable, updateLatestMaxId, performSearch } from './search';
import * as AWS from 'aws-sdk';
import * as process from 'process';

async function main() {
    if('AWS_REGION' in process.env) {
        AWS.config.update({
            region: process.env.AWS_REGION
        });
    }

    let db = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    let sinceId : string = await loadLastSinceId(db); // XXX here
    let maxId : string = null;

    if(sinceId == null) {
        sinceId = conversationStart;
    }

    try {
        while(true) {
            let results = await performSearch(sinceId, maxId); // XXX here

            for(let status of results.statuses) {
                if(status.in_reply_to_status_id_str == conversationStart) { // XXX here
                    console.log(status.id_str);
                    insertIntoRepliesTable(db, status);
                }
            }

            let next_results = results.search_metadata.next_results;
            if(next_results === undefined) {
                break;
            }
            let match = /max_id=(\d+)/.exec(next_results);

            if(!match) {
                throw new Error("Unable to extract max_id from " + next_results);
            }
            maxId = match[1];
        }
    } finally {
        if(maxId != null) {
            updateLatestMaxId(db, maxId); // XXX here
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
