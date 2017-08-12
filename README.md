# Twitter Reply Tracker

This is a project that provides code meant to be run on AWS Lambda for tracking replies to a tweet, as well as searching those replies.

# Motivation

Writing this was inspired by the following tweet:

<blockquote class="twitter-tweet" data-conversation="none" data-lang="en"><p lang="en" dir="ltr">For people who are in a position to give help: Post to your timeline every now &amp; then that you&#39;re open to questions. That makes a difference</p>&mdash; Stephanie Hurlburt (@sehurlburt) <a href="https://twitter.com/sehurlburt/status/889004724669661184">July 23, 2017</a></blockquote>

I thought it was really great how Stephanie was using her clout to bring people together, but found it difficult to find people who had replied, volunteering their expertise.  So I wrote this!

# Deploying

If you're interested in modifying this code and deploying it for yourself, please raise an issue in the [issue tracker](https://github.com/hoelzro/twitter-reply-tracker/issues).

# Components

There are two pieces of this application - the [lambda code to refresh search replies](https://github.com/hoelzro/twitter-reply-tracker/tree/master/lambda-search-function), and the [search UI](https://github.com/hoelzro/twitter-reply-tracker/tree/master/search-ui).

# If You Replied...

...and don't see your reply on the search UI, please file an issue on the [issue tracker](https://github.com/hoelzro/twitter-reply-tracker/issues) and I'll work to remedy that.

# Room for Improvement

There's plenty of room for improvement in this application, namely:

  * It needs lots of documentation on how to deploy - I'll try to work on this first. =)
  * It needs better error handling.
  * It's not yet mobile friendly - this is partially UI, partially how heavy it is coming over the wire.
  * It's written in Elm, which isn't a problem in and of itself, but it results in heavier generated JS files, which impacts mobile users.
  * It's specific to Stephanie and her tweet - I would like to make the code more generic, as well as make multiple tweets' replies available on a single UI.
  * I would like the search UI to *not* allow new input while tweets are loading - I couldn't get something I liked working quickly, but I bet I could nail it given enough time.
