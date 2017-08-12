// vim:sts=4 sw=4

import * as https from 'https';
import * as process from 'process';
import * as AWS from 'aws-sdk';

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

async function main() {
    let db = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    let results = await getTableItems(db, 'reply_status_ids');

    let documents = [];
    let documentHtml = [];
    let docId = 0;

    for(let item of results.Items) {
        if(item.status_id.S != 'latest_max_id') {
            let statusUrl = 'https://twitter.com/' + item.author.S + '/status/' + item.status_id.S;
            let id = docId++;
            documents.push(renderStatus(statusUrl).then((html) => { documentHtml[id] = html; return { id: id, author: item.author.S, full_text: item.full_text.S } }));
            documentHtml.push(null);
        }
    }

    documents = await Promise.all(documents);

    let builder = new lunr.Builder();

    builder.pipeline.add(
        lunr.trimmer,
        lunr.stopWordFilter,
        lunr.stemmer
    );

    builder.searchPipeline.add(
        lunr.stemmer
    );

    builder.ref('id');
    builder.field('author');
    builder.field('full_text');

    for(let doc of documents) {
        builder.add(doc);
    }

    let index = builder.build();

    stdout.write('var savedHtml =\n');
    stdout.write(JSON.stringify(documentHtml) + ';\n');
    stdout.write('var savedIndexData =\n');
    stdout.write(JSON.stringify(index) + ';');
}

main().then((value) => {}, (err) => console.log(err));
