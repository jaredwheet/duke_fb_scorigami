import { TwitterApi } from 'twitter-api-v2';

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function publishTweet(payload, msg) {
  const result = await twitterClient.v2.tweet(payload);
  console.log('Tweeted:', msg);
  const tweetId = result?.data?.id;
  if (!tweetId) throw new Error('Twitter API returned no tweet ID');
  console.log(`Tweet URL: https://x.com/i/web/status/${tweetId}`);
  return tweetId;
}

export const tweet = async (msg, inReplyToTweetId = null) => {
  try {
    const payload = { text: msg };
    if (inReplyToTweetId) {
      payload.reply = { in_reply_to_tweet_id: inReplyToTweetId };
    }
    return await publishTweet(payload, msg);
  } catch (err) {
    console.error('Twitter error:', err);
    throw err;
  }
};

export const uploadImage = async (imageBuffer) => {
  try {
    return await twitterClient.v1.uploadMedia(imageBuffer, { type: 'png' });
  } catch (err) {
    console.error('Twitter media upload error:', err);
    throw err;
  }
};

export const tweetWithMedia = async (msg, mediaId) => {
  try {
    return await publishTweet({
      text: msg,
      media: { media_ids: [mediaId] },
    }, msg);
  } catch (err) {
    console.error('Twitter media tweet error:', err);
    throw err;
  }
};

export default twitterClient;
