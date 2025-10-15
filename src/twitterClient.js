import { TwitterApi } from 'twitter-api-v2';

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

export const tweet = async (msg) => {
  try {
    await twitterClient.v2.tweet(msg);
    console.log('Tweeted:', msg);
    return msg
  } catch (err) {
    console.error('Twitter error:', err);
  }
};

export default twitterClient;
