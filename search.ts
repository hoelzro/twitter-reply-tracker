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

function stripMentions(text, mentions) {
    let pieces = [];
    let startIndex = 0;

    for(let [start, end] of mentions) {
        pieces.push(text.substring(startIndex, start));
        startIndex = end + 1;
    }

    pieces.push(text.substring(startIndex, text.length));
    return pieces.join('');
}

function insertIntoRepliesTable(db, status) {
    db.putItem({
        TableName: 'reply_status_ids',
        Item: {
            'status_id': {
                S: status.id_str
            },
            'full_text': {
                S: stripMentions(status.full_text, status.entities.user_mentions.map((mention) => mention.indices))
            },
            'author': {
                S: status.user.screen_name
            }
        }
    }, (err, _) => {
        if(err) {
            console.warn(err, err.stack);
        }
    });
}

export
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
            updateLatestMaxId(db, maxId);
        }

    }
}
