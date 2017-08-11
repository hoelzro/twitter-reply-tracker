// vim:sts=4 sw=4

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

async function main() {
    let db = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    let results = await getTableItems(db, 'reply_status_ids');
    let index = lunr(function() {
        this.ref('url');
        this.field('author');
        this.field('full_text');

        for(let item of results.Items) {
            if(item.status_id.S != 'latest_max_id') {
                this.add({
                    url: 'https://twitter.com/' + item.author.S + '/status/' + item.status_id.S,
                    author: item.author.S,
                    full_text: item.full_text.S
                });
            }
        }
    });
    stdout.write('var savedIndexData =\n');
    stdout.write(JSON.stringify(index) + ';');
}

main().then((value) => {}, (err) => console.log(err));
