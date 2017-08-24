// vim:sts=4 sw=4

/*
 * Twitter Reply Tracker - Tracks replies to a tweet
 * Copyright (C) 2017 Rob Hoelz
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as Twitter from 'twitter';
import * as AWS from 'aws-sdk';
import * as process from 'process';

interface Status {
    in_reply_to_status_id_str: string;
    id_str: string;

    quoted_status: Status;
}

interface SearchMetadata {
    next_results: string;
}

interface SearchResults {
    statuses: Array<Status>;
    search_metadata: SearchMetadata;
}

let decryptedKeys = {};

async function kmsDecrypt(key : string) : Promise<string> {
    return new Promise<string>((resolve, reject) => {
        if(decryptedKeys.hasOwnProperty(key)) {
            resolve(decryptedKeys[key]);
        } else {
            let kms = new AWS.KMS();
            kms.decrypt({ CiphertextBlob: new Buffer(process.env[key], 'base64') }, (err, data) => {
                if(err) {
                    reject(err);
                    return;
                }
                decryptedKeys[key] = (data.Plaintext as Buffer).toString('ascii');
                resolve(decryptedKeys[key]);
            });
        }
    });
}

async function performSingleSearch(query : string, sinceId, maxId) {
    return new Promise<SearchResults>(async function(resolve, reject) {
        let tw = new Twitter({
          consumer_key: await kmsDecrypt('TWITTER_CONSUMER_KEY'),
          consumer_secret: await kmsDecrypt('TWITTER_CONSUMER_SECRET'),
          access_token_key: await kmsDecrypt('TWITTER_ACCESS_TOKEN'),
          access_token_secret: await kmsDecrypt('TWITTER_ACCESS_TOKEN_SECRET'),
        });

        let params : any = {
            q: query,
            count: 100,
            since_id: sinceId,
            tweet_mode: 'extended'
        };

        if(maxId != null) {
            params.max_id = maxId;
        }

        tw.get('search/tweets', params, (error, tweets, response) => {
            if(error) {
                return reject(error);
            }
            // pass response headers in somehow? or just CW the thing here?
            resolve(tweets);
        });
    });
}

export
async function* performSearch(query : string, sinceId : string, outMaxId : any) {
    // XXX throw error and see if it gets caught on the outside
    let maxId : string = null;
    while(true) {
        let results = await performSingleSearch(query, sinceId, maxId);
        yield* results.statuses;

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
    outMaxId.maxId = maxId;
}

export
async function loadLastSinceId(db, targetScreenName, targetStatusId, key : string) : Promise<string> {
    return new Promise<string>(function(resolve, _) {
        db.getItem({
            TableName: 'twitter_replies',
            Key: {
                'screen_name_and_replied_to_status': {
                    S: targetScreenName + '/' + targetStatusId
                },
                'status_id': {
                    S: key
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

export
function updateLatestMaxId(db, targetScreenName, targetStatusId, maxId, key : string) {
    if(maxId == null) {
        return;
    }

    db.putItem({
        TableName: 'twitter_replies',
        Item: {
            'screen_name_and_replied_to_status': {
                S: targetScreenName + '/' + targetStatusId
            },
            'status_id': {
                S: key
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

export
function insertIntoRepliesTable(targetScreenName, targetStatusId, db, status) {
    db.putItem({
        TableName: 'twitter_replies',
        Item: {
            'screen_name_and_replied_to_status': {
                S: targetScreenName + '/' + targetStatusId
            },
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
