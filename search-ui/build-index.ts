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

let stdout = process.stdout;
let lunr = require('lunr');

AWS.config.update({
    region: process.env.AWS_REGION
});

async function getTableItems(db, tableName: string) : Promise<any> {
    return new Promise<any>((resolve, reject) => {
        db.scan({TableName: tableName}, (err, data) => {
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

async function main() {
    let db = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    let results = await getTableItems(db, 'reply_status_ids');

    let documents = [];
    let documentHtml = [];
    let docId = 0;

    for(let item of results.Items) {
        if(item.status_id.S != 'latest_max_id' && item.status_id.S != 'quote_latest_max_id') {
            let statusUrl = 'https://twitter.com/' + item.author.S + '/status/' + item.status_id.S;
            let id = docId++;
            documents.push(renderStatus(statusUrl).then((html) => { documentHtml[id] = html; return { id: id, author: item.author.S, full_text: item.full_text.S } }));
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
            this.add(doc);
        }
    });
    stdout.write('var savedHtml =\n');
    stdout.write(JSON.stringify(documentHtml) + ';\n');
    stdout.write('var savedIndexData =\n');
    stdout.write(JSON.stringify(index) + ';');
}

main().then((value) => {}, (err) => console.log(err));
