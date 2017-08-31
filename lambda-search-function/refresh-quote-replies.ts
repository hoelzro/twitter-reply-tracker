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

import { loadLastSinceId, insertIntoRepliesTable, updateLatestMaxId, performSearch } from './common';
import * as AWS from 'aws-sdk';
import * as process from 'process';

async function main(targetScreenName, targetStatusId) {
    (Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol.for("Symbol.asyncIterator");

    if('AWS_REGION' in process.env) {
        AWS.config.update({
            region: process.env.AWS_REGION
        });
    }

    let db = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    let sinceId : string = await loadLastSinceId(db, targetScreenName, targetStatusId, 'quote_latest_max_id');
    let outMaxId = { maxId : null};

    if(sinceId == null) {
        sinceId = targetStatusId;
    }

    for await (let status of performSearch('https://twitter.com/' + targetScreenName + '/status/' + targetStatusId, targetStatusId, outMaxId)) {
        if(status.quoted_status && status.quoted_status.id_str == targetStatusId) {
            insertIntoRepliesTable(targetScreenName, targetStatusId, db, status);
        }
    }
    await updateLatestMaxId(db, targetScreenName, targetStatusId, outMaxId.maxId, 'quote_latest_max_id');
}

export
function handler(event, context, callback) {
    let targetScreenName = process.env.TARGET_SCREEN_NAME;
    let targetStatusId = process.env.TARGET_STATUS_ID;

    main(targetScreenName, targetStatusId).then(
        (result) => callback(null, result),
        (err)    => callback(err));
}
