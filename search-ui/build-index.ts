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

        db.scan(params, (err, data) => {
            if(err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

async function renderStatus(statusUrl) {
    return new Promise((resolve, reject) => {
        https.get('https://publish.twitter.com/oembed?url=' + statusUrl + '&omit_script=true&hide_thread=true', (res) => {
            if(res.statusCode == 404) {
                return resolve(null);
            }

            // XXX handle failure
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk });
            res.on('end', () => {
                resolve(JSON.parse(body).html);
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

async function uploadToS3(key, content) {
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
                console.warn(err);
            } else {
                console.log(data);
            }
        });
    });
}

async function main(targetScreenName, targetStatusId) {
    let db = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    let results = await getTableItems(db, targetScreenName, targetStatusId, 'twitter_replies');

    let documents = [];
    let documentHtml = [];
    let docId = 0;

    for(let item of results.Items) {
        if(item.status_id.S != 'latest_max_id' && item.status_id.S != 'quote_latest_max_id') {
            let statusUrl = 'https://twitter.com/' + item.author.S + '/status/' + item.status_id.S;
            let id = docId++;
            documents.push(renderStatus(statusUrl).then((html) => { if(html == null) { return; } documentHtml[id] = html; return { id: id, author: item.author.S, full_text: item.full_text.S } }));
            documentHtml.push(null);
        }
    }

    documents = await Promise.all(documents);

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
    let content = 'var savedHtml =\n' +
        JSON.stringify(documentHtml) + ';\n' +
        'var savedIndexData =\n' +
        JSON.stringify(index) + ';';

    return await uploadToS3(targetScreenName + '/' + targetStatusId + '/saved-index.js', content);

}

export
function handler(context, event, callback) {
    main(process.env.TARGET_SCREEN_NAME, process.env.TARGET_STATUS_ID).then(
        (result) => callback(null, result),
        (err)    => callback(err));
}
