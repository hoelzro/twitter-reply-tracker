// vim:sts=4 sw=4

import { Twitter } from 'twitter-node-client';
import * as process from 'process';

interface SearchResults {
}

async function performSearch(sinceId : string) : Promise<SearchResults> {
    return new Promise<SearchResults>(async function(resolve, reject) {
        let tw = new Twitter({
          consumerKey: process.env.TWITTER_CONSUMER_KEY,
          consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
          accessToken: process.env.TWITTER_ACCESS_TOKEN,
          accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
        });

        tw.getSearch({
            q: 'to:sehurlburt',
            count: 100,
            since_id: sinceId,
            tweet_mode: 'extended'
        }, reject, (results) => resolve(JSON.parse(results)));
    });
}

async function main() {
    const conversationStart = '889004724669661184';

    let results = await performSearch(conversationStart);

    console.log(results);
}

main();
