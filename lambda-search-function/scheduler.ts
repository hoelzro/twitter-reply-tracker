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

let targetTweets = [
    ['sehurlburt', '889004724669661184'], // For people who are in a position to give help: Post to your timeline every now & then that you're open to questions. That makes a difference
    ['sehurlburt', '899482493925023744'], // What are some hobbies you have that have no direct relation to your career? "Just for fun" things.
    ['b0rk',       '904699186238693376'], // what is your absolute favorite developer tool you use?
];

const WORK_STREAM = 'twitter-reply-work';

export
function handler(event, context, callback) {
    let kinesis = new AWS.Kinesis({ apiVersion: '2013-12-02' });

    let records = [];

    for(let [targetScreenName, targetStatusId] of targetTweets ) {
        for(let payloadType of ['replies', 'quoted-replies']) {
            let payload = {
                type: payloadType,
                screenName: targetScreenName,
                statusId: targetStatusId,
            };

            records.push({
                Data: JSON.stringify(payload),
                PartitionKey: '1',
            });
        }
    }

    kinesis.putRecords({
        StreamName: WORK_STREAM,
        Records: records,
    }, callback);
}
