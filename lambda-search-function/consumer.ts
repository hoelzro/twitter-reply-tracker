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

require('trace');
require('clarify');

import { loadLastSinceId, insertIntoRepliesTable, updateLatestMaxId, performSearch } from './common';
import * as AWS from 'aws-sdk';

async function addReplies(context, targetScreenName, targetStatusId) {
    let db = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    let sinceId : string = await loadLastSinceId(db, targetScreenName, targetStatusId, 'latest_max_id');
    let outMaxId = { maxId : null};

    if(sinceId == null) {
        sinceId = targetStatusId;
    }

    let promises = [];

    for await (let status of performSearch(context, 'to:' + targetScreenName, targetStatusId, outMaxId)) {
        if(status.in_reply_to_status_id_str == targetStatusId) {
            promises.push(insertIntoRepliesTable(targetScreenName, targetStatusId, db, status));
        }
    }
    await Promise.all(promises); // XXX are you sure? don't you want to make sure the stuff you managed to get is written? do you always want to foolishly re-try?
    await updateLatestMaxId(db, targetScreenName, targetStatusId, outMaxId.maxId, 'latest_max_id');
}

async function addQuotedReplies(context, targetScreenName, targetStatusId) {
    let db = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    let sinceId : string = await loadLastSinceId(db, targetScreenName, targetStatusId, 'quote_latest_max_id');
    let outMaxId = { maxId : null};

    if(sinceId == null) {
        sinceId = targetStatusId;
    }

    let promises = [];

    for await (let status of performSearch(context, 'https://twitter.com/' + targetScreenName + '/status/' + targetStatusId, targetStatusId, outMaxId)) {
        if(status.quoted_status && status.quoted_status.id_str == targetStatusId) {
            promises.push(insertIntoRepliesTable(targetScreenName, targetStatusId, db, status));
        }
    }
    await Promise.all(promises); // XXX are you sure? don't you want to make sure the stuff you managed to get is written? do you always want to foolishly re-try?
    await updateLatestMaxId(db, targetScreenName, targetStatusId, outMaxId.maxId, 'quote_latest_max_id');
}

export
function handler(event, context, callback) {
    (Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol.for("Symbol.asyncIterator");

    for(let record of event.Records) {
        let payload = JSON.parse(record.Sns.Message);

        if(payload.type == 'replies') {
            console.log('adding replies for ' + payload.screenName + '/' + payload.statusId);
            addReplies(context, payload.screenName, payload.statusId).then(
                (result) => callback(null, result),
                (err)    => callback(err));
        } else if(payload.type == 'quoted-replies') {
            console.log('adding quoted replies for ' + payload.screenName + '/' + payload.statusId);
            addQuotedReplies(context, payload.screenName, payload.statusId).then(
                (result) => callback(null, result),
                (err)    => callback(err));
        } else {
            callback('Unrecognized request type: ' + payload.type);
        }
    }
}
