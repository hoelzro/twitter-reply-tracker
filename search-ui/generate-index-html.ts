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
import * as fs from 'fs';
import { argv, env, exit } from 'process';

import * as handlebars from 'handlebars';
import * as AWS from 'aws-sdk';
import * as Twitter from 'twitter';

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

let decryptedKeys = {};

async function kmsDecrypt(key : string) : Promise<string> {
    return new Promise<string>((resolve, reject) => {
        if(decryptedKeys.hasOwnProperty(key)) {
            resolve(decryptedKeys[key]);
        } else {
            if('AWS_LAMBDA_FUNCTION_NAME' in env) {
                let kms = new AWS.KMS();
                kms.decrypt({ CiphertextBlob: new Buffer(process.env[key], 'base64') }, (err, data) => {
                    if(err) {
                        reject(err);
                        return;
                    }
                    decryptedKeys[key] = (data.Plaintext as Buffer).toString('ascii');
                    resolve(decryptedKeys[key]);
                });
            } else {
                resolve(env[key]);
            }
        }
    });
}

async function getTwitterUser(screen_name) : Promise<any> {
    let tw = new Twitter({
      consumer_key: await kmsDecrypt('TWITTER_CONSUMER_KEY'),
      consumer_secret: await kmsDecrypt('TWITTER_CONSUMER_SECRET'),
      access_token_key: await kmsDecrypt('TWITTER_ACCESS_TOKEN'),
      access_token_secret: await kmsDecrypt('TWITTER_ACCESS_TOKEN_SECRET'),
    });

    return new Promise((resolve, reject) => {
        let params = {
            screen_name: screen_name,
        };

        tw.get('users/lookup', params, (error, users, response) => {
            if(error) {
                return reject(error);
            }
            if(users.length > 0) {
                resolve(users[0]);
            } else {
                resolve(null);
            }
        });
    });
}

async function main(screen_name, status_id) {
    let status_url = 'https://twitter.com/' + screen_name + '/status/' + status_id;

    let [ rendered_tweet, author ] = await Promise.all([
        renderStatus(status_url),
        getTwitterUser(screen_name),
    ]);

    let author_name = author.name;

    let templateSource = fs.readFileSync('index.html').toString('ascii');
    let template = handlebars.compile(templateSource);
    console.log(template({
      author_name: author_name,
      original_tweet: rendered_tweet,
    }));
}

if(argv.length < 4) {
    console.error('usage: ' + argv[1] + ' [screen name] [status ID]');
    exit(1);
}

let [_1, _2, screen_name, status_id] = argv;
main(screen_name, status_id).then(() => {}, (err) => console.warn(err));
