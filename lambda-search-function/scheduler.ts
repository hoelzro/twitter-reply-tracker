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

import * as AWS from 'aws-sdk';
import * as process from 'process';

async function publishEvent(topicARN, payload) {
    let sns = new AWS.SNS({ apiVersion: '2010-03-31' });

    return new Promise((resolve, reject) => {
        sns.publish({
            TopicArn: topicARN,
            Message: JSON.stringify(payload),
        }, (err, response) => {
            if(err != null) {
                return reject(err);
            }
            resolve(response);
        });
    });
}

async function getTargetTweets() {
    let db = new AWS.DynamoDB({apiVersion: '2012-08-10'});

    return new Promise<any>((resolve, reject) => {
        let params = {
            TableName: 'twitter_reply_subscriptions',
            FilterExpression: 'enabled = :enabled',
            ExpressionAttributeValues: {
                ':enabled': {
                    BOOL: true
                },
            }
        };

        db.scan(params, (err, data) => {
            if(err) {
                reject(err);
            } else {
                if('LastEvaluatedKey' in data) {
                    throw new Error("LastEvaluatedKey present in data - I don't know how to handle this!");
                }

                let targets = [];

                for(let item of data.Items) {
                    let screenNameAndRepliedToStatus = item.screen_name_and_replied_to_status.S;
                    targets.push(screenNameAndRepliedToStatus.split('/'));
                }
                resolve(targets);
            }
        });
    });
}

async function scheduleNewTweets() {
    let promises = [];

    for(let [targetScreenName, targetStatusId] of await getTargetTweets() ) {
        for(let payloadType of ['replies', 'quoted-replies']) {
            let payload = {
                type: payloadType,
                screenName: targetScreenName,
                statusId: targetStatusId,
            };

            promises.push(publishEvent(process.env.SNS_TOPIC_ARN_NEW_TWEETS, payload));
        }
    }

    return Promise.all(promises);
}

async function scheduleIndexes() {
    let promises = [];

    for(let [targetScreenName, targetStatusId] of await getTargetTweets() ) {
        let payload = {
            type: 'index',
            screenName: targetScreenName,
            statusId: targetStatusId,
        };

        promises.push(publishEvent(process.env.SNS_TOPIC_ARN_INDEXES, payload));
    }

    return Promise.all(promises);
}

export
function handler(event, context, callback) {
    if(event.type == 'new-tweets') {
        scheduleNewTweets().then(
            (response) => callback(null, true),
            (err) => callback(err));
    } else if(event.type == 'indexes') {
        scheduleIndexes().then(
            (response) => callback(null, true),
            (err) => callback(err));
    } else {
        throw new Error('Unknown schedule type: ' + event.type);
    }
}
