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

import * as https from 'https';
import * as process from 'process';
import * as AWS from 'aws-sdk';

const TOKEN_WHITELIST = {
    'C#': true,
    'C++': true,
    '.NET': true,
};

let lunr = require('lunr');

AWS.config.update({
    region: process.env.AWS_REGION
});

async function getTableItems(db, targetScreenName : string, targetStatusId : string, tableName: string) : Promise<any> {
    function performScan(params, accum, resolve, reject, backoff = 100) {
        db.scan(params, (err, data) => {
            if(err) {
                if(err.code == 'ProvisionedThroughputExceededException') {
                    console.log('throughput exceeded - sleeping ' + backoff + 'ms');
                    setTimeout(function() {
                        performScan(params, accum, resolve, reject, backoff * 2);
                    }, 100);
                } else {
                    console.log('DynamoDB error: ' + err);
                    reject(err);
                }
            } else {
                accum.Items = accum.Items.concat(data.Items);

                if('LastEvaluatedKey' in data) {
                    let newParams = Object.assign({}, params);
                    newParams.ExclusiveStartKey = data.LastEvaluatedKey;
                    performScan(newParams, accum, resolve, reject);
                } else {
                    resolve(accum);
                }
            }
        });
    }

    return new Promise<any>((resolve, reject) => {
        let params = {
            TableName: tableName,
            FilterExpression: 'screen_name_and_replied_to_status = :s',
            ExpressionAttributeValues: {
                ':s': {
                    S: targetScreenName + '/' + targetStatusId
                }
            }
        };

        performScan(params, {Items: []}, resolve, reject);
    });
}

async function renderStatus(statusUrl) : Promise<string> {
    return new Promise<string>((resolve, reject) => {
        https.get('https://publish.twitter.com/oembed?url=' + statusUrl + '&omit_script=true&hide_thread=true', (res) => {
            if(res.statusCode == 404) {
                return resolve(null);
            }

            // XXX handle failure
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body).html);
                } catch(e) {
                    console.log('status render failure (status = ' + res.statusCode + ', body = ' + body + ')');
                    reject(e);
                }
            });
        });
    });
}

function customTrimmer(token) {
    if(TOKEN_WHITELIST.hasOwnProperty(token.toString().toUpperCase())) {
        return token;
    }

    return token.update((s) => s.replace(/^\W+/, '').replace(/\W+$/, ''));
}

async function s3GetObject(bucket, key) {
    let s3 = new AWS.S3({apiVersion: '2006-03-01'});

    return new Promise((resolve, reject) => {
        let params = {
            Bucket: bucket,
            Key: key,
        };

        s3.getObject(params, (err, data) => {
            if(err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

async function s3ListObjects(bucket, prefix): Promise<Array<any>> {
    let s3 = new AWS.S3({apiVersion: '2006-03-01'});

    return new Promise<Array<any>>((resolve, reject) => {
        let params = {
            Bucket: bucket,
            Prefix: prefix,
        };

        s3.listObjects(params, (err, data) => {
            if(err) {
                reject(err);
            } else {
                let keys = [];

                for(let item of data.Contents) {
                    keys.push(item.Key);
                }
                resolve(keys);
            }
        });
    });
}

async function s3Copy(bucket, sourceKey, destKey) {
    let s3 = new AWS.S3({apiVersion: '2006-03-01'});

    if(destKey.endsWith('/')) {
        let lastSlash = sourceKey.lastIndexOf('/');
        let filename = lastSlash != -1 ? sourceKey.substring(lastSlash + 1) : sourceKey;
        destKey += filename;
    }

    return new Promise((resolve, reject) => {
        let params = {
            Bucket: bucket,
            CopySource: '/' + bucket + '/' + sourceKey,
            ACL: 'public-read',
            Key: destKey,
        };

        s3.copyObject(params, (err, data) => {
            if(err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

async function uploadToS3(key, content) {
    console.log('Uploading ' + content.length + ' bytes to S3...');
    let s3 = new AWS.S3({apiVersion: '2006-03-01'});
    return new Promise((resolve, reject) => {
        s3.putObject({
            Bucket: 'twitter-reply-tracker',
            Key: key,
            ACL: 'public-read',
            ContentType: 'application/javascript',
            Body: content
        }, (err, data) => {
            if(err) {
                console.log('Error uploading: ' + err);
                reject(err);
            } else {
                console.log('Upload successful: ' + data);
                resolve(data);
            }
        });
    });
}

async function initS3DirIfNeeded(targetScreenName, targetStatusId) {
    try {
        await s3GetObject('twitter-reply-tracker', targetScreenName + '/' + targetStatusId + '/elm.js');
    } catch(e) {
        console.log('support files not found - copying from skeleton directory');
        let supportFiles = await s3ListObjects('twitter-reply-tracker', '__skel__');
        await Promise.all(supportFiles.filter((key) => !key.endsWith('/')).map((key) => s3Copy('twitter-reply-tracker', key, targetScreenName + '/' + targetStatusId + '/')));
    }
}

async function main(targetScreenName, targetStatusId) {
    let db = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    console.log('getting database items...');
    let results = await getTableItems(db, targetScreenName, targetStatusId, 'twitter_replies');
    console.log('# results: ' + results.Items.length);

    let documents = [];
    let documentHtml = [];
    let docId = 0;

    for(let item of results.Items) {
        if(item.status_id.S == 'latest_max_id' || item.status_id.S == 'quote_latest_max_id') {
            continue;
        }

        let id = docId++;

        if('html' in item) {
            documentHtml.push(item.html.S);
            documents.push(Promise.resolve({
                id: id,
                author: item.author.S,
                full_text: item.full_text.S
            }));
        } else {
            let statusUrl = 'https://twitter.com/' + item.author.S + '/status/' + item.status_id.S;
            documents.push(renderStatus(statusUrl).then((html) => {
                if(html == null) {
                    return;
                }
                return new Promise(function(resolve, _) {
                    db.updateItem({
                        TableName: 'twitter_replies',
                        Key: {
                            'screen_name_and_replied_to_status': item.screen_name_and_replied_to_status,
                            'status_id': item.status_id
                        },
                        UpdateExpression: 'set html = :h',
                        ExpressionAttributeValues: {
                            ':h': {
                                S: html
                            }
                        }
                    }, function(err, _) {
                        if(err) {
                            console.log('DynamoDB update error: ' + err);
                        }
                        documentHtml[id] = html;
                        resolve({
                            id: id,
                            author: item.author.S,
                            full_text: item.full_text.S
                        })
                    });
                });
            }));
            documentHtml.push(null);
        }
    }

    console.log('waiting for all documents to render...');
    documents = await Promise.all(documents);
    console.log('documents done rendering.');

    console.log('building index...');
    let index = lunr(function() {
        this.ref('id');
        this.field('author');
        this.field('full_text');

        this.pipeline.before(lunr.trimmer, customTrimmer);
        this.pipeline.remove(lunr.trimmer);

        for(let doc of documents) {
            if(doc == null) {
                continue;
            }
            this.add(doc);
        }
    });
    console.log('done building index.');
    let content = 'var savedHtml =\n' +
        JSON.stringify(documentHtml) + ';\n' +
        'var savedIndexData =\n' +
        JSON.stringify(index) + ';';

    await uploadToS3(targetScreenName + '/' + targetStatusId + '/saved-index.js', content);

    await initS3DirIfNeeded(targetScreenName, targetStatusId);
}

export
function handler(event, context, callback) {
    let promises = [];

    for(let record of event.Records) {
        let payload = JSON.parse(record.Sns.Message);

        if(payload.type == 'index') {
            console.log('refreshing index for ' + payload.screenName + '/' + payload.statusId);
            promises.push(main(payload.screenName, payload.statusId));
        } else {
            callback('Unrecognized request type: ' + payload.type);
        }
    }

    Promise.all(promises).then(
        (result) => callback(null, result),
        (err)    => callback(err));
}
