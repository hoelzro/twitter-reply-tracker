let lunr = require('lunr');
let process = require('process');
let stdout = process.stdout;
let AWS = require('aws-sdk');

AWS.config.update({
    region: process.env.AWS_REGION
});

let db = new AWS.DynamoDB({apiVersion: '2012-08-10'});
db.scan({TableName: 'reply_status_ids'}, (err, data) => {
    if(err) {
        console.warn(err, err.stack);
    } else {
        let index = lunr(function() {
            this.ref('url');
            this.field('author');
            this.field('full_text');

            for(let item of data.Items) {
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
});
