// vim:sts=4 sw=4

import { Twitter } from 'twitter-node-client';
import * as AWS from 'aws-sdk';
import * as process from 'process';

interface Status {
    in_reply_to_status_id_str: string;
    id_str: string;
}

interface SearchMetadata {
    next_results: string;
}

interface SearchResults {
    statuses: Array<Status>;
    search_metadata: SearchMetadata;
}

async function performSearch(sinceId : string, maxId : string) : Promise<SearchResults> {
    return new Promise<SearchResults>(async function(resolve, reject) {
        let tw = new Twitter({
          consumerKey: process.env.TWITTER_CONSUMER_KEY,
          consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
          accessToken: process.env.TWITTER_ACCESS_TOKEN,
          accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
        });

        let params : any = {
            q: 'to:sehurlburt',
            count: 100,
            since_id: sinceId,
            tweet_mode: 'extended'
        };

        if(maxId != null) {
            params.max_id = maxId;
        }

        tw.getSearch(params, reject, (results) => resolve(JSON.parse(results)));
    });
}

async function loadLastSinceId(db) : Promise<string> {
    return new Promise<string>(function(resolve, _) {
        db.getItem({
            TableName: 'reply_status_ids',
            Key: {
                'status_id': {
                    S: 'latest_max_id'
                }
            }
        }, (err, data) => {
            if(err) {
                console.warn(err, err.stack);
                resolve(null);
            } else {
                if('Item' in data) {
                    resolve(data.Item.latest_max_id.S);
                } else {
                    resolve(null);
                }
            }
        });
    });
}

function updateLatestMaxId(db, maxId) {
    db.putItem({
        TableName: 'reply_status_ids',
        Item: {
            'status_id': {
                S: 'latest_max_id'
            },
            'latest_max_id': {
                S: maxId
            }
        }
    }, (err, _) => {
        if(err) {
            console.warn(err, err.stack);
        }
    });
}

async function main() {
    if('AWS_REGION' in process.env) {
        AWS.config.update({
            region: process.env.AWS_REGION
        });
    }

    let db = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    let sinceId : string = await loadLastSinceId(db);
    const conversationStart = '889004724669661184';
    let maxId : string = null;

    if(sinceId == null) {
        sinceId = conversationStart;
    }

    try {
        while(true) {
            let results = await performSearch(sinceId, maxId);

            for(let status of results.statuses) {
                if(status.in_reply_to_status_id_str == conversationStart) {
                    console.log(status.id_str);
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
            updateLatestMaxId(db, maxId);
        }

    }
}

main();
